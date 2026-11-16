/**
 * @jest-environment node
 *
 * CLASS GATE H7 — when Vobiz's answer is lost, the call is never dialled again
 * (EDGE_CASES.md §2 gap 8; telephony S09).
 *
 * A 502 or 504 from Vobiz, a dropped connection, or no answer within the timeout
 * all leave us not knowing whether the phone is already ringing. Before the
 * hardening sprint a 5xx settled as an ordinary, retryable failure — so the
 * dispatcher could ring a family twice for one notice — and `fetch` had no
 * timeout at all. The class, end to end through the real Vobiz notice carrier
 * and the real detailed client (only `fetch` is fake): for every way the outcome
 * can be unknown, the call is left for the sweep, the intent becomes
 * 'needs_review', and Vobiz is never asked again for that family.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { createVobizNoticeCarrier } from '@/lib/sampark/dispatch/vobiz-carrier';
import { callIdFor, campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { placeVobizCallDetailed, type VobizConfig } from '@/lib/vobiz/client';

import { campaign, DEFAULT_OPTS, deps, ORG, school, seedFamilies, testClock, testModeSchool } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const MIN = 60_000;
const CONFIG: VobizConfig = { authId: 'MA_TEST', authToken: 'tok', baseUrl: 'https://api.vobiz.test/api/v1', fromNumber: '+918000000000' };
const ID = intentIdFor(campaignDedupeKey('camp-ptm', 'g001'));

const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
beforeEach(() => {
    process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
});
afterEach(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
});

type Behaviour = { kind: 'status'; status: number } | { kind: 'throw' } | { kind: 'hang' };

/** A fake Vobiz endpoint. 'hang' never answers: only the client's own timeout (the AbortSignal) ends it. */
function vobizEndpoint(behaviour: Behaviour) {
    let requests = 0;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
        requests += 1;
        if (behaviour.kind === 'throw') throw new TypeError('fetch failed: ECONNRESET');
        if (behaviour.kind === 'hang') {
            return new Promise<Response>((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
            });
        }
        // A 204 may carry no body at all.
        return new Response(behaviour.status === 204 ? null : '{"error":"upstream"}', { status: behaviour.status });
    }) as unknown as typeof fetch;
    const carrier = createVobizNoticeCarrier({
        config: CONFIG,
        publicBaseUrl: 'https://sampark-calls.example.test',
        mintToken: async (domain, principal) => `${principal}.9999999999.${domain}`,
        // A short timeout keeps the test fast; the default (8 s) is pinned in the client's own tests.
        placeCall: (config, options) => placeVobizCallDetailed(config, options, fetchImpl, { timeoutMs: 25 }),
    });
    return { carrier, requests: () => requests };
}

const CASES: [string, Behaviour][] = [
    ['HTTP 500', { kind: 'status', status: 500 }],
    ['HTTP 502', { kind: 'status', status: 502 }],
    ['HTTP 503', { kind: 'status', status: 503 }],
    ['HTTP 504', { kind: 'status', status: 504 }],
    ['an unexpected 204', { kind: 'status', status: 204 }],
    ['a dropped connection', { kind: 'throw' }],
    ['no answer within the timeout', { kind: 'hang' }],
];

describe('class gate H7 — an unknown outcome is never re-dialled', () => {
    it.each(CASES)('%s: left for the sweep, handed to a person, and Vobiz is never asked again', async (_label, behaviour) => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 1, { school: testModeSchool() });
        const camp = campaign({ mode: 'test' });
        await repo.createCampaign(camp);
        await materialiseCampaignIntents({ repo, clock }, camp, school(testModeSchool()), 'vobiz');
        const vobiz = vobizEndpoint(behaviour);
        const d = deps(repo, clock, vobiz.carrier);

        const first = await runDispatchTick(d, DEFAULT_OPTS);
        expect(vobiz.requests()).toBe(1);
        // The carrier says which unknown it was: the response was a 5xx-like status, or there was none.
        const expected = behaviour.kind === 'status' ? 'vobiz_provider_error_outcome_unknown' : 'vobiz_network_outcome_unknown';
        expect(first.errors).toEqual([expect.stringContaining(expected)]);
        // Not settled as a failure: the call stays open and the intent waits on it.
        expect(await repo.getCall(ORG, callIdFor(ID, 1))).toMatchObject({ state: 'dialing', settledAt: null });
        expect(await repo.getIntent(ORG, ID)).toMatchObject({ status: 'dialing', attempts: 1 });

        // Past the claim lease the sweep hands it to a person.
        clock.advance(DEFAULT_OPTS.leaseMs + 1000);
        expect((await runDispatchTick(d, DEFAULT_OPTS)).swept).toBe(1);
        expect(await repo.getCall(ORG, callIdFor(ID, 1))).toMatchObject({ state: 'unknown' });
        expect(await repo.getIntent(ORG, ID)).toMatchObject({ status: 'needs_review' });

        // A day of ticks later: still one request, no second call record, still with a person.
        for (let i = 0; i < 48; i++) {
            clock.advance(30 * MIN);
            await runDispatchTick(d, DEFAULT_OPTS);
        }
        expect(vobiz.requests()).toBe(1);
        expect(await repo.listCalls(ORG, { limit: 10 })).toHaveLength(1);
        expect(await repo.getIntent(ORG, ID)).toMatchObject({ status: 'needs_review' });
        // A day of ticks is slow under a fully parallel run; the 5 s default made this flaky there.
    }, 30_000);

    it('positive control: a refusal that provably placed nothing (a 400) is a clean, retryable failure', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 1, { school: testModeSchool() });
        const camp = campaign({ mode: 'test' });
        await repo.createCampaign(camp);
        await materialiseCampaignIntents({ repo, clock }, camp, school(testModeSchool()), 'vobiz');
        const vobiz = vobizEndpoint({ kind: 'status', status: 400 });
        await runDispatchTick(deps(repo, clock, vobiz.carrier), DEFAULT_OPTS);
        expect(await repo.getCall(ORG, callIdFor(ID, 1))).toMatchObject({ state: 'failed', failureReason: 'vobiz_provider_rejected' });
        expect(await repo.getIntent(ORG, ID)).toMatchObject({ status: 'retry_wait', attempts: 1 });
    });
});
