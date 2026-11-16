/**
 * @jest-environment node
 *
 * CLASS GATE H7 — a carrier refusal for capacity never spends a family's attempt,
 * and never jams the claim (EDGE_CASES.md §2 gap 8; telephony C01, D06, S23).
 *
 * Before the hardening sprint a 429 from Vobiz settled like any failure: the
 * family lost one of its three attempts to the carrier's own congestion. Making
 * the refusal free has a trap of its own: the attempt number stays the same, so
 * if the call id did not change, the next claim would collide with the refused
 * call's record and return 'not_claimable' for ever. The class, end to end
 * through the real Vobiz notice carrier and the real detailed client (only
 * `fetch` is fake):
 *
 *   - a 429 never spends an attempt: the intent is requeued 60–90 s later;
 *   - the (MAX_CARRIER_REQUEUES + 1)th refusal within an attempt does spend it,
 *     so a carrier that refuses for ever cannot loop an intent for ever;
 *   - every dial has its own call id, and every due intent is claimed;
 *   - a duplicated settlement of a refusal requeues once.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { MAX_CARRIER_REQUEUES, REQUEUE_MAX_MS, REQUEUE_MIN_MS, settleCall } from '@/lib/sampark/dispatch/settle';
import { applyCallEvent } from '@/lib/sampark/dispatch/state';
import { createVobizNoticeCarrier } from '@/lib/sampark/dispatch/vobiz-carrier';
import { callIdFor, campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import type { SamparkRepo } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { placeVobizCallDetailed, type VobizConfig } from '@/lib/vobiz/client';
import type { ParentLanguage } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, ORG, school, seedFamilies, testClock, testModeSchool, type TestClock } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const MIN = 60_000;
const CONFIG: VobizConfig = { authId: 'MA_TEST', authToken: 'tok', baseUrl: 'https://api.vobiz.test/api/v1', fromNumber: '+918000000000' };
const LANGUAGES: ParentLanguage[] = ['Nepali', 'Hindi', 'Bengali', 'English'];
const idFor = (gid: string) => intentIdFor(campaignDedupeKey('camp-ptm', gid));

const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
beforeEach(() => {
    process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
});
afterEach(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
});

/** Vobiz's HTTP answers, in order; the last one repeats. Records every request body's call id. */
function vobizHttp(statuses: number[]) {
    const dials: string[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { answer_url: string };
        const principal = new URL(body.answer_url).searchParams.get('t')?.split('.')[0] ?? '';
        dials.push(principal.split('~')[1] ?? '');
        const status = statuses[Math.min(dials.length - 1, statuses.length - 1)];
        return status === 429
            ? new Response('{"error":"rate limit exceeded"}', { status })
            : new Response(JSON.stringify({ request_uuid: `req-${dials.length}` }), { status });
    }) as unknown as typeof fetch;
    const carrier = createVobizNoticeCarrier({
        config: CONFIG,
        publicBaseUrl: 'https://sampark-calls.example.test',
        mintToken: async (domain, principal) => `${principal}.9999999999.${domain}`,
        placeCall: (config, options) => placeVobizCallDetailed(config, options, fetchImpl),
    });
    return { carrier, dials };
}

/** A Test-mode school with `n` families, one per language (each is its language's sample, H9). */
async function testModeWorld(n: number) {
    const repo = createMemorySamparkRepo();
    const clock = testClock();
    await seedFamilies(repo, n, { school: testModeSchool() });
    const seeded = await repo.listGuardians(ORG);
    await repo.upsertGuardians(ORG, seeded.map((g, i) => ({ ...g, crmLanguage: LANGUAGES[i] })));
    const camp = campaign({ mode: 'test' });
    await repo.createCampaign(camp);
    await materialiseCampaignIntents({ repo, clock }, camp, school(testModeSchool()), 'vobiz');
    return { repo, clock };
}

/** Advance to the moment the intent is due again, then tick. */
async function tickWhenDue(repo: SamparkRepo, clock: TestClock, d: Parameters<typeof runDispatchTick>[0], intentId: string) {
    const intent = await repo.getIntent(ORG, intentId);
    if (intent?.notBefore && Date.parse(intent.notBefore) > clock.now().getTime()) clock.set(intent.notBefore);
    return runDispatchTick(d, DEFAULT_OPTS);
}

describe('class gate H7 — carrier busy is free', () => {
    it('three 429s never spend an attempt; the fourth does; then the next attempt goes out under its own id', async () => {
        expect(MAX_CARRIER_REQUEUES).toBe(3);
        const { repo, clock } = await testModeWorld(1);
        const vobiz = vobizHttp([429, 429, 429, 429, 201]);
        const d = deps(repo, clock, vobiz.carrier);
        const id = idFor('g001');

        for (let requeue = 0; requeue < MAX_CARRIER_REQUEUES; requeue++) {
            const report = await tickWhenDue(repo, clock, d, id);
            expect(report).toMatchObject({ dialed: 1, skipped: 0, errors: [] }); // claimed every time: never jammed
            expect(await repo.getCall(ORG, callIdFor(id, 1, requeue))).toMatchObject({ state: 'failed', failureReason: 'vobiz_rate_limited', requeue, attempt: 1 });
            const intent = await repo.getIntent(ORG, id);
            expect(intent).toMatchObject({ status: 'retry_wait', attempts: 0, carrierRequeues: requeue + 1, lastCallId: callIdFor(id, 1, requeue) });
            const wait = Date.parse(intent!.notBefore!) - clock.now().getTime(); // the tick's own instant
            expect(wait).toBeGreaterThanOrEqual(REQUEUE_MIN_MS);
            expect(wait).toBeLessThanOrEqual(REQUEUE_MAX_MS);
        }

        // The fourth refusal in the same attempt is an ordinary retryable failure: the attempt is spent.
        await tickWhenDue(repo, clock, d, id);
        expect(await repo.getIntent(ORG, id)).toMatchObject({
            status: 'retry_wait',
            attempts: 1,
            carrierRequeues: 0,
            lastCallId: callIdFor(id, 1, MAX_CARRIER_REQUEUES),
            notBefore: new Date(clock.now().getTime() + 120 * MIN).toISOString(),
        });

        // Two hours later attempt 2 goes out, as requeue 0 of that attempt.
        const report = await tickWhenDue(repo, clock, d, id);
        expect(report).toMatchObject({ dialed: 1, errors: [] });
        expect(await repo.getIntent(ORG, id)).toMatchObject({ status: 'dialing', attempts: 2, lastCallId: callIdFor(id, 2, 0) });
        expect(await repo.getCall(ORG, callIdFor(id, 2, 0))).toMatchObject({ state: 'dialing', providerCallId: 'req-5', requeue: 0 });

        expect(vobiz.dials).toEqual([callIdFor(id, 1, 0), callIdFor(id, 1, 1), callIdFor(id, 1, 2), callIdFor(id, 1, 3), callIdFor(id, 2, 0)]);
        expect(new Set(vobiz.dials).size).toBe(vobiz.dials.length);
    });

    it('a carrier that refuses for ever ends the intent after maxAttempts × (1 + MAX_CARRIER_REQUEUES) dials, every id unique', async () => {
        const { repo, clock } = await testModeWorld(1);
        const vobiz = vobizHttp([429]);
        const d = deps(repo, clock, vobiz.carrier);
        const id = idFor('g001');
        for (let i = 0; i < 40; i++) {
            const intent = await repo.getIntent(ORG, id);
            if (intent?.status !== 'approved' && intent?.status !== 'retry_wait') break;
            await tickWhenDue(repo, clock, d, id);
        }
        expect(await repo.getIntent(ORG, id)).toMatchObject({ status: 'done', attempts: 3, carrierRequeues: 0 });
        expect(vobiz.dials).toHaveLength(3 * (1 + MAX_CARRIER_REQUEUES));
        expect(new Set(vobiz.dials).size).toBe(vobiz.dials.length);
        const calls = await repo.listCalls(ORG, { limit: 100 });
        expect(calls.every((c) => c.state === 'failed' && c.settledAt)).toBe(true);
    });

    it('with several families queued, refusals never jam a claim and never cost anyone an attempt', async () => {
        const { repo, clock } = await testModeWorld(4);
        // Every other dial refused, the rest accepted (and then hung up by the "webhook" below).
        const vobiz = vobizHttp([429, 201, 429, 201, 429, 201, 429, 201]);
        const d = deps(repo, clock, vobiz.carrier);
        for (let i = 0; i < 30; i++) {
            const report = await runDispatchTick(d, DEFAULT_OPTS);
            expect(report.errors).toEqual([]);
            // A placed call ends at once, unanswered, so the test phone is free for the next tick.
            for (const call of await repo.listCalls(ORG, { limit: 100 })) {
                if (call.state !== 'dialing' || !call.providerCallId) continue;
                await repo.mutateCall(ORG, call.id, (c) => applyCallEvent(c, { type: 'hangup', at: clock.now().toISOString(), cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 }));
                await settleCall({ repo, clock }, ORG, call.id);
            }
            clock.advance(MIN);
        }
        expect(new Set(vobiz.dials).size).toBe(vobiz.dials.length);
        // Each family was refused at most once and reached the carrier once, all on attempt 1.
        for (const g of ['g001', 'g002', 'g003', 'g004']) {
            const intent = await repo.getIntent(ORG, idFor(g));
            expect(intent).toMatchObject({ status: 'retry_wait', attempts: 1, carrierRequeues: 0 });
        }
    });

    it('a duplicated settlement of a refusal requeues once', async () => {
        const { repo, clock } = await testModeWorld(1);
        const id = idFor('g001');
        const intent = (await repo.getIntent(ORG, id))!;
        const call = {
            id: callIdFor(id, 1, 0), orgId: ORG, intentId: id, campaignId: 'camp-ptm', purpose: 'ptm_invite' as const, guardianId: 'g001',
            phoneHash: 'hash:test-phone', phoneLast4: '0001', destination: 'test_phone' as const, language: intent.language, variant: 'default' as const,
            attempt: 1, state: 'dialing' as const, leaseUntil: new Date(clock.now().getTime() + 120_000).toISOString(), carrier: 'vobiz' as const,
            providerCallId: null, outcome: { heard: 'none' as const, digits: '', confirmed: false, declined: false, optOut: 'none' as const },
            durationSeconds: null, billedSeconds: null, costPaise: null, audioSeconds: 40, createdAt: clock.now().toISOString(),
            updatedAt: clock.now().toISOString(), endedAt: null, failureReason: null, settledAt: null, requeue: 0,
        };
        expect(await repo.claimIntentForDial(ORG, id, call, clock.now())).toBe('claimed');
        await repo.updateCall(ORG, call.id, applyCallEvent(call, { type: 'place_failed', at: clock.now().toISOString(), reason: 'vobiz_rate_limited' }));
        const results = await Promise.all([
            settleCall({ repo, clock }, ORG, call.id, { requeue: true }),
            settleCall({ repo, clock }, ORG, call.id, { requeue: true }),
        ]);
        expect(results.sort()).toEqual(['noop', 'settled']);
        expect(await repo.getIntent(ORG, id)).toMatchObject({ status: 'retry_wait', attempts: 0, carrierRequeues: 1 });
    });
});
