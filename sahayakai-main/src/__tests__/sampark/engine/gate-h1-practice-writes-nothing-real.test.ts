/**
 * @jest-environment node
 *
 * CLASS GATE H1 — a Practice rehearsal writes nothing real (EDGE_CASES.md §2 gap 1).
 *
 * The simulated carrier presses 9 (and 99) on a share of answered calls by design.
 * Before the hardening sprint those presses became real opt-outs against real
 * guardians, and every simulated call counted towards the family's 30-day cap, so
 * a school that rehearsed twice could no longer reach its own parents. The class:
 * no simulated call, whatever it did, may change a record that a real call reads.
 *
 *   - A whole Practice campaign over many families, through the real simulated
 *     carrier and every retry, leaves zero suppressions; its 9s are only audited.
 *   - Every guardian's frequency count stays 0, so further Practice campaigns
 *     materialise with nothing blocked.
 *   - The settle helpers refuse on their own, for any outcome: a simulated call
 *     with any opt-out or a dead-number cause writes no suppression.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { recordInvalidNumber, recordOptOut } from '@/lib/sampark/dispatch/settle';
import { createSimulatedCarrier } from '@/lib/sampark/dispatch/simulated-carrier';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { AuditEntry } from '@/lib/sampark/ports';
import type { Campaign, CallOutcome, SamparkCall } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, ORG, school, seedFamilies, testClock } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const FAMILIES = 160;
const TEN_MIN = 10 * 60_000;

async function runToCompletion(repo: ReturnType<typeof createMemorySamparkRepo>, clock: ReturnType<typeof testClock>, campaignId: string) {
    const d = deps(repo, clock, createSimulatedCarrier());
    for (let i = 0; i < 400; i++) {
        await runDispatchTick(d, DEFAULT_OPTS);
        if ((await repo.getCampaign(ORG, campaignId))?.status === 'completed') return;
        clock.advance(TEN_MIN);
    }
    throw new Error(`campaign ${campaignId} never completed`);
}

describe('class gate H1 — Practice writes nothing real', () => {
    it('a whole Practice campaign, 9s and 99s included, leaves no suppression and no frequency count', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        const gids = await seedFamilies(repo, FAMILIES);
        const audits: AuditEntry[] = [];
        const append = repo.appendAudit.bind(repo);
        jest.spyOn(repo, 'appendAudit').mockImplementation(async (orgId, entry) => {
            audits.push(entry);
            await append(orgId, entry);
        });

        const camp = campaign({ mode: 'practice' });
        await repo.createCampaign(camp);
        expect((await materialiseCampaignIntents({ repo, clock }, camp, school(), 'simulated')).created).toBe(FAMILIES);
        await runToCompletion(repo, clock, camp.id);

        const calls = await repo.listCalls(ORG, { limit: 10_000 });
        expect(calls.every((c) => c.carrier === 'simulated')).toBe(true);
        const pressed9 = calls.filter((c) => c.outcome.optOut !== 'none');
        // Not vacuous: the simulated carrier really did press 9 and 99 in this campaign.
        expect(pressed9.some((c) => c.outcome.optOut === 'confirmed')).toBe(true);
        expect(pressed9.some((c) => c.outcome.optOut === 'requested')).toBe(true);

        expect(await repo.listSuppressions(ORG)).toEqual([]);
        expect(audits.filter((e) => e.action === 'suppression.add')).toEqual([]);
        expect(audits.filter((e) => e.action === 'practice_call.opt_out_pressed').map((e) => e.target).sort()).toEqual(
            pressed9.map((c) => `call/${c.id}`).sort(),
        );
        for (const gid of gids) {
            expect(await repo.countCallsToPhoneSince(ORG, `hash:${gid}`, new Date(0), false)).toBe(0);
            expect(await repo.countCallsToPhoneSince(ORG, `hash:${gid}`, new Date(0), true)).toBe(0);
        }
    });

    it('so rehearsing again and again never blocks a family: further Practice campaigns materialise with nothing blocked', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 40);
        const ptm = (id: string, date: string): Campaign =>
            campaign({ id, mode: 'practice', facts: { kind: 'ptm_invite', date, time: { hour: 10, minute: 0 }, venueId: 'hall' } });
        // Three attempts each, three campaigns: up to 9 simulated calls per family, over the cap of 4.
        for (const [id, date] of [['p1', '2026-10-10'], ['p2', '2026-10-17'], ['p3', '2026-10-24']] as const) {
            const c = ptm(id, date);
            await repo.createCampaign(c);
            const res = await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
            expect(res).toEqual({ created: 40, existing: 0, blocked: {} });
            await runToCompletion(repo, clock, c.id);
        }
        const intents = [...(await repo.listIntentsByCampaign(ORG, 'p3'))];
        expect(intents.filter((i) => i.blockReason === 'frequency_cap' || i.blockReason === 'suppressed')).toEqual([]);
    });

    it.each<CallOutcome['optOut']>(['requested', 'confirmed'])('a simulated call with a %s opt-out never writes a suppression, on any destination', async (optOut) => {
        const repo = createMemorySamparkRepo();
        const now = new Date('2026-10-07T05:30:00.000Z');
        for (const destination of ['guardian', 'test_phone', undefined] as const) {
            const call = simulatedCall({ destination, outcome: { heard: 'full', digits: optOut === 'confirmed' ? '99' : '9', confirmed: false, declined: false, optOut } });
            await recordOptOut(repo, call, now);
        }
        expect(await repo.listSuppressions(ORG)).toEqual([]);
    });

    it.each(['UNALLOCATED_NUMBER', 'INVALID_NUMBER_FORMAT', 'NUMBER_CHANGED'])('a simulated call ending %s never writes a suppression either', async (hangupCause) => {
        const repo = createMemorySamparkRepo();
        await recordInvalidNumber(repo, simulatedCall({ state: 'failed', hangupCause }), new Date('2026-10-07T05:30:00.000Z'));
        expect(await repo.listSuppressions(ORG)).toEqual([]);
    });
});

function simulatedCall(overrides: Partial<SamparkCall>): SamparkCall {
    return {
        id: 'sim-call-1',
        orgId: ORG,
        intentId: 'intent-1',
        campaignId: 'camp-ptm',
        purpose: 'ptm_invite',
        guardianId: 'g001',
        phoneHash: 'hash:g001',
        phoneLast4: '0001',
        destination: 'guardian',
        language: 'Nepali',
        variant: 'default',
        attempt: 1,
        state: 'completed',
        leaseUntil: '2026-10-07T05:32:00.000Z',
        carrier: 'simulated',
        providerCallId: 'sim-1',
        outcome: { heard: 'full', digits: '', confirmed: false, declined: false, optOut: 'none' },
        durationSeconds: 40,
        billedSeconds: 60,
        costPaise: null,
        audioSeconds: 40,
        createdAt: '2026-10-07T05:30:00.000Z',
        updatedAt: '2026-10-07T05:31:00.000Z',
        endedAt: '2026-10-07T05:31:00.000Z',
        failureReason: null,
        ...overrides,
    };
}
