/**
 * @jest-environment node
 *
 * Phase 2a dispatch (contract §3): the real-carrier lifecycle, Test mode, and
 * the shared settle path.
 *
 *   - A real carrier returns no events: the call stays open with a 15-minute
 *     lease, the intent stays 'dialing', and only the hangup webhook (here:
 *     mutateCall + applyCallEvent, then settleCall — exactly what stream V's
 *     status route does) settles it. A call whose hangup never comes is swept to
 *     unknown/needs_review after the lease and is NEVER re-dialled (class gate 3).
 *   - Webhooks that land before the dispatcher's own post-place update are never
 *     overwritten or regressed.
 *   - Test mode rings only the school's test phone, recorded under the test
 *     phone's hash, one call at a time; live mode and a missing test phone dial
 *     nothing.
 *
 * Nothing here reaches a network: the Vobiz carrier is constructed with a fake
 * placeCall and a fake token minter.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { REAL_CALL_LEASE_MS, runDispatchTick, TEST_MODE_MAX_IN_FLIGHT, type DispatchDeps } from '@/lib/sampark/dispatch/dispatcher';
import { settleCall } from '@/lib/sampark/dispatch/settle';
import { applyCallEvent } from '@/lib/sampark/dispatch/state';
import { createVobizNoticeCarrier } from '@/lib/sampark/dispatch/vobiz-carrier';
import { callIdFor, campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import type { SamparkRepo } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { PlaceCallOptions, VobizConfig, VobizResult } from '@/lib/vobiz/client';
import type { CallEvent, SamparkCall } from '@/types/sampark';

import {
    campaign,
    DEFAULT_OPTS,
    deps,
    ORG,
    school,
    scriptedCarrier,
    seedFamilies,
    testClock,
    testModeSchool,
    TEST_PHONE,
    TEST_PHONE_HASH,
    TEST_PHONE_LAST4,
    type ScriptedFate,
    type TestClock,
} from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const BASE = 'https://sampark-calls.example.test';
const CONFIG: VobizConfig = { authId: 'MA_TEST', authToken: 'tok', baseUrl: 'https://api.vobiz.test/api/v1', fromNumber: '+918000000000' };
const idFor = (gid: string) => intentIdFor(campaignDedupeKey('camp-ptm', gid));

const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
beforeEach(() => {
    process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
});
afterEach(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
    jest.restoreAllMocks();
});

/** What stream V's status/answer/gather routes do with one carrier event. */
function webhook(repo: SamparkRepo, callId: string, event: CallEvent): Promise<SamparkCall | null> {
    return repo.mutateCall(ORG, callId, (c) => applyCallEvent(c, event));
}

async function hangUp(repo: SamparkRepo, clock: TestClock, callId: string, cause: 'completed' | 'no_answer' | 'busy', digits: string[] = []) {
    const at = (s: number) => new Date(clock.now().getTime() + s * 1000).toISOString();
    if (cause === 'completed') {
        await webhook(repo, callId, { type: 'ringing', at: at(1) });
        await webhook(repo, callId, { type: 'answered', at: at(5) });
        for (const [i, digit] of digits.entries()) await webhook(repo, callId, { type: 'digit', at: at(50 + i), digit });
    }
    const duration = cause === 'completed' ? 55 : 0;
    await webhook(repo, callId, { type: 'hangup', at: at(60), cause, durationSeconds: duration, billedSeconds: cause === 'completed' ? 60 : 0 });
    return settleCall({ repo, clock }, ORG, callId);
}

/**
 * A Vobiz notice carrier whose provider is a fake: `onPlace` runs inside the provider call,
 * which is where a real ring/answer/hangup webhook could already be landing.
 */
function fakeVobizCarrier(onPlace?: (callId: string) => Promise<void>, result?: VobizResult) {
    const sent: PlaceCallOptions[] = [];
    const callIds: string[] = [];
    const carrier = createVobizNoticeCarrier({
        config: CONFIG,
        publicBaseUrl: BASE,
        mintToken: async (domain, principal) => `${principal}.9999999999.${domain}`,
        placeCall: async (_config, options) => {
            sent.push(options);
            const principal = new URL(options.answerUrl).searchParams.get('t')?.split('.')[0] ?? '';
            const callId = principal.split('~')[1] ?? '';
            callIds.push(callId);
            if (onPlace) await onPlace(callId);
            return result ?? { ok: true, handle: { requestUuid: `req-${sent.length}` } };
        },
    });
    return { carrier, sent, callIds, placesFor: (intentId: string) => callIds.filter((c) => [1, 2, 3].some((a) => callIdFor(intentId, a) === c)).length };
}

async function testModeSetup(n: number, overrides: Partial<Parameters<typeof testModeSchool>[0]> = {}) {
    const repo = createMemorySamparkRepo();
    const clock = testClock();
    await seedFamilies(repo, n, { school: testModeSchool(overrides) });
    const camp = campaign();
    await repo.createCampaign(camp);
    const res = await materialiseCampaignIntents({ repo, clock }, camp, school(testModeSchool(overrides)), 'vobiz');
    expect(res.created).toBe(n);
    expect(res.blocked).toEqual({});
    return { repo, clock, camp };
}

const onlyCall = async (repo: SamparkRepo) => {
    const calls = await repo.listCalls(ORG, { limit: 10 });
    expect(calls).toHaveLength(1);
    return calls[0];
};

// ── settle on the simulated path ────────────────────────────────────────────

describe('the simulated path settles through settleCall', () => {
    it('every terminal call is stamped settledAt, and settling again changes nothing', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 3);
        await repo.createCampaign(campaign());
        await materialiseCampaignIntents({ repo, clock }, campaign(), school(), 'simulated');
        const fates: Record<string, ScriptedFate> = { g001: 'key1', g002: 'no_answer', g003: 'fail_final' };
        await runDispatchTick(deps(repo, clock, scriptedCarrier((r) => fates[r.call.guardianId])), DEFAULT_OPTS);

        const calls = await repo.listCalls(ORG, { limit: 10 });
        expect(calls).toHaveLength(3);
        for (const c of calls) {
            expect(c.settledAt).toBe(clock.now().toISOString());
            expect(c.destination).toBe('guardian');
        }
        const before = await repo.listIntentsByCampaign(ORG, 'camp-ptm');
        expect(before.map((i) => i.status).sort()).toEqual(['done', 'done', 'retry_wait']);
        clock.advance(MIN);
        for (const c of calls) expect(await settleCall({ repo, clock }, ORG, c.id)).toBe('noop');
        expect(await repo.listIntentsByCampaign(ORG, 'camp-ptm')).toEqual(before);
    });
});

// ── real-carrier lifecycle ──────────────────────────────────────────────────

describe('real carrier: the call stays open until its hangup webhook settles it', () => {
    it('place → no events → open and not swept at +2 min → hangup + settle → intent done; then the next family is dialled', async () => {
        const { repo, clock } = await testModeSetup(2);
        const vobiz = fakeVobizCarrier();
        const d = deps(repo, clock, vobiz.carrier);
        const t0 = clock.now();

        expect(await runDispatchTick(d, DEFAULT_OPTS)).toMatchObject({ dialed: 1, swept: 0, errors: [] });
        expect(vobiz.sent).toHaveLength(1);
        expect(vobiz.sent[0].to).toBe(TEST_PHONE);
        const call = await onlyCall(repo);
        expect(call).toMatchObject({
            state: 'dialing',
            carrier: 'vobiz',
            destination: 'test_phone',
            phoneHash: TEST_PHONE_HASH,
            phoneLast4: TEST_PHONE_LAST4,
            providerCallId: 'req-1',
            leaseUntil: new Date(t0.getTime() + REAL_CALL_LEASE_MS).toISOString(),
        });
        expect(call.settledAt ?? null).toBeNull();
        expect(await repo.getIntent(ORG, call.intentId)).toMatchObject({ status: 'dialing', attempts: 1, lastCallId: call.id });

        // Two minutes later (past the 2-minute claim lease): still open, not swept, nothing else dialled.
        clock.advance(2 * MIN);
        expect(await runDispatchTick(d, DEFAULT_OPTS)).toMatchObject({ dialed: 0, swept: 0, skipped: 1 });
        expect(await repo.getCall(ORG, call.id)).toMatchObject({ state: 'dialing' });
        expect(vobiz.sent).toHaveLength(1);

        // The hangup webhook arrives and settles; a retried webhook settles nothing twice.
        expect(await hangUp(repo, clock, call.id, 'completed', ['1'])).toBe('settled');
        expect(await settleCall({ repo, clock }, ORG, call.id)).toBe('noop');
        expect(await repo.getCall(ORG, call.id)).toMatchObject({ state: 'completed', outcome: { confirmed: true, heard: 'full' } });
        expect(await repo.getIntent(ORG, call.intentId)).toMatchObject({ status: 'done', attempts: 1 });
        expect((await repo.getCampaign(ORG, 'camp-ptm'))?.counts).toMatchObject({ confirmedYes: 1, inFlight: 0 });

        // The phone is free again: the next family's call goes out on the next tick.
        clock.advance(MIN);
        expect((await runDispatchTick(d, DEFAULT_OPTS)).dialed).toBe(1);
        expect(vobiz.sent).toHaveLength(2);
        expect(vobiz.sent.map((o) => o.to)).toEqual([TEST_PHONE, TEST_PHONE]);
    });

    it('a call whose hangup never arrives is swept to unknown/needs_review after the 15-minute lease and never re-dialled', async () => {
        const { repo, clock } = await testModeSetup(1);
        const vobiz = fakeVobizCarrier();
        const d = deps(repo, clock, vobiz.carrier);
        const target = idFor('g001');

        await runDispatchTick(d, DEFAULT_OPTS);
        const callId = callIdFor(target, 1);
        clock.advance(REAL_CALL_LEASE_MS - 1000);
        expect((await runDispatchTick(d, DEFAULT_OPTS)).swept).toBe(0);
        clock.advance(2000);
        expect((await runDispatchTick(d, DEFAULT_OPTS)).swept).toBe(1);
        const swept = await repo.getCall(ORG, callId);
        expect(swept).toMatchObject({ state: 'unknown', failureReason: 'lease_expired_in_dialing', settledAt: clock.now().toISOString() });
        expect(await repo.getIntent(ORG, target)).toMatchObject({ status: 'needs_review' });

        // A hangup that turns up late is ignored and cannot settle the intent into a retry.
        await webhook(repo, callId, { type: 'hangup', at: clock.now().toISOString(), cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 });
        expect(await settleCall({ repo, clock }, ORG, callId)).toBe('noop');
        expect(await repo.getCall(ORG, callId)).toMatchObject({ state: 'unknown' });

        for (let i = 0; i < 40; i++) {
            clock.advance(15 * MIN);
            await runDispatchTick(d, DEFAULT_OPTS);
        }
        expect(vobiz.placesFor(target)).toBe(1);
        expect(await repo.getCall(ORG, callIdFor(target, 2))).toBeNull();
        expect(await repo.getIntent(ORG, target)).toMatchObject({ status: 'needs_review' });
    });

    it('an answered call that never hangs up is swept the same way (ringing / in progress are open states too)', async () => {
        const { repo, clock } = await testModeSetup(1);
        const d = deps(repo, clock, fakeVobizCarrier().carrier);
        await runDispatchTick(d, DEFAULT_OPTS);
        const callId = callIdFor(idFor('g001'), 1);
        await webhook(repo, callId, { type: 'ringing', at: clock.now().toISOString() });
        await webhook(repo, callId, { type: 'answered', at: clock.now().toISOString() });
        clock.advance(REAL_CALL_LEASE_MS + 1000);
        expect((await runDispatchTick(d, DEFAULT_OPTS)).swept).toBe(1);
        expect(await repo.getCall(ORG, callId)).toMatchObject({ state: 'unknown', failureReason: 'lease_expired_in_in_progress' });
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'needs_review' });
    });

    it('webhooks that land before the post-place update are not regressed: the call stays in progress and gets the long lease', async () => {
        const { repo, clock } = await testModeSetup(1);
        const vobiz = fakeVobizCarrier(async (callId) => {
            await webhook(repo, callId, { type: 'ringing', at: clock.now().toISOString() });
            await webhook(repo, callId, { type: 'answered', at: clock.now().toISOString() });
        });
        await runDispatchTick(deps(repo, clock, vobiz.carrier), DEFAULT_OPTS);
        expect(await onlyCall(repo)).toMatchObject({
            state: 'in_progress',
            providerCallId: 'req-1',
            leaseUntil: new Date(clock.now().getTime() + REAL_CALL_LEASE_MS).toISOString(),
        });
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'dialing' });
    });

    it('a hangup that lands before the post-place update is left alone and settled exactly once', async () => {
        const { repo, clock } = await testModeSetup(1);
        const settle = jest.fn();
        // The webhook applies the hangup and settles it; the dispatcher must not touch the ended call.
        const vobiz = fakeVobizCarrier(async (callId) => {
            await webhook(repo, callId, { type: 'hangup', at: clock.now().toISOString(), cause: 'busy', durationSeconds: 0, billedSeconds: 0 });
            settle(await settleCall({ repo, clock }, ORG, callId));
        });
        await runDispatchTick(deps(repo, clock, vobiz.carrier), DEFAULT_OPTS);
        expect(settle).toHaveBeenCalledWith('settled');
        const call = await onlyCall(repo);
        expect(call).toMatchObject({ state: 'busy', providerCallId: null, settledAt: clock.now().toISOString() });
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'retry_wait', attempts: 1, notBefore: new Date(clock.now().getTime() + 2 * HOUR).toISOString() });
    });

    it('a hangup applied by a webhook that died before settling is settled by the dispatcher', async () => {
        const { repo, clock } = await testModeSetup(1);
        const vobiz = fakeVobizCarrier((callId) =>
            webhook(repo, callId, { type: 'hangup', at: clock.now().toISOString(), cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 }).then(() => undefined),
        );
        await runDispatchTick(deps(repo, clock, vobiz.carrier), DEFAULT_OPTS);
        expect(await onlyCall(repo)).toMatchObject({ state: 'no_answer', settledAt: clock.now().toISOString() });
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'retry_wait' });
    });

    it('the sweep never overwrites a hangup that lands between listing a stale call and sweeping it — it settles it instead', async () => {
        const { repo, clock } = await testModeSetup(1);
        const d = deps(repo, clock, fakeVobizCarrier().carrier);
        await runDispatchTick(d, DEFAULT_OPTS);
        const callId = callIdFor(idFor('g001'), 1);
        clock.advance(REAL_CALL_LEASE_MS + 1000);
        const list = repo.listExpiredOpenCalls.bind(repo);
        jest.spyOn(repo, 'listExpiredOpenCalls').mockImplementationOnce(async (orgId, now) => {
            const listed = await list(orgId, now);
            await webhook(repo, callId, { type: 'hangup', at: now.toISOString(), cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 });
            return listed;
        });
        expect((await runDispatchTick(d, DEFAULT_OPTS)).swept).toBe(0);
        expect(await repo.getCall(ORG, callId)).toMatchObject({ state: 'no_answer', settledAt: clock.now().toISOString() });
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'retry_wait' });
    });

    it('a provider failure is a clean failure: a refusal retries, an operator problem closes the intent', async () => {
        for (const [category, status] of [['provider_rejected', 'retry_wait'], ['provider_unconfigured', 'done']] as const) {
            const { repo, clock } = await testModeSetup(1);
            const vobiz = fakeVobizCarrier(undefined, { ok: false, failure: { category } });
            await runDispatchTick(deps(repo, clock, vobiz.carrier), DEFAULT_OPTS);
            expect(await onlyCall(repo)).toMatchObject({ state: 'failed', failureReason: `vobiz_${category}` });
            expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status });
        }
    });

    it('a network failure is an unknown outcome: never retried, swept to a person after the lease (class gate 3)', async () => {
        const { repo, clock } = await testModeSetup(1);
        const vobiz = fakeVobizCarrier(undefined, { ok: false, failure: { category: 'network' } });
        const d = deps(repo, clock, vobiz.carrier);
        const report = await runDispatchTick(d, DEFAULT_OPTS);
        expect(report.errors.join(' ')).toContain('vobiz_network_outcome_unknown');
        expect(await onlyCall(repo)).toMatchObject({ state: 'dialing' });
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'dialing' });

        clock.advance(DEFAULT_OPTS.leaseMs + 1000);
        expect((await runDispatchTick(d, DEFAULT_OPTS)).swept).toBe(1);
        expect(await onlyCall(repo)).toMatchObject({ state: 'unknown' });
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'needs_review' });
        clock.advance(6 * HOUR);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(vobiz.sent).toHaveLength(1); // never dialled again
    });
});

describe('settlement is once-only and self-repairing', () => {
    it('two settlements racing on the same ended call move the intent once and write one opt-out', async () => {
        const { repo, clock } = await testModeSetup(1);
        await runDispatchTick(deps(repo, clock, fakeVobizCarrier().carrier), DEFAULT_OPTS);
        const callId = callIdFor(idFor('g001'), 1);
        await webhook(repo, callId, { type: 'answered', at: clock.now().toISOString() });
        await webhook(repo, callId, { type: 'digit', at: clock.now().toISOString(), digit: '9' });
        await webhook(repo, callId, { type: 'hangup', at: clock.now().toISOString(), cause: 'completed', durationSeconds: 40, billedSeconds: 60 });
        const updateIntentIf = jest.spyOn(repo, 'updateIntentIf');
        const audits = jest.spyOn(repo, 'appendAudit');
        const results = await Promise.all([settleCall({ repo, clock }, ORG, callId), settleCall({ repo, clock }, ORG, callId)]);
        expect(results.sort()).toEqual(['noop', 'settled']);
        expect((await Promise.all(updateIntentIf.mock.results.map((r) => r.value))).filter(Boolean)).toHaveLength(1);
        expect(audits.mock.calls.filter(([, e]) => e.action === 'test_call.opt_out_pressed')).toHaveLength(1);
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'done', attempts: 1 });
    });

    it('an ended call whose settlement never ran is settled by the repair sweep after 5 minutes, and only once', async () => {
        const { repo, clock } = await testModeSetup(1);
        const d = deps(repo, clock, fakeVobizCarrier().carrier);
        await runDispatchTick(d, DEFAULT_OPTS);
        const callId = callIdFor(idFor('g001'), 1);
        // The hangup was recorded, but every settle attempt failed (no settleCall here).
        await webhook(repo, callId, { type: 'hangup', at: clock.now().toISOString(), cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 });
        clock.advance(2 * MIN);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'dialing' }); // inside the grace period
        clock.advance(4 * MIN);
        const audits = jest.spyOn(repo, 'appendAudit');
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'retry_wait' });
        expect((await repo.getCall(ORG, callId))?.settledAt).toBe(clock.now().toISOString());
        expect(audits.mock.calls.filter(([, e]) => e.action === 'call.settle_repaired')).toHaveLength(1);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(audits.mock.calls.filter(([, e]) => e.action === 'call.settle_repaired')).toHaveLength(1);
    });

    it('a settlement that moved the intent but died before stamping is closed by the repair sweep without acting twice', async () => {
        const { repo, clock } = await testModeSetup(1);
        const d = deps(repo, clock, fakeVobizCarrier().carrier);
        await runDispatchTick(d, DEFAULT_OPTS);
        const callId = callIdFor(idFor('g001'), 1);
        await webhook(repo, callId, { type: 'hangup', at: clock.now().toISOString(), cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 });
        jest.spyOn(repo, 'mutateCall').mockImplementationOnce(async () => {
            throw new Error('process died before the stamp');
        });
        await expect(settleCall({ repo, clock }, ORG, callId)).rejects.toThrow('process died');
        const moved = await repo.getIntent(ORG, idFor('g001'));
        expect(moved).toMatchObject({ status: 'retry_wait' });
        clock.advance(6 * MIN);
        const updateIntentIf = jest.spyOn(repo, 'updateIntentIf');
        await runDispatchTick(d, { ...DEFAULT_OPTS, maxDialsPerSchoolPerTick: 0 });
        expect((await repo.getCall(ORG, callId))?.settledAt).toBe(clock.now().toISOString());
        expect(await updateIntentIf.mock.results[0]?.value).toBeUndefined(); // the intent was never moved again
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'retry_wait', notBefore: moved?.notBefore });
    });
});

// ── test mode ───────────────────────────────────────────────────────────────

describe('test mode rings only the school’s test phone, one call at a time', () => {
    it('every call goes to the test phone and is recorded under the test phone’s hash and last four', async () => {
        const { repo, clock } = await testModeSetup(3);
        const sim = scriptedCarrier(() => 'full', 'vobiz');
        const asked: string[] = [];
        const base = deps(repo, clock, sim);
        const d: DispatchDeps = {
            ...base,
            destinationFor: async (s, g) => {
                const target = await base.destinationFor(s, g);
                asked.push(target.kind);
                return target;
            },
        };
        for (let i = 0; i < 3; i++) {
            expect((await runDispatchTick(d, DEFAULT_OPTS)).dialed).toBe(1); // one per tick, even though the carrier settles in-tick
            clock.advance(MIN);
        }
        expect(sim.requests).toHaveLength(3);
        expect(new Set(sim.requests.map((r) => r.call.guardianId))).toEqual(new Set(['g001', 'g002', 'g003']));
        for (const r of sim.requests) {
            expect(r.destinationE164).toBe(TEST_PHONE);
            expect(r.call).toMatchObject({ destination: 'test_phone', phoneHash: TEST_PHONE_HASH, phoneLast4: TEST_PHONE_LAST4 });
        }
        expect(asked).toEqual(['test_phone', 'test_phone', 'test_phone']);
        // Nothing was recorded against a guardian's number.
        for (const g of ['g001', 'g002', 'g003']) {
            expect(await repo.countCallsToPhoneSince(ORG, `hash:${g}`, new Date(0), false)).toBe(0);
        }
    });

    it('the cap is TEST_MODE_MAX_IN_FLIGHT (1) whatever the options say; practice mode keeps the configured cap', async () => {
        expect(TEST_MODE_MAX_IN_FLIGHT).toBe(1);
        const { repo, clock } = await testModeSetup(5);
        const opts = { ...DEFAULT_OPTS, maxInFlightPerSchool: 50, maxDialsPerSchoolPerTick: 50 };
        expect((await runDispatchTick(deps(repo, clock, fakeVobizCarrier().carrier), opts)).dialed).toBe(1);

        const practice = createMemorySamparkRepo();
        await seedFamilies(practice, 5);
        await practice.createCampaign(campaign());
        await materialiseCampaignIntents({ repo: practice, clock }, campaign(), school(), 'simulated');
        expect((await runDispatchTick(deps(practice, clock, scriptedCarrier(() => 'full')), opts)).dialed).toBe(5);
    });

    it('the frequency cap still counts the GUARDIAN’s calls, and a test intent’s own attempts are not taken back out', async () => {
        const { repo, clock } = await testModeSetup(1);
        const sim = scriptedCarrier(() => 'no_answer', 'vobiz');
        const d = deps(repo, clock, sim);
        const count = jest.spyOn(repo, 'countCallsToPhoneSince');
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(count).toHaveBeenCalledWith(ORG, 'hash:g001', expect.any(Date), true);
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'retry_wait', attempts: 1 });

        // Four calls to the guardian's number from other campaigns: with one own attempt a guardian
        // call would subtract it (3 → allowed); a test call's attempt rang the test phone, so 4 → capped.
        count.mockResolvedValue(4);
        clock.advance(2 * HOUR);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(sim.requests).toHaveLength(1);
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'blocked', blockReason: 'frequency_cap' });
    });

    it('a 9 pressed on the test phone suppresses nobody', async () => {
        const { repo, clock } = await testModeSetup(1);
        await runDispatchTick(deps(repo, clock, scriptedCarrier(() => 'key99', 'vobiz')), DEFAULT_OPTS);
        expect(await onlyCall(repo)).toMatchObject({ outcome: { optOut: 'confirmed' }, destination: 'test_phone' });
        expect(await repo.listSuppressions(ORG)).toEqual([]);
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'done' });
    });

    it('a test school without a test phone dials nothing and claims nothing', async () => {
        for (const missing of [{ testPhoneHash: null }, { testPhoneLast4: null }]) {
            const repo = createMemorySamparkRepo();
            const clock = testClock();
            await seedFamilies(repo, 2);
            await repo.createCampaign(campaign());
            await materialiseCampaignIntents({ repo, clock }, campaign(), school(), 'simulated');
            await repo.upsertSchool(school(testModeSchool(missing)));
            const sim = scriptedCarrier(() => 'full', 'vobiz');
            const report = await runDispatchTick(deps(repo, clock, sim), DEFAULT_OPTS);
            expect(sim.requests).toHaveLength(0);
            expect(report.errors).toEqual([expect.stringMatching(/^hillview-demo: TEST_PHONE_MISSING/)]);
            expect(await repo.listCalls(ORG, { limit: 10 })).toEqual([]);
            for (const i of await repo.listIntentsByCampaign(ORG, 'camp-ptm')) expect(i.status).toBe('approved');
        }
    });

    it('a guardian number offered for a test-mode call is never dialled', async () => {
        const { repo, clock } = await testModeSetup(1);
        const sim = scriptedCarrier(() => 'full', 'vobiz');
        const d = deps(repo, clock, sim, { destinationFor: async () => ({ e164: '+919811111111', kind: 'guardian' }) });
        const report = await runDispatchTick(d, DEFAULT_OPTS);
        expect(sim.requests).toHaveLength(0);
        expect(report.dialed).toBe(0);
        expect(report.errors).toEqual([expect.stringContaining('destination mismatch')]);
        expect(await onlyCall(repo)).toMatchObject({ state: 'failed', failureReason: 'destination_mismatch' });
        expect(await repo.getIntent(ORG, idFor('g001'))).toMatchObject({ status: 'done' });
    });
});

describe('live mode dials nothing in phase 2a', () => {
    it.each(['simulated', 'vobiz'] as const)('refused by the dispatcher itself, whatever carrier is offered (%s)', async (kind) => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 2, { guardian: { phoneClass: 'mobile' } });
        await repo.createCampaign(campaign());
        await materialiseCampaignIntents({ repo, clock }, campaign(), school(), 'simulated');
        await repo.upsertSchool(school({ mode: 'live' }));
        const carrier = scriptedCarrier(() => 'full', kind);
        const destinationFor = jest.fn();
        const report = await runDispatchTick(deps(repo, clock, carrier, { destinationFor }), DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(0);
        expect(destinationFor).not.toHaveBeenCalled();
        expect(report).toMatchObject({ dialed: 0, errors: [expect.stringMatching(/^hillview-demo: LIVE_MODE_NOT_AVAILABLE/)] });
        expect(await repo.listCalls(ORG, { limit: 10 })).toEqual([]);
    });
});
