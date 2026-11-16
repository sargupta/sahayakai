/** @jest-environment node */
/**
 * GATE H9 (overview by mode) — Practice and Test calls never appear in `today`.
 *
 * The bug class: the overview counted every call of the day together, so a closure
 * rehearsed in Test mode (one staff phone rang) showed families as having heard it,
 * and a Practice run (no phone rang) showed calls and opt-outs that never happened.
 * Now each call lands in exactly one bucket: `today` (a real carrier ringing a
 * guardian), `rehearsal.practice` (the simulated carrier) or `rehearsal.test` (a real
 * carrier ringing the school's test phone).
 *
 * (a) Every combination of carrier, destination (including records from before
 *     phase 2a, which have none), outcome and day, stored through the real claim
 *     path, is counted in its one bucket and nowhere else.
 * (b) End to end: a Practice campaign and a Test campaign dispatched by the real
 *     dispatcher leave `today` at zero.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SamparkCtx } from '@/server/sampark/http';
import { callBucket, getOverview } from '@/server/sampark/overview';
import type { CallOutcome, CarrierKind, Intent, SamparkCall, TodayCallCounts } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, ORG, school, scriptedCarrier, seedFamilies, testClock, testModeSchool, WED_11_IST } from '../engine/_fixtures';

const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
afterEach(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
});

const ZERO: TodayCallCounts = { calls: 0, heardKeyFact: 0, confirmedYes: 0, optOuts: 0 };

const OUTCOMES: CallOutcome[] = [
    { heard: 'full', digits: '1', confirmed: true, declined: false, optOut: 'none' },
    { heard: 'partial', digits: '2', confirmed: false, declined: true, optOut: 'none' },
    { heard: 'full', digits: '99', confirmed: false, declined: false, optOut: 'confirmed' },
    { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' },
];

function intent(id: string, at: string): Intent {
    return {
        id, dedupeKey: `gate:${id}`, orgId: ORG, campaignId: 'c1', purpose: 'ptm_invite', guardianId: `g-${id}`, studentIds: [],
        language: 'Hindi', status: 'approved', blockReason: null, attempts: 0, maxAttempts: 3, notBefore: null,
        expiresAt: '2027-01-01T00:00:00.000Z', lastCallId: null, createdAt: at, updatedAt: at,
    };
}

function call(id: string, at: string, carrier: CarrierKind, destination: SamparkCall['destination'] | 'absent', outcome: CallOutcome): SamparkCall {
    const c: SamparkCall = {
        id: `call-${id}`, orgId: ORG, intentId: id, campaignId: 'c1', purpose: 'ptm_invite', guardianId: `g-${id}`, phoneHash: `hash:${id}`,
        phoneLast4: '0000', language: 'Hindi', variant: 'default', attempt: 1, state: 'dialing', leaseUntil: at, carrier,
        providerCallId: null, outcome, durationSeconds: 30, billedSeconds: 60, costPaise: null, audioSeconds: 30,
        createdAt: at, updatedAt: at, endedAt: at, failureReason: null,
    };
    if (destination !== 'absent') c.destination = destination;
    return c;
}

function count(calls: SamparkCall[]): TodayCallCounts {
    return {
        calls: calls.length,
        heardKeyFact: calls.filter((c) => c.outcome.heard === 'full' || c.outcome.confirmed || c.outcome.declined).length,
        confirmedYes: calls.filter((c) => c.outcome.confirmed).length,
        optOuts: calls.filter((c) => c.outcome.optOut !== 'none').length,
    };
}

describe('gate h9 — the overview separates Practice, Test and families', () => {
    it('every carrier × destination × outcome × day is counted in exactly one bucket', async () => {
        const repo = createMemorySamparkRepo();
        await repo.upsertSchool(school());
        const ctx: SamparkCtx = { repo, clock: testClock(WED_11_IST) };
        const today = WED_11_IST.toISOString();
        const yesterday = new Date(WED_11_IST.getTime() - 24 * 3600 * 1000).toISOString();

        const stored: SamparkCall[] = [];
        let n = 0;
        for (const at of [today, yesterday]) {
            for (const carrier of ['simulated', 'vobiz'] as const) {
                for (const destination of ['guardian', 'test_phone', 'absent'] as const) {
                    for (const outcome of OUTCOMES) {
                        const id = `i${n++}`;
                        const c = call(id, at, carrier, destination, outcome);
                        await repo.createIntentIfAbsent(intent(id, at));
                        expect(await repo.claimIntentForDial(ORG, id, c, new Date(at))).toBe('claimed');
                        await repo.updateCall(ORG, c.id, { state: 'completed' });
                        stored.push(c);
                    }
                }
            }
        }

        const o = await getOverview(ctx, ORG);
        const todays = stored.filter((c) => c.createdAt === today);
        const families = todays.filter((c) => c.carrier !== 'simulated' && c.destination !== 'test_phone');
        expect(o.today).toEqual(count(families));
        expect(o.rehearsal.practice).toEqual(count(todays.filter((c) => c.carrier === 'simulated')));
        expect(o.rehearsal.test).toEqual(count(todays.filter((c) => c.carrier !== 'simulated' && c.destination === 'test_phone')));
        // A partition: nothing double-counted, nothing dropped.
        expect(o.today.calls + o.rehearsal.practice.calls + o.rehearsal.test.calls).toBe(todays.length);
        // No simulated or test-phone call is ever in the families' bucket.
        for (const c of stored) {
            if (c.carrier === 'simulated' || c.destination === 'test_phone') expect(callBucket(c)).not.toBe('family');
        }
    });

    it('a Practice campaign and a Test campaign, dispatched for real, leave today at zero', async () => {
        // Practice: the simulated carrier, every family.
        const practiceRepo = createMemorySamparkRepo();
        const clock = testClock(WED_11_IST);
        await seedFamilies(practiceRepo, 5);
        const p = campaign({ id: 'camp-practice', mode: 'practice' });
        await practiceRepo.createCampaign(p);
        await materialiseCampaignIntents({ repo: practiceRepo, clock }, p, school(), 'simulated');
        const sim = scriptedCarrier(() => 'key1', 'simulated');
        await runDispatchTick(deps(practiceRepo, clock, sim), DEFAULT_OPTS);
        expect(sim.requests.length).toBe(5);
        const practice = await getOverview({ repo: practiceRepo, clock }, ORG);
        expect(practice.today).toEqual(ZERO);
        expect(practice.rehearsal.practice).toMatchObject({ calls: 5, heardKeyFact: 5, confirmedYes: 5 });
        expect(practice.rehearsal.test).toEqual(ZERO);

        // Test: the real carrier, ringing only the school's test phone.
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const testRepo = createMemorySamparkRepo();
        await seedFamilies(testRepo, 3, { school: testModeSchool() });
        const t = campaign({ id: 'camp-test', mode: 'test' });
        await testRepo.createCampaign(t);
        await materialiseCampaignIntents({ repo: testRepo, clock }, t, school(testModeSchool()), 'vobiz');
        const vobiz = scriptedCarrier(() => 'key1', 'vobiz');
        for (let i = 0; i < 3; i++) {
            await runDispatchTick(deps(testRepo, clock, vobiz), DEFAULT_OPTS);
            clock.advance(60_000);
        }
        expect(vobiz.requests.length).toBeGreaterThan(0);
        const test = await getOverview({ repo: testRepo, clock }, ORG);
        expect(test.today).toEqual(ZERO);
        expect(test.rehearsal.test.calls).toBe(vobiz.requests.length);
        expect(test.rehearsal.test.confirmedYes).toBe(vobiz.requests.length);
        expect(test.rehearsal.practice).toEqual(ZERO);
    });
});
