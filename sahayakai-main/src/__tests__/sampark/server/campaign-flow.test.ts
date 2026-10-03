/** @jest-environment node */
/**
 * Slice 1 end to end on the in-memory repo, through the server services the
 * routes call: enable → import → create PTM → audience dry run → preview in
 * four languages → approve → render job (fake TTS + transcribe-back) →
 * scheduled → dispatch job (simulated carrier) refused outside the window and
 * placing calls inside it → call log with outcomes; plus the D4 closure's
 * today/tomorrow variants, render failure, and cancellation.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { runImport } from '@/lib/sampark/crm/import';
import type { CrmSource } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { getClipAudio } from '@/server/sampark/audio';
import { listCallLog } from '@/server/sampark/calls';
import { approveCampaign, cancelCampaign, createCampaign, getCampaignDetail, previewCampaign, retryCampaignAudio } from '@/server/sampark/campaigns';
import { listGuardianRows, updateGuardianPreferences } from '@/server/sampark/guardians';
import type { SamparkCtx } from '@/server/sampark/http';
import { dispatchJob, renderJob } from '@/server/sampark/jobs';
import { getOverview } from '@/server/sampark/overview';
import { enableSchool } from '@/server/sampark/school';
import type { Campaign } from '@/types/sampark';

import { ADMIN, CRM_SCHOOL, crmConsent, crmGuardian, crmStudent, fakeSpeech, MON_08_IST, MON_11_IST, ORG, setPhoneEnv, testClock } from './_helpers';

beforeAll(setPhoneEnv);

const SPOKEN = { English: 'Hillview School', Hindi: 'हिलव्यू स्कूल', Bengali: 'হিলভিউ স্কুল', Nepali: 'हिलभ्यू स्कूल' };
const LANGS = ['ne', 'bn', 'hi', 'en'] as const;

/** 12 families across the four languages, plus planted refusals. */
function crm(): CrmSource {
    const students: Record<string, unknown>[] = [];
    const guardians: Record<string, unknown>[] = [];
    for (let i = 0; i < 12; i++) {
        const sid = `s${i}`;
        const gid = `g${i}`;
        students.push(crmStudent(sid, { grade: 7, section: i % 2 ? 'A' : 'B', guardians: [{ guardianId: gid, isPrimary: true, isGuardianOfRecord: true }] }));
        guardians.push(crmGuardian(gid, { preferredLanguage: LANGS[i % 4] }));
    }
    // Planted: consent denied, no language (school asks rather than defaults), CRM do-not-contact.
    students.push(crmStudent('s-denied', { guardians: [{ guardianId: 'g-denied', isPrimary: true, isGuardianOfRecord: true }] }));
    guardians.push(crmGuardian('g-denied', { consent: { notices: crmConsent('denied'), progress: null, recordedConversation: null, hpcInput: null } }));
    students.push(crmStudent('s-nolang', { guardians: [{ guardianId: 'g-nolang', isPrimary: true, isGuardianOfRecord: true }] }));
    guardians.push(crmGuardian('g-nolang', { preferredLanguage: null }));
    students.push(crmStudent('s-dnc', { guardians: [{ guardianId: 'g-dnc', isPrimary: true, isGuardianOfRecord: true }] }));
    guardians.push(crmGuardian('g-dnc', { doNotContact: true }));
    return { kind: 'rest', fetchSchool: async () => CRM_SCHOOL, fetchStudents: async () => students, fetchGuardians: async () => guardians };
}

async function setup(start: Date = MON_11_IST) {
    const clock = testClock(start);
    const repo = createMemorySamparkRepo();
    const ctx: SamparkCtx = { repo, clock };
    const speech = fakeSpeech();
    const school = await enableSchool(ctx, ORG, ADMIN, { displayName: 'Hillview Demo School', isDemo: true, spokenName: SPOKEN });
    const run = await runImport({ repo, clock }, ORG, crm(), ADMIN);
    expect(run.status).toBe('succeeded');
    return { clock, repo, ctx, speech, school };
}

async function renderUntilSettled(env: Awaited<ReturnType<typeof setup>>, campaignId: string): Promise<Campaign> {
    for (let i = 0; i < 6; i++) {
        await renderJob({ repo: env.repo, clock: env.clock, speech: env.speech });
        const c = (await env.repo.getCampaign(ORG, campaignId))!;
        if (c.status !== 'rendering') return c;
    }
    throw new Error('campaign never left rendering');
}

describe('slice 1 campaign flow', () => {
    it('PTM: create → dry run → preview → approve → render → schedule → dispatch in window → call log', async () => {
        const env = await setup();
        const { ctx, repo, clock } = env;

        // Enabled in practice mode with the templates' reviewed venues.
        expect(env.school.mode).toBe('practice');
        expect(env.school.venues.map((v) => v.id)).toEqual(expect.arrayContaining(['school_hall']));

        const campaign = await createCampaign(ctx, ORG, ADMIN, {
            purpose: 'ptm_invite',
            facts: { kind: 'ptm_invite', date: '2026-10-08', time: { hour: 10, minute: 30 }, venueId: 'school_hall' },
            audience: { sections: [] },
        });
        expect(campaign).toMatchObject({ status: 'draft', notBefore: null });
        expect(campaign.expiresAt).toBe('2026-10-08T18:29:59.999Z'); // end of the event day, IST

        // Dry run: every guardian of record, languages, and the planted refusals. No writes.
        const detail = await getCampaignDetail(ctx, ORG, campaign.id);
        expect(detail.audience.guardians).toBe(15); // 12 + denied + nolang + do-not-contact (still a guardian of record)
        expect(detail.audience.blocked).toMatchObject({ consent_denied: 1, language_unknown: 1, crm_do_not_contact: 1 });
        expect(detail.audience.byLanguage.unknown).toBe(1);
        expect(await repo.listIntentsByCampaign(ORG, campaign.id)).toEqual([]);

        // Preview: text in all four languages, no audio yet.
        const before = await previewCampaign(ctx, ORG, campaign.id);
        expect(before.map((p) => p.language)).toEqual(['English', 'Hindi', 'Bengali', 'Nepali']);
        for (const p of before) {
            expect(p.variant).toBe('default');
            expect(p.clips.find((c) => c.kind === 'message')?.text.length).toBeGreaterThan(20);
            expect(p.clips.every((c) => c.audioKey === null)).toBe(true);
        }

        // Approve → rendering, with an audit entry of what was approved.
        const approved = await approveCampaign(ctx, ORG, campaign.id, ADMIN);
        expect(approved).toMatchObject({ status: 'rendering', approvedBy: ADMIN });
        await expect(approveCampaign(ctx, ORG, campaign.id, ADMIN)).rejects.toMatchObject({ code: 'CAMPAIGN_NOT_DRAFT', status: 409 });

        // Render job: clips rendered + verified, intents materialised, scheduled.
        const scheduled = await renderUntilSettled(env, campaign.id);
        expect(scheduled.status).toBe('scheduled');
        expect(scheduled.renderProgress.failures).toEqual([]);
        expect(scheduled.renderProgress.done).toBe(scheduled.renderProgress.total);
        const intents = await repo.listIntentsByCampaign(ORG, campaign.id);
        expect(intents.length).toBeGreaterThanOrEqual(12);
        expect(intents.filter((i) => i.status === 'approved')).toHaveLength(12);
        expect(intents.filter((i) => i.status === 'blocked').map((i) => i.blockReason).sort()).toEqual(
            expect.arrayContaining(['consent_denied']),
        );

        // Preview now carries audio keys, and the audio is served org-scoped.
        const after = await previewCampaign(ctx, ORG, campaign.id, ['Nepali']);
        const message = after[0].clips.find((c) => c.kind === 'message')!;
        expect(message.audioKey).toMatch(/^[0-9a-f]{40}$/);
        expect(message.durationSeconds).toBeGreaterThan(0);
        const audio = await getClipAudio(ctx, env.speech.store, ORG, message.audioKey!);
        expect(audio.audio.subarray(0, 4).toString('ascii')).toBe('RIFF');
        await expect(getClipAudio(ctx, env.speech.store, 'other-org', message.audioKey!)).rejects.toMatchObject({ status: 404 });

        // Outside the window (08:00 IST): nothing is dialled.
        clock.set(MON_08_IST);
        const early = await dispatchJob({ repo, clock });
        expect(early.dialed).toBe(0);
        expect(await repo.listCalls(ORG, { limit: 100 })).toEqual([]);

        // Inside the window: simulated calls are placed and logged.
        clock.set(MON_11_IST);
        const tick = await dispatchJob({ repo, clock });
        expect(tick.errors).toEqual([]);
        expect(tick.dialed).toBe(12);

        const log = await listCallLog(ctx, ORG, { campaignId: campaign.id, limit: 100 });
        expect(log).toHaveLength(12);
        for (const entry of log) {
            expect(entry.carrier).toBe('simulated');
            expect(entry.purpose).toBe('ptm_invite');
            expect(entry.guardianDisplayName).toMatch(/^Guardian g\d+$/);
            expect(entry.studentDisplayNames).toHaveLength(1);
            expect(entry.phoneLast4).toMatch(/^\d{4}$/);
            expect(JSON.stringify(entry)).not.toContain('+915');
        }
        const states = new Set(log.map((e) => e.state));
        for (const s of states) expect(['completed', 'no_answer', 'busy', 'failed']).toContain(s);

        const campaignNow = (await repo.getCampaign(ORG, campaign.id))!;
        expect(['dispatching', 'completed']).toContain(campaignNow.status);

        // Overview reflects the day's calls.
        const overview = await getOverview(ctx, ORG);
        expect(overview.windowOpenNow).toBe(true);
        expect(overview.today.calls).toBe(12);
        expect(overview.guardians.total).toBe(15);
        expect(overview.lastImport?.status).toBe('succeeded');
    });

    it('emergency closure previews today/tomorrow variants and schedules', async () => {
        const env = await setup();
        const campaign = await createCampaign(env.ctx, ORG, ADMIN, {
            purpose: 'emergency_closure',
            facts: { kind: 'emergency_closure', date: '2026-10-06', reason: 'heavy_rain', busesRunning: false },
            audience: { sections: [{ grade: 7, section: 'A' }] },
        });
        expect(campaign.expiresAt).toBe('2026-10-06T18:29:59.999Z');
        const previews = await previewCampaign(env.ctx, ORG, campaign.id);
        expect(previews.map((p) => `${p.language}:${p.variant}`)).toEqual([
            'English:today', 'English:tomorrow', 'Hindi:today', 'Hindi:tomorrow',
            'Bengali:today', 'Bengali:tomorrow', 'Nepali:today', 'Nepali:tomorrow',
        ]);
        await approveCampaign(env.ctx, ORG, campaign.id, ADMIN);
        expect((await renderUntilSettled(env, campaign.id)).status).toBe('scheduled');
    });

    it('refuses dates the facts cannot carry', async () => {
        const env = await setup();
        const base = { audience: { sections: [] } };
        await expect(
            createCampaign(env.ctx, ORG, ADMIN, { ...base, purpose: 'ptm_invite', facts: { kind: 'ptm_invite', date: '2026-10-01', time: { hour: 10, minute: 0 }, venueId: 'school_hall' } }),
        ).rejects.toMatchObject({ code: 'DATE_IN_PAST', status: 400 });
        await expect(
            createCampaign(env.ctx, ORG, ADMIN, { ...base, purpose: 'ptm_invite', facts: { kind: 'ptm_invite', date: '2026-10-09', time: { hour: 10, minute: 0 }, venueId: 'moon' } }),
        ).rejects.toMatchObject({ code: 'UNKNOWN_VENUE' });
        await expect(
            createCampaign(env.ctx, ORG, ADMIN, { ...base, purpose: 'emergency_closure', facts: { kind: 'emergency_closure', date: '2026-10-09', reason: 'bandh', busesRunning: true } }),
        ).rejects.toMatchObject({ code: 'CLOSURE_DATE' });
        // Class gate 8: planned / human-only purposes never become campaigns.
        for (const purpose of ['fee_due', 'safeguarding', 'holiday_notice', 'not_a_purpose']) {
            await expect(
                createCampaign(env.ctx, ORG, ADMIN, { ...base, purpose, facts: { kind: 'ptm_invite', date: '2026-10-09', time: { hour: 10, minute: 0 }, venueId: 'school_hall' } }),
            ).rejects.toMatchObject({ status: 400 });
        }
        await expect(
            createCampaign(env.ctx, ORG, ADMIN, { ...base, purpose: 'event_invite', facts: { kind: 'ptm_invite', date: '2026-10-09', time: { hour: 10, minute: 0 }, venueId: 'school_hall' } }),
        ).rejects.toMatchObject({ code: 'FACTS_MISMATCH' });
    });

    it('a Latin spoken name is reported per language in preview and refused at approval', async () => {
        const env = await setup();
        await env.repo.upsertSchool({ ...env.school, spokenName: { ...SPOKEN, Hindi: 'Hillview School' } });
        const campaign = await createCampaign(env.ctx, ORG, ADMIN, {
            purpose: 'ptm_invite',
            facts: { kind: 'ptm_invite', date: '2026-10-08', time: { hour: 10, minute: 0 }, venueId: 'school_hall' },
            audience: { sections: [] },
        });
        const previews = await previewCampaign(env.ctx, ORG, campaign.id);
        const hindi = previews.find((p) => p.language === 'Hindi')!;
        expect(hindi.clips).toEqual([]);
        expect(hindi.warnings.join(' ')).toMatch(/Latin/);
        expect(previews.find((p) => p.language === 'Nepali')!.clips.length).toBeGreaterThan(0);
        await expect(approveCampaign(env.ctx, ORG, campaign.id, ADMIN)).rejects.toMatchObject({ code: 'SCRIPT_UNAVAILABLE', status: 409 });
    });

    it('a message clip that fails transcribe-back fails the campaign; nothing is dispatched', async () => {
        const env = await setup();
        env.speech = fakeSpeech({ mishear: (text) => (/[ঀ-৿]/.test(text) && text.length > 60 ? 'কিছু একটা ভুল' : null) });
        const campaign = await createCampaign(env.ctx, ORG, ADMIN, {
            purpose: 'ptm_invite',
            facts: { kind: 'ptm_invite', date: '2026-10-08', time: { hour: 10, minute: 0 }, venueId: 'school_hall' },
            audience: { sections: [] },
        });
        await approveCampaign(env.ctx, ORG, campaign.id, ADMIN);
        const settled = await renderUntilSettled(env, campaign.id);
        expect(settled.status).toBe('render_failed');
        expect(settled.renderProgress.failures.join(' ')).toMatch(/Bengali/);
        expect(await env.repo.listIntentsByCampaign(ORG, campaign.id)).toEqual([]);
        const tick = await dispatchJob({ repo: env.repo, clock: env.clock });
        expect(tick.dialed).toBe(0);
    });

    it('after a voice slip fails the render, "try again" re-renders only the failed clips and the campaign goes on', async () => {
        const env = await setup();
        let slipping = true; // the voice model slips on the first render, then behaves
        env.speech = fakeSpeech({ mishear: (text) => (slipping && /[ঀ-৿]/.test(text) && text.length > 60 ? 'কিছু একটা ভুল' : null) });
        const campaign = await createCampaign(env.ctx, ORG, ADMIN, {
            purpose: 'ptm_invite',
            facts: { kind: 'ptm_invite', date: '2026-10-08', time: { hour: 10, minute: 0 }, venueId: 'school_hall' },
            audience: { sections: [] },
        });
        // Only a failed render can be retried.
        await expect(retryCampaignAudio(env.ctx, ORG, campaign.id, ADMIN)).rejects.toMatchObject({ code: 'CAMPAIGN_AUDIO_NOT_FAILED' });
        await approveCampaign(env.ctx, ORG, campaign.id, ADMIN);
        const failed = await renderUntilSettled(env, campaign.id);
        expect(failed.status).toBe('render_failed');

        slipping = false;
        const callsBefore = env.speech.synth.calls;
        const retried = await retryCampaignAudio(env.ctx, ORG, campaign.id, ADMIN);
        expect(retried).toMatchObject({ status: 'rendering', renderProgress: { failures: [] } });
        const settled = await renderUntilSettled(env, campaign.id);
        expect(settled.status).toBe('scheduled');
        // Clips that passed the first time were kept: only the failed one(s) were rendered again.
        const rerendered = env.speech.synth.calls - callsBefore;
        expect(rerendered).toBeGreaterThan(0);
        expect(rerendered).toBeLessThan(settled.renderProgress.total);
        expect((await env.repo.listIntentsByCampaign(ORG, campaign.id)).length).toBeGreaterThan(0);
        await expect(retryCampaignAudio(env.ctx, ORG, campaign.id, ADMIN)).rejects.toMatchObject({ code: 'CAMPAIGN_AUDIO_NOT_FAILED' });
    });

    it('cancelling a scheduled campaign cancels its waiting intents; the dispatcher places nothing', async () => {
        const env = await setup();
        const campaign = await createCampaign(env.ctx, ORG, ADMIN, {
            purpose: 'event_invite',
            facts: { kind: 'event_invite', eventType: 'sports_day', date: '2026-10-09', time: { hour: 9, minute: 0 }, venueId: 'main_ground' },
            audience: { sections: [{ grade: 7, section: 'B' }] },
        });
        await approveCampaign(env.ctx, ORG, campaign.id, ADMIN);
        expect((await renderUntilSettled(env, campaign.id)).status).toBe('scheduled');
        const cancelled = await cancelCampaign(env.ctx, ORG, campaign.id, ADMIN);
        expect(cancelled.status).toBe('cancelled');
        const intents = await env.repo.listIntentsByCampaign(ORG, campaign.id);
        expect(intents.some((i) => i.status === 'approved')).toBe(false);
        expect(intents.filter((i) => i.status === 'cancelled').length).toBeGreaterThan(0);
        expect((await dispatchJob({ repo: env.repo, clock: env.clock })).dialed).toBe(0);
        await expect(cancelCampaign(env.ctx, ORG, campaign.id, ADMIN)).rejects.toMatchObject({ code: 'CAMPAIGN_FINISHED' });
    });

    it('office preference edits show in the guardian list and survive the next import', async () => {
        const env = await setup();
        const prefs = await updateGuardianPreferences(env.ctx, ORG, 'g-nolang', ADMIN, { language: 'Bengali', consent: { notices: 'granted' } });
        expect(prefs.language).toBe('Bengali');
        expect(prefs.consent.notices).toMatchObject({ status: 'granted', source: 'office' });
        await runImport({ repo: env.repo, clock: env.clock }, ORG, crm(), ADMIN);
        const rows = await listGuardianRows(env.ctx, ORG, { limit: 100, q: 'g-nolang' });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ language: 'Bengali', consent: { notices: 'granted' }, suppressed: false, students: [{ id: 's-nolang' }] });
        const bengali = await listGuardianRows(env.ctx, ORG, { limit: 500, language: 'Bengali' });
        expect(bengali.every((r) => r.language === 'Bengali')).toBe(true);
        await expect(updateGuardianPreferences(env.ctx, ORG, 'nobody', ADMIN, { language: null })).rejects.toMatchObject({ status: 404 });
    });
});
