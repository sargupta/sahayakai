/** @jest-environment node */
/**
 * Phase 2a, stream U (contract §5): the school's test phone and Test mode.
 *
 *   - A test phone is an Indian MOBILE only: normalised, stored as ciphertext +
 *     peppered hash + last four, and never echoed — not in the school view, not
 *     in the overview, not in the audit trail.
 *   - Test mode needs this deployment to be able to place real calls
 *     (`liveDialBlocker() === null`) AND a saved phone; Live is always refused.
 *   - Removing (or changing) the phone while in Test mode drops the school back
 *     to Practice, so Test is only ever on for the number the admin confirmed.
 *   - The call log says whose phone rang (`destination`); pre-2a records read
 *     as guardian calls.
 */

import { decryptPhone, hashPhone } from '@/lib/sampark/phone';
import type { AuditEntry } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { listCallLog } from '@/server/sampark/calls';
import type { SamparkCtx } from '@/server/sampark/http';
import { getOverview } from '@/server/sampark/overview';
import { enableSchool, schoolView, setSchoolMode, updateSchool } from '@/server/sampark/school';
import type { Intent, SamparkCall, SamparkSchool } from '@/types/sampark';

import { ADMIN, MON_11_IST, ORG, recordingRepo, setPhoneEnv, testClock } from './_helpers';

const MOBILE_E164 = '+919876543210';
const MOBILE_DIGITS = '9876543210';
const OTHER_E164 = '+917000011223';

/** Everything liveDialBlocker() needs for a deployment that can place real calls. */
const LIVE_ENV: Record<string, string> = {
    SAMPARK_LIVE_DIAL_ENABLED: 'true',
    SAMPARK_PUBLIC_BASE_URL: 'https://example.test',
    VOBIZ_AUTH_ID: 'test-auth-id',
    VOBIZ_AUTH_TOKEN: 'test-auth-token',
    VOBIZ_FROM_NUMBER: '+918000000001',
};
const ENV_KEYS = [...Object.keys(LIVE_ENV), 'VOBIZ_BASE_URL'];
const savedEnv: Record<string, string | undefined> = {};

function setEnv(values: Record<string, string | undefined>): void {
    for (const [k, v] of Object.entries(values)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
}

beforeAll(() => {
    setPhoneEnv();
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});
beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
});
afterAll(() => setEnv(savedEnv));

async function setup() {
    const repo = recordingRepo(createMemorySamparkRepo());
    const ctx: SamparkCtx = { repo, clock: testClock(MON_11_IST) };
    // The Hillview demo org: Test mode is allowed on a demo school, because the
    // number dialled is the verified test phone, never a synthetic guardian.
    await enableSchool(ctx, ORG, ADMIN, { displayName: 'Hillview Demo School', isDemo: true });
    return { repo, ctx };
}

type Env = Awaited<ReturnType<typeof setup>>;

function audits(env: Env): AuditEntry[] {
    return env.repo.writes.filter((w) => w.method === 'appendAudit').map((w) => w.args[1] as AuditEntry);
}

function modeAudits(env: Env): AuditEntry[] {
    return audits(env).filter((a) => a.action === 'school.mode');
}

async function stored(env: Env): Promise<SamparkSchool> {
    return (await env.repo.getSchool(ORG))!;
}

/** A school in Test mode with MOBILE_E164 saved. */
async function inTestMode(): Promise<Env> {
    const env = await setup();
    setEnv(LIVE_ENV);
    await updateSchool(env.ctx, ORG, ADMIN, { testPhone: '98765 43210' });
    await setSchoolMode(env.ctx, ORG, ADMIN, 'test');
    expect((await stored(env)).mode).toBe('test');
    return env;
}

// ── Test phone ──────────────────────────────────────────────────────────────

describe('test phone (PUT school { testPhone })', () => {
    it.each(['98765 43210', '+91 98765-43210', '09876543210', '919876543210', '(+91) 98765 43210'])(
        'normalises %p, stores ciphertext + peppered hash + last four, and never echoes the number',
        async (typed) => {
            const env = await setup();
            const result = await updateSchool(env.ctx, ORG, ADMIN, { testPhone: typed });

            const s = await stored(env);
            expect(decryptPhone(s.testPhoneEnc!)).toBe(MOBILE_E164);
            expect(s.testPhoneEnc).not.toContain(MOBILE_DIGITS);
            expect(s.testPhoneHash).toBe(hashPhone(MOBILE_E164));
            expect(s.testPhoneLast4).toBe('3210');
            expect(s.mode).toBe('practice');

            // What the console receives: last four only.
            const view = schoolView(result);
            expect(view.testPhoneLast4).toBe('3210');
            expect(view).not.toHaveProperty('testPhoneEnc');
            expect(view).not.toHaveProperty('testPhoneHash');
            expect(JSON.stringify(view)).not.toContain(MOBILE_DIGITS);

            // The audit trail names the field and the last four, never the number.
            const update = audits(env).find((a) => a.action === 'school.update');
            expect(update?.detail).toEqual({ fields: ['testPhone'], testPhoneLast4: '3210' });
            expect(JSON.stringify(audits(env))).not.toContain(MOBILE_DIGITS);
        },
    );

    it.each([
        ['a Kolkata landline', '+91 33 2222 3333'],
        ['a Siliguri landline with the trunk prefix', '0353 2222333'],
        ['a synthetic demo number', '+915123456789'],
        ['a bare synthetic number', '5123456789'],
        ['a foreign mobile', '+1 415 555 2671'],
        ['a number one digit short', '+91 98765 4321'],
        ['too few digits', '12345'],
        ['words', 'not a phone'],
    ])('refuses %s with 400 TEST_PHONE_INVALID and saves nothing', async (_label, typed) => {
        const env = await setup();
        const writesBefore = env.repo.writes.length;
        const err = await updateSchool(env.ctx, ORG, ADMIN, { testPhone: typed }).then(
            () => null,
            (e: unknown) => e as { code: string; status: number; message: string },
        );
        expect(err).toMatchObject({ code: 'TEST_PHONE_INVALID', status: 400 });
        expect(err!.message).not.toMatch(/\d{5,}/); // the message never repeats what was typed
        expect(env.repo.writes.length).toBe(writesBefore);
        const s = await stored(env);
        expect(s.testPhoneEnc ?? null).toBeNull();
        expect(s.testPhoneHash ?? null).toBeNull();
        expect(s.testPhoneLast4 ?? null).toBeNull();
    });

    it('removing the phone clears all three fields; in Practice the mode is untouched', async () => {
        const env = await setup();
        await updateSchool(env.ctx, ORG, ADMIN, { testPhone: MOBILE_E164 });
        const result = await updateSchool(env.ctx, ORG, ADMIN, { testPhone: null });
        expect(result).toMatchObject({ mode: 'practice', testPhoneEnc: null, testPhoneHash: null, testPhoneLast4: null });
        expect(await stored(env)).toMatchObject({ testPhoneEnc: null, testPhoneHash: null, testPhoneLast4: null });
        expect(modeAudits(env)).toEqual([]);
    });

    it('removing the phone while in Test mode returns the school to Practice, audited', async () => {
        const env = await inTestMode();
        const result = await updateSchool(env.ctx, ORG, ADMIN, { testPhone: null });
        expect(result).toMatchObject({ mode: 'practice', testPhoneEnc: null, testPhoneHash: null, testPhoneLast4: null });
        expect((await stored(env)).mode).toBe('practice');
        expect(modeAudits(env).at(-1)).toMatchObject({
            actor: ADMIN,
            target: `school/${ORG}`,
            detail: { from: 'test', to: 'practice', reason: 'test_phone_removed' },
        });
    });

    it('changing the number while in Test mode returns the school to Practice; re-saving the same number does not', async () => {
        const env = await inTestMode();
        const encBefore = (await stored(env)).testPhoneEnc;

        const same = await updateSchool(env.ctx, ORG, ADMIN, { testPhone: '+91 98765 43210' });
        expect(same.mode).toBe('test');
        expect(same.testPhoneEnc).toBe(encBefore); // unchanged ciphertext, no churn

        const changed = await updateSchool(env.ctx, ORG, ADMIN, { testPhone: OTHER_E164 });
        expect(changed).toMatchObject({ mode: 'practice', testPhoneLast4: '1223', testPhoneHash: hashPhone(OTHER_E164) });
        expect(decryptPhone(changed.testPhoneEnc!)).toBe(OTHER_E164);
        expect(modeAudits(env).at(-1)).toMatchObject({ detail: { from: 'test', to: 'practice', reason: 'test_phone_changed' } });
        expect(JSON.stringify(audits(env))).not.toMatch(/9876543210|7000011223/);
    });
});

// ── Mode ────────────────────────────────────────────────────────────────────

describe('mode (PUT mode)', () => {
    it('practice is always allowed; asking for the current mode changes nothing', async () => {
        const env = await setup();
        const before = env.repo.writes.length;
        expect((await setSchoolMode(env.ctx, ORG, ADMIN, 'practice')).mode).toBe('practice');
        expect(env.repo.writes.length).toBe(before);
    });

    it.each([
        ['LIVE_DIAL_DISABLED', 'the live-dial flag is unset', {}],
        ['LIVE_DIAL_DISABLED', 'the live-dial flag is not exactly "true"', { ...LIVE_ENV, SAMPARK_LIVE_DIAL_ENABLED: '1' }],
        ['PUBLIC_BASE_URL_MISSING', 'there is no public base URL', { ...LIVE_ENV, SAMPARK_PUBLIC_BASE_URL: undefined }],
        ['PUBLIC_BASE_URL_MISSING', 'the public base URL is not https', { ...LIVE_ENV, SAMPARK_PUBLIC_BASE_URL: 'http://example.test' }],
        ['CARRIER_UNCONFIGURED', 'the carrier is not configured', { ...LIVE_ENV, VOBIZ_AUTH_TOKEN: undefined }],
    ] as const)('test is refused 409 %s when %s, even with a phone saved', async (code, _label, values) => {
        const env = await setup();
        await updateSchool(env.ctx, ORG, ADMIN, { testPhone: MOBILE_E164 });
        setEnv(values as Record<string, string | undefined>);
        await expect(setSchoolMode(env.ctx, ORG, ADMIN, 'test')).rejects.toMatchObject({ code, status: 409 });
        expect((await stored(env)).mode).toBe('practice');
        expect(modeAudits(env)).toEqual([]);
    });

    it('test is refused 409 TEST_PHONE_MISSING without a saved phone, even when the deployment can dial', async () => {
        const env = await setup();
        setEnv(LIVE_ENV);
        await expect(setSchoolMode(env.ctx, ORG, ADMIN, 'test')).rejects.toMatchObject({ code: 'TEST_PHONE_MISSING', status: 409 });
        expect((await stored(env)).mode).toBe('practice');
    });

    it('test succeeds with the deployment configured and a phone saved; every change is audited with the last four only', async () => {
        const env = await setup();
        await updateSchool(env.ctx, ORG, ADMIN, { testPhone: MOBILE_E164 });
        setEnv(LIVE_ENV);

        const test = await setSchoolMode(env.ctx, ORG, ADMIN, 'test');
        expect(test.mode).toBe('test');
        expect((await stored(env)).mode).toBe('test');
        expect(modeAudits(env)).toEqual([
            expect.objectContaining({ actor: ADMIN, target: `school/${ORG}`, detail: { from: 'practice', to: 'test', testPhoneLast4: '3210' } }),
        ]);

        // Idempotent: asking again changes nothing and writes no second audit.
        await setSchoolMode(env.ctx, ORG, ADMIN, 'test');
        expect(modeAudits(env)).toHaveLength(1);

        const back = await setSchoolMode(env.ctx, ORG, ADMIN, 'practice');
        expect(back.mode).toBe('practice');
        expect(modeAudits(env).at(-1)?.detail).toEqual({ from: 'test', to: 'practice' });
        expect(JSON.stringify(audits(env))).not.toContain(MOBILE_DIGITS);
    });

    it('live is always 409 LIVE_MODE_NOT_AVAILABLE — from practice or test, with or without the deployment configured', async () => {
        const env = await setup();
        await expect(setSchoolMode(env.ctx, ORG, ADMIN, 'live')).rejects.toMatchObject({ code: 'LIVE_MODE_NOT_AVAILABLE', status: 409 });
        setEnv(LIVE_ENV);
        await updateSchool(env.ctx, ORG, ADMIN, { testPhone: MOBILE_E164 });
        await expect(setSchoolMode(env.ctx, ORG, ADMIN, 'live')).rejects.toMatchObject({ code: 'LIVE_MODE_NOT_AVAILABLE' });
        await setSchoolMode(env.ctx, ORG, ADMIN, 'test');
        await expect(setSchoolMode(env.ctx, ORG, ADMIN, 'live')).rejects.toMatchObject({ code: 'LIVE_MODE_NOT_AVAILABLE' });
        expect((await stored(env)).mode).toBe('test');
        expect(modeAudits(env).every((a) => (a.detail as { to: string }).to !== 'live')).toBe(true);
    });
});

// ── What the console reads ──────────────────────────────────────────────────

describe('overview and school view', () => {
    it('overview.school.liveDialAvailable follows liveDialBlocker(); testPhoneLast4 is the only phone detail', async () => {
        const env = await setup();
        let o = await getOverview(env.ctx, ORG);
        expect(o.school).toMatchObject({ liveDialAvailable: false, testPhoneLast4: null });

        await updateSchool(env.ctx, ORG, ADMIN, { testPhone: MOBILE_E164 });
        setEnv(LIVE_ENV);
        o = await getOverview(env.ctx, ORG);
        expect(o.school).toMatchObject({ liveDialAvailable: true, testPhoneLast4: '3210' });
        expect(o.school).not.toHaveProperty('testPhoneEnc');
        expect(o.school).not.toHaveProperty('testPhoneHash');
        expect(JSON.stringify(o)).not.toContain(MOBILE_DIGITS);

        setEnv({ SAMPARK_PUBLIC_BASE_URL: 'https://example.test/some/path' });
        expect((await getOverview(env.ctx, ORG)).school.liveDialAvailable).toBe(false);
    });

    it('schoolView drops the ciphertext and hash and reports whether, and why not, Test mode is possible here', async () => {
        const env = await setup();
        await updateSchool(env.ctx, ORG, ADMIN, { testPhone: MOBILE_E164 });
        const raw = await stored(env);

        const dark = schoolView(raw);
        expect(dark).toMatchObject({ testPhoneLast4: '3210', liveDialAvailable: false, liveDialBlocker: 'LIVE_DIAL_DISABLED' });
        expect(Object.keys(dark)).not.toEqual(expect.arrayContaining(['testPhoneEnc']));
        expect(Object.keys(dark)).not.toEqual(expect.arrayContaining(['testPhoneHash']));

        setEnv(LIVE_ENV);
        expect(schoolView(raw)).toMatchObject({ liveDialAvailable: true, liveDialBlocker: null });
        expect(schoolView({ ...raw, testPhoneLast4: undefined }).testPhoneLast4).toBeNull();
    });
});

// ── Call log ────────────────────────────────────────────────────────────────

describe('call log destination', () => {
    const at = MON_11_IST.toISOString();

    function intent(id: string): Intent {
        return {
            id,
            dedupeKey: `test:${id}`,
            orgId: ORG,
            campaignId: 'c1',
            purpose: 'ptm_invite',
            guardianId: `g-${id}`,
            studentIds: [],
            language: 'Hindi',
            status: 'approved',
            blockReason: null,
            attempts: 0,
            maxAttempts: 2,
            notBefore: null,
            expiresAt: '2026-10-10T00:00:00.000Z',
            lastCallId: null,
            createdAt: at,
            updatedAt: at,
        };
    }

    function call(intentId: string, destination: SamparkCall['destination'] | 'absent'): SamparkCall {
        const c: SamparkCall = {
            id: `call-${intentId}`,
            orgId: ORG,
            intentId,
            campaignId: 'c1',
            purpose: 'ptm_invite',
            guardianId: `g-${intentId}`,
            phoneHash: 'hash',
            phoneLast4: '3210',
            language: 'Hindi',
            variant: 'default',
            attempt: 1,
            state: 'dialing',
            leaseUntil: '2026-10-05T06:00:00.000Z',
            carrier: 'vobiz',
            providerCallId: null,
            outcome: { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' },
            durationSeconds: null,
            billedSeconds: null,
            costPaise: null,
            audioSeconds: null,
            createdAt: at,
            updatedAt: at,
            endedAt: null,
            failureReason: null,
        };
        if (destination !== 'absent') c.destination = destination;
        return c;
    }

    it('each entry says whose phone rang; a record written before phase 2a reads as a guardian call', async () => {
        const env = await setup();
        const cases = [
            ['i-test', 'test_phone'],
            ['i-guardian', 'guardian'],
            ['i-legacy', 'absent'],
        ] as const;
        for (const [id, destination] of cases) {
            await env.repo.createIntentIfAbsent(intent(id));
            expect(await env.repo.claimIntentForDial(ORG, id, call(id, destination), MON_11_IST)).not.toBe('not_claimable');
        }
        const log = await listCallLog(env.ctx, ORG, { limit: 10 });
        const byId = new Map(log.map((e) => [e.id, e]));
        expect(byId.get('call-i-test')?.destination).toBe('test_phone');
        expect(byId.get('call-i-guardian')?.destination).toBe('guardian');
        expect(byId.get('call-i-legacy')?.destination).toBe('guardian');
    });
});
