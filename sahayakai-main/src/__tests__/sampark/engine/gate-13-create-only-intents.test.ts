/**
 * @jest-environment node
 *
 * CLASS GATE 13 — the same dedupe key never produces two intents, and a
 * rejected (blocked / cancelled / needs_review) intent cannot be resurrected
 * by re-running materialisation, even after the reason it was blocked goes away.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';

import { campaign, ORG, prefs, school, seedFamilies, testClock } from './_fixtures';

const idFor = (campaignId: string, gid: string) => intentIdFor(campaignDedupeKey(campaignId, gid));

describe('class gate 13 — create-only intents', () => {
    it('createIntentIfAbsent never overwrites an existing intent', async () => {
        const repo = createMemorySamparkRepo();
        await seedFamilies(repo, 1);
        const c = campaign();
        await repo.createCampaign(c);
        await materialiseCampaignIntents({ repo, clock: testClock() }, c, school(), 'simulated');
        const id = idFor(c.id, 'g001');
        const original = await repo.getIntent(ORG, id);
        expect(await repo.createIntentIfAbsent({ ...original!, status: 'approved', attempts: 0, language: 'Hindi', studentIds: ['x'] })).toBe(false);
        expect(await repo.getIntent(ORG, id)).toEqual(original);
    });

    it('re-materialising never resurrects a blocked, cancelled or needs_review intent — even after consent is granted', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 4);
        await repo.upsertPreferences([prefs('g001', { notices: 'denied' })]);
        const c = campaign();
        await repo.createCampaign(c);
        const first = await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
        expect(first).toEqual({ created: 4, existing: 0, blocked: { consent_denied: 1 } });

        // A person rejects one, one is lost in dialing, and the family that refused later consents.
        await repo.updateIntent(ORG, idFor(c.id, 'g002'), { status: 'cancelled' });
        await repo.updateIntent(ORG, idFor(c.id, 'g003'), { status: 'needs_review', attempts: 1 });
        await repo.upsertPreferences([prefs('g001', { notices: 'granted' })]);
        const before = await repo.listIntentsByCampaign(ORG, c.id);

        clock.advance(3600_000);
        const again = await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
        expect(again).toEqual({ created: 0, existing: 4, blocked: {} });
        expect(await repo.listIntentsByCampaign(ORG, c.id)).toEqual(before);
        expect(await repo.getIntent(ORG, idFor(c.id, 'g001'))).toMatchObject({ status: 'blocked', blockReason: 'consent_denied' });
    });

    it('the dedupe key is per campaign and guardian: one intent each, a new campaign gets new intents', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 3);
        const a = campaign({ id: 'camp-a' });
        const b = campaign({ id: 'camp-b' });
        await repo.createCampaign(a);
        await repo.createCampaign(b);
        await Promise.all([
            materialiseCampaignIntents({ repo, clock }, a, school(), 'simulated'),
            materialiseCampaignIntents({ repo, clock }, a, school(), 'simulated'),
            materialiseCampaignIntents({ repo, clock }, b, school(), 'simulated'),
        ]);
        const ia = await repo.listIntentsByCampaign(ORG, 'camp-a');
        const ib = await repo.listIntentsByCampaign(ORG, 'camp-b');
        expect(ia).toHaveLength(3);
        expect(ib).toHaveLength(3);
        expect(new Set(ia.map((i) => i.dedupeKey)).size).toBe(3);
        for (const i of ia) expect(i.id).toBe(intentIdFor(i.dedupeKey));
        expect(ia.map((i) => i.id).some((id) => ib.some((j) => j.id === id))).toBe(false);
    });
});
