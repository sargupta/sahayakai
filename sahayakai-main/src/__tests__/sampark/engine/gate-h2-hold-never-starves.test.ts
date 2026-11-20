/**
 * @jest-environment node
 *
 * CLASS GATE H2/H3 — a held campaign never starves another campaign.
 *
 * Due intents are listed oldest first, and a tick reads only a few times its dial budget
 * (in Test mode the budget is one call). Before parking, a held campaign's intents sat at the
 * front of that list on every tick, so a campaign behind them was never reached: a principal
 * who rehearsed in Practice and then switched the school to Test would find the new Test
 * campaign never rang, because the old Practice campaign (now held as 'mode_changed') had
 * more intents than the tick reads. The class: whatever is held, and however many intents it
 * holds, every campaign that may dial is dialled; and the held campaign's intents are due
 * again as soon as its hold clears, or expire once it is past its expiry, so it completes.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { HOLD_PARKED_NOT_BEFORE, runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';

import { campaign, DEFAULT_OPTS, deps, ORG, school, scriptedCarrier, seedFamilies, testClock } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const HELD_FAMILIES = 300; // far more than a tick reads (DEFAULT_OPTS budget × 5)

async function world() {
    const repo = createMemorySamparkRepo();
    const clock = testClock();
    await seedFamilies(repo, HELD_FAMILIES);
    // The older campaign was approved before modes were pinned, so it is held ('mode_not_pinned')
    // with every family still waiting. (A Practice campaign held after a switch to Test is the
    // same case: the hold, not its reason, is what used to starve the list.)
    const older = campaign({ id: 'camp-older' });
    await repo.createCampaign(older);
    await materialiseCampaignIntents({ repo, clock }, older, school(), 'simulated');
    clock.advance(60_000);
    // The newer campaign, approved in Practice: it may dial.
    const newer = campaign({ id: 'camp-newer', mode: 'practice' });
    await repo.createCampaign(newer);
    await materialiseCampaignIntents({ repo, clock }, newer, school(), 'simulated');
    const carrier = scriptedCarrier(() => 'full', 'simulated');
    return { repo, clock, carrier, d: deps(repo, clock, carrier) };
}

describe('class gate — a held campaign never starves another', () => {
    it('the newer campaign is dialled to completion while the older one is held', async () => {
        const { repo, clock, carrier, d } = await world();
        const approvedOlder = (await repo.listIntentsByCampaign(ORG, 'camp-older')).filter((i) => i.status === 'approved');
        expect(approvedOlder.length).toBeGreaterThan(DEFAULT_OPTS.maxDialsPerSchoolPerTick * 5);
        const waitingNewer = (await repo.listIntentsByCampaign(ORG, 'camp-newer')).filter((i) => i.status === 'approved').length;
        for (let i = 0; i < 40; i++) {
            await runDispatchTick(d, DEFAULT_OPTS);
            clock.advance(60_000);
        }
        expect(carrier.requests.length).toBe(waitingNewer);
        expect(carrier.requests.every((r) => r.call.campaignId === 'camp-newer')).toBe(true);
        expect((await repo.getCampaign(ORG, 'camp-older'))?.holdReason).toBe('mode_not_pinned');
        for (const i of await repo.listIntentsByCampaign(ORG, 'camp-older')) {
            if (i.status === 'approved') expect(i.notBefore).toBe(HOLD_PARKED_NOT_BEFORE);
        }
    }, 30_000);

    it('when the hold clears, every parked intent is due again at once', async () => {
        const { repo, clock, carrier, d } = await world();
        await runDispatchTick(d, DEFAULT_OPTS);
        // A person pins the older campaign to the school's mode: the hold clears.
        await repo.updateCampaign(ORG, 'camp-older', { mode: 'practice' });
        await runDispatchTick(d, DEFAULT_OPTS);
        const older = await repo.listIntentsByCampaign(ORG, 'camp-older');
        expect(older.some((i) => i.notBefore === HOLD_PARKED_NOT_BEFORE)).toBe(false);
        expect((await repo.getCampaign(ORG, 'camp-older'))?.holdReason ?? null).toBeNull();
        clock.advance(60_000);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests.some((r) => r.call.campaignId === 'camp-older')).toBe(true);
    }, 30_000);

    it('a held campaign past its expiry expires what is waiting, and completes', async () => {
        const { repo, clock, d } = await world();
        await runDispatchTick(d, DEFAULT_OPTS);
        const camp = (await repo.getCampaign(ORG, 'camp-older'))!;
        clock.set(new Date(Date.parse(camp.expiresAt) + 60_000));
        await runDispatchTick(d, DEFAULT_OPTS);
        const left = (await repo.listIntentsByCampaign(ORG, 'camp-older')).filter((i) => i.status === 'approved' || i.status === 'retry_wait');
        expect(left).toEqual([]);
        expect((await repo.getCampaign(ORG, 'camp-older'))?.status).toBe('completed');
    }, 30_000);
});
