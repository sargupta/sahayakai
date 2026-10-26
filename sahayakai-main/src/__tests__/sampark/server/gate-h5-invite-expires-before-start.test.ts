/** @jest-environment node */
/**
 * CLASS GATE H5 — an invitation is never dialled at or after its start minus
 * INVITE_LEAD_MINUTES (docs/sampark/EDGE_CASES.md §2 gap 5).
 *
 * The bug: invitation campaigns expired at 23:59 on the event day, so a family
 * could be rung about a PTM or a sports day that had already begun. The class:
 * for ANY start time a school can choose (06:00–21:00, whole and half hours) and
 * either kind of invitation, no new call starts once the event is less than two
 * hours away. Proven at three layers:
 *   1. campaignExpiry is the last millisecond before start − INVITE_LEAD_MINUTES
 *      for every time of day (expiresAt is the last instant a call may start:
 *      the dispatcher expires once `now > expiresAt`, as the closure's
 *      23:59:59.999 does); the closure's end-of-day expiry is unchanged;
 *   2. createCampaign refuses TOO_LATE_TO_CALL from that instant on, for every
 *      time of day, and accepts the second before it with that expiry;
 *   3. end to end (import → approve → render → schedule → dispatch on the
 *      simulated carrier), every intent carries the campaign's expiry, the
 *      dispatcher dials a minute before it and dials nothing at it.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { closureExpiry } from '@/lib/sampark/closure';
import { runImport } from '@/lib/sampark/crm/import';
import type { CrmSource } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { Campaign, CampaignFacts, SpokenTime } from '@/types/sampark';
import { approveCampaign, campaignExpiry, createCampaign, INVITE_LEAD_MINUTES } from '@/server/sampark/campaigns';
import type { SamparkCtx } from '@/server/sampark/http';
import { dispatchJob, renderJob } from '@/server/sampark/jobs';
import { enableSchool } from '@/server/sampark/school';

import { ADMIN, CRM_SCHOOL, crmGuardian, crmStudent, fakeSpeech, ORG, setPhoneEnv, testClock } from './_helpers';

beforeAll(setPhoneEnv);

const DATE = '2026-10-08'; // Thursday
const LEAD_MS = INVITE_LEAD_MINUTES * 60_000;

/** Every start time the facts schema allows: 06:00 to 21:00 in whole and half hours. */
const TIMES: SpokenTime[] = [];
for (let hour = 6; hour <= 21; hour++) {
    TIMES.push({ hour, minute: 0 });
    if (hour < 21) TIMES.push({ hour, minute: 30 });
}

function start(time: SpokenTime): Date {
    return new Date(`${DATE}T${String(time.hour).padStart(2, '0')}:${time.minute === 0 ? '00' : '30'}:00+05:30`);
}

function invitations(time: SpokenTime): CampaignFacts[] {
    return [
        { kind: 'ptm_invite', date: DATE, time, venueId: 'school_hall' },
        { kind: 'event_invite', eventType: 'annual_day', date: DATE, time, venueId: 'main_ground' },
    ];
}

const label = (t: SpokenTime) => `${String(t.hour).padStart(2, '0')}:${t.minute === 0 ? '00' : '30'}`;

describe('gate H5 — the expiry of an invitation is its start minus the lead, at every time of day', () => {
    it('the lead is two hours', () => {
        expect(INVITE_LEAD_MINUTES).toBe(120);
        expect(TIMES).toHaveLength(31);
    });

    it.each(TIMES.map((t) => [label(t), t] as const))('%s: campaignExpiry is the last millisecond before start − 120 min', (_l, time) => {
        for (const facts of invitations(time)) {
            const expiry = campaignExpiry(facts);
            expect(expiry.getTime()).toBe(start(time).getTime() - LEAD_MS - 1);
            expect(expiry.getTime()).toBeLessThan(start(time).getTime() - LEAD_MS);
        }
    });

    it('an emergency closure still runs to the end of its day', () => {
        const facts: CampaignFacts = { kind: 'emergency_closure', date: DATE, reason: 'heavy_rain', busesRunning: false };
        expect(campaignExpiry(facts).toISOString()).toBe(closureExpiry(DATE).toISOString());
        expect(campaignExpiry(facts).toISOString()).toBe('2026-10-08T18:29:59.999Z');
    });
});

describe('gate H5 — createCampaign refuses an invitation from the moment it is too late to call', () => {
    async function env() {
        const clock = testClock('2026-10-01T05:30:00Z');
        const repo = createMemorySamparkRepo();
        const ctx: SamparkCtx = { repo, clock };
        await enableSchool(ctx, ORG, ADMIN, { displayName: 'Hillview Demo School', isDemo: true });
        return { clock, ctx };
    }

    it.each(TIMES.map((t) => [label(t), t] as const))('%s: accepted one second before start − lead, refused at it and after it', async (_l, time) => {
        const { clock, ctx } = await env();
        for (const facts of invitations(time)) {
            const input = { purpose: facts.kind, facts, audience: { sections: [] } };
            const lead = start(time).getTime() - LEAD_MS;

            clock.set(new Date(lead - 1000));
            const created = await createCampaign(ctx, ORG, ADMIN, input);
            expect(created.expiresAt).toBe(new Date(lead - 1).toISOString());

            for (const at of [lead - 1, lead, lead + LEAD_MS / 2, start(time).getTime() - 1000]) {
                clock.set(new Date(at));
                await expect(createCampaign(ctx, ORG, ADMIN, input)).rejects.toMatchObject({ code: 'TOO_LATE_TO_CALL', status: 400 });
            }
        }
    });
});

describe('gate H5 — end to end, the dispatcher never dials an invitation at or after start − lead', () => {
    function crm(): CrmSource {
        const codes = ['en', 'hi', 'bn', 'ne'] as const;
        const students = codes.map((_, i) => crmStudent(`s${i}`, { guardians: [{ guardianId: `g${i}`, isPrimary: true, isGuardianOfRecord: true }] }));
        const guardians = codes.map((code, i) => crmGuardian(`g${i}`, { preferredLanguage: code }));
        return { kind: 'rest', fetchSchool: async () => CRM_SCHOOL, fetchStudents: async () => students, fetchGuardians: async () => guardians };
    }

    /** A scheduled Practice-mode invitation for `time` on DATE, created and rendered on 1 October. */
    async function scheduled(facts: CampaignFacts) {
        const clock = testClock('2026-10-01T05:30:00Z');
        const repo = createMemorySamparkRepo();
        const ctx: SamparkCtx = { repo, clock };
        await enableSchool(ctx, ORG, ADMIN, {
            displayName: 'Hillview Demo School',
            isDemo: true,
            spokenName: { English: 'Hillview School', Hindi: 'हिलव्यू स्कूल', Bengali: 'হিলভিউ স্কুল', Nepali: 'हिलभ्यू स्कुल' },
        });
        expect((await runImport({ repo, clock }, ORG, crm(), ADMIN)).status).toBe('succeeded');
        const campaign = await createCampaign(ctx, ORG, ADMIN, { purpose: facts.kind, facts, audience: { sections: [] } });
        await approveCampaign(ctx, ORG, campaign.id, ADMIN);
        const speech = fakeSpeech();
        let current: Campaign | null = null;
        for (let i = 0; i < 6; i++) {
            await renderJob({ repo, clock, speech });
            current = await repo.getCampaign(ORG, campaign.id);
            if (current?.status !== 'rendering') break;
        }
        expect(current?.status).toBe('scheduled');
        const intents = (await repo.listIntentsByCampaign(ORG, campaign.id)).filter((i) => i.status === 'approved');
        expect(intents.length).toBeGreaterThan(0);
        // Every intent stops exactly when its campaign does.
        for (const intent of intents) expect(intent.expiresAt).toBe(campaign.expiresAt);
        return { clock, repo, campaign };
    }

    // Starts whose start − lead falls inside the default calling window (10:00–19:00 IST), so the window
    // itself is not what stops the call, and that every script can say (the facts schema allows 21:00,
    // but no language's day periods name a time after 20:00, so such a campaign is refused at approval).
    const STARTS: SpokenTime[] = [
        { hour: 13, minute: 0 },
        { hour: 16, minute: 30 },
        { hour: 19, minute: 30 },
    ];
    const leadOf = (facts: CampaignFacts) => campaignExpiry(facts).getTime() + 1;

    it.each(STARTS.flatMap((t) => invitations(t).map((f) => [`${f.kind} at ${label(t)}`, f] as const)))('%s: dials a minute before start − lead', async (_l, facts) => {
        const { clock, repo } = await scheduled(facts);
        clock.set(new Date(leadOf(facts) - 60_000));
        const tick = await dispatchJob({ repo, clock });
        expect(tick.errors).toEqual([]);
        expect(tick.dialed).toBeGreaterThan(0);
    });

    it.each(STARTS.flatMap((t) => invitations(t).map((f) => [`${f.kind} at ${label(t)}`, f] as const)))('%s: dials nothing at start − lead, nor later that day', async (_l, facts) => {
        const { clock, repo, campaign } = await scheduled(facts);
        for (const at of [leadOf(facts), leadOf(facts) + 30 * 60_000]) {
            clock.set(new Date(at));
            const tick = await dispatchJob({ repo, clock });
            expect(tick.dialed).toBe(0);
        }
        expect(await repo.listCalls(ORG, { campaignId: campaign.id, limit: 100 })).toEqual([]);
    });
});
