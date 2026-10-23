/** @jest-environment node */
/**
 * The shared contact check (src/lib/contact-policy), unit level: hours and their exact
 * boundaries on a fixed clock, the opt-out list, the 30-day cap counted across paths,
 * the D4 emergency band, a teacher with no school, the ledger's idempotency, and
 * failing closed.
 */

import { checkContact, clearanceFor, contactHours, contactHoursVerdict, type ContactPolicyStore } from '@/lib/contact-policy';
import { FREQUENCY_CAP, FREQUENCY_WINDOW_MS } from '@/lib/sampark/policy/gate';
import { hashPhone } from '@/lib/sampark/phone';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SamparkCall, Suppression } from '@/types/sampark';

const ORG = 'hillview-demo';
const PARENT = '+919812345678';

beforeAll(() => {
    process.env.SAMPARK_PII_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.SAMPARK_PHONE_PEPPER = 'test-pepper';
});

/** An instant as IST wall clock on Wednesday 7 Oct 2026. */
const ist = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 7, hour - 5, minute - 30));

function suppression(overrides: Partial<Suppression> = {}): Suppression {
    return {
        orgId: ORG, phoneHash: hashPhone(PARENT), phoneLast4: '5678', scope: 'routine', source: 'keypad',
        officeVerification: 'pending', createdAt: ist(11).toISOString(), callId: 'c1', ...overrides,
    } as Suppression;
}

function samparkCall(id: string, at: Date, overrides: Partial<SamparkCall> = {}): SamparkCall {
    return {
        id, orgId: ORG, intentId: `i-${id}`, campaignId: 'camp', purpose: 'ptm_invite', guardianId: 'g1',
        phoneHash: hashPhone(PARENT), phoneLast4: '5678', destination: 'guardian', language: 'Hindi', variant: 'default',
        attempt: 1, state: 'completed', leaseUntil: null, carrier: 'vobiz', providerCallId: null,
        outcome: { heard: 'full', digits: '', confirmed: false, declined: false, optOut: 'none' },
        durationSeconds: 40, billedSeconds: 60, costPaise: null, audioSeconds: 40,
        createdAt: at.toISOString(), updatedAt: at.toISOString(), endedAt: at.toISOString(), failureReason: null, settledAt: at.toISOString(),
        ...overrides,
    } as SamparkCall;
}

async function repoWith(opts: { suppression?: Suppression; samparkCalls?: SamparkCall[]; teacherCalls?: Date[] } = {}) {
    const repo = createMemorySamparkRepo();
    if (opts.suppression) await repo.upsertSuppression(opts.suppression);
    for (const c of opts.samparkCalls ?? []) {
        await repo.createIntentIfAbsent({ id: c.intentId, orgId: ORG, status: 'approved', notBefore: null, attempts: 0, maxAttempts: 3 } as never);
        // Calls enter the repo only through the claim (state 'dialing'); then they end.
        expect(await repo.claimIntentForDial(ORG, c.intentId, { ...c, state: 'dialing' }, new Date(c.createdAt))).toBe('claimed');
        await repo.updateCall(ORG, c.id, { state: c.state });
    }
    for (const [i, at] of (opts.teacherCalls ?? []).entries()) {
        await repo.recordContact({ id: `teacher_o${i}`, orgId: ORG, phoneHash: hashPhone(PARENT), kind: 'routine', source: 'teacher', at: at.toISOString() });
    }
    return repo;
}

const check = (store: ContactPolicyStore, at: Date, opts: { orgId?: string | null; kind?: 'routine' | 'emergency' } = {}) =>
    checkContact({ orgId: opts.orgId === undefined ? ORG : opts.orgId, phone: { e164: PARENT }, kind: opts.kind ?? 'routine', at }, store);

describe('hours (decision 2): routine 10:00–19:00 IST, emergency closure 06:00–21:00 IST', () => {
    it('the bands come from routine-hours.ts and window.ts', () => {
        expect(contactHours('routine')).toEqual({ startHour: 10, endHour: 19 });
        expect(contactHours('emergency')).toEqual({ startHour: 6, endHour: 21 });
    });

    it.each([
        [9, 59, false], [10, 0, true], [13, 30, true], [18, 59, true], [19, 0, false], [19, 5, false], [23, 0, false], [2, 0, false],
    ])('routine at %i:%i IST → allowed=%s (start inclusive, end exclusive)', async (h, m, allowed) => {
        const d = await check(await repoWith(), ist(h, m));
        expect(d.allowed).toBe(allowed);
        if (!d.allowed) expect(d.reason).toBe('outside_hours');
    });

    it('19:05 IST is outside_hours and says when calling reopens (10:00 IST next day)', async () => {
        const d = await check(await repoWith(), ist(19, 5));
        expect(d).toMatchObject({ allowed: false, reason: 'outside_hours' });
        if (!d.allowed) expect(d.nextAllowedAt!.toISOString()).toBe(new Date(Date.UTC(2026, 9, 8, 4, 30)).toISOString());
    });

    it('is the same verdict whatever the process time zone', () => {
        const original = process.env.TZ;
        const verdicts = ['UTC', 'America/New_York', 'Asia/Kolkata'].map((tz) => {
            process.env.TZ = tz;
            return contactHoursVerdict('routine', ist(19, 5)).allowed;
        });
        process.env.TZ = original;
        expect(verdicts).toEqual([false, false, false]);
    });

    it.each([[5, 59, false], [6, 0, true], [19, 30, true], [20, 59, true], [21, 0, false]])('emergency at %i:%i IST → allowed=%s', async (h, m, allowed) => {
        expect((await check(await repoWith(), ist(h, m), { kind: 'emergency' })).allowed).toBe(allowed);
    });
});

describe('opted_out: the school\'s suppression list', () => {
    it('a routine suppression (keypad 9) blocks a routine call', async () => {
        expect(await check(await repoWith({ suppression: suppression() }), ist(11))).toMatchObject({ allowed: false, reason: 'opted_out' });
    });

    it('opted_out wins over the cap and the hours (gate order)', async () => {
        const repo = await repoWith({ suppression: suppression(), teacherCalls: [ist(10), ist(10, 1), ist(10, 2), ist(10, 3)] });
        expect(await check(repo, ist(19, 5))).toMatchObject({ allowed: false, reason: 'opted_out' });
    });

    it('a routine suppression does not stop an emergency closure; a scope-all one does; a reversed one stops nothing', async () => {
        expect((await check(await repoWith({ suppression: suppression() }), ist(11), { kind: 'emergency' })).allowed).toBe(true);
        expect(await check(await repoWith({ suppression: suppression({ scope: 'all' }) }), ist(11), { kind: 'emergency' }))
            .toMatchObject({ allowed: false, reason: 'opted_out' });
        expect((await check(await repoWith({ suppression: suppression({ officeVerification: 'reversed' }) }), ist(11))).allowed).toBe(true);
    });

    it('another school\'s suppression does not apply; a teacher with no school has no school list', async () => {
        const repo = await repoWith({ suppression: suppression() });
        expect((await check(repo, ist(11), { orgId: 'other-school' })).allowed).toBe(true);
        expect((await check(repo, ist(11), { orgId: null })).allowed).toBe(true);
    });
});

describe('frequency_cap: at most 4 routine calls per number in 30 days, every path counted', () => {
    it(`${FREQUENCY_CAP} earlier calls mixed across Sampark and teachers → the next is frequency_cap`, async () => {
        const repo = await repoWith({ samparkCalls: [samparkCall('c1', ist(10)), samparkCall('c2', ist(10, 5))], teacherCalls: [ist(10, 10), ist(10, 15)] });
        expect(await check(repo, ist(11))).toMatchObject({ allowed: false, reason: 'frequency_cap' });
    });

    it('three earlier calls → the fourth is allowed', async () => {
        const repo = await repoWith({ samparkCalls: [samparkCall('c1', ist(10))], teacherCalls: [ist(10, 10), ist(10, 15)] });
        expect((await check(repo, ist(11))).allowed).toBe(true);
    });

    it('calls older than 30 days, simulated (Practice) calls and emergency calls do not count', async () => {
        const old = new Date(ist(11).getTime() - FREQUENCY_WINDOW_MS - 60_000);
        const repo = await repoWith({
            samparkCalls: [
                samparkCall('c1', ist(10), { carrier: 'simulated' }),
                samparkCall('c2', ist(10, 1), { purpose: 'emergency_closure' }),
                samparkCall('c3', old),
            ],
            teacherCalls: [old, ist(10, 2), ist(10, 3)],
        });
        expect((await check(repo, ist(11))).allowed).toBe(true);
    });

    it('a teacher with no school: the per-number cap still applies (ledger, every school and none)', async () => {
        const repo = await repoWith({ teacherCalls: [ist(10), ist(10, 1), ist(10, 2), ist(10, 3)] });
        expect(await check(repo, ist(11), { orgId: null })).toMatchObject({ allowed: false, reason: 'frequency_cap' });
    });

    it('the cap never applies to an emergency closure', async () => {
        const repo = await repoWith({ teacherCalls: [ist(10), ist(10, 1), ist(10, 2), ist(10, 3)] });
        expect((await check(repo, ist(11), { kind: 'emergency' })).allowed).toBe(true);
    });

    it('a precounted total (Sampark\'s dispatcher) replaces the store\'s count', async () => {
        const repo = await repoWith();
        const at = ist(11);
        expect(await checkContact({ orgId: ORG, phone: { hash: hashPhone(PARENT) }, kind: 'routine', at, routineContactsInWindow: 4 }, repo))
            .toMatchObject({ allowed: false, reason: 'frequency_cap' });
    });
});

describe('the ledger: one entry per placed call', () => {
    it('recording the same id twice counts once', async () => {
        const repo = createMemorySamparkRepo();
        const entry = { id: 'teacher_o1', orgId: ORG, phoneHash: hashPhone(PARENT), kind: 'routine' as const, source: 'teacher' as const, at: ist(11).toISOString() };
        expect(await repo.recordContact(entry)).toBe(true);
        expect(await repo.recordContact({ ...entry, at: ist(12).toISOString() })).toBe(false);
        expect(await repo.countContactsToPhoneSince(hashPhone(PARENT), ist(0), 'routine')).toBe(1);
    });
});

describe('fails closed', () => {
    const brokenStore = (): ContactPolicyStore => ({
        getSuppression: async () => { throw new Error('UNAVAILABLE'); },
        countCallsToPhoneSince: async () => 0,
        countContactsToPhoneSince: async () => 0,
        recordContact: async () => true,
    });

    it('a store failure → policy_unavailable, never allowed', async () => {
        expect(await check(brokenStore(), ist(11))).toMatchObject({ allowed: false, reason: 'policy_unavailable' });
    });

    it('a count that is not a number → policy_unavailable', async () => {
        const store = { ...brokenStore(), getSuppression: async () => null, countContactsToPhoneSince: async () => NaN };
        expect(await check(store, ist(11))).toMatchObject({ allowed: false, reason: 'policy_unavailable' });
    });

    it('no phone pepper configured → policy_unavailable', async () => {
        const pepper = process.env.SAMPARK_PHONE_PEPPER;
        delete process.env.SAMPARK_PHONE_PEPPER;
        try {
            expect(await check(await repoWith(), ist(11))).toMatchObject({ allowed: false, reason: 'policy_unavailable' });
        } finally {
            process.env.SAMPARK_PHONE_PEPPER = pepper;
        }
    });

    it('a number that cannot be normalised → policy_unavailable', async () => {
        expect(await checkContact({ orgId: ORG, phone: { e164: 'not a phone' }, kind: 'routine', at: ist(11) }, await repoWith()))
            .toMatchObject({ allowed: false, reason: 'policy_unavailable' });
    });

    it('a clearance exists only for an allowed decision', async () => {
        const input = { orgId: ORG, kind: 'routine' as const, at: ist(11) };
        expect(clearanceFor(input, await check(await repoWith(), ist(11)))).toMatchObject({ orgId: ORG, phoneHash: hashPhone(PARENT) });
        expect(clearanceFor(input, await check(await repoWith(), ist(19, 5)))).toBeNull();
    });
});
