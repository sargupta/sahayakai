/**
 * @jest-environment node
 *
 * GATE H9 (Test-mode samples) — a Test campaign over N families in L languages
 * rings the school's test phone at most L times.
 *
 * The bug class: in Test mode every call rings the one staff test phone, so a Test
 * campaign of 400 families rang it 400 times, one call at a time (about 7 hours).
 * The materialiser now approves the first family per language (by guardian id) as
 * the sample and creates the rest blocked 'test_mode_sample'. The gate checks the
 * count for many (N, L) shapes, end to end through the dispatcher, plus the three
 * ways the sample could quietly grow: a second materialise, a run that died halfway,
 * and a campaign whose pinned mode is missing (the school's mode applies).
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import type { SamparkRepo } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { PARENT_LANGUAGES, type Intent, type SamparkMode } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, guardian, ORG, prefs, school, scriptedCarrier, student, testClock, testModeSchool, TEST_PHONE } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
beforeEach(() => {
    process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
});
afterAll(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
});

/** N single-child families, spread over the first L parent languages, all consented. */
async function seed(repo: SamparkRepo, n: number, l: number, schoolMode: SamparkMode) {
    const s = school(schoolMode === 'test' ? testModeSchool() : { mode: schoolMode });
    await repo.upsertSchool(s);
    const languages = PARENT_LANGUAGES.slice(0, l);
    const students = [];
    const guardians = [];
    for (let i = 0; i < n; i++) {
        const id = String(i).padStart(3, '0');
        students.push(student(`s${id}`, { guardianIds: [`g${id}`] }));
        guardians.push(guardian(`g${id}`, { studentIds: [`s${id}`], crmLanguage: languages[i % l] }));
    }
    await repo.upsertStudents(ORG, students);
    await repo.upsertGuardians(ORG, guardians);
    await repo.upsertPreferences(guardians.map((g) => prefs(g.id)));
    return s;
}

const approvedLanguages = (intents: Intent[]) => intents.filter((i) => i.status === 'approved').map((i) => i.language).sort();

describe('gate h9 — Test mode rings the test phone once per language', () => {
    it.each([
        [1, 1],
        [7, 1],
        [12, 2],
        [30, 3],
        [41, 4],
    ])('N=%i families in L=%i languages: L approved, the rest blocked test_mode_sample, the phone rings at most L times', async (n, l) => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        const s = await seed(repo, n, l, 'test');
        const c = campaign({ mode: 'test' });
        await repo.createCampaign(c);
        const res = await materialiseCampaignIntents({ repo, clock }, c, s, 'vobiz');
        expect(res.created).toBe(n);
        expect(res.blocked).toEqual(n > l ? { test_mode_sample: n - l } : {});

        const intents = await repo.listIntentsByCampaign(ORG, c.id);
        expect(approvedLanguages(intents)).toEqual([...PARENT_LANGUAGES.slice(0, l)].sort());
        // The sample per language is the family with the lowest guardian id.
        for (const lang of PARENT_LANGUAGES.slice(0, l)) {
            const ofLang = intents.filter((i) => i.language === lang).sort((a, b) => a.guardianId.localeCompare(b.guardianId));
            expect(ofLang[0].status).toBe('approved');
            for (const rest of ofLang.slice(1)) expect(rest).toMatchObject({ status: 'blocked', blockReason: 'test_mode_sample' });
        }

        const carrier = scriptedCarrier(() => 'full', 'vobiz');
        for (let tick = 0; tick < 6; tick++) {
            await runDispatchTick(deps(repo, clock, carrier), DEFAULT_OPTS);
            clock.advance(60_000);
        }
        expect(carrier.requests.length).toBeGreaterThan(0);
        expect(carrier.requests.length).toBeLessThanOrEqual(l);
        for (const r of carrier.requests) expect(r.destinationE164).toBe(TEST_PHONE);
    });

    it('materialising again approves nobody new', async () => {
        const repo = createMemorySamparkRepo();
        const s = await seed(repo, 10, 2, 'test');
        const c = campaign({ mode: 'test' });
        await repo.createCampaign(c);
        await materialiseCampaignIntents({ repo, clock: testClock() }, c, s, 'vobiz');
        expect(await materialiseCampaignIntents({ repo, clock: testClock() }, c, s, 'vobiz')).toEqual({ created: 0, existing: 10, blocked: {} });
        expect(approvedLanguages(await repo.listIntentsByCampaign(ORG, c.id))).toHaveLength(2);
    });

    it('a run that died halfway: an intent already approved for a language is that language’s sample', async () => {
        const repo = createMemorySamparkRepo();
        const s = await seed(repo, 6, 1, 'test');
        const c = campaign({ mode: 'test' });
        await repo.createCampaign(c);
        // The earlier run got as far as approving g004 (not the lowest id) before it died.
        const dedupeKey = campaignDedupeKey(c.id, 'g004');
        const now = testClock().now().toISOString();
        await repo.createIntentIfAbsent({
            id: intentIdFor(dedupeKey), dedupeKey, orgId: ORG, campaignId: c.id, purpose: 'ptm_invite', guardianId: 'g004', studentIds: ['s004'],
            language: 'English', status: 'approved', blockReason: null, attempts: 0, maxAttempts: 3,
            notBefore: null, expiresAt: c.expiresAt, lastCallId: null, createdAt: now, updatedAt: now,
        });
        const res = await materialiseCampaignIntents({ repo, clock: testClock() }, c, s, 'vobiz');
        expect(res).toEqual({ created: 5, existing: 1, blocked: { test_mode_sample: 5 } });
        expect(approvedLanguages(await repo.listIntentsByCampaign(ORG, c.id))).toEqual(['English']);
    });

    it('a campaign without a pinned mode samples when the school is in Test mode; Practice samples nothing', async () => {
        for (const [schoolMode, campaignMode, expectedApproved] of [
            ['test', undefined, 3],
            ['test', 'test', 3],
            ['practice', undefined, 9],
            ['practice', 'practice', 9],
            // The campaign's pinned mode wins: a Practice campaign at a school since moved to Test is
            // held by the dispatcher (H2) rather than sampled here.
            ['test', 'practice', 9],
        ] as const) {
            const repo = createMemorySamparkRepo();
            const s = await seed(repo, 9, 3, schoolMode);
            const c = campaign(campaignMode ? { mode: campaignMode } : {});
            await repo.createCampaign(c);
            await materialiseCampaignIntents({ repo, clock: testClock() }, c, s, schoolMode === 'test' ? 'vobiz' : 'simulated');
            expect(approvedLanguages(await repo.listIntentsByCampaign(ORG, c.id))).toHaveLength(expectedApproved);
        }
    });

    it('only families that would have been approved can be the sample: a blocked family never takes the slot', async () => {
        const repo = createMemorySamparkRepo();
        const s = await seed(repo, 4, 1, 'test');
        await repo.upsertPreferences([prefs('g000', { notices: 'denied' })]); // the lowest id cannot be called
        const c = campaign({ mode: 'test' });
        await repo.createCampaign(c);
        const res = await materialiseCampaignIntents({ repo, clock: testClock() }, c, s, 'vobiz');
        expect(res.blocked).toEqual({ consent_denied: 1, test_mode_sample: 2 });
        const intents = await repo.listIntentsByCampaign(ORG, c.id);
        expect(intents.find((i) => i.status === 'approved')?.guardianId).toBe('g001');
    });
});
