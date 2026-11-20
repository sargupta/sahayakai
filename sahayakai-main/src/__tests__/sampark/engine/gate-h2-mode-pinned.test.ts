/**
 * @jest-environment node
 *
 * CLASS GATE H2 — a campaign dials only in the mode it was approved in
 * (EDGE_CASES.md §2 gap 2).
 *
 * Before the hardening sprint a campaign had no mode of its own: flipping the
 * school from Practice to Test (or Live) mid-campaign started real calls from a
 * campaign nobody approved for them, and flipping back settled families as done
 * on the simulated carrier without ringing anyone. The class: for EVERY pair
 * (campaign mode, school mode) that differs, and for a campaign with no pinned
 * mode, nothing is dialled and no intent changes — on any carrier.
 *
 *   - The campaign is held with 'mode_changed' or 'mode_not_pinned', written and
 *     audited once (not on every tick). Each intent keeps its status, attempts and
 *     history byte for byte; only its notBefore is parked (HOLD_PARKED_NOT_BEFORE) so a
 *     held campaign cannot starve the campaigns that may dial (gate-h2-hold-never-starves).
 *   - Positive control: when the modes agree the same campaign dials.
 *   - When the school returns to the campaign's mode the hold clears, once.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { HOLD_PARKED_NOT_BEFORE, runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { AuditEntry, SamparkRepo } from '@/lib/sampark/ports';
import type { SamparkMode } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, ORG, school, scriptedCarrier, seedFamilies, testClock, testModeSchool, type TestClock } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const MODES: SamparkMode[] = ['practice', 'test', 'live'];
const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
beforeEach(() => {
    process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
});
afterEach(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
});

/** The school in `mode` (Test mode with its test phone). */
function schoolIn(mode: SamparkMode) {
    return school(mode === 'test' ? testModeSchool() : { mode });
}

/**
 * Three approved intents for a campaign pinned to `campaignMode` (or unpinned), materialised as
 * a Practice school would, then the school moved to `schoolMode`. Every carrier records.
 */
async function world(campaignMode: SamparkMode | undefined, schoolMode: SamparkMode) {
    const repo = createMemorySamparkRepo();
    const clock = testClock();
    await seedFamilies(repo, 3, { guardian: { phoneClass: 'mobile' } });
    // One family per language, so a Test campaign's per-language sample (H9) is all three of them.
    const seeded = await repo.listGuardians(ORG);
    await repo.upsertGuardians(ORG, seeded.map((g, i) => ({ ...g, crmLanguage: (['Nepali', 'Hindi', 'Bengali'] as const)[i] })));
    const camp = campaign(campaignMode ? { mode: campaignMode } : {});
    await repo.createCampaign(camp);
    await materialiseCampaignIntents({ repo, clock }, camp, school(), 'simulated');
    await repo.upsertSchool(schoolIn(schoolMode));
    const simulated = scriptedCarrier(() => 'full', 'simulated');
    const vobiz = scriptedCarrier(() => 'full', 'vobiz');
    const audits: AuditEntry[] = [];
    const append = repo.appendAudit.bind(repo);
    jest.spyOn(repo, 'appendAudit').mockImplementation(async (orgId, entry) => {
        audits.push(entry);
        await append(orgId, entry);
    });
    const d = deps(repo, clock, simulated, { carrierFor: (s) => (s.mode === 'practice' ? simulated : vobiz) });
    return { repo, clock, camp, simulated, vobiz, audits, d };
}

async function ticks(d: Parameters<typeof runDispatchTick>[0], clock: TestClock, n: number) {
    for (let i = 0; i < n; i++) {
        await runDispatchTick(d, DEFAULT_OPTS);
        clock.advance(60_000);
    }
}

const intents = (repo: SamparkRepo) => repo.listIntentsByCampaign(ORG, 'camp-ptm');

/** Everything a hold must leave alone: all but the parked notBefore and its updatedAt stamp. */
const held = (list: Awaited<ReturnType<typeof intents>>) => list.map(({ notBefore: _n, updatedAt: _u, ...rest }) => rest);

async function expectParkedUnchanged(repo: SamparkRepo, before: Awaited<ReturnType<typeof intents>>) {
    const after = await intents(repo);
    expect(held(after)).toEqual(held(before));
    // Parked, or (a school the dispatcher refuses outright, e.g. Live) never even read.
    const was = new Map(before.map((i) => [i.id, i.notBefore]));
    expect(after.every((i) => i.notBefore === HOLD_PARKED_NOT_BEFORE || i.notBefore === was.get(i.id))).toBe(true);
}

const MISMATCHES: [SamparkMode, SamparkMode][] = MODES.flatMap((c) => MODES.filter((s) => s !== c).map((s) => [c, s] as [SamparkMode, SamparkMode]));

describe('class gate H2 — mode pinned at approval', () => {
    it('covers every differing pair', () => {
        expect(MISMATCHES).toHaveLength(6);
    });

    it.each(MISMATCHES)('campaign approved in %s, school now in %s: nothing dialled, no intent changes, held as mode_changed', async (campaignMode, schoolMode) => {
        const { repo, clock, simulated, vobiz, audits, d } = await world(campaignMode, schoolMode);
        const before = await intents(repo);
        await ticks(d, clock, 5);
        expect(simulated.requests).toHaveLength(0);
        expect(vobiz.requests).toHaveLength(0);
        expect(await repo.listCalls(ORG, { limit: 10 })).toEqual([]);
        await expectParkedUnchanged(repo, before);
        expect((await repo.getCampaign(ORG, 'camp-ptm'))?.holdReason).toBe('mode_changed');
        // Written once, not once a tick.
        expect(audits.filter((e) => e.action === 'campaign.hold')).toEqual([
            expect.objectContaining({ target: 'campaign/camp-ptm', detail: { reason: 'mode_changed', from: null } }),
        ]);
    });

    it.each(MODES)('a campaign with no pinned mode never dials, school in %s', async (schoolMode) => {
        const { repo, clock, simulated, vobiz, audits, d } = await world(undefined, schoolMode);
        const before = await intents(repo);
        await ticks(d, clock, 5);
        expect(simulated.requests).toHaveLength(0);
        expect(vobiz.requests).toHaveLength(0);
        await expectParkedUnchanged(repo, before);
        expect((await repo.getCampaign(ORG, 'camp-ptm'))?.holdReason).toBe('mode_not_pinned');
        expect(audits.filter((e) => e.action === 'campaign.hold')).toHaveLength(1);
    });

    it.each(['practice', 'test'] as const)('positive control: approved in %s and the school still in it → it dials', async (mode) => {
        const { repo, clock, simulated, vobiz, d } = await world(mode, mode);
        await ticks(d, clock, 3); // Test mode rings the test phone one call per tick
        expect(simulated.requests.length + vobiz.requests.length).toBe(3);
        expect((mode === 'practice' ? simulated : vobiz).requests).toHaveLength(3);
        expect((await repo.getCampaign(ORG, 'camp-ptm'))?.holdReason ?? null).toBeNull();
    });

    it('flipping back to the approved mode clears the hold once and the campaign dials', async () => {
        const { repo, clock, simulated, vobiz, audits, d } = await world('practice', 'test');
        await ticks(d, clock, 3);
        expect(vobiz.requests).toHaveLength(0);
        await repo.upsertSchool(schoolIn('practice'));
        await ticks(d, clock, 3);
        expect(simulated.requests).toHaveLength(3);
        expect(vobiz.requests).toHaveLength(0);
        expect((await repo.getCampaign(ORG, 'camp-ptm'))?.holdReason).toBeNull();
        expect(audits.filter((e) => e.action === 'campaign.hold' || e.action === 'campaign.resume').map((e) => [e.action, e.detail])).toEqual([
            ['campaign.hold', { reason: 'mode_changed', from: null }],
            ['campaign.resume', { from: 'mode_changed' }],
        ]);
    });

    it('a Test campaign whose school went back to Practice never settles a family as done on the simulated carrier', async () => {
        // The original bug's other half: flipping modes must not quietly finish families.
        const { repo, clock, d } = await world('test', 'practice');
        await ticks(d, clock, 10);
        for (const i of await intents(repo)) expect(i).toMatchObject({ status: 'approved', attempts: 0, lastCallId: null });
        expect((await repo.getCampaign(ORG, 'camp-ptm'))?.status).toBe('scheduled');
    });
});
