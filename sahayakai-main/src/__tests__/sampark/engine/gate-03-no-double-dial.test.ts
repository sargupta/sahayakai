/**
 * @jest-environment node
 *
 * CLASS GATE 3 — a simulated crash between dialing and recording never produces
 * a second dial (plan §4⑦). The carrier is contacted only after a claim, a call
 * lost in 'dialing' is swept to 'unknown' + 'needs_review' and never re-dialled,
 * and neither overlapping ticks nor a lost lease can make two dispatchers dial
 * the same attempt.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { callIdFor, campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import type { SamparkRepo } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';

import { campaign, DEFAULT_OPTS, deps, ORG, school, scriptedCarrier, seedFamilies, testClock, type ScriptedFate } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const MIN = 60_000;
const idFor = (gid: string) => intentIdFor(campaignDedupeKey('camp-ptm', gid));

async function materialised(repo: SamparkRepo, n: number) {
    const clock = testClock();
    await seedFamilies(repo, n);
    const c = campaign();
    await repo.createCampaign(c);
    await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
    return clock;
}

describe('class gate 3 — crash after claim', () => {
    it('the crashed intent is never placed, is swept to unknown/needs_review after its lease, and never dialled again', async () => {
        const target = idFor('g002');
        const repo = createMemorySamparkRepo({ faults: { failAfterClaim: (id) => id === target } });
        const clock = await materialised(repo, 4);
        // Everyone else fails to answer, so their intents keep coming back for retries across the ticks below.
        const carrier = scriptedCarrier(() => 'no_answer');
        const d = deps(repo, clock, carrier);

        const first = await runDispatchTick(d, DEFAULT_OPTS);
        expect(first.errors).toEqual([expect.stringContaining('SIMULATED_CRASH_AFTER_CLAIM')]);
        expect(carrier.placesFor(target)).toBe(0);
        expect(await repo.getIntent(ORG, target)).toMatchObject({ status: 'dialing', attempts: 1 });
        expect(await repo.getCall(ORG, callIdFor(target, 1))).toMatchObject({ state: 'dialing' });

        // Inside the lease: nothing happens to it.
        clock.advance(DEFAULT_OPTS.leaseMs - 1000);
        expect((await runDispatchTick(d, DEFAULT_OPTS)).swept).toBe(0);

        // Past the lease: swept, never re-dialled.
        clock.advance(2000);
        expect((await runDispatchTick(d, DEFAULT_OPTS)).swept).toBe(1);
        expect(await repo.getCall(ORG, callIdFor(target, 1))).toMatchObject({ state: 'unknown' });
        expect(await repo.getIntent(ORG, target)).toMatchObject({ status: 'needs_review' });

        // Many more ticks across the day (the others retry every 2 h until exhausted).
        for (let i = 0; i < 40; i++) {
            clock.advance(15 * MIN);
            await runDispatchTick(d, DEFAULT_OPTS);
        }
        expect(carrier.placesFor(target)).toBe(0);
        expect(await repo.getCall(ORG, callIdFor(target, 2))).toBeNull();
        expect((await repo.getIntent(ORG, target))?.status).toBe('needs_review');
        // The other families were retried up to maxAttempts and no further.
        for (const g of ['g001', 'g003', 'g004']) expect(carrier.placesFor(idFor(g))).toBe(3);
        expect((await repo.getCampaign(ORG, 'camp-ptm'))?.counts.failed).toBe(1);
    });

    it('a crash AFTER the carrier accepted the call (before recording) produces at most one dial, ever', async () => {
        const repo = createMemorySamparkRepo();
        const clock = await materialised(repo, 2);
        const target = idFor('g001');
        const carrier = scriptedCarrier((req) => (req.call.intentId === target ? 'throw' : 'full'));
        const d = deps(repo, clock, carrier);

        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.placesFor(target)).toBe(1);
        expect(await repo.getCall(ORG, callIdFor(target, 1))).toMatchObject({ state: 'dialing' });

        for (let i = 0; i < 20; i++) {
            clock.advance(10 * MIN);
            await runDispatchTick(d, DEFAULT_OPTS);
        }
        expect(carrier.placesFor(target)).toBe(1);
        expect(await repo.getCall(ORG, callIdFor(target, 1))).toMatchObject({ state: 'unknown' });
        expect((await repo.getIntent(ORG, target))?.status).toBe('needs_review');
    });
});

describe('class gate 3 — concurrency', () => {
    it('two concurrent ticks on the same repo: the lease admits one, and no intent is dialled twice', async () => {
        const repo = createMemorySamparkRepo();
        const clock = await materialised(repo, 10);
        const carrier = scriptedCarrier(() => 'full');
        const [a, b] = await Promise.all([
            runDispatchTick({ ...deps(repo, clock, carrier), holder: 'tick-a' }, DEFAULT_OPTS),
            runDispatchTick({ ...deps(repo, clock, carrier), holder: 'tick-b' }, DEFAULT_OPTS),
        ]);
        expect([a.skipped, b.skipped].sort()).toEqual([0, 1]);
        expect(carrier.requests).toHaveLength(10);
        for (let i = 1; i <= 10; i++) expect(carrier.placesFor(idFor(`g${String(i).padStart(3, '0')}`))).toBe(1);
    });

    it('even with the lease defeated (a stuck or cross-region lock), the claim alone prevents a double dial', async () => {
        const repo = createMemorySamparkRepo();
        const clock = await materialised(repo, 10);
        const leaky: SamparkRepo = { ...repo, acquireLock: async () => true, releaseLock: async () => undefined };
        const fates: ScriptedFate[] = ['full', 'no_answer', 'key1', 'busy', 'partial'];
        const carrier = scriptedCarrier((req) => fates[Number(req.call.guardianId.slice(1)) % fates.length]);
        const d1 = { ...deps(leaky, clock, carrier), holder: 'tick-a' };
        const d2 = { ...deps(leaky, clock, carrier), holder: 'tick-b' };
        const d3 = { ...deps(leaky, clock, carrier), holder: 'tick-c' };

        const reports = await Promise.all([runDispatchTick(d1, DEFAULT_OPTS), runDispatchTick(d2, DEFAULT_OPTS), runDispatchTick(d3, DEFAULT_OPTS)]);
        expect(reports.reduce((n, r) => n + r.dialed, 0)).toBe(10);
        const ids = carrier.requests.map((r) => r.call.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (let i = 1; i <= 10; i++) expect(carrier.placesFor(idFor(`g${String(i).padStart(3, '0')}`))).toBe(1);

        // And again for the retries, concurrently, two hours later.
        clock.advance(2 * 60 * MIN);
        await Promise.all([runDispatchTick(d1, DEFAULT_OPTS), runDispatchTick(d2, DEFAULT_OPTS), runDispatchTick(d3, DEFAULT_OPTS)]);
        const all = carrier.requests.map((r) => r.call.id);
        expect(new Set(all).size).toBe(all.length);
        for (const r of carrier.requests) expect(r.call.id).toBe(callIdFor(r.call.intentId, r.call.attempt));
    });
});
