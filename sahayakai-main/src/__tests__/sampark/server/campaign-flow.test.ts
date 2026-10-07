/** @jest-environment node */
/**
 * Slice 1 end to end on the in-memory repo, through the server services the
 * routes call: enable → import → create PTM → audience dry run → preview in
 * four languages → approve → render job (fake TTS + transcribe-back) →
 * scheduled → dispatch job (simulated carrier) refused outside the window and
 * placing calls inside it → call log with outcomes; plus the D4 closure's
 * today/tomorrow variants, render failure, and cancellation.
 *
 * Hardening (7 Oct 2026): approval pins the school's mode (H2); scheduling
 * freezes the verified clip keys (H4); invitations expire INVITE_LEAD_MINUTES
 * before the start (H5); cancelling reports the calls it stopped (H4); and the
 * dry run counts toward the cap only real calls to a guardian (B6).
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { runImport } from '@/lib/sampark/crm/import';
import type { CrmSource } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { getClipAudio } from '@/server/sampark/audio';
import { listCallLog } from '@/server/sampark/calls';
import { FREQUENCY_CAP } from '@/lib/sampark/policy/gate';
import type { AuditEntry, SamparkRepo } from '@/lib/sampark/ports';
import { approveCampaign, cancelCampaign, clipKeySlot, createCampaign, getCampaignDetail, previewCampaign, retryCampaignAudio } from '@/server/sampark/campaigns';
import { listGuardianRows, updateGuardianPreferences } from '@/server/sampark/guardians';
import type { SamparkCtx } from '@/server/sampark/http';
import { dispatchJob, renderJob } from '@/server/sampark/jobs';
import { getOverview } from '@/server/sampark/overview';
import { enableSchool } from '@/server/sampark/school';
import { PARENT_LANGUAGES, type Campaign, type CarrierKind, type CallDestination, type SamparkGuardian } from '@/types/sampark';

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

/** Capture every audit entry the services write from now on. */
function captureAudits(repo: SamparkRepo): AuditEntry[] {
    const audits: AuditEntry[] = [];
    const original = repo.appendAudit.bind(repo);
    repo.appendAudit = async (orgId, entry) => {
        audits.push(entry);
        await original(orgId, entry);
    };
    return audits;
}

/** Plant `n` past calls to a guardian's number, each through its own intent, as the dispatcher writes them. */
async function plantCalls(repo: SamparkRepo, guardian: SamparkGuardian, n: number, carrier: CarrierKind, destination: CallDestination, at: Date): Promise<void> {
    for (let i = 0; i < n; i++) {
        const id = `planted-${guardian.id}-${carrier}-${destination}-${i}`;
        const iso = at.toISOString();
        await repo.createIntentIfAbsent({
            id, dedupeKey: id, orgId: ORG, campaignId: null, purpose: 'ptm_invite', guardianId: guardian.id, studentIds: [], language: 'English',
            status: 'approved', blockReason: null, attempts: 0, maxAttempts: 3, notBefore: null, expiresAt: '2027-01-01T00:00:00.000Z',
            lastCallId: null, createdAt: iso, updatedAt: iso,
        });
        const claimed = await repo.claimIntentForDial(ORG, id, {
            id, orgId: ORG, intentId: id, campaignId: null, purpose: 'ptm_invite', guardianId: guardian.id, phoneHash: guardian.phoneHash,
            phoneLast4: guardian.phoneLast4, language: 'English', variant: 'default', attempt: 1, state: 'dialing', leaseUntil: iso, carrier, destination,
            providerCallId: null, outcome: { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' }, durationSeconds: null,
            billedSeconds: null, costPaise: null, audioSeconds: null, createdAt: iso, updatedAt: iso, endedAt: null, failureReason: null,
        }, at);
        expect(claimed).toBe('claimed');
    }
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
        expect(campaign.expiresAt).toBe('2026-10-08T02:59:59.999Z'); // H5: the last instant before 08:30 IST, two hours before the 10:30 start

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

        // Approve → rendering, with an audit entry of what was approved, the school's mode pinned (H2).
        expect(campaign.mode).toBeUndefined();
        const audits = captureAudits(repo);
        const approved = await approveCampaign(ctx, ORG, campaign.id, ADMIN);
        expect(approved).toMatchObject({ status: 'rendering', approvedBy: ADMIN, mode: 'practice' });
        expect((await repo.getCampaign(ORG, campaign.id))?.mode).toBe('practice');
        expect(audits.find((a) => a.action === 'campaign.approve')?.detail).toMatchObject({ mode: 'practice' });
        await expect(approveCampaign(ctx, ORG, campaign.id, ADMIN)).rejects.toMatchObject({ code: 'CAMPAIGN_NOT_DRAFT', status: 409 });

        // Render job: clips rendered + verified, intents materialised, scheduled.
        const scheduled = await renderUntilSettled(env, campaign.id);
        expect(scheduled.status).toBe('scheduled');
        expect(scheduled.renderProgress.failures).toEqual([]);
        expect(scheduled.renderProgress.done).toBe(scheduled.renderProgress.total);
        // H4: the verified clip keys are frozen on the campaign, one slot per language rendered, every
        // kind of clip a call can play, each a stored clip that passed its check.
        expect(Object.keys(scheduled.clipKeys ?? {}).sort()).toEqual(PARENT_LANGUAGES.map((l) => clipKeySlot(l, 'default')).sort());
        for (const byKind of Object.values(scheduled.clipKeys ?? {})) {
            expect(Object.keys(byKind).sort()).toEqual(['confirm_1', 'confirm_2', 'fallback_office', 'message', 'no_input', 'opt_out_confirm', 'opt_out_done', 'withdrawn']);
            for (const key of Object.values(byKind)) expect((await repo.getClip(ORG, key as string))?.verification.status).toBe('passed');
        }
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

        // Overview reflects the day's calls: Practice calls rang nobody, so they are rehearsals (H9).
        const overview = await getOverview(ctx, ORG);
        expect(overview.windowOpenNow).toBe(true);
        expect(overview.today.calls).toBe(0);
        expect(overview.rehearsal.practice.calls).toBe(12);
        expect(overview.guardians.total).toBe(15);
        expect(overview.lastImport?.status).toBe('succeeded');
        // The Today charts show the Practice calls, labelled as such; the families' trend stays empty.
        expect(overview.activityMode).toBe('practice');
        expect(overview.hours.reduce((s, h) => s + h.calls, 0)).toBe(12);
        expect(Object.values(overview.todayByLanguage).reduce((s, l) => s + l.calls, 0)).toBe(12);
        expect(overview.recent).toHaveLength(8);
        expect(overview.recent.every((r) => r.carrier === 'simulated' && r.campaignId === campaign.id)).toBe(true);
        expect(overview.trend[overview.trend.length - 1].calls).toBe(12);
        expect(overview.familyTrend.every((d) => d.calls === 0)).toBe(true);
        expect(overview.liveCampaign?.id ?? null).toBe(campaignNow.status === 'dispatching' ? campaign.id : null);
        expect(overview.windowToday).not.toBeNull();
    });

    it('emergency closure previews today/tomorrow variants and schedules', async () => {
        const env = await setup();
        const campaign = await createCampaign(env.ctx, ORG, ADMIN, {
            purpose: 'emergency_closure',
            facts: { kind: 'emergency_closure', date: '2026-10-06', reason: 'heavy_rain', busesRunning: false },
            audience: { sections: [{ grade: 7, section: 'A' }] },
        });
        expect(campaign.expiresAt).toBe('2026-10-06T18:29:59.999Z'); // a closure still runs to the end of its day
        // Both variants are frozen (H4).
        const previews = await previewCampaign(env.ctx, ORG, campaign.id);
        expect(previews.map((p) => `${p.language}:${p.variant}`)).toEqual([
            'English:today', 'English:tomorrow', 'Hindi:today', 'Hindi:tomorrow',
            'Bengali:today', 'Bengali:tomorrow', 'Nepali:today', 'Nepali:tomorrow',
        ]);
        await approveCampaign(env.ctx, ORG, campaign.id, ADMIN);
        const scheduled = await renderUntilSettled(env, campaign.id);
        expect(scheduled.status).toBe('scheduled');
        const slots = Object.keys(scheduled.clipKeys ?? {});
        expect(slots.filter((k) => k.endsWith('|today'))).toHaveLength(slots.length / 2);
        expect(slots.filter((k) => k.endsWith('|tomorrow'))).toHaveLength(slots.length / 2);
        expect(slots.length).toBeGreaterThan(0);
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
        // H5: an invitation for 12:30 today (it is 11:00) is too late to call about, though it has not started.
        await expect(
            createCampaign(env.ctx, ORG, ADMIN, { ...base, purpose: 'ptm_invite', facts: { kind: 'ptm_invite', date: '2026-10-05', time: { hour: 12, minute: 30 }, venueId: 'school_hall' } }),
        ).rejects.toMatchObject({ code: 'TOO_LATE_TO_CALL', status: 400 });
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
        const audits = captureAudits(env.repo);
        const cancelled = await cancelCampaign(env.ctx, ORG, campaign.id, ADMIN);
        expect(cancelled.status).toBe('cancelled');
        // Nothing was out yet, and the response and the audit say so (H4).
        expect(cancelled.calls).toEqual({ ringingStopped: 0, stillSpeaking: 0 });
        expect(audits.find((a) => a.action === 'campaign.cancel')?.detail).toMatchObject({ ringingStopped: 0, stillSpeaking: 0 });
        const intents = await env.repo.listIntentsByCampaign(ORG, campaign.id);
        expect(intents.some((i) => i.status === 'approved')).toBe(false);
        expect(intents.filter((i) => i.status === 'cancelled').length).toBeGreaterThan(0);
        expect((await dispatchJob({ repo: env.repo, clock: env.clock })).dialed).toBe(0);
        await expect(cancelCampaign(env.ctx, ORG, campaign.id, ADMIN)).rejects.toMatchObject({ code: 'CAMPAIGN_FINISHED' });
    });

    it('B6: the dry run counts toward the cap only real calls to a guardian, like the cap itself', async () => {
        const env = await setup();
        const campaign = await createCampaign(env.ctx, ORG, ADMIN, {
            purpose: 'ptm_invite',
            facts: { kind: 'ptm_invite', date: '2026-10-08', time: { hour: 10, minute: 30 }, venueId: 'school_hall' },
            audience: { sections: [] },
        });
        const [g0, g1, g2] = await env.repo.listGuardians(ORG, ['g0', 'g1', 'g2']);
        const yesterday = new Date(MON_11_IST.getTime() - 24 * 60 * 60 * 1000);
        await plantCalls(env.repo, g0, FREQUENCY_CAP, 'simulated', 'guardian', yesterday); // Practice: rang nobody
        await plantCalls(env.repo, g1, FREQUENCY_CAP, 'vobiz', 'test_phone', yesterday); // Test: rang the school's phone
        await plantCalls(env.repo, g2, FREQUENCY_CAP, 'vobiz', 'guardian', yesterday); // real calls to the family
        const detail = await getCampaignDetail(env.ctx, ORG, campaign.id);
        expect(detail.audience.blocked.frequency_cap).toBe(1);
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
