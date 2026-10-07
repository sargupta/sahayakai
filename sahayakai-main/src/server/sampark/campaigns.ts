/**
 * Class-wide notice campaigns (plan §2B/§2D, slice 1: PTM, event, emergency
 * closure): create a draft, dry-run its audience, preview what parents will
 * hear, approve it into rendering, or cancel it.
 *
 * Facts are typed per purpose and validated here — no free text ever reaches
 * TTS. A purpose must be `available` in the catalogue, dialable and a TRAI
 * "service" purpose (class gate 8), so a promotional or planned purpose can
 * never become a campaign.
 *
 * The audience dry-run evaluates the SAME gate the materialiser uses (stage
 * 'materialise') and writes nothing.
 *
 * Hardening sprint (7 Oct 2026, docs/sampark/EDGE_CASES.md §3):
 *   - approval pins the school's mode on the campaign (H2), so flipping the
 *     school's mode later can never turn a rehearsal into real calls;
 *   - invitations stop INVITE_LEAD_MINUTES before the event starts (H5): a
 *     family must never be invited to something that has already begun;
 *   - cancelling hangs up the campaign's calls that are still ringing (H4); one
 *     answered anyway hears the withdrawn line (voice.ts), never silence;
 *   - `campaignClipKeys` is the one definition of the clip keys a campaign's
 *     calls play, frozen on the campaign when it is scheduled (H4, jobs.ts).
 */

import crypto from 'node:crypto';

import { z } from 'zod';

import { logger } from '@/lib/logger';
import { bundleAudience } from '@/lib/sampark/audience';
import { isDialable, PURPOSE_CATALOGUE, purposeSpec } from '@/lib/sampark/catalogue';
import { chooseClosureVariant, closureExpiry, istDateString } from '@/lib/sampark/closure';
import { emptyCounts } from '@/lib/sampark/dispatch/counts';
import { languageInfo } from '@/lib/sampark/languages';
import { evaluateGate } from '@/lib/sampark/policy/gate';
import { resolveLanguage } from '@/lib/sampark/policy/language';
import { audienceLabelFor, renderNoticeScript, ScriptRenderError, variantsFor, type ScriptVariant } from '@/lib/sampark/scripts/render';
import { clipKey } from '@/lib/sampark/speech/clip-key';
import {
    type BlockReason,
    type Campaign,
    type CampaignFacts,
    type ClipKind,
    type GuardianPreferences,
    PARENT_LANGUAGES,
    type ParentLanguage,
    type PurposeId,
    type SamparkGuardian,
    type SamparkSchool,
    type SamparkStudent,
    type ScriptPreview,
} from '@/types/sampark';
import { carrierKindForDryRun } from '@/server/sampark/carrier';
import { badRequest, conflict, notFound } from '@/server/sampark/errors';
import { hangupRingingCalls, type LegHangup } from '@/server/sampark/hangup';
import type { SamparkCtx } from '@/server/sampark/http';
import { getSchoolOrThrow, IsoDateSchema } from '@/server/sampark/school';

// ── Schemas ─────────────────────────────────────────────────────────────────

const SpokenTimeSchema = z
    .object({
        // Every language's day periods name school hours up to 19:30; a later time could be created
        // and then refused at approval (SCRIPT_UNAVAILABLE), so it is refused here instead
        // (gate-h5-every-accepted-time-is-sayable).
        hour: z.number().int().min(6, 'time must be between 06:00 and 19:30').max(19, 'time must be between 06:00 and 19:30'),
        minute: z.union([z.literal(0), z.literal(30)], { errorMap: () => ({ message: 'minute must be 0 or 30' }) }),
    })
    .strict();

const VenueIdSchema = z.string().min(1).max(40);

export const CampaignFactsSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('ptm_invite'), date: IsoDateSchema, time: SpokenTimeSchema, venueId: VenueIdSchema }).strict(),
    z
        .object({
            kind: z.literal('event_invite'),
            eventType: z.enum(['annual_day', 'sports_day', 'science_fair', 'cultural_programme', 'parent_workshop']),
            date: IsoDateSchema,
            time: SpokenTimeSchema,
            venueId: VenueIdSchema,
        })
        .strict(),
    z
        .object({
            kind: z.literal('emergency_closure'),
            date: IsoDateSchema,
            reason: z.enum(['rain_landslide', 'heavy_rain', 'bandh', 'local_emergency']),
            busesRunning: z.boolean(),
        })
        .strict(),
]);

export const CreateCampaignSchema = z
    .object({
        purpose: z.string().min(1).max(64),
        facts: CampaignFactsSchema,
        audience: z
            .object({
                sections: z
                    .array(z.object({ grade: z.number().int().min(1).max(12), section: z.string().regex(/^[A-Z]$/) }).strict())
                    .max(100),
            })
            .strict(),
        notBefore: z.string().datetime({ offset: true }).nullable().optional(),
    })
    .strict();
export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;

export const PreviewSchema = z
    .object({ languages: z.array(z.enum(PARENT_LANGUAGES)).min(1).max(4).optional() })
    .strict();

// ── Helpers ─────────────────────────────────────────────────────────────────

/** An instant on an IST wall clock. */
function istInstant(date: string, hour: number, minute: number, second = 0, ms = 0): Date {
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return new Date(`${date}T${pad(hour)}:${pad(minute)}:${pad(second)}.${pad(ms, 3)}+05:30`);
}

/**
 * Minutes before an invitation's start time after which no new call starts (H5). Until
 * 7 Oct 2026 invitations ran to 23:59 on the event day, so a family could be rung about a
 * meeting that had already begun; two hours leaves time to get there.
 */
export const INVITE_LEAD_MINUTES = 120;

/**
 * The last instant at which a new attempt may start (the dispatcher expires an intent once
 * `now > expiresAt`, and the closure's expiry is 23:59:59.999 IST for the same reason). For an
 * invitation that is the millisecond before the event start minus INVITE_LEAD_MINUTES, so no
 * call ever starts AT the lead either; for D4, the closure-day expiry from the engine.
 */
export function campaignExpiry(facts: CampaignFacts): Date {
    if (facts.kind === 'emergency_closure') return closureExpiry(facts.date);
    const start = istInstant(facts.date, facts.time.hour, facts.time.minute);
    return new Date(start.getTime() - INVITE_LEAD_MINUTES * 60_000 - 1);
}

function validateFacts(facts: CampaignFacts, school: SamparkSchool, now: Date): void {
    if (facts.kind === 'emergency_closure') {
        if (chooseClosureVariant(facts.date, now) === null) {
            throw badRequest('CLOSURE_DATE', 'An emergency closure must be for today or tomorrow (IST)');
        }
        return;
    }
    if (facts.date < istDateString(now)) throw badRequest('DATE_IN_PAST', 'The date is in the past');
    if (istInstant(facts.date, facts.time.hour, facts.time.minute).getTime() <= now.getTime()) {
        throw badRequest('DATE_IN_PAST', 'The time has already passed');
    }
    if (campaignExpiry(facts).getTime() <= now.getTime()) {
        throw badRequest('TOO_LATE_TO_CALL', `Invitation calls stop ${INVITE_LEAD_MINUTES / 60} hours before the start, so it is too late to call about this`);
    }
    if (!school.venues.some((v) => v.id === facts.venueId)) {
        throw badRequest('UNKNOWN_VENUE', 'Choose one of the school venues');
    }
}

async function getCampaignOrThrow(ctx: SamparkCtx, orgId: string, campaignId: string): Promise<Campaign> {
    const campaign = await ctx.repo.getCampaign(orgId, campaignId);
    if (!campaign) throw notFound('CAMPAIGN_NOT_FOUND', 'Campaign not found');
    return campaign;
}

// ── Audience ────────────────────────────────────────────────────────────────

export interface ResolvedAudience {
    students: SamparkStudent[];
    guardians: SamparkGuardian[];
    prefs: Map<string, GuardianPreferences>;
    /** Guardian id → the in-audience children they are guardian of record for. */
    studentsByGuardian: Map<string, SamparkStudent[]>;
}

/**
 * The audience exactly as the materialiser will see it: stream B's
 * bundleAudience (active students in the sections, active guardians who are
 * of record on BOTH sides), so the dry run and the real run cannot disagree.
 */
export async function resolveCampaignAudience(ctx: SamparkCtx, orgId: string, campaign: Pick<Campaign, 'audience'>): Promise<ResolvedAudience> {
    const all = await ctx.repo.listStudents(orgId);
    const candidateIds = [...new Set(all.filter((s) => s.active).flatMap((s) => s.guardianIds ?? []))];
    const candidates = candidateIds.length ? await ctx.repo.listGuardians(orgId, candidateIds) : [];
    const bundles = bundleAudience(campaign, all, candidates);
    const guardians = [...bundles.values()].map((b) => b.guardian);
    const studentsByGuardian = new Map([...bundles.entries()].map(([id, b]) => [id, b.students]));
    const students = [...new Map([...bundles.values()].flatMap((b) => b.students).map((s) => [s.id, s])).values()];
    const prefs = guardians.length
        ? await ctx.repo.getPreferences(orgId, guardians.map((g) => g.id))
        : new Map<string, GuardianPreferences>();
    return { students, guardians, prefs, studentsByGuardian };
}

// ── Frozen clip keys (H4) ───────────────────────────────────────────────────

/** The `Campaign.clipKeys` slot of one language and audio variant. */
export function clipKeySlot(language: ParentLanguage, variant: ScriptVariant): string {
    return `${language}|${variant}`;
}

/**
 * The key of every clip a campaign's calls can play, per language × variantsFor(purpose):
 * the render job's own texts (renderNoticeScript on the same purpose, facts, school,
 * language, variant and audience label) hashed with the same clipKey. Computed once, when
 * the audio has passed its checks, and frozen on the campaign, so a later edit to the
 * school's settings can no longer change what an answered call looks up (EDGE_CASES.md
 * gap 3: the re-rendered key missed, and the parent heard silence). Throws
 * ScriptRenderError for a script that cannot be said.
 */
export function campaignClipKeys(
    campaign: Pick<Campaign, 'purpose' | 'facts' | 'audience'>,
    school: SamparkSchool,
    languages: readonly ParentLanguage[],
): NonNullable<Campaign['clipKeys']> {
    const frozen: NonNullable<Campaign['clipKeys']> = {};
    const audience = audienceLabelFor(campaign);
    for (const language of languages) {
        const speech = languageInfo(language).speech;
        for (const variant of variantsFor(campaign.purpose)) {
            const script = renderNoticeScript({ purpose: campaign.purpose, facts: campaign.facts, school, language, variant, audience });
            const byKind: Partial<Record<ClipKind, string>> = {};
            for (const clip of script.clips) byKind[clip.kind] = clipKey(speech, clip.text);
            frozen[clipKeySlot(language, variant)] = byKind;
        }
    }
    return frozen;
}

/** Distinct languages the audience's guardians resolve to — what must be rendered. */
export function audienceLanguages(audience: ResolvedAudience, school: SamparkSchool): ParentLanguage[] {
    const set = new Set<ParentLanguage>();
    for (const g of audience.guardians) {
        const lang = resolveLanguage(g, audience.prefs.get(g.id) ?? null, school);
        if (lang) set.add(lang);
    }
    return PARENT_LANGUAGES.filter((l) => set.has(l));
}

export interface AudienceSummary {
    guardians: number;
    byLanguage: Record<ParentLanguage | 'unknown', number>;
    blocked: Partial<Record<BlockReason, number>>;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Dry-run the materialise-stage gate for every guardian of record in the
 * audience. Writes nothing. `byLanguage` covers every guardian in the audience
 * (the languages the campaign must be rendered in); `blocked` counts the ones
 * the gate would refuse, by reason.
 */
export async function summariseAudience(ctx: SamparkCtx, school: SamparkSchool, campaign: Campaign): Promise<AudienceSummary> {
    const now = ctx.clock.now();
    const audience = await resolveCampaignAudience(ctx, school.orgId, campaign);
    const spec = purposeSpec(campaign.purpose);
    const carrierKind = carrierKindForDryRun(school);

    const [suppressions, recentCalls] = await Promise.all([
        ctx.repo.listSuppressions(school.orgId),
        ctx.repo.listCalls(school.orgId, { limit: 5000 }),
    ]);
    const suppressionByHash = new Map(suppressions.map((s) => [s.phoneHash, s]));
    const since = now.getTime() - THIRTY_DAYS_MS;
    const recentByHash = new Map<string, number>();
    for (const c of recentCalls) {
        if (new Date(c.createdAt).getTime() < since) continue;
        if (purposeSpec(c.purpose).emergency) continue;
        // The cap's own rule (H1, B6): only real calls to a guardian count. A Practice call rang
        // nobody, and a Test call rang the school's own phone.
        if (c.carrier === 'simulated' || (c.destination ?? 'guardian') !== 'guardian') continue;
        recentByHash.set(c.phoneHash, (recentByHash.get(c.phoneHash) ?? 0) + 1);
    }

    const byLanguage: Record<ParentLanguage | 'unknown', number> = { English: 0, Hindi: 0, Bengali: 0, Nepali: 0, unknown: 0 };
    const blocked: Partial<Record<BlockReason, number>> = {};
    for (const guardian of audience.guardians) {
        const preferences = audience.prefs.get(guardian.id) ?? null;
        const lang = resolveLanguage(guardian, preferences, school);
        byLanguage[lang ?? 'unknown'] += 1;
        const verdict = evaluateGate({
            school,
            spec,
            guardian,
            students: audience.studentsByGuardian.get(guardian.id) ?? [],
            preferences,
            suppression: suppressionByHash.get(guardian.phoneHash) ?? null,
            recentCallsToPhone: recentByHash.get(guardian.phoneHash) ?? 0,
            carrierKind,
            now,
            stage: 'materialise',
        });
        if (verdict.kind === 'block') blocked[verdict.reason] = (blocked[verdict.reason] ?? 0) + 1;
    }
    return { guardians: audience.guardians.length, byLanguage, blocked };
}

// ── Services ────────────────────────────────────────────────────────────────

export async function listCampaigns(ctx: SamparkCtx, orgId: string): Promise<Campaign[]> {
    await getSchoolOrThrow(ctx, orgId);
    return ctx.repo.listCampaigns(orgId, 100);
}

export async function createCampaign(ctx: SamparkCtx, orgId: string, uid: string, input: CreateCampaignInput): Promise<Campaign> {
    const school = await getSchoolOrThrow(ctx, orgId);
    if (!Object.prototype.hasOwnProperty.call(PURPOSE_CATALOGUE, input.purpose)) {
        throw badRequest('UNKNOWN_PURPOSE', 'Unknown purpose');
    }
    const purpose = input.purpose as PurposeId;
    const spec = purposeSpec(purpose);
    // Class gate 8: only available, dialable, service purposes can ever be scheduled.
    if (spec.status !== 'available' || !isDialable(purpose) || spec.commercial !== 'service') {
        throw badRequest('PURPOSE_NOT_AVAILABLE', 'This purpose is not available for campaigns');
    }
    const facts = input.facts as CampaignFacts;
    if (facts.kind !== purpose) throw badRequest('FACTS_MISMATCH', 'The facts do not match the purpose');

    const now = ctx.clock.now();
    validateFacts(facts, school, now);
    const expiresAt = campaignExpiry(facts);
    const notBefore = input.notBefore ? new Date(input.notBefore) : null;
    if (notBefore && notBefore.getTime() >= expiresAt.getTime()) {
        throw badRequest('NOT_BEFORE_AFTER_EXPIRY', 'The start time is after the campaign expires');
    }

    const seen = new Set<string>();
    const sections = input.audience.sections.filter((s) => {
        const key = `${s.grade}${s.section}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const nowIso = now.toISOString();
    const campaign: Campaign = {
        id: crypto.randomUUID().replace(/-/g, ''),
        orgId,
        purpose,
        facts,
        audience: { sections },
        status: 'draft',
        notBefore: notBefore ? notBefore.toISOString() : null,
        expiresAt: expiresAt.toISOString(),
        createdBy: uid,
        createdAt: nowIso,
        approvedBy: null,
        approvedAt: null,
        renderProgress: { done: 0, total: 0, failures: [] },
        counts: emptyCounts(),
        updatedAt: nowIso,
    };
    await ctx.repo.createCampaign(campaign);
    await ctx.repo.appendAudit(orgId, {
        at: nowIso,
        actor: uid,
        action: 'campaign.create',
        target: `campaign/${campaign.id}`,
        detail: { purpose, facts, audience: campaign.audience },
    });
    return campaign;
}

export async function getCampaignDetail(
    ctx: SamparkCtx,
    orgId: string,
    campaignId: string,
): Promise<{ campaign: Campaign; audience: AudienceSummary }> {
    const school = await getSchoolOrThrow(ctx, orgId);
    const campaign = await getCampaignOrThrow(ctx, orgId, campaignId);
    return { campaign, audience: await summariseAudience(ctx, school, campaign) };
}

export async function previewCampaign(
    ctx: SamparkCtx,
    orgId: string,
    campaignId: string,
    languages: ParentLanguage[] = [...PARENT_LANGUAGES],
): Promise<ScriptPreview[]> {
    const school = await getSchoolOrThrow(ctx, orgId);
    const campaign = await getCampaignOrThrow(ctx, orgId, campaignId);
    const audience = audienceLabelFor(campaign);
    const wanted = PARENT_LANGUAGES.filter((l) => languages.includes(l));
    const previews: ScriptPreview[] = [];
    for (const language of wanted) {
        const speech = languageInfo(language).speech;
        for (const variant of variantsFor(campaign.purpose)) {
            let rendered;
            try {
                rendered = renderNoticeScript({ purpose: campaign.purpose, facts: campaign.facts, school, language, variant, audience });
            } catch (err) {
                // One language that cannot be said (e.g. its spoken school name is still in
                // Latin letters) must not hide the others: return it with the reason.
                if (!(err instanceof ScriptRenderError)) throw err;
                previews.push({ language, variant, clips: [], estimatedSeconds: 0, warnings: [err.message] });
                continue;
            }
            const clips = await Promise.all(
                rendered.clips.map(async (c) => {
                    const key = clipKey(speech, c.text);
                    const clip = await ctx.repo.getClip(orgId, key);
                    return { kind: c.kind, text: c.text, audioKey: clip ? key : null, durationSeconds: clip ? clip.durationSeconds : null };
                }),
            );
            previews.push({ language, variant, clips, estimatedSeconds: rendered.estimatedSeconds, warnings: rendered.warnings });
        }
    }
    return previews;
}

export async function approveCampaign(ctx: SamparkCtx, orgId: string, campaignId: string, uid: string): Promise<Campaign> {
    const school = await getSchoolOrThrow(ctx, orgId);
    const campaign = await getCampaignOrThrow(ctx, orgId, campaignId);
    if (campaign.status !== 'draft') throw conflict('CAMPAIGN_NOT_DRAFT', 'Only a draft campaign can be approved');
    const now = ctx.clock.now();
    if (new Date(campaign.expiresAt).getTime() <= now.getTime()) throw conflict('CAMPAIGN_EXPIRED', 'This campaign has expired');
    if (campaign.facts.kind === 'emergency_closure' && chooseClosureVariant(campaign.facts.date, now) === null) {
        throw conflict('CAMPAIGN_EXPIRED', 'This closure is no longer for today or tomorrow');
    }
    // Refuse now, not after minutes of rendering: every language the audience
    // needs must be sayable (e.g. an Indic spoken school name in its own script).
    const languages = audienceLanguages(await resolveCampaignAudience(ctx, orgId, campaign), school);
    for (const language of languages) {
        for (const variant of variantsFor(campaign.purpose)) {
            try {
                renderNoticeScript({ purpose: campaign.purpose, facts: campaign.facts, school, language, variant, audience: audienceLabelFor(campaign) });
            } catch (err) {
                if (err instanceof ScriptRenderError) throw conflict('SCRIPT_UNAVAILABLE', err.message);
                throw err;
            }
        }
    }
    const nowIso = now.toISOString();
    // The mode is pinned here (H2): the dispatcher and the answer webhook only let this campaign
    // speak while the school is still in the mode the approver saw.
    const patch: Partial<Campaign> = { status: 'rendering', approvedBy: uid, approvedAt: nowIso, mode: school.mode, updatedAt: nowIso };
    await ctx.repo.updateCampaign(orgId, campaignId, patch);
    // Audit what the approver saw (plan §4⑤): purpose, facts, audience, expiry and mode.
    await ctx.repo.appendAudit(orgId, {
        at: nowIso,
        actor: uid,
        action: 'campaign.approve',
        target: `campaign/${campaignId}`,
        detail: { purpose: campaign.purpose, facts: campaign.facts, audience: campaign.audience, expiresAt: campaign.expiresAt, mode: school.mode },
    });
    return { ...campaign, ...patch };
}

/**
 * Re-run audio preparation for a campaign whose render failed its check.
 *
 * Voice-model slips (a repeated line, a leaked instruction) are random, so a
 * fresh render usually passes; without this a principal's only way out was to
 * cancel and recreate the campaign. Clips that already passed are kept (the
 * render job skips them), only the failed ones are rendered again, and the
 * check that failed them still applies.
 */
export async function retryCampaignAudio(ctx: SamparkCtx, orgId: string, campaignId: string, uid: string): Promise<Campaign> {
    await getSchoolOrThrow(ctx, orgId);
    const campaign = await getCampaignOrThrow(ctx, orgId, campaignId);
    if (campaign.status !== 'render_failed') {
        throw conflict('CAMPAIGN_AUDIO_NOT_FAILED', 'Only a campaign whose audio failed its check can be prepared again');
    }
    const now = ctx.clock.now();
    if (new Date(campaign.expiresAt).getTime() <= now.getTime()) throw conflict('CAMPAIGN_EXPIRED', 'This campaign has expired');
    const nowIso = now.toISOString();
    const patch: Partial<Campaign> = {
        status: 'rendering',
        renderProgress: { ...campaign.renderProgress, failures: [] },
        updatedAt: nowIso,
    };
    await ctx.repo.updateCampaign(orgId, campaignId, patch);
    await ctx.repo.appendAudit(orgId, {
        at: nowIso,
        actor: uid,
        action: 'campaign.retry_audio',
        target: `campaign/${campaignId}`,
        detail: { previousFailures: campaign.renderProgress.failures.slice(0, 20) },
    });
    return { ...campaign, ...patch };
}

const CANCELLABLE_INTENT_STATUSES = new Set(['approved', 'retry_wait']);

/** What happened to the campaign's calls that were already out when it was cancelled (H4). */
export interface CancelCallsReport {
    /** Phones that were still ringing and that the carrier confirmed it stopped. */
    ringingStopped: number;
    /** Calls a parent had already answered, left to finish their sentence. */
    stillSpeaking: number;
}

export type CancelledCampaign = Campaign & { calls: CancelCallsReport | null };

/**
 * Cancel a campaign: nothing waiting is dialled, and every phone of it still ringing is hung
 * up through the carrier (H4). A call already speaking finishes (cutting a parent off
 * mid-sentence is worse), and a call answered before its hang-up lands hears the withdrawn
 * line instead of the message (voice.ts). The response and the audit entry say how many
 * phones were stopped and how many calls were still speaking; `calls` is null when the
 * hang-up step itself failed (the cancel still stands, and the audit says so).
 *
 * `legHangup` is injectable for tests; it defaults to the Vobiz hang-up.
 */
export async function cancelCampaign(ctx: SamparkCtx, orgId: string, campaignId: string, uid: string, legHangup?: LegHangup | null): Promise<CancelledCampaign> {
    await getSchoolOrThrow(ctx, orgId);
    const campaign = await getCampaignOrThrow(ctx, orgId, campaignId);
    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
        throw conflict('CAMPAIGN_FINISHED', 'This campaign has already finished');
    }
    const nowIso = ctx.clock.now().toISOString();
    const patch: Partial<Campaign> = { status: 'cancelled', updatedAt: nowIso };
    await ctx.repo.updateCampaign(orgId, campaignId, patch);
    // Everything still waiting stops; a call already 'dialing' has its phone hung up below if it rings.
    const intents = await ctx.repo.listIntentsByCampaign(orgId, campaignId);
    let cancelled = 0;
    for (const intent of intents) {
        if (!CANCELLABLE_INTENT_STATUSES.has(intent.status)) continue;
        await ctx.repo.updateIntent(orgId, intent.id, { status: 'cancelled', updatedAt: nowIso });
        cancelled++;
    }
    // The campaign is cancelled and the queue emptied before the carrier is asked anything, so a
    // carrier fault can never leave the cancel half done.
    let calls: CancelCallsReport | null = null;
    let hangupError: string | null = null;
    try {
        const report = await hangupRingingCalls(ctx, orgId, { campaignId, reason: 'campaign_cancelled', actor: uid }, legHangup);
        calls = { ringingStopped: report.hungUp, stillSpeaking: report.stillSpeaking };
    } catch (err) {
        hangupError = err instanceof Error ? err.message.slice(0, 200) : 'unknown error';
        logger.error('Sampark cancel: hanging up ringing calls failed', err, 'SAMPARK_CAMPAIGNS', { orgId, campaignId });
    }
    await ctx.repo.appendAudit(orgId, {
        at: nowIso,
        actor: uid,
        action: 'campaign.cancel',
        target: `campaign/${campaignId}`,
        detail: { from: campaign.status, intentsCancelled: cancelled, ...(calls ?? { hangupError }) },
    });
    return { ...campaign, ...patch, calls };
}
