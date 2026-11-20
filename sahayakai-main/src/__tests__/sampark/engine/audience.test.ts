/**
 * @jest-environment node
 */
import { bundleAudience, materialiseCampaignIntents } from '@/lib/sampark/audience';
import { campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SamparkRepo } from '@/lib/sampark/ports';

import { campaign, guardian, ORG, prefs, school, student, testClock } from './_fixtures';

const clock = testClock();
const idFor = (campaignId: string, guardianId: string) => intentIdFor(campaignDedupeKey(campaignId, guardianId));

/**
 * Planted families:
 *  - Mother gM of siblings a (7B) and b (3A)                      → one intent, both children
 *  - Blended family: gP of record for c (7B) only; step-child d (7B) has gQ only.
 *    d lists gQ; gP lists c. gP must NOT receive d.
 *  - Inactive student e (7B) with guardian gE                      → no intent
 *  - Inactive guardian gX of student f (7B); f also has gF         → only gF
 *  - Guardian gN without consent                                  → blocked no_consent
 */
async function seed(repo: SamparkRepo) {
    await repo.upsertSchool(school());
    await repo.upsertStudents(ORG, [
        student('a', { grade: 7, section: 'B', guardianIds: ['gM'] }),
        student('b', { grade: 3, section: 'A', guardianIds: ['gM'] }),
        student('c', { grade: 7, section: 'B', guardianIds: ['gP'] }),
        student('d', { grade: 7, section: 'B', guardianIds: ['gQ'] }),
        student('e', { grade: 7, section: 'B', guardianIds: ['gE'], active: false }),
        student('f', { grade: 7, section: 'B', guardianIds: ['gX', 'gF'] }),
        student('n', { grade: 9, section: 'A', guardianIds: ['gN'] }),
    ]);
    await repo.upsertGuardians(ORG, [
        guardian('gM', { studentIds: ['a', 'b'], crmLanguage: 'Bengali' }),
        guardian('gP', { studentIds: ['c'] }),
        guardian('gQ', { studentIds: ['d'], crmLanguage: 'Hindi' }),
        guardian('gE', { studentIds: ['e'] }),
        guardian('gX', { studentIds: ['f'], active: false }),
        guardian('gF', { studentIds: ['f'] }),
        guardian('gN', { studentIds: ['n'], crmLanguage: null }),
    ]);
    await repo.upsertPreferences(['gM', 'gP', 'gQ', 'gE', 'gX', 'gF'].map((g) => prefs(g)));
}

describe('bundleAudience', () => {
    it('requires the guardian-of-record link on both sides', () => {
        // Student lists gP but gP does not list the student → not bundled.
        const bundles = bundleAudience(
            campaign(),
            [student('d', { guardianIds: ['gP', 'gQ'] })],
            [guardian('gP', { studentIds: ['c'] }), guardian('gQ', { studentIds: ['d'] })],
        );
        expect([...bundles.keys()]).toEqual(['gQ']);
    });
});

describe('materialiseCampaignIntents', () => {
    it('whole-school audience: one intent per guardian of record, siblings bundled, inactive skipped', async () => {
        const repo = createMemorySamparkRepo();
        await seed(repo);
        const c = campaign();
        await repo.createCampaign(c);
        const res = await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');

        const intents = await repo.listIntentsByCampaign(ORG, c.id);
        const byGuardian = Object.fromEntries(intents.map((i) => [i.guardianId, i]));
        expect(Object.keys(byGuardian).sort()).toEqual(['gF', 'gM', 'gN', 'gP', 'gQ']);
        expect(byGuardian.gM.studentIds).toEqual(['a', 'b']);
        expect(byGuardian.gP.studentIds).toEqual(['c']); // step-child d is not bundled to gP
        expect(byGuardian.gQ.studentIds).toEqual(['d']);
        expect(byGuardian.gF.studentIds).toEqual(['f']);
        expect(res).toEqual({ created: 5, existing: 0, blocked: { no_consent: 1 } });
    });

    it('writes intents with the contract fields', async () => {
        const repo = createMemorySamparkRepo();
        await seed(repo);
        const c = campaign({ notBefore: '2026-10-08T04:30:00.000Z', expiresAt: '2026-10-10T18:29:59.999Z' });
        await repo.createCampaign(c);
        await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');

        const gM = await repo.getIntent(ORG, idFor(c.id, 'gM'));
        expect(gM).toEqual({
            id: idFor(c.id, 'gM'),
            dedupeKey: campaignDedupeKey(c.id, 'gM'),
            orgId: ORG,
            campaignId: c.id,
            purpose: 'ptm_invite',
            guardianId: 'gM',
            studentIds: ['a', 'b'],
            language: 'Bengali',
            status: 'approved',
            blockReason: null,
            attempts: 0,
            maxAttempts: 3,
            notBefore: '2026-10-08T04:30:00.000Z',
            expiresAt: '2026-10-10T18:29:59.999Z',
            lastCallId: null,
            createdAt: clock.now().toISOString(),
            updatedAt: clock.now().toISOString(),
        });
        const gN = await repo.getIntent(ORG, idFor(c.id, 'gN'));
        // Blocked without a resolvable language: 'English' is a placeholder only.
        expect(gN).toMatchObject({ status: 'blocked', blockReason: 'no_consent', language: 'English' });
    });

    it('a blocked intent keeps its resolved language when there is one', async () => {
        const repo = createMemorySamparkRepo();
        await seed(repo);
        await repo.upsertPreferences([prefs('gQ', { notices: 'denied' })]);
        const c = campaign();
        await repo.createCampaign(c);
        await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
        expect(await repo.getIntent(ORG, idFor(c.id, 'gQ'))).toMatchObject({ status: 'blocked', blockReason: 'consent_denied', language: 'Hindi' });
    });

    it('section audience: only guardians of children in those sections, bundling only in-audience siblings', async () => {
        const repo = createMemorySamparkRepo();
        await seed(repo);
        const c = campaign({ id: 'camp-7b', audience: { sections: [{ grade: 7, section: 'b' }] } });
        await repo.createCampaign(c);
        await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
        const intents = await repo.listIntentsByCampaign(ORG, c.id);
        expect(intents.map((i) => i.guardianId).sort()).toEqual(['gF', 'gM', 'gP', 'gQ']);
        expect(intents.find((i) => i.guardianId === 'gM')?.studentIds).toEqual(['a']); // b is in 3A
    });

    it('is idempotent: a re-run creates nothing', async () => {
        const repo = createMemorySamparkRepo();
        await seed(repo);
        const c = campaign();
        await repo.createCampaign(c);
        await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
        const again = await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
        expect(again).toEqual({ created: 0, existing: 5, blocked: {} });
        expect((await repo.listIntentsByCampaign(ORG, c.id)).length).toBe(5);
    });

    it('uses non-emergency calls in the last 30 days for the frequency cap', async () => {
        const repo = createMemorySamparkRepo();
        await seed(repo);
        const spy = jest.spyOn(repo, 'countCallsToPhoneSince').mockImplementation(async (_o, phoneHash) => (phoneHash === 'hash:gP' ? 4 : 0));
        const c = campaign();
        await repo.createCampaign(c);
        const res = await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
        expect(res.blocked).toEqual({ no_consent: 1, frequency_cap: 1 });
        for (const call of spy.mock.calls) {
            expect(call[2].getTime()).toBe(clock.now().getTime() - 30 * 24 * 3600 * 1000);
            expect(call[3]).toBe(true);
        }
    });

    it('records campaign counts after materialising', async () => {
        const repo = createMemorySamparkRepo();
        await seed(repo);
        const c = campaign();
        await repo.createCampaign(c);
        await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
        expect((await repo.getCampaign(ORG, c.id))?.counts).toMatchObject({ guardians: 5, blocked: 1, queued: 4, inFlight: 0 });
    });

    it('a cancelled campaign materialises nothing; a campaign from another org is refused', async () => {
        const repo = createMemorySamparkRepo();
        await seed(repo);
        expect(await materialiseCampaignIntents({ repo, clock }, campaign({ status: 'cancelled' }), school(), 'simulated')).toEqual({ created: 0, existing: 0, blocked: {} });
        await expect(materialiseCampaignIntents({ repo, clock }, campaign({ orgId: 'other' }), school(), 'simulated')).rejects.toThrow();
    });

    it('an empty audience creates nothing', async () => {
        const repo = createMemorySamparkRepo();
        await seed(repo);
        const c = campaign({ audience: { sections: [{ grade: 12, section: 'Z' }] } });
        await repo.createCampaign(c);
        expect(await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated')).toEqual({ created: 0, existing: 0, blocked: {} });
    });
});
