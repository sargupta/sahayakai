/**
 * @jest-environment node
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick, recomputeCampaignCounts, DISPATCH_LOCK_NAME } from '@/lib/sampark/dispatch/dispatcher';
import { recordOptOut } from '@/lib/sampark/dispatch/settle';
import { callIdFor, campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import { istInstant } from '@/lib/sampark/policy/ist';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { Campaign, SamparkCall } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, ORG, prefs, school, scriptedCarrier, seedFamilies, testClock, type ScriptedFate } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const HOUR = 3600_000;
const idFor = (campaignId: string, gid: string) => intentIdFor(campaignDedupeKey(campaignId, gid));

async function setup(n: number, fates: Record<string, ScriptedFate> = {}, c: Partial<Campaign> = {}) {
    const repo = createMemorySamparkRepo();
    const clock = testClock();
    const gids = await seedFamilies(repo, n);
    // Approved in Practice mode, like the school (H2: a campaign dials only in the mode it was approved in).
    const camp = campaign({ mode: 'practice', ...c });
    await repo.createCampaign(camp);
    await materialiseCampaignIntents({ repo, clock }, camp, school(), 'simulated');
    const carrier = scriptedCarrier((req) => fates[req.call.guardianId] ?? 'full');
    return { repo, clock, gids, camp, carrier, d: deps(repo, clock, carrier) };
}

describe('runDispatchTick — outcomes and retries', () => {
    it('dials each due intent once and settles it: key/full → done, no answer → retry_wait', async () => {
        const { repo, clock, camp, carrier, d } = await setup(3, { g001: 'key1', g002: 'full', g003: 'no_answer' });
        const report = await runDispatchTick(d, DEFAULT_OPTS);
        expect(report).toMatchObject({ schools: 1, dialed: 3, deferred: 0, blocked: 0, swept: 0, errors: [] });
        expect(carrier.requests).toHaveLength(3);

        const i1 = await repo.getIntent(ORG, idFor(camp.id, 'g001'));
        const i3 = await repo.getIntent(ORG, idFor(camp.id, 'g003'));
        expect(i1).toMatchObject({ status: 'done', attempts: 1, lastCallId: callIdFor(i1!.id, 1) });
        expect((await repo.getIntent(ORG, idFor(camp.id, 'g002')))?.status).toBe('done');
        expect(i3).toMatchObject({ status: 'retry_wait', attempts: 1, notBefore: new Date(clock.now().getTime() + 120 * 60_000).toISOString() });

        const call1 = await repo.getCall(ORG, callIdFor(i1!.id, 1));
        expect(call1).toMatchObject({ state: 'completed', attempt: 1, variant: 'default', carrier: 'simulated', audioSeconds: 40, phoneHash: 'hash:g001' });
        expect(call1?.outcome).toMatchObject({ heard: 'full', digits: '1', confirmed: true });

        const updated = await repo.getCampaign(ORG, camp.id);
        expect(updated?.status).toBe('dispatching');
        expect(updated?.counts).toMatchObject({ guardians: 3, heardKeyFact: 2, confirmedYes: 1, noAnswer: 1, queued: 1, inFlight: 0 });
    });

    it('retries after retryAfterMinutes with a new call id, and stops at maxAttempts → done; campaign completes', async () => {
        const { repo, clock, camp, carrier, d } = await setup(1, { g001: 'no_answer' });
        const id = idFor(camp.id, 'g001');
        await runDispatchTick(d, DEFAULT_OPTS);
        clock.advance(HOUR); // not yet due
        expect((await runDispatchTick(d, DEFAULT_OPTS)).dialed).toBe(0);
        clock.advance(HOUR);
        expect((await runDispatchTick(d, DEFAULT_OPTS)).dialed).toBe(1);
        expect(await repo.getIntent(ORG, id)).toMatchObject({ status: 'retry_wait', attempts: 2, lastCallId: callIdFor(id, 2) });
        clock.advance(2 * HOUR);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(await repo.getIntent(ORG, id)).toMatchObject({ status: 'done', attempts: 3 });
        clock.advance(4 * HOUR);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.placesFor(id)).toBe(3);
        expect(carrier.requests.map((r) => r.call.id)).toEqual([callIdFor(id, 1), callIdFor(id, 2), callIdFor(id, 3)]);
        expect((await repo.getCampaign(ORG, camp.id))?.status).toBe('completed');
    });

    it('partial listen, early hang-up and busy are retried; a retryable place failure is retried; a final one is done', async () => {
        const { repo, camp, d } = await setup(5, { g001: 'partial', g002: 'early', g003: 'busy', g004: 'fail', g005: 'fail_final' });
        await runDispatchTick(d, DEFAULT_OPTS);
        const status = async (g: string) => (await repo.getIntent(ORG, idFor(camp.id, g)))?.status;
        expect(await status('g001')).toBe('retry_wait');
        expect(await status('g002')).toBe('retry_wait');
        expect(await status('g003')).toBe('retry_wait');
        expect(await status('g004')).toBe('retry_wait');
        expect(await status('g005')).toBe('done');
        const failedCall = await repo.getCall(ORG, callIdFor(idFor(camp.id, 'g004'), 1));
        expect(failedCall).toMatchObject({ state: 'failed', failureReason: 'carrier_down' });
        const counts = (await repo.getCampaign(ORG, camp.id))?.counts;
        expect(counts).toMatchObject({ noAnswer: 1, failed: 2, heardKeyFact: 0 });
    });

    it('a retry whose next attempt would fall after expiresAt expires instead', async () => {
        const { repo, camp, d } = await setup(1, { g001: 'no_answer' }, { expiresAt: new Date(testClock().now().getTime() + HOUR).toISOString() });
        await runDispatchTick(d, DEFAULT_OPTS);
        expect((await repo.getIntent(ORG, idFor(camp.id, 'g001')))?.status).toBe('expired');
    });
});

describe('opt-outs: Practice audits them, a real guardian call suppresses (H1)', () => {
    /** The same call as if it had rung the guardian on the real carrier (Live mode, not dialled in this release). */
    const asRealGuardianCall = (c: SamparkCall): SamparkCall => ({ ...c, carrier: 'vobiz', destination: 'guardian' });

    it('in Practice mode a 99 or a 9 is counted and audited, but suppresses nobody', async () => {
        const { repo, camp, d } = await setup(3, { g001: 'key99', g002: 'key9', g003: 'key2' });
        const audits = jest.spyOn(repo, 'appendAudit');
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(await repo.listSuppressions(ORG)).toEqual([]);
        const pressed = audits.mock.calls.filter(([, e]) => e.action === 'practice_call.opt_out_pressed').map(([, e]) => e.detail?.optOut);
        expect(pressed.sort()).toEqual(['confirmed', 'requested']);
        expect(audits.mock.calls.filter(([, e]) => e.action === 'suppression.add')).toEqual([]);
        for (const g of ['g001', 'g002', 'g003']) expect((await repo.getIntent(ORG, idFor(camp.id, g)))?.status).toBe('done');
        expect((await repo.getCampaign(ORG, camp.id))?.counts).toMatchObject({ optOuts: 2, declinedOrOther: 1 });
    });

    it('a real guardian call: 99 → confirmed keypad opt-out; 9 then hang-up → unconfirmed; both routine, pending office verification', async () => {
        const { repo, clock, camp, d } = await setup(3, { g001: 'key99', g002: 'key9', g003: 'key2' });
        await runDispatchTick(d, DEFAULT_OPTS);
        for (const g of ['g001', 'g002', 'g003']) {
            const call = await repo.getCall(ORG, callIdFor(idFor(camp.id, g), 1));
            await recordOptOut(repo, asRealGuardianCall(call!), clock.now(), 'carrier');
        }
        const s1 = await repo.getSuppression(ORG, 'hash:g001');
        const s2 = await repo.getSuppression(ORG, 'hash:g002');
        expect(s1).toMatchObject({ scope: 'routine', source: 'keypad', officeVerification: 'pending', callId: callIdFor(idFor(camp.id, 'g001'), 1) });
        expect(s2).toMatchObject({ scope: 'routine', source: 'keypad_unconfirmed', officeVerification: 'pending' });
        expect(await repo.getSuppression(ORG, 'hash:g003')).toBeNull();
    });

    it('a suppression created by one campaign blocks the same phone in the next routine campaign', async () => {
        const { repo, clock, camp, d } = await setup(1, { g001: 'key99' });
        await runDispatchTick(d, DEFAULT_OPTS);
        const call = await repo.getCall(ORG, callIdFor(idFor(camp.id, 'g001'), 1));
        await recordOptOut(repo, asRealGuardianCall(call!), clock.now(), 'carrier');
        const next = campaign({ id: 'camp-event', mode: 'practice', purpose: 'event_invite', facts: { kind: 'event_invite', eventType: 'annual_day', date: '2026-11-01', time: { hour: 10, minute: 0 }, venueId: 'hall' } });
        await repo.createCampaign(next);
        const res = await materialiseCampaignIntents({ repo, clock }, next, school(), 'simulated');
        expect(res.blocked).toEqual({ suppressed: 1 });
    });

    it('an emergency-call 9 never overwrites an effective (office-confirmed) routine suppression', async () => {
        const { repo, clock, camp, d } = await setup(1, { g001: 'key9' }, { purpose: 'emergency_closure', facts: { kind: 'emergency_closure', date: '2026-10-07', reason: 'heavy_rain', busesRunning: false } });
        const office = { orgId: ORG, phoneHash: 'hash:g001', phoneLast4: '0000', scope: 'routine' as const, source: 'office' as const, officeVerification: 'confirmed' as const, createdAt: '2026-09-01T00:00:00.000Z', callId: null };
        await repo.upsertSuppression(office);
        await runDispatchTick(d, DEFAULT_OPTS);
        const call = await repo.getCall(ORG, callIdFor(idFor(camp.id, 'g001'), 1));
        expect(call?.outcome.optOut).toBe('requested');
        await recordOptOut(repo, asRealGuardianCall(call!), clock.now(), 'carrier');
        expect(await repo.getSuppression(ORG, 'hash:g001')).toEqual(office);
    });
});

describe('runDispatchTick — gating at dispatch', () => {
    it('outside the window: defers to the next opening and dials nothing', async () => {
        const { repo, clock, camp, carrier, d } = await setup(2);
        clock.set(istInstant('2026-10-07', 21));
        const report = await runDispatchTick(d, DEFAULT_OPTS);
        expect(report).toMatchObject({ dialed: 0, deferred: 2 });
        expect(carrier.requests).toHaveLength(0);
        expect((await repo.getIntent(ORG, idFor(camp.id, 'g001')))?.notBefore).toBe(istInstant('2026-10-08', 10).toISOString());
        clock.set(istInstant('2026-10-08', 10));
        expect((await runDispatchTick(d, DEFAULT_OPTS)).dialed).toBe(2);
    });

    it('re-checks consent at dispatch: withdrawn after materialisation → blocked', async () => {
        const { repo, camp, carrier, d } = await setup(2);
        await repo.upsertPreferences([prefs('g002', { notices: 'denied' })]);
        const report = await runDispatchTick(d, DEFAULT_OPTS);
        expect(report).toMatchObject({ dialed: 1, blocked: 1 });
        expect(await repo.getIntent(ORG, idFor(camp.id, 'g002'))).toMatchObject({ status: 'blocked', blockReason: 'consent_denied' });
        expect(carrier.requests.map((r) => r.call.guardianId)).toEqual(['g001']);
    });

    it('frequency cap at dispatch: Practice attempts are never in the count (H1), so none are taken back out', async () => {
        const { repo, clock, camp, carrier, d } = await setup(1, { g001: 'no_answer' });
        const id = idFor(camp.id, 'g001');
        await runDispatchTick(d, DEFAULT_OPTS);
        // The repo really leaves the practice attempt out of the count.
        expect(await repo.countCallsToPhoneSince(ORG, 'hash:g001', new Date(0), true)).toBe(0);
        const count = jest.spyOn(repo, 'countCallsToPhoneSince').mockResolvedValue(3); // 3 real calls from elsewhere
        clock.advance(2 * HOUR);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.placesFor(id)).toBe(2);
        count.mockResolvedValue(4); // 4 real calls from elsewhere → capped, whatever this intent's practice attempts
        clock.advance(2 * HOUR);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(await repo.getIntent(ORG, id)).toMatchObject({ status: 'blocked', blockReason: 'frequency_cap' });
    });

    it('expired intents are never dialled', async () => {
        const { repo, clock, camp, carrier, d } = await setup(1, {}, { expiresAt: '2026-10-07T06:00:00.000Z' });
        clock.set('2026-10-07T06:00:01.000Z');
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(0);
        expect((await repo.getIntent(ORG, idFor(camp.id, 'g001')))?.status).toBe('expired');
        expect((await repo.getCampaign(ORG, camp.id))?.status).toBe('completed');
    });

    it('a campaign that is not yet scheduled is skipped; a cancelled one cancels its intents', async () => {
        const { repo, camp, carrier, d } = await setup(1);
        await repo.updateCampaign(ORG, camp.id, { status: 'rendering' });
        expect((await runDispatchTick(d, DEFAULT_OPTS)).skipped).toBe(1);
        await repo.updateCampaign(ORG, camp.id, { status: 'cancelled' });
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(0);
        expect((await repo.getIntent(ORG, idFor(camp.id, 'g001')))?.status).toBe('cancelled');
    });

    it('a campaign whose intents were all blocked at materialisation completes without a dial', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 2);
        await repo.upsertPreferences([prefs('g001', {}), prefs('g002', {})]);
        const camp = campaign({ mode: 'practice' });
        await repo.createCampaign(camp);
        await materialiseCampaignIntents({ repo, clock }, camp, school(), 'simulated');
        const carrier = scriptedCarrier(() => 'full');
        await runDispatchTick(deps(repo, clock, carrier), DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(0);
        expect((await repo.getCampaign(ORG, camp.id))?.status).toBe('completed');
    });
});

describe('runDispatchTick — capacity, lock and isolation', () => {
    it('dials at most maxDialsPerSchoolPerTick per tick', async () => {
        const { carrier, d } = await setup(5);
        const report = await runDispatchTick(d, { ...DEFAULT_OPTS, maxDialsPerSchoolPerTick: 2 });
        expect(report.dialed).toBe(2);
        expect(carrier.requests).toHaveLength(2);
    });

    it('skips a school whose non-terminal calls are at the in-flight cap', async () => {
        const { repo, carrier, d } = await setup(3);
        jest.spyOn(repo, 'countNonTerminalCalls').mockResolvedValue(20);
        const report = await runDispatchTick(d, DEFAULT_OPTS);
        expect(report).toMatchObject({ dialed: 0, skipped: 1 });
        expect(carrier.requests).toHaveLength(0);
    });

    it('limits dials to the remaining in-flight headroom', async () => {
        const { repo, d } = await setup(5);
        jest.spyOn(repo, 'countNonTerminalCalls').mockResolvedValue(18);
        expect((await runDispatchTick(d, DEFAULT_OPTS)).dialed).toBe(2);
    });

    it('returns early when another holder has the lease, and releases its own lease afterwards', async () => {
        const { repo, clock, carrier, d } = await setup(2);
        await repo.acquireLock(DISPATCH_LOCK_NAME, 'someone-else', clock.now(), 55_000);
        expect(await runDispatchTick(d, DEFAULT_OPTS)).toEqual({ schools: 0, dialed: 0, deferred: 0, blocked: 0, skipped: 1, swept: 0, errors: [] });
        expect(carrier.requests).toHaveLength(0);
        await repo.releaseLock(DISPATCH_LOCK_NAME, 'someone-else');
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(await repo.acquireLock(DISPATCH_LOCK_NAME, 'next-holder', clock.now(), 55_000)).toBe(true);
    });

    it('releases the lease even when the tick throws', async () => {
        const { repo, clock, d } = await setup(1);
        jest.spyOn(repo, 'listSchools').mockRejectedValue(new Error('firestore down'));
        await expect(runDispatchTick(d, DEFAULT_OPTS)).rejects.toThrow('firestore down');
        expect(await repo.acquireLock(DISPATCH_LOCK_NAME, 'next-holder', clock.now(), 55_000)).toBe(true);
    });

    it('an error in one school never stops the others', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 2);
        const other = 'z-other-school';
        await repo.upsertSchool(school({ orgId: other }));
        const camp = campaign({ mode: 'practice' });
        await repo.createCampaign(camp);
        await materialiseCampaignIntents({ repo, clock }, camp, school(), 'simulated');
        // The failing school sorts first.
        await repo.upsertSchool(school({ orgId: 'a-broken-school' }));
        await repo.createCampaign(campaign({ orgId: 'a-broken-school', mode: 'practice' }));
        await repo.createIntentIfAbsent({ ...(await repo.getIntent(ORG, idFor(camp.id, 'g001')))!, orgId: 'a-broken-school' });
        const carrier = scriptedCarrier(() => 'full');
        const d = deps(repo, clock, carrier, {
            carrierFor: (s) => {
                if (s.orgId === 'a-broken-school') throw new Error('LIVE_DIAL_DISABLED');
                return carrier;
            },
        });
        const report = await runDispatchTick(d, DEFAULT_OPTS);
        expect(report.schools).toBe(3);
        expect(report.dialed).toBe(2);
        expect(report.errors).toEqual([expect.stringMatching(/^a-broken-school: LIVE_DIAL_DISABLED/)]);
    });

    it('when the destination cannot be resolved, the carrier is never contacted and the attempt is a clean, retryable failure', async () => {
        const { repo, camp, carrier } = await setup(1);
        const d = deps(repo, testClock(), carrier, { destinationFor: async () => { throw new Error('decrypt failed'); } });
        const report = await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(0);
        expect(report.dialed).toBe(0);
        const id = idFor(camp.id, 'g001');
        expect(await repo.getCall(ORG, callIdFor(id, 1))).toMatchObject({ state: 'failed' });
        expect((await repo.getIntent(ORG, id))?.status).toBe('retry_wait');
    });

    it('audio length comes from deps.audioSecondsFor; unknown audio is stored as null', async () => {
        const { repo, camp, carrier } = await setup(1);
        await runDispatchTick(deps(repo, testClock(), carrier, { audioSecondsFor: async () => null }), DEFAULT_OPTS);
        expect(carrier.requests[0].audioSeconds).toBe(40);
        expect((await repo.getCall(ORG, callIdFor(idFor(camp.id, 'g001'), 1)))?.audioSeconds).toBeNull();
    });
});

describe('recomputeCampaignCounts', () => {
    it('recomputes from records and stores the counts on the campaign', async () => {
        const { repo, camp, d } = await setup(2, { g001: 'key1', g002: 'busy' });
        await runDispatchTick(d, DEFAULT_OPTS);
        await repo.updateCampaign(ORG, camp.id, { counts: { ...camp.counts, guardians: 99 } });
        const counts = await recomputeCampaignCounts(repo, ORG, camp.id);
        expect(counts).toEqual({ guardians: 2, blocked: 0, queued: 1, inFlight: 0, heardKeyFact: 1, confirmedYes: 1, declinedOrOther: 0, noAnswer: 1, failed: 0, optOuts: 0 });
        expect((await repo.getCampaign(ORG, camp.id))?.counts).toEqual(counts);
    });
});
