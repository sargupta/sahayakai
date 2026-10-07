/**
 * @jest-environment node
 *
 * CLASS GATE H3 — a paused school starts no call (EDGE_CASES.md §2 gap 9).
 *
 * Before the hardening sprint the only way to stop a school's calls was a global
 * flag behind a deploy. The class: while `school.pause` is set, no call starts
 * that the pause covers — whatever the purpose, campaign or intent — and nothing
 * about the families changes, so lifting the pause carries on exactly where it
 * stopped.
 *
 *   - scope 'all': nothing is dialled, emergency closures included.
 *   - scope 'routine': only emergency_closure intents are dialled.
 *   - Intents without a campaign obey the pause too (the mode check does not apply).
 *   - Holds are written and audited on change only, and cleared on resume.
 *   - The sweep and the settle repair still run for a paused school.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { campaignHoldReason, HOLD_PARKED_NOT_BEFORE, runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { pauseStopsPurpose } from '@/lib/sampark/policy/pause';
import { PURPOSE_CATALOGUE } from '@/lib/sampark/catalogue';
import { callIdFor, campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import type { AuditEntry, SamparkRepo } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { Intent, PurposeId, SchoolPause } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, ORG, school, scriptedCarrier, seedFamilies, testClock, type TestClock } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const PAUSE_ALL: SchoolPause = { at: '2026-10-07T05:00:00.000Z', by: 'principal-1', reason: 'Exam week', scope: 'all' };
const PAUSE_ROUTINE: SchoolPause = { ...PAUSE_ALL, scope: 'routine' };

/** A PTM and an emergency closure over the same three families, plus one intent with no campaign. */
async function world() {
    const repo = createMemorySamparkRepo();
    const clock = testClock(); // Wednesday 11:00 IST
    await seedFamilies(repo, 3);
    const ptm = campaign({ id: 'camp-ptm', mode: 'practice' });
    const closure = campaign({
        id: 'camp-d4',
        mode: 'practice',
        purpose: 'emergency_closure',
        facts: { kind: 'emergency_closure', date: '2026-10-07', reason: 'heavy_rain', busesRunning: false },
    });
    for (const c of [ptm, closure]) {
        await repo.createCampaign(c);
        await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
    }
    const loose: Intent = {
        ...(await repo.getIntent(ORG, intentIdFor(campaignDedupeKey('camp-ptm', 'g001'))))!,
        id: 'loose-intent',
        dedupeKey: 'loose:g001',
        campaignId: null,
    };
    await repo.createIntentIfAbsent(loose);
    const carrier = scriptedCarrier(() => 'full');
    const audits: AuditEntry[] = [];
    const append = repo.appendAudit.bind(repo);
    jest.spyOn(repo, 'appendAudit').mockImplementation(async (orgId, entry) => {
        audits.push(entry);
        await append(orgId, entry);
    });
    return { repo, clock, carrier, audits, d: deps(repo, clock, carrier) };
}

async function setPause(repo: SamparkRepo, pause: SchoolPause | null) {
    await repo.upsertSchool({ ...(await repo.getSchool(ORG))!, pause });
}

async function ticks(d: Parameters<typeof runDispatchTick>[0], clock: TestClock, n: number) {
    for (let i = 0; i < n; i++) {
        await runDispatchTick(d, DEFAULT_OPTS);
        clock.advance(60_000);
    }
}

const allIntents = async (repo: SamparkRepo) =>
    [...(await repo.listIntentsByCampaign(ORG, 'camp-ptm')), ...(await repo.listIntentsByCampaign(ORG, 'camp-d4')), (await repo.getIntent(ORG, 'loose-intent'))!];

describe('class gate H3 — school pause', () => {
    it('the rule: scope all stops every purpose; scope routine stops every purpose but the emergency closure', () => {
        for (const id of Object.keys(PURPOSE_CATALOGUE) as PurposeId[]) {
            expect(pauseStopsPurpose(PAUSE_ALL, id)).toBe(true);
            expect(pauseStopsPurpose(PAUSE_ROUTINE, id)).toBe(id !== 'emergency_closure');
            expect(pauseStopsPurpose(null, id)).toBe(false);
            expect(pauseStopsPurpose(undefined, id)).toBe(false);
        }
        expect(campaignHoldReason({ mode: 'practice', pause: PAUSE_ALL }, { mode: 'practice', purpose: 'ptm_invite' })).toBe('school_paused');
    });

    it("scope 'all': nothing is dialled, emergency closures included, and no intent changes", async () => {
        const { repo, clock, carrier, d } = await world();
        await setPause(repo, PAUSE_ALL);
        const before = await allIntents(repo);
        await ticks(d, clock, 5);
        expect(carrier.requests).toHaveLength(0);
        // Status, attempts and history untouched; campaign intents are parked out of the due list.
        const strip = (list: typeof before) => list.map(({ notBefore: _n, updatedAt: _u, ...rest }) => rest);
        const after = await allIntents(repo);
        expect(strip(after)).toEqual(strip(before));
        expect(after.filter((i) => i.campaignId).every((i) => i.notBefore === HOLD_PARKED_NOT_BEFORE)).toBe(true);
        expect((await repo.getCampaign(ORG, 'camp-ptm'))?.holdReason).toBe('school_paused');
        expect((await repo.getCampaign(ORG, 'camp-d4'))?.holdReason).toBe('school_paused');
    });

    it("scope 'routine': only the emergency closure's intents are dialled", async () => {
        const { repo, clock, carrier, d } = await world();
        await setPause(repo, PAUSE_ROUTINE);
        await ticks(d, clock, 5);
        expect(carrier.requests.length).toBe(3);
        expect(carrier.requests.every((r) => r.call.purpose === 'emergency_closure')).toBe(true);
        for (const i of await repo.listIntentsByCampaign(ORG, 'camp-ptm')) expect(i).toMatchObject({ status: 'approved', attempts: 0 });
        expect(await repo.getIntent(ORG, 'loose-intent')).toMatchObject({ status: 'approved', attempts: 0 });
        expect((await repo.getCampaign(ORG, 'camp-ptm'))?.holdReason).toBe('school_paused');
        expect((await repo.getCampaign(ORG, 'camp-d4'))?.holdReason ?? null).toBeNull();
    });

    it('clearing the pause resumes dialling, and the hold and resume are audited once each', async () => {
        const { repo, clock, carrier, audits, d } = await world();
        await setPause(repo, PAUSE_ALL);
        await ticks(d, clock, 4);
        expect(carrier.requests).toHaveLength(0);
        await setPause(repo, null);
        await ticks(d, clock, 2);
        // 3 PTM + 3 closure + the intent without a campaign (the mode check does not apply to it).
        expect(carrier.requests).toHaveLength(7);
        expect(carrier.requests.some((r) => r.call.intentId === 'loose-intent')).toBe(true);
        for (const id of ['camp-ptm', 'camp-d4']) {
            expect((await repo.getCampaign(ORG, id))?.holdReason).toBeNull();
            expect(audits.filter((e) => e.target === `campaign/${id}`).map((e) => e.action)).toEqual(['campaign.hold', 'campaign.resume']);
        }
    });

    it('a pause set after a call was claimed does not stop the sweep: the lost call still goes to a person', async () => {
        const target = intentIdFor(campaignDedupeKey('camp-ptm', 'g002'));
        const repo = createMemorySamparkRepo({ faults: { failAfterClaim: (id) => id === target } });
        const clock = testClock();
        await seedFamilies(repo, 2);
        const ptm = campaign({ mode: 'practice' });
        await repo.createCampaign(ptm);
        await materialiseCampaignIntents({ repo, clock }, ptm, school(), 'simulated');
        const d = deps(repo, clock, scriptedCarrier(() => 'full'));
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(await repo.getIntent(ORG, target)).toMatchObject({ status: 'dialing' });

        await setPause(repo, PAUSE_ALL);
        clock.advance(DEFAULT_OPTS.leaseMs + 1000);
        expect((await runDispatchTick(d, DEFAULT_OPTS)).swept).toBe(1);
        expect(await repo.getCall(ORG, callIdFor(target, 1))).toMatchObject({ state: 'unknown' });
        expect(await repo.getIntent(ORG, target)).toMatchObject({ status: 'needs_review' });
    });

    it('a pause does not stop the settle repair either: an ended, unsettled call is still settled', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 1);
        const ptm = campaign({ mode: 'practice' });
        await repo.createCampaign(ptm);
        await materialiseCampaignIntents({ repo, clock }, ptm, school(), 'simulated');
        const id = intentIdFor(campaignDedupeKey('camp-ptm', 'g001'));
        // A call claimed and ended, whose settlement never ran (as if the process died mid-settle).
        const intent = (await repo.getIntent(ORG, id))!;
        const callId = callIdFor(id, 1);
        await repo.claimIntentForDial(ORG, id, {
            id: callId, orgId: ORG, intentId: id, campaignId: 'camp-ptm', purpose: 'ptm_invite', guardianId: 'g001',
            phoneHash: 'hash:g001', phoneLast4: '0000', destination: 'guardian', language: intent.language, variant: 'default',
            attempt: 1, state: 'dialing', leaseUntil: new Date(clock.now().getTime() + 120_000).toISOString(), carrier: 'simulated',
            providerCallId: null, outcome: { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' },
            durationSeconds: null, billedSeconds: null, costPaise: null, audioSeconds: 40, createdAt: clock.now().toISOString(),
            updatedAt: clock.now().toISOString(), endedAt: null, failureReason: null, settledAt: null, requeue: 0,
        }, clock.now());
        await repo.updateCall(ORG, callId, { state: 'no_answer', endedAt: clock.now().toISOString() });

        await setPause(repo, PAUSE_ALL);
        clock.advance(6 * 60_000);
        await runDispatchTick(deps(repo, clock, scriptedCarrier(() => 'full')), DEFAULT_OPTS);
        expect((await repo.getCall(ORG, callId))?.settledAt).toBe(clock.now().toISOString());
        expect(await repo.getIntent(ORG, id)).toMatchObject({ status: 'retry_wait' });
    });
});
