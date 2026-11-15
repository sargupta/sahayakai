/**
 * Class-wide batch calling: ONE teacher action → one independent Riya call per eligible family.
 *
 * This is an orchestration layer only. Every call is placed by the existing `startRiyaCall`
 * (server/sampark/conversation.ts), so each recipient gets exactly what an individual call gets:
 * its own record, idempotency key, provider call (its own Vobiz CallUUID), signed per-call context
 * for the bridge, gate checks (consent, opt-out, suppression, custody, frequency cap, calling hours,
 * pause, language), the Sargvision allow-list, the per-contact daily cap, its own transcript,
 * synopsis, callback proposal and stop-request suppression. Nothing here dials a phone directly.
 *
 * Flow:
 *   preview  (no writes)  → class roster → per family: previewRiyaCall → eligible / excluded (+why)
 *   create   (confirmed)  → re-runs the preview, checks the confirmed count and line, refuses a
 *                           duplicate announcement for the same class, writes the campaign 'running'
 *   advance  (queue)      → lease → mirror every recipient's current call → ROLLING SCHEDULER: launch
 *                           the next pending family whenever a line is free (at most 3 at once:
 *                           min(SAMPARK_BATCH_MAX_CONCURRENCY, verified Vobiz account limit, AI
 *                           session capacity)) AND at least the minimum interval (60 s) has passed
 *                           since the school's last ACCEPTED launch → complete when nothing is left.
 *                           Woken by: a call ending (webhook), the interval/backoff expiring (timer),
 *                           pause/resume/retry, the open campaign page, and the dispatch tick
 *                           (reconciliation fallback). All idempotent under the campaign lease.
 *   pause / resume / cancel / retry — explicit person actions. Pause stops NEW calls only; calls
 *                           already ringing finish and are recorded. Resume never re-dials a recipient
 *                           that already has an outcome. Retry is explicit, per recipient, and only for
 *                           no-answer / busy / failed (never after a stop or callback request).
 *
 * Fail-closed:
 *   - Practice mode → simulated calls only.
 *   - A real provider needs SAMPARK_BATCH_REAL_CALLS === 'true' (on top of every Riya flag), the
 *     person's explicit confirmation, and per-contact numbers (the local Sargvision roster). A batch
 *     never rings the single school test phone N times.
 *   - Only Vobiz runs real batches in this release; with ElevenLabs selected a real batch is refused
 *     (it is never silently routed through Vobiz).
 *   - Individual-only workflows (absence, academic, behaviour, achievement) are refused.
 */

import crypto from 'node:crypto';
import os from 'node:os';

import { z } from 'zod';

import { logger } from '@/lib/logger';
import { getBatchRepo } from '@/lib/sampark/batch/factory';
import { batchReason, BATCH_REASON_IDS, classKey, classLabel, isBatchablePurpose, type BatchReasonId } from '@/lib/sampark/batch/reasons';
import type { BatchCampaignRepo } from '@/lib/sampark/batch/repo';
import {
    backoffMs,
    batchCapacity,
    batchMinIntervalMs,
    countActiveCalls,
    isAcceptedLaunch,
    isRateLimitRefusal,
    lastAcceptedLaunchAt,
    nextLaunchAt,
    rateLimitBackoffUntil,
    retryAfterSeconds,
    type BatchCapacity,
} from '@/lib/sampark/batch/schedule';
import { RIYA_VOBIZ_HARD_END_MS } from '@/lib/sampark/conversation/vobiz-provider';
import { applyCallToRecipient, isFinished, isOpen, isRetryable, progressOf } from '@/lib/sampark/batch/state';
import {
    BATCH_ACTIVE_STATUSES,
    BATCH_MAX_LAUNCH_FAILURES,
    BATCH_MAX_RECIPIENTS,
    type BatchCampaign,
    type BatchExclusion,
    type BatchExclusionReason,
    type BatchProgress,
    type BatchRecipient,
} from '@/lib/sampark/batch/types';
import { runIdempotencyKey } from '@/lib/sampark/callbacks/state';
import { RiyaFactsSchema, type RiyaFacts } from '@/lib/sampark/conversation/facts';
import { SimulationScenarioSchema } from '@/lib/sampark/conversation/simulated-provider';
import { isRealProvider, isTerminalConversationState, type ConversationCall, type ConversationCallView, type ConversationProviderKind } from '@/lib/sampark/conversation/types';
import { hashId } from '@/lib/sampark/intents';
import type { Clock } from '@/lib/sampark/ports';
import type { SamparkGuardian, SamparkStudent } from '@/types/sampark';
import { canManageClass, requireOrgAdmin } from '@/server/sampark/auth';
import {
    expireRiyaCallUnknown,
    factsHashOf,
    getRiyaCall,
    previewRiyaCall,
    reconcileRiyaCall,
    riyaCallId,
    riyaDeps,
    riyaEnabled,
    sargvisionRosterMode,
    startRiyaCall,
    type RiyaDeps,
    type RiyaPreview,
    type RiyaRefusal,
} from '@/server/sampark/conversation';
import { armTimer, markAdvancing, registerBatchWaker, takeRerun } from '@/server/sampark/batch-wake';
import { badRequest, conflict, forbidden, notFound, SamparkServiceError } from '@/server/sampark/errors';
import { getSchoolOrThrow } from '@/server/sampark/school';

const LOG = 'SAMPARK_BATCH';
export const BATCH_TICK_LOCK = 'sampark-batch';
const BATCH_TICK_LOCK_TTL_MS = 2 * 60_000;
const LEASE_MS = 45_000;
const CLAIM_MS = 2 * 60_000;
/** A call with no result this long after it was placed is shown as 'unknown' (never re-dialled). */
export const BATCH_STALE_MS = 20 * 60_000;
/** An in-progress real call older than this is looked up read-only at the provider, at most once a minute. */
const RECONCILE_AFTER_MS = 2 * 60_000;
const RECONCILE_EVERY_MS = 60_000;
const SIMULATED_DIALS_PER_PASS = 10;

type Env = Record<string, string | undefined>;

export interface BatchDeps extends RiyaDeps {
    batches: BatchCampaignRepo;
    /** Org admin, or a teacher the school assigned to this class (server-managed member record). */
    canManageClass: (orgId: string, uid: string, grade: number, section: string) => Promise<boolean>;
    isOrgAdmin: (orgId: string, uid: string) => Promise<boolean>;
    /**
     * Wake this campaign at `at` (the launch interval or a backoff expires). Production arms an
     * in-process timer; tests record the request. Absent → only webhooks and the tick wake it.
     */
    scheduleWake?: (orgId: string, campaignId: string, at: Date) => void;
}

export async function batchDeps(ctx: { repo: RiyaDeps['repo']; clock: Clock }): Promise<BatchDeps> {
    const base = await riyaDeps(ctx);
    const deps: BatchDeps = { ...base, batches: await getBatchRepo(), canManageClass, isOrgAdmin: requireOrgAdmin };
    deps.scheduleWake = (orgId, campaignId, at) => armTimer(deps, orgId, campaignId, at, deps.clock.now().getTime());
    return deps;
}

// ── Configuration ───────────────────────────────────────────────────────────

/** Real (ringing) batches are off unless the operator switches them on, on top of every Riya flag. */
export function realBatchCallsEnabled(env: Env = process.env): boolean {
    return env.SAMPARK_BATCH_REAL_CALLS === 'true';
}

/**
 * Calls in flight at once for one school during a batch. The product ceiling is three; an operator
 * may configure fewer, and a verified provider/account limit or the conversation backend's session
 * capacity lowers it further. Nothing a browser sends takes part in this.
 */
export function batchConcurrency(env: Env = process.env, provider: ConversationProviderKind = 'vobiz'): number {
    return batchCapacity(env, provider).effective;
}

/**
 * Minimum gap between two launches the provider ACCEPTED (seconds → ms). Default 60 s; Practice
 * needs none. A launch the provider refused never rang, so it does not start this interval.
 */
export function batchDialGapMs(env: Env = process.env, provider: ConversationProviderKind): number {
    return batchMinIntervalMs(env, provider);
}

/** Batch calls one school may place in 24 hours (all batches). Default 200. */
export function batchDailyLimit(env: Env = process.env): number {
    const n = Number(env.SAMPARK_BATCH_DAILY_LIMIT);
    return Number.isInteger(n) && n >= 0 && n <= 2000 ? n : 200;
}

// ── Requests ────────────────────────────────────────────────────────────────

const DocId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'invalid id');
const Section = z.string().regex(/^[A-Za-z0-9]{1,8}$/, 'invalid section');

const FamilyRef = z.object({ guardianId: DocId, studentId: DocId }).strict();

export const BatchPreviewSchema = z.object({
    grade: z.number().int().min(0).max(12),
    section: Section,
    reason: z.enum(BATCH_REASON_IDS),
    facts: RiyaFactsSchema,
    /** Families the teacher removed from this batch. */
    excluded: z.array(FamilyRef).max(BATCH_MAX_RECIPIENTS).default([]),
}).strict();
export type BatchPreviewInput = z.input<typeof BatchPreviewSchema>;

export const BatchCreateSchema = BatchPreviewSchema.extend({
    /** Client-chosen; a retried request returns the original campaign. */
    requestKey: z.string().uuid(),
    /** What the person reviewed: the number of families that will be called and the sample line. */
    confirmedRecipientCount: z.number().int().min(1).max(BATCH_MAX_RECIPIENTS),
    confirmedSampleAnnouncement: z.string().min(1).max(2000),
    /** Required for a real provider: the person confirmed that real phones will ring. */
    confirmRealCalls: z.boolean().default(false),
    /** Practice only. */
    scenario: SimulationScenarioSchema.optional(),
}).strict();
export type BatchCreateInput = z.input<typeof BatchCreateSchema>;

export const BatchActionSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('pause') }).strict(),
    z.object({ action: z.literal('resume') }).strict(),
    z.object({ action: z.literal('cancel') }).strict(),
    z.object({ action: z.literal('advance') }).strict(),
    /** Retry these recipients (or every retryable one when omitted). */
    z.object({ action: z.literal('retry'), recipientIds: z.array(z.string().regex(/^[a-f0-9]{32}$/)).max(BATCH_MAX_RECIPIENTS).optional() }).strict(),
]);
export type BatchActionInput = z.infer<typeof BatchActionSchema>;

// ── Classes ─────────────────────────────────────────────────────────────────

export interface BatchClass {
    grade: number;
    section: string;
    key: string;
    label: string;
    students: number;
}

function primaryGuardianId(s: SamparkStudent): string | null {
    return s.primaryGuardianIds?.find((g) => s.guardianIds.includes(g)) ?? s.guardianIds[0] ?? null;
}

/** Classes (grade + section of active students) this person may run a class-wide batch for. */
export async function listBatchClasses(deps: BatchDeps, orgId: string, uid: string): Promise<BatchClass[]> {
    await getSchoolOrThrow({ repo: deps.repo, clock: deps.clock }, orgId);
    const students = (await deps.repo.listStudents(orgId)).filter((s) => s.active);
    const byKey = new Map<string, BatchClass>();
    for (const s of students) {
        const key = classKey(s.grade, s.section);
        const c = byKey.get(key) ?? { grade: s.grade, section: s.section, key, label: classLabel(s.grade, s.section), students: 0 };
        c.students += 1;
        byKey.set(key, c);
    }
    const out: BatchClass[] = [];
    for (const c of [...byKey.values()].sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section))) {
        if (await deps.canManageClass(orgId, uid, c.grade, c.section)) out.push(c);
    }
    return out;
}

async function requireClass(deps: BatchDeps, orgId: string, uid: string, grade: number, section: string): Promise<void> {
    if (!(await deps.canManageClass(orgId, uid, grade, section))) {
        throw forbidden('CLASS_NOT_AUTHORISED', 'You can only call the parents of classes you manage');
    }
}

// ── Preview ─────────────────────────────────────────────────────────────────

/** Refusals that are the same for every family: the batch as a whole cannot run. */
const CAMPAIGN_REFUSALS = new Set<RiyaRefusal['code']>(['PURPOSE_NOT_ENABLED', 'FACTS_REQUIRED', 'CAMPAIGN_FACTS_UNAVAILABLE', 'PROVIDER_UNAVAILABLE']);
/** Refusals that only delay the batch (it waits and dials when they clear). */
const WAITING_REFUSALS = new Set<RiyaRefusal['code']>(['OUTSIDE_CALLING_HOURS', 'SCHOOL_PAUSED']);
const PER_FAMILY_FACT_VARIABLES = new Set(['student_name', 'class_name', 'section_name']);

function isCampaignRefusal(r: RiyaRefusal): boolean {
    if (CAMPAIGN_REFUSALS.has(r.code)) return true;
    // Wrong or past facts (a date not on the calendar …) are the batch's; a missing spoken name is the family's.
    return r.code === 'FACTS_INVALID' && r.problems.some((p) => !(p.code === 'MISSING_VALUE' && PER_FAMILY_FACT_VARIABLES.has(p.variable)));
}

export function exclusionFor(r: RiyaRefusal): { reason: BatchExclusionReason; detail: string } {
    switch (r.code) {
        case 'NOT_GUARDIAN_OF_RECORD':
        case 'STUDENT_INACTIVE':
            return { reason: 'inactive', detail: r.code };
        case 'RECORDING_CONSENT_REQUIRED':
            return { reason: 'no_consent', detail: r.code };
        case 'LANGUAGE_NOT_SUPPORTED':
            return { reason: 'language', detail: r.code };
        case 'NUMBER_NOT_ALLOWED':
            return { reason: 'not_allow_listed', detail: r.code };
        case 'FACTS_INVALID':
            return { reason: 'not_permitted', detail: 'missing_spoken_name' };
        case 'GATE_BLOCKED':
            switch (r.reason) {
                case 'suppressed':
                case 'crm_do_not_contact':
                case 'consent_denied':
                    return { reason: 'opted_out', detail: r.reason };
                case 'no_consent':
                    return { reason: 'no_consent', detail: r.reason };
                case 'invalid_number':
                case 'synthetic_number_not_allowed':
                    return { reason: 'missing_phone', detail: r.reason };
                case 'custody_restricted':
                case 'sensitive_flag':
                    return { reason: 'sensitive', detail: r.reason };
                case 'frequency_cap':
                    return { reason: 'frequency_cap', detail: r.reason };
                case 'language_unknown':
                    return { reason: 'language', detail: r.reason };
                case 'student_inactive':
                case 'not_guardian_of_record':
                    return { reason: 'inactive', detail: r.reason };
                default:
                    return { reason: 'not_permitted', detail: r.reason };
            }
        default:
            return { reason: 'not_permitted', detail: r.code };
    }
}

export type BatchBlocker =
    | 'RIYA_DISABLED'
    | 'NOT_BATCHABLE'
    | 'REASON_NOT_AVAILABLE'
    | 'PURPOSE_MISMATCH'
    | 'BATCH_PROVIDER_NOT_SUPPORTED'
    | 'BATCH_NEEDS_OWN_NUMBERS'
    | 'REAL_BATCH_DISABLED'
    | 'NO_ELIGIBLE_RECIPIENTS'
    | 'TOO_MANY_RECIPIENTS'
    | 'CAMPAIGN_REFUSED';

export interface BatchPreviewRecipient {
    guardianId: string | null;
    studentId: string;
    studentDisplayName: string;
    guardianDisplayName: string | null;
    phoneLast4: string | null;
    eligible: boolean;
    exclusion: { reason: BatchExclusionReason; detail: string | null } | null;
    announcement: string | null;
    /** Real calls (roster): the contact's number is on this deployment's allow-list. */
    realCallAllowed: boolean;
}

export interface BatchPreview {
    ok: boolean;
    blockers: { code: BatchBlocker; message: string }[];
    /** Campaign-level Riya refusals (facts, provider …), when any. */
    refusals: RiyaRefusal[];
    /** Why calls would wait (calling hours, pause), when every check passes otherwise. */
    waiting: { code: string; nextAllowedAt: string | null } | null;
    classLabel: string;
    reason: BatchReasonId;
    purpose: RiyaPreview['purpose'];
    provider: ConversationProviderKind | null;
    realCalls: boolean;
    rosterMode: boolean;
    language: 'English';
    opening: string | null;
    sampleAnnouncement: string | null;
    totals: {
        students: number;
        eligible: number;
        missingPhone: number;
        optedOut: number;
        otherExcluded: number;
        teacherExcluded: number;
    };
    recipients: BatchPreviewRecipient[];
    concurrency: number;
    dialGapSeconds: number;
    /** Where that concurrency comes from: the app ceiling, the provider account, or the AI backend. */
    capacity: BatchCapacity;
}

interface Evaluated {
    preview: BatchPreview;
    eligible: { guardian: SamparkGuardian; student: SamparkStudent; announcement: string }[];
    excluded: BatchExclusion[];
}

const BLOCKER_TEXT: Record<BatchBlocker, string> = {
    RIYA_DISABLED: 'Riya calling is not enabled for this deployment',
    NOT_BATCHABLE: 'This workflow talks about one child; it stays an individual call',
    REASON_NOT_AVAILABLE: 'Riya has no approved wording for this reason yet',
    PURPOSE_MISMATCH: 'The details do not match the chosen reason',
    BATCH_PROVIDER_NOT_SUPPORTED: 'Class-wide calls run on Vobiz. ElevenLabs is selected, so no real batch is placed (and calls are never moved to Vobiz silently)',
    BATCH_NEEDS_OWN_NUMBERS: 'Real class-wide calls need each family’s own permitted number; this school’s Test mode rings one test phone',
    REAL_BATCH_DISABLED: 'Real class-wide calls are switched off on this deployment (SAMPARK_BATCH_REAL_CALLS)',
    NO_ELIGIBLE_RECIPIENTS: 'No family in this class can be called for this announcement',
    TOO_MANY_RECIPIENTS: `A batch can call at most ${BATCH_MAX_RECIPIENTS} families`,
    CAMPAIGN_REFUSED: 'The calling rules refuse this announcement',
};

async function evaluateBatch(deps: BatchDeps, orgId: string, input: z.infer<typeof BatchPreviewSchema>): Promise<Evaluated> {
    const env = deps.env ?? process.env;
    const school = await getSchoolOrThrow({ repo: deps.repo, clock: deps.clock }, orgId);
    const reason = batchReason(input.reason);
    const blockers: BatchPreview['blockers'] = [];
    const block = (code: BatchBlocker) => { if (!blockers.some((b) => b.code === code)) blockers.push({ code, message: BLOCKER_TEXT[code] }); };
    if (!riyaEnabled(env)) block('RIYA_DISABLED');
    const purpose = input.facts.purpose;
    // Child-specific workflows first: they are never a class announcement, whatever reason was picked.
    if (!isBatchablePurpose(purpose)) block('NOT_BATCHABLE');
    if (!reason.purpose) block('REASON_NOT_AVAILABLE');
    else if (reason.purpose !== purpose) block('PURPOSE_MISMATCH');

    const [students, guardians] = await Promise.all([deps.repo.listStudents(orgId), deps.repo.listGuardians(orgId)]);
    const inClass = students.filter((s) => s.grade === input.grade && s.section === input.section && s.active)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    const gById = new Map(guardians.map((g) => [g.id, g]));
    const teacherOut = new Set(input.excluded.map((e) => `${e.guardianId}|${e.studentId}`));

    const recipients: BatchPreviewRecipient[] = [];
    const eligible: Evaluated['eligible'] = [];
    const excluded: BatchExclusion[] = [];
    const seenGuardians = new Set<string>();
    let campaignRefusals: RiyaRefusal[] = [];
    let waiting: BatchPreview['waiting'] = null;
    let provider: ConversationProviderKind | null = null;
    let opening: string | null = null;
    const exclude = (row: Omit<BatchPreviewRecipient, 'eligible' | 'exclusion' | 'announcement'> & { announcement?: string | null }, reasonCode: BatchExclusionReason, detail: string | null) => {
        recipients.push({ ...row, announcement: row.announcement ?? null, eligible: false, exclusion: { reason: reasonCode, detail } });
        excluded.push({ guardianId: row.guardianId, studentId: row.studentId, studentDisplayName: row.studentDisplayName, guardianDisplayName: row.guardianDisplayName, reason: reasonCode, detail });
    };

    const rosterMode = sargvisionRosterMode(env, school);
    for (const student of inClass) {
        const gid = primaryGuardianId(student);
        const guardian = gid ? gById.get(gid) ?? null : null;
        const base = { guardianId: guardian?.id ?? null, studentId: student.id, studentDisplayName: student.displayName, guardianDisplayName: guardian?.displayName ?? null, phoneLast4: guardian?.phoneLast4 ?? null, realCallAllowed: false };
        if (!guardian || !guardian.active || !guardian.phoneEnc || !guardian.phoneHash || guardian.phoneClass === 'invalid') {
            exclude(base, 'missing_phone', guardian ? 'no_valid_number' : 'no_guardian');
            continue;
        }
        if (seenGuardians.has(guardian.id)) {
            // One call per family: a parent with two children in this class gets one call.
            exclude(base, 'same_family', null);
            continue;
        }
        if (blockers.some((b) => b.code === 'NOT_BATCHABLE' || b.code === 'REASON_NOT_AVAILABLE' || b.code === 'PURPOSE_MISMATCH')) {
            recipients.push({ ...base, eligible: false, exclusion: null, announcement: null });
            continue;
        }
        const p = await previewRiyaCall(deps, orgId, { purpose, guardianId: guardian.id, studentId: student.id, facts: input.facts as RiyaFacts });
        provider = provider ?? p.provider;
        opening = opening ?? p.opening;
        const realAllowed = isRealProvider(p.provider) && Boolean(p.destinationE164);
        const row = { ...base, realCallAllowed: realAllowed, announcement: p.announcement };
        const campaignLevel = p.refusals.filter(isCampaignRefusal);
        if (campaignLevel.length) {
            if (campaignRefusals.length === 0) campaignRefusals = campaignLevel;
            recipients.push({ ...row, eligible: false, exclusion: null });
            continue;
        }
        const waits = p.refusals.filter((r) => WAITING_REFUSALS.has(r.code));
        if (waits.length && !waiting) {
            const w = waits[0];
            waiting = { code: w.code, nextAllowedAt: w.code === 'OUTSIDE_CALLING_HOURS' ? w.nextAllowedAt : null };
        }
        const familyRefusals = p.refusals.filter((r) => !WAITING_REFUSALS.has(r.code));
        if (familyRefusals.length) {
            const ex = exclusionFor(familyRefusals[0]);
            exclude(row, ex.reason, ex.detail);
            continue;
        }
        if (!p.announcement) {
            exclude(row, 'not_permitted', 'no_announcement');
            continue;
        }
        if (teacherOut.has(`${guardian.id}|${student.id}`)) {
            exclude(row, 'teacher_excluded', null);
            continue;
        }
        seenGuardians.add(guardian.id);
        recipients.push({ ...row, eligible: true, exclusion: null });
        eligible.push({ guardian, student, announcement: p.announcement });
    }

    if (campaignRefusals.length) block('CAMPAIGN_REFUSED');
    if (provider === 'elevenlabs') block('BATCH_PROVIDER_NOT_SUPPORTED');
    if (isRealProvider(provider) && !rosterMode) block('BATCH_NEEDS_OWN_NUMBERS');
    if (isRealProvider(provider) && !realBatchCallsEnabled(env)) block('REAL_BATCH_DISABLED');
    if (eligible.length > BATCH_MAX_RECIPIENTS) block('TOO_MANY_RECIPIENTS');
    if (blockers.length === 0 && eligible.length === 0) block('NO_ELIGIBLE_RECIPIENTS');

    const count = (r: BatchExclusionReason) => excluded.filter((e) => e.reason === r).length;
    const preview: BatchPreview = {
        ok: blockers.length === 0,
        blockers,
        refusals: campaignRefusals,
        waiting,
        classLabel: classLabel(input.grade, input.section),
        reason: input.reason,
        purpose,
        provider,
        realCalls: isRealProvider(provider),
        rosterMode,
        language: 'English',
        opening,
        sampleAnnouncement: eligible[0]?.announcement ?? recipients.find((r) => r.announcement)?.announcement ?? null,
        totals: {
            students: inClass.length,
            eligible: eligible.length,
            missingPhone: count('missing_phone'),
            optedOut: count('opted_out'),
            teacherExcluded: count('teacher_excluded'),
            otherExcluded: excluded.length - count('missing_phone') - count('opted_out') - count('teacher_excluded'),
        },
        recipients,
        concurrency: batchCapacity(env, provider ?? 'simulated').effective,
        dialGapSeconds: Math.round(batchDialGapMs(env, provider ?? 'simulated') / 1000),
        capacity: batchCapacity(env, provider ?? 'simulated'),
    };
    return { preview, eligible, excluded };
}

export async function previewBatch(deps: BatchDeps, orgId: string, uid: string, raw: BatchPreviewInput): Promise<BatchPreview> {
    const input = BatchPreviewSchema.parse(raw);
    await requireClass(deps, orgId, uid, input.grade, input.section);
    return (await evaluateBatch(deps, orgId, input)).preview;
}

// ── Create ──────────────────────────────────────────────────────────────────

function canonicalFacts(f: RiyaFacts): string {
    const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]))
        : v;
    return JSON.stringify(sort(f));
}

export function batchDedupeKey(orgId: string, grade: number, section: string, facts: RiyaFacts): string {
    return hashId(`batch|${orgId}|${classKey(grade, section)}|${canonicalFacts(facts)}`);
}

export function batchCampaignId(orgId: string, requestKey: string): string {
    return hashId(`batch-campaign|${orgId}|${requestKey}`);
}

export function batchRecipientId(campaignId: string, guardianId: string, studentId: string): string {
    return hashId(`batch-recipient|${campaignId}|${guardianId}|${studentId}`);
}

/**
 * The idempotency key of one launch: the same launch can never place a second call.
 *
 * `attempt` is the family's attempt number (capped by BATCH_MAX_ATTEMPTS). `launchFailures` counts
 * launches the provider refused before anything rang (rate limits): those are not attempts, but
 * they must still produce a NEW key, or the re-launch would just return the refused call.
 * `launchFailures === 0` keeps the original key exactly, so campaigns already running are unaffected.
 */
export function batchAttemptKey(campaignId: string, recipientId: string, attempt: number, launchFailures = 0): string {
    const suffix = launchFailures > 0 ? `|r${launchFailures}` : '';
    return runIdempotencyKey(crypto.createHash('sha256').update(`batch|${campaignId}|${recipientId}|${attempt}${suffix}`).digest('hex'));
}

export async function createBatch(deps: BatchDeps, orgId: string, uid: string, raw: BatchCreateInput): Promise<{ campaign: BatchCampaignView; duplicate: boolean }> {
    const input = BatchCreateSchema.parse(raw);
    await requireClass(deps, orgId, uid, input.grade, input.section);
    const id = batchCampaignId(orgId, input.requestKey);
    const existing = await deps.batches.get(orgId, id);
    if (existing) {
        if (existing.createdBy !== uid) throw conflict('IDEMPOTENCY_KEY_REUSED', 'This request key was already used');
        return { campaign: await viewOf(deps, existing), duplicate: true };
    }

    const { preview, eligible, excluded } = await evaluateBatch(deps, orgId, input);
    const now = deps.clock.now();
    const at = now.toISOString();
    if (!preview.ok) {
        await deps.repo.appendAudit(orgId, { at, actor: uid, action: 'batch_campaign.refused', target: `class/${classKey(input.grade, input.section)}`, detail: { reason: input.reason, blockers: preview.blockers.map((b) => b.code) } });
        const first = preview.blockers[0];
        throw conflict(first.code, first.message);
    }
    if (input.confirmedRecipientCount !== eligible.length) {
        throw conflict('RECIPIENTS_CHANGED', 'The list of families to call has changed since you reviewed it; review it again');
    }
    if (input.confirmedSampleAnnouncement.trim() !== preview.sampleAnnouncement) {
        throw conflict('ANNOUNCEMENT_CHANGED', 'What Riya would say has changed since the preview; review it again');
    }
    if (preview.realCalls && !input.confirmRealCalls) {
        throw conflict('REAL_CALL_CONFIRMATION_REQUIRED', 'Real phones will ring: confirm the batch explicitly');
    }
    if (input.scenario && preview.provider !== 'simulated') throw badRequest('SCENARIO_PRACTICE_ONLY', 'Scenarios can only be chosen in Practice mode');

    const facts = input.facts as RiyaFacts;
    const dedupeKey = batchDedupeKey(orgId, input.grade, input.section, facts);
    const twins = (await deps.batches.findByDedupeKey(orgId, dedupeKey)).filter((c) => c.status !== 'cancelled');
    if (twins.length) {
        throw conflict('DUPLICATE_CAMPAIGN', twins.some((c) => c.status === 'completed')
            ? 'This announcement was already sent to this class. Use Retry on that campaign for families who were not reached.'
            : 'A campaign with this announcement is already running for this class');
    }

    const provider = preview.provider as ConversationProviderKind;
    const campaign: BatchCampaign = {
        id,
        orgId,
        grade: input.grade,
        section: input.section,
        reason: input.reason,
        purpose: facts.purpose,
        facts,
        dedupeKey,
        provider,
        scenario: input.scenario ?? null,
        sampleAnnouncement: preview.sampleAnnouncement as string,
        opening: preview.opening,
        language: 'English',
        status: 'running',
        open: true,
        waitingReason: null,
        pauseReason: null,
        concurrency: batchCapacity(deps.env ?? process.env, provider).effective,
        concurrencySource: batchCapacity(deps.env ?? process.env, provider).source,
        minGapMs: batchDialGapMs(deps.env ?? process.env, provider),
        lastDialAt: null,
        nextLaunchAt: null,
        backoffUntil: null,
        backoffReason: null,
        recipients: eligible.map(({ guardian, student, announcement }) => ({
            id: batchRecipientId(id, guardian.id, student.id),
            guardianId: guardian.id,
            studentId: student.id,
            guardianDisplayName: guardian.displayName,
            studentDisplayName: student.displayName,
            phoneLast4: guardian.phoneLast4,
            announcement,
            status: 'pending',
            attempts: 0,
            callIds: [],
            currentCallId: null,
            claimUntil: null,
            launchFailures: 0,
            callbackRequested: false,
            stopRequested: false,
            lastError: null,
            updatedAt: at,
        })),
        excluded,
        createdBy: uid,
        createdAt: at,
        startedAt: at,
        updatedAt: at,
        pausedAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelledBy: null,
        leaseHolder: null,
        leaseUntil: null,
        version: 0,
    };
    if (!(await deps.batches.createIfAbsent(campaign))) {
        const again = await deps.batches.get(orgId, id);
        if (!again) throw conflict('BATCH_CREATE_RACE', 'Please try again');
        return { campaign: await viewOf(deps, again), duplicate: true };
    }
    await deps.repo.appendAudit(orgId, {
        at, actor: uid, action: 'batch_campaign.start', target: `batch_campaign/${id}`,
        detail: { class: classKey(input.grade, input.section), reason: input.reason, purpose: facts.purpose, provider, recipients: campaign.recipients.length, excluded: excluded.length, concurrency: campaign.concurrency },
    });
    logger.info('Batch campaign started', LOG, { orgId, campaignId: id, provider, recipients: campaign.recipients.length });
    // The first calls go out now; the queue (dispatch tick / open page) continues.
    const advanced = await advanceBatch(deps, orgId, id);
    return { campaign: await viewOf(deps, advanced ?? campaign), duplicate: false };
}

// ── Queue ───────────────────────────────────────────────────────────────────

/** The school-wide launch gate: held for one minimum interval by the launch that took it. */
export function batchLaunchGate(orgId: string): string {
    return `riya-batch-launch:${orgId}`;
}

function holderId(): string {
    return `batch:${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
}

async function updateRecipient(deps: BatchDeps, orgId: string, id: string, recipientId: string, fn: (r: BatchRecipient, c: BatchCampaign) => BatchRecipient | null): Promise<BatchCampaign | null> {
    return deps.batches.mutate(orgId, id, (c) => {
        const i = c.recipients.findIndex((r) => r.id === recipientId);
        if (i < 0) return null;
        const next = fn(c.recipients[i], c);
        if (!next) return null;
        const recipients = c.recipients.slice();
        recipients[i] = next;
        return { ...c, recipients, updatedAt: deps.clock.now().toISOString() };
    });
}

/**
 * Mirrors each recipient's current call onto the campaign (the call record is the truth). A real
 * call still ringing after RECONCILE_AFTER_MS is looked up read-only at the provider; one with no
 * result after BATCH_STALE_MS is shown as 'unknown' (a later result still lands on it).
 */
async function reconcileRecipients(deps: BatchDeps, campaign: BatchCampaign): Promise<BatchCampaign> {
    const now = deps.clock.now();
    const at = now.toISOString();
    let current = campaign;
    for (const r of campaign.recipients) {
        if (!r.currentCallId || r.status === 'cancelled' || r.status === 'skipped') continue;
        let call = await deps.calls.getCall(campaign.orgId, r.currentCallId);
        if (!call) {
            // Claimed but the call record was never written (a crash before startRiyaCall wrote it):
            // after the claim expires the attempt goes back to the queue with the SAME key.
            if (r.status === 'dialing' && r.claimUntil && Date.parse(r.claimUntil) < now.getTime()) {
                current = (await updateRecipient(deps, campaign.orgId, campaign.id, r.id, (x) => (x.status === 'dialing' && x.currentCallId === r.currentCallId
                    ? { ...x, status: 'pending', attempts: Math.max(0, x.attempts - 1), currentCallId: null, claimUntil: null, updatedAt: at } : null))) ?? current;
            }
            continue;
        }
        if (call.state === 'initiated' && isRealProvider(call.provider)) {
            const age = now.getTime() - Date.parse(call.createdAt);
            if (age > RECONCILE_AFTER_MS && now.getTime() - Date.parse(call.updatedAt) > RECONCILE_EVERY_MS) {
                try {
                    await reconcileRiyaCall(deps, campaign.orgId, call.id);
                } catch {
                    // Provider unreachable / no id: try again next pass; nothing is invented.
                }
                call = (await deps.calls.getCall(campaign.orgId, call.id)) ?? call;
            }
        }
        // Stuck calls. A local timer alone NEVER frees a line. Past the point where the provider
        // itself must have disconnected the call (ring timeout + Vobiz time_limit + margin:
        // RIYA_VOBIZ_HARD_END_MS), the provider is ASKED first:
        //   - it reports a final outcome → recorded through the normal reducer (slot freed there);
        //   - it reports the line ended but the bridge never sent its result → the call becomes
        //     'unknown' (nothing is connected; a person reviews it; never re-dialled);
        //   - it reports the call still connected → the line stays held and the overrun is audited;
        //   - it has no record, or cannot be reached → the provider-enforced time limit has passed,
        //     so the call cannot still be connected: it becomes 'unknown', and that is audited.
        // A result that arrives later still lands on the call (the reducer resolves 'unknown').
        let snapshot = call;
        const hardEndMs = isRealProvider(snapshot.provider) ? RIYA_VOBIZ_HARD_END_MS : BATCH_STALE_MS;
        const overdue = !isTerminalConversationState(snapshot.state) && now.getTime() - Date.parse(snapshot.createdAt) > hardEndMs;
        let recovery: string | null = null;
        let overrun = false;
        if (overdue && isRealProvider(snapshot.provider)) {
            let lookup: 'ok' | 'not_found' | 'unreachable' = 'ok';
            try {
                await reconcileRiyaCall(deps, campaign.orgId, snapshot.id);
            } catch (err) {
                lookup = err instanceof SamparkServiceError && (err.code === 'PROVIDER_NOT_FOUND' || err.code === 'NO_PROVIDER_ID') ? 'not_found' : 'unreachable';
            }
            snapshot = (await deps.calls.getCall(campaign.orgId, snapshot.id)) ?? snapshot;
            if (!isTerminalConversationState(snapshot.state)) {
                if (lookup === 'ok' && snapshot.providerStatus !== 'carrier_ended') {
                    // The provider says the call is still up: hold the line, however long it runs.
                    overrun = true;
                    if (r.lastError?.code !== 'CALL_OVERRUN') {
                        logger.warn('Batch call still connected past its time limit; line kept', LOG, { orgId: campaign.orgId, campaignId: campaign.id, callId: snapshot.id });
                        await deps.repo.appendAudit(campaign.orgId, { at, actor: 'system', action: 'batch_campaign.call_overrun', target: `riya_call/${snapshot.id}`, detail: { campaignId: campaign.id } });
                    }
                } else {
                    recovery = lookup === 'ok' ? 'carrier_ended_no_report' : lookup === 'not_found' ? 'provider_has_no_record' : 'provider_unreachable_past_time_limit';
                    await expireRiyaCallUnknown(deps, campaign.orgId, snapshot.id, recovery);
                    snapshot = (await deps.calls.getCall(campaign.orgId, snapshot.id)) ?? snapshot;
                }
            }
        } else if (overdue) {
            recovery = 'simulated_no_result';
            await expireRiyaCallUnknown(deps, campaign.orgId, snapshot.id, recovery);
            snapshot = (await deps.calls.getCall(campaign.orgId, snapshot.id)) ?? snapshot;
        }
        const before = snapshot;
        current = (await updateRecipient(deps, campaign.orgId, campaign.id, r.id, (x) => {
            const mirrored = applyCallToRecipient(x, before, at);
            if (mirrored && recovery && mirrored.status === 'unknown') {
                return { ...mirrored, lastError: { code: 'NO_RESULT', message: 'No result arrived from the calling service; check the call before calling again' } };
            }
            if (overrun && (mirrored ?? x).lastError?.code !== 'CALL_OVERRUN') {
                return { ...(mirrored ?? x), lastError: { code: 'CALL_OVERRUN', message: 'The calling service still shows this call connected; its line stays reserved until it ends' }, updatedAt: at };
            }
            return mirrored;
        })) ?? current;
        if (recovery) {
            logger.warn('Batch call recovered after the provider check', LOG, { orgId: campaign.orgId, campaignId: campaign.id, callId: before.id, recovery });
            await deps.repo.appendAudit(campaign.orgId, { at, actor: 'system', action: 'batch_campaign.call_stale', target: `riya_call/${before.id}`, detail: { campaignId: campaign.id, recovery, providerStatus: before.providerStatus ?? null } });
        }
    }
    return current;
}

/** Calls this school's batches placed in the last 24 hours (for the daily limit). */
async function batchCallsToday(deps: BatchDeps, orgId: string): Promise<number> {
    const since = new Date(deps.clock.now().getTime() - 24 * 3_600_000).toISOString();
    return (await deps.calls.listCalls(orgId, 500)).filter((c) => c.batch && c.createdAt >= since && c.provider !== 'simulated').length;
}

const RETRY_LATER = new Set(['RIYA_CALL_IN_PROGRESS', 'UNRESOLVED_PREVIOUS_CALL']);

/**
 * One pass of the queue for one campaign. Idempotent and safe to run concurrently (campaign lease).
 * Returns the campaign after the pass, or null when another worker holds the lease.
 */
const MAX_RERUNS = 3;

export async function advanceBatch(deps: BatchDeps, orgId: string, campaignId: string, holder: string = holderId(), depth = 0): Promise<BatchCampaign | null> {
    const env = deps.env ?? process.env;
    const leaseAt = deps.clock.now();
    let leaseTaken = false;
    const leased = await deps.batches.mutate(orgId, campaignId, (c) => {
        leaseTaken = false;
        if (c.leaseHolder && c.leaseHolder !== holder && c.leaseUntil && Date.parse(c.leaseUntil) > leaseAt.getTime()) {
            // Another worker is advancing it: leave it a note so it goes round once more before
            // letting go (this wake — a freed line — is never lost).
            return c.rerunRequested ? null : { ...c, rerunRequested: true };
        }
        leaseTaken = true;
        return { ...c, leaseHolder: holder, leaseUntil: new Date(leaseAt.getTime() + LEASE_MS).toISOString(), rerunRequested: false };
    });
    if (!leased || !leaseTaken || leased.leaseHolder !== holder) {
        // The other worker may have let go between its last look and our note: try once more.
        if (depth === 0 && leased && !leaseTaken) {
            const again = await deps.batches.get(orgId, campaignId);
            if (again && !(again.leaseHolder && again.leaseHolder !== holder && again.leaseUntil && Date.parse(again.leaseUntil) > deps.clock.now().getTime())) {
                return advanceBatch(deps, orgId, campaignId, holder, depth + 1);
            }
        }
        return null;
    }
    let campaign: BatchCampaign = leased;
    let rerunNow = false;
    // A call that settles inside this pass must not re-enter it (it would only block on the lease);
    // its wake is remembered instead (takeRerun) and this pass goes round again.
    markAdvancing(orgId, campaignId, true);
    try {
        campaign = await reconcileRecipients(deps, campaign);
        if (campaign.status === 'running') campaign = await dialPass(deps, campaign, env);
        // Finish / close.
        const at = deps.clock.now().toISOString();
        campaign = (await deps.batches.mutate(orgId, campaignId, (c) => {
            const completed = c.status === 'running' && isFinished(c);
            const status = completed ? 'completed' : c.status;
            const open = isOpen({ status, recipients: c.recipients });
            if (status === c.status && open === c.open) return null;
            return { ...c, status, open, completedAt: completed ? at : c.completedAt, waitingReason: completed ? null : c.waitingReason, updatedAt: at };
        })) ?? campaign;
        if (campaign.status === 'completed' && campaign.completedAt === at) {
            await deps.repo.appendAudit(orgId, { at, actor: 'system', action: 'batch_campaign.completed', target: `batch_campaign/${campaignId}`, detail: { ...progressOf(campaign) } });
        }
    } finally {
        const local = takeRerun(orgId, campaignId);
        campaign = (await deps.batches.mutate(orgId, campaignId, (c) => {
            if (c.leaseHolder !== holder) return null;
            rerunNow = Boolean(c.rerunRequested) || local;
            return { ...c, leaseHolder: null, leaseUntil: null, rerunRequested: false };
        })) ?? campaign;
        markAdvancing(orgId, campaignId, false);
    }
    // A line was freed (or another wake came in) while this pass ran: fill it now, not at the next tick.
    if (rerunNow && campaign.status === 'running' && depth < MAX_RERUNS) {
        return (await advanceBatch(deps, orgId, campaignId, holder, depth + 1)) ?? campaign;
    }
    armNextWake(deps, campaign);
    return campaign;
}

/**
 * When the pass ended waiting for the launch interval or a rate-limit backoff, ask for a wake at
 * exactly that moment (production: an in-process timer; the tick is the fallback). A campaign that
 * waits for a line to free needs no timer: the call's end wakes it.
 */
function armNextWake(deps: BatchDeps, c: BatchCampaign): void {
    if (!deps.scheduleWake || c.status !== 'running' || !c.recipients.some((r) => r.status === 'pending')) return;
    const now = deps.clock.now().getTime();
    const candidates = [c.nextLaunchAt, c.backoffUntil].filter((x): x is string => Boolean(x)).map((x) => Date.parse(x)).filter((t) => t > now);
    if (!candidates.length) return;
    deps.scheduleWake(c.orgId, c.id, new Date(Math.max(...candidates)));
}

/**
 * A call that belongs to a batch has just reached a terminal state (a provider webhook, or a
 * reconciliation that confirmed it ended): its slot is free, so advance that campaign now.
 * Registered on load, called from the ONE place calls settle (server/sampark/conversation.ts).
 */
registerBatchWaker(async (deps, orgId, campaignId) => {
    const base = deps as RiyaDeps & Partial<BatchDeps>;
    const full: BatchDeps = base.batches && base.canManageClass && base.isOrgAdmin
        ? (base as BatchDeps)
        : { ...base, batches: await getBatchRepo(), canManageClass, isOrgAdmin: requireOrgAdmin, scheduleWake: undefined };
    // A webhook's deps carry no timer: give this wake one (a copy — the caller's deps are not
    // changed), so a pass that ends waiting for the interval still fires on time.
    const withTimer: BatchDeps = full.scheduleWake ? full : { ...full };
    if (!withTimer.scheduleWake) withTimer.scheduleWake = (o, c, at) => armTimer(withTimer, o, c, at, withTimer.clock.now().getTime());
    await advanceBatch(withTimer, orgId, campaignId);
});

async function setWaiting(deps: BatchDeps, c: BatchCampaign, reason: string | null): Promise<BatchCampaign> {
    if (c.waitingReason === reason) return c;
    return (await deps.batches.mutate(c.orgId, c.id, (x) => (x.waitingReason === reason ? null : { ...x, waitingReason: reason, updatedAt: deps.clock.now().toISOString() }))) ?? c;
}

async function pauseFor(deps: BatchDeps, c: BatchCampaign, reason: string): Promise<BatchCampaign> {
    const at = deps.clock.now().toISOString();
    const next = (await deps.batches.mutate(c.orgId, c.id, (x) => (x.status !== 'running' ? null : { ...x, status: 'paused', pauseReason: reason, pausedAt: at, updatedAt: at }))) ?? c;
    await deps.repo.appendAudit(c.orgId, { at, actor: 'system', action: 'batch_campaign.paused', target: `batch_campaign/${c.id}`, detail: { reason } });
    return next;
}

/** The launch interval and the capacity the campaign runs at, re-read from the records each pass. */
async function setSchedule(deps: BatchDeps, c: BatchCampaign, patch: Partial<BatchCampaign>): Promise<BatchCampaign> {
    const at = deps.clock.now().toISOString();
    return (await deps.batches.mutate(c.orgId, c.id, (x) => ({ ...x, ...patch, updatedAt: at }))) ?? { ...c, ...patch };
}

/**
 * A launch the provider accepted: it starts the minimum interval for the WHOLE school, and it
 * clears any rate-limit backoff. `acceptedAt` is the call record's own timestamp, so a restart
 * recomputes the same interval from the records.
 */
async function recordLaunch(deps: BatchDeps, c: BatchCampaign, acceptedAt: string, minIntervalMs: number): Promise<BatchCampaign> {
    return setSchedule(deps, c, {
        lastDialAt: acceptedAt,
        nextLaunchAt: nextLaunchAt(acceptedAt, minIntervalMs, deps.clock.now()),
        waitingReason: null,
        backoffUntil: null,
        backoffReason: null,
    });
}

/**
 * The provider refused the launch because we are going too fast. Nothing rang, so the family keeps
 * its place in the queue AND its retry allowance: only `launchFailures` goes up, which gives the
 * next launch a fresh idempotency key. The campaign backs off (60 s, doubling) before submitting
 * anything again, so a rate limit is never answered with a tight re-submit loop.
 */
async function backOffAfterRateLimit(deps: BatchDeps, c: BatchCampaign, recipientId: string, callId: string): Promise<BatchCampaign> {
    const now = deps.clock.now();
    const at = now.toISOString();
    let failures = 1;
    let out = (await updateRecipient(deps, c.orgId, c.id, recipientId, (r) => {
        if (r.currentCallId !== callId) return null;
        failures = (r.launchFailures ?? 0) + 1;
        const exhausted = failures >= BATCH_MAX_LAUNCH_FAILURES;
        return {
            ...r,
            status: exhausted ? 'failed' : 'pending',
            // The refused launch was not an attempt: the family may still be called three times.
            attempts: exhausted ? r.attempts : Math.max(0, r.attempts - 1),
            currentCallId: null,
            claimUntil: null,
            launchFailures: failures,
            lastError: exhausted
                ? { code: 'PROVIDER_RATE_LIMITED', message: 'The calling service kept refusing new calls' }
                : { code: 'PROVIDER_RATE_LIMITED', message: 'The calling service is busy; this family is still queued' },
            updatedAt: at,
        };
    })) ?? c;
    // The school-wide backoff from the records (every campaign and worker computes the same one);
    // the family's own count is only the floor if the records were not readable.
    const schoolWide = rateLimitBackoffUntil(await deps.calls.listCalls(c.orgId, 300));
    const refused = await deps.calls.getCall(c.orgId, callId);
    const floor = now.getTime() + Math.max(backoffMs(failures), (retryAfterSeconds(refused?.failureReason) ?? 0) * 1000);
    const until = new Date(Math.max(floor, schoolWide ? Date.parse(schoolWide.until) : 0)).toISOString();
    out = await setSchedule(deps, out, { backoffUntil: until, backoffReason: 'PROVIDER_RATE_LIMITED', waitingReason: 'PROVIDER_RATE_LIMITED', nextLaunchAt: until });
    await deps.repo.appendAudit(c.orgId, { at, actor: 'system', action: 'batch_campaign.rate_limited', target: `batch_campaign/${c.id}`, detail: { until, failures, refusals: schoolWide?.refusals ?? failures } });
    logger.warn('Batch backing off: the provider rate-limited a launch', LOG, { orgId: c.orgId, campaignId: c.id, until });
    return out;
}

/**
 * ONE pass of the rolling scheduler for one campaign. Idempotent and safe to run concurrently
 * (campaign lease + per-recipient atomic claim + the per-school lock slots startRiyaCall takes).
 *
 * The two rules, both recomputed from the CALL RECORDS on every pass so a restart changes nothing:
 *
 *   1. At most `capacity.effective` Riya calls may be in flight for this school at once - counting
 *      every campaign AND individual calls, because they share the same lock slots and the same
 *      provider lines. A slot comes back when the provider says the call ended (webhook), not when
 *      a timer says so.
 *   2. At least `minIntervalMs` must have passed since the last launch THE PROVIDER ACCEPTED, for
 *      this school. A refused launch never rang, so it does not start the interval.
 *
 * Nothing waits longer than those two rules require: as soon as both allow it, the pass launches,
 * and a call settling (webhook) or the next tick re-enters this pass immediately.
 */
async function dialPass(deps: BatchDeps, start: BatchCampaign, env: Env): Promise<BatchCampaign> {
    let c = start;
    const orgId = c.orgId;
    // The person who started it must still manage the class.
    if (!(await deps.canManageClass(orgId, c.createdBy, c.grade, c.section))) return pauseFor(deps, c, 'CREATOR_NOT_AUTHORISED');
    const real = isRealProvider(c.provider);
    if (real && !realBatchCallsEnabled(env)) return setWaiting(deps, c, 'REAL_BATCH_DISABLED');
    if (real && (await batchCallsToday(deps, orgId)) >= batchDailyLimit(env)) return setWaiting(deps, c, 'DAILY_LIMIT_REACHED');

    // Limits are re-read every pass, so lowering them server-side applies to a running campaign.
    const capacity = batchCapacity(env, c.provider);
    const minIntervalMs = batchMinIntervalMs(env, c.provider);
    if (c.concurrency !== capacity.effective || c.minGapMs !== minIntervalMs || (c.concurrencySource ?? 'app') !== capacity.source) {
        c = await setSchedule(deps, c, { concurrency: capacity.effective, concurrencySource: capacity.source, minGapMs: minIntervalMs });
    }

    const maxLaunchesPerPass = real ? capacity.effective : SIMULATED_DIALS_PER_PASS;
    let launched = 0;
    const tried = new Set<string>();
    // A real call already ringing to a family (any campaign, or an individual call) defers that family.
    let recent = await deps.calls.listCalls(orgId, 300);
    while (launched < maxLaunchesPerPass) {
        const now = deps.clock.now();
        const next = c.recipients.find((r) => r.status === 'pending' && !tried.has(r.id));
        if (!next) break; // nothing queued: no reason to report waiting

        // 1. Capacity. The call records are the source of truth for "active", never a counter: a
        //    line is held until the provider says the call ended (see holdsLine).
        const active = real
            ? countActiveCalls(recent, now, RIYA_VOBIZ_HARD_END_MS)
            : c.recipients.filter((r) => BATCH_ACTIVE_STATUSES.includes(r.status)).length;
        if (active >= capacity.effective) {
            c = await setWaiting(deps, c, 'CONCURRENCY_FULL');
            break;
        }
        // 2. Rate-limit backoff, school-wide, from the records: nothing is re-submitted while the
        //    provider is refusing new calls (60 s doubling, or its Retry-After if longer).
        const backoff = real ? rateLimitBackoffUntil(recent) : null;
        if (backoff && Date.parse(backoff.until) > now.getTime()) {
            c = await setSchedule(deps, c, { backoffUntil: backoff.until, backoffReason: 'PROVIDER_RATE_LIMITED', waitingReason: 'PROVIDER_RATE_LIMITED', nextLaunchAt: backoff.until });
            break;
        }
        // 3. Minimum interval since the last launch this school had ACCEPTED, across campaigns.
        const lastAccepted = real ? lastAcceptedLaunchAt(recent) : null;
        const due = nextLaunchAt(lastAccepted, minIntervalMs, now);
        if (due) {
            c = await setSchedule(deps, c, { nextLaunchAt: due, waitingReason: 'WAITING_FOR_INTERVAL' });
            break;
        }
        tried.add(next.id);

        const busyFamily = recent.find((x) => x.guardianId === next.guardianId && !isTerminalConversationState(x.state) && x.id !== next.currentCallId);
        if (busyFamily) continue; // another call to this family is in flight: try them on a later pass

        // Fresh checks at launch time (consent, opt-out, stop requests from earlier calls, hours, pause, allow-list).
        const runDeps: RiyaDeps = isRealProvider(c.provider) ? { ...deps, providerChoice: c.provider } : deps;
        const p = await previewRiyaCall(runDeps, orgId, { purpose: c.purpose, guardianId: next.guardianId, studentId: next.studentId, facts: c.facts });
        if (p.provider !== c.provider) return pauseFor(deps, c, 'PROVIDER_CHANGED');
        const waits = p.refusals.find((r) => WAITING_REFUSALS.has(r.code));
        if (waits) return setWaiting(deps, c, waits.code);
        const at = now.toISOString();
        if (p.refusals.length || !p.announcement || !p.variables) {
            const first = p.refusals[0];
            const ex = first ? exclusionFor(first) : { reason: 'not_permitted' as const, detail: 'no_announcement' };
            c = (await updateRecipient(deps, orgId, c.id, next.id, (r) => (r.status !== 'pending' ? null : { ...r, status: 'failed', lastError: { code: first?.code ?? 'REFUSED', message: `${ex.reason}${ex.detail ? `: ${ex.detail}` : ''}` }, updatedAt: at }))) ?? c;
            continue;
        }
        if (p.announcement !== next.announcement) {
            c = (await updateRecipient(deps, orgId, c.id, next.id, (r) => (r.status !== 'pending' ? null : { ...r, status: 'failed', lastError: { code: 'ANNOUNCEMENT_CHANGED', message: 'The school records changed since the batch was confirmed' }, updatedAt: at }))) ?? c;
            continue;
        }
        // Never twice about the same announcement: a family already reached (by any campaign or an
        // individual call) is skipped.
        const factsHash = factsHashOf(c.purpose, p.variables);
        const already = recent.find((x) => x.guardianId === next.guardianId && x.studentId === next.studentId && x.factsHash === factsHash && x.state === 'completed' && !next.callIds.includes(x.id));
        if (already) {
            c = (await updateRecipient(deps, orgId, c.id, next.id, (r) => (r.status !== 'pending' ? null : { ...r, status: 'skipped', lastError: { code: 'ALREADY_CALLED', message: 'This family was already called about this announcement' }, updatedAt: at }))) ?? c;
            continue;
        }

        // Claim (transaction): pending -> dialing, with this launch's key and call id fixed up front.
        // Two workers that reach the same family race here; exactly one wins, and the loser's
        // mutate returns null. The key is derived, so even a replayed claim dials the same call once.
        const attempt = next.attempts + 1;
        const key = batchAttemptKey(c.id, next.id, attempt, next.launchFailures ?? 0);
        const callId = riyaCallId(orgId, key);

        // The launch gate (atomic, school-wide, shared by every worker and campaign): a lock that
        // lives exactly one minimum interval. The records above say "due"; the gate makes sure only
        // ONE worker acts on that. A refused launch gives the gate back (it never rang).
        const gated = real && minIntervalMs > 0;
        if (gated && !(await deps.repo.acquireLock(batchLaunchGate(orgId), callId, now, minIntervalMs))) {
            c = await setWaiting(deps, c, 'WAITING_FOR_INTERVAL');
            break;
        }
        const releaseGate = async () => { if (gated) await deps.repo.releaseLock(batchLaunchGate(orgId), callId); };

        let claimed = false;
        c = (await updateRecipient(deps, orgId, c.id, next.id, (r, camp) => {
            claimed = false;
            if (r.status !== 'pending' || camp.status !== 'running') return null;
            claimed = true;
            return { ...r, status: 'dialing', attempts: attempt, currentCallId: callId, callIds: r.callIds.includes(callId) ? r.callIds : [...r.callIds, callId], claimUntil: new Date(now.getTime() + CLAIM_MS).toISOString(), lastError: null, updatedAt: at };
        })) ?? c;
        if (!claimed) {
            await releaseGate();
            continue;
        }

        try {
            const result = await startRiyaCall(runDeps, orgId, c.createdBy, {
                purpose: c.purpose,
                guardianId: next.guardianId,
                studentId: next.studentId,
                facts: c.facts,
                idempotencyKey: key,
                confirmedAnnouncement: next.announcement,
                ...(c.provider === 'simulated' && c.scenario ? { scenario: c.scenario } : {}),
            }, { lockSlots: capacity.effective, batch: { campaignId: c.id, recipientId: next.id } });
            const call = await deps.calls.getCall(orgId, result.call.id);
            if (call && isRateLimitRefusal(call.failureReason)) {
                // Nothing rang and nothing was queued at the provider: back off, keep the family.
                await releaseGate();
                c = await backOffAfterRateLimit(deps, c, next.id, callId);
                break;
            }
            if (call) {
                c = (await updateRecipient(deps, orgId, c.id, next.id, (r) => applyCallToRecipient(r, call, deps.clock.now().toISOString()))) ?? c;
                if (isAcceptedLaunch(call)) {
                    // Only an ACCEPTED launch starts the interval and uses one of the pass's launches.
                    if (real) c = await recordLaunch(deps, c, call.createdAt, minIntervalMs);
                    launched += 1;
                } else {
                    // Refused before ringing: no slot used, no interval started, the next family may
                    // go out at once. The family's own outcome is on its call record.
                    await releaseGate();
                    c = await setSchedule(deps, c, { waitingReason: null });
                }
            } else {
                await releaseGate();
            }
        } catch (err) {
            const code = err instanceof SamparkServiceError ? err.code : 'CALL_START_ERROR';
            const message = err instanceof SamparkServiceError ? err.message : 'The call could not be started';
            const written = await deps.calls.getCall(orgId, callId);
            if (written && isAcceptedLaunch(written) && real) {
                // The record exists and may have rung: it keeps the gate and starts the interval.
                c = (await updateRecipient(deps, orgId, c.id, next.id, (r) => applyCallToRecipient(r, written, deps.clock.now().toISOString()))) ?? c;
                c = await recordLaunch(deps, c, written.createdAt, minIntervalMs);
                launched += 1;
            } else {
                await releaseGate();
            }
            if (written) {
                // The record exists: its own state is the outcome (never a second call).
                c = (await updateRecipient(deps, orgId, c.id, next.id, (r) => applyCallToRecipient(r, written, deps.clock.now().toISOString()))) ?? c;
            } else if (RETRY_LATER.has(code) || WAITING_REFUSALS.has(code as RiyaRefusal['code'])) {
                // Nothing was dialled: back in the queue, the attempt not spent.
                c = (await updateRecipient(deps, orgId, c.id, next.id, (r) => (r.currentCallId !== callId ? null : {
                    ...r, status: 'pending', attempts: r.attempts - 1, currentCallId: null, callIds: r.callIds.filter((x) => x !== callId), claimUntil: null, updatedAt: deps.clock.now().toISOString(),
                }))) ?? c;
                if (WAITING_REFUSALS.has(code as RiyaRefusal['code'])) return setWaiting(deps, c, code);
                if (code === 'RIYA_CALL_IN_PROGRESS') {
                    // Every per-school lock slot is taken (an individual call, or another campaign):
                    // the global limit held. Try again when a slot frees.
                    c = await setWaiting(deps, c, 'CONCURRENCY_FULL');
                    break;
                }
            } else {
                c = (await updateRecipient(deps, orgId, c.id, next.id, (r) => (r.currentCallId !== callId ? null : {
                    ...r, status: 'failed', currentCallId: null, callIds: r.callIds.filter((x) => x !== callId), claimUntil: null, lastError: { code, message: message.slice(0, 200) }, updatedAt: deps.clock.now().toISOString(),
                }))) ?? c;
            }
            logger.warn('Batch call not started', LOG, { orgId, campaignId: c.id, code });
        }
        // Capacity and the last accepted launch both come from the records: re-read them.
        recent = await deps.calls.listCalls(orgId, 300);
    }
    // Nothing is queued any more: never leave a stale "waiting" on the campaign.
    if (!c.recipients.some((r) => r.status === 'pending') && c.waitingReason) c = await setWaiting(deps, c, null);
    return c;
}

// ── Scheduler entry ─────────────────────────────────────────────────────────

export interface BatchTickReport {
    skipped: boolean;
    reason?: string;
    schools: number;
    campaigns: number;
    errors: string[];
}

/** One tick across every school (from /api/jobs/sampark-dispatch). Safe to run concurrently. */
export async function runBatchTick(deps: BatchDeps): Promise<BatchTickReport> {
    const env = deps.env ?? process.env;
    const report: BatchTickReport = { skipped: false, schools: 0, campaigns: 0, errors: [] };
    if (env.SAMPARK_ENABLED !== 'true' || !riyaEnabled(env)) return { ...report, skipped: true, reason: 'riya_disabled' };
    const holder = holderId();
    if (!(await deps.repo.acquireLock(BATCH_TICK_LOCK, holder, deps.clock.now(), BATCH_TICK_LOCK_TTL_MS))) return { ...report, skipped: true, reason: 'another_worker' };
    try {
        for (const school of await deps.repo.listSchools()) {
            report.schools += 1;
            for (const c of await deps.batches.listOpen(school.orgId, 20)) {
                try {
                    if (await advanceBatch(deps, school.orgId, c.id, holder)) report.campaigns += 1;
                } catch (err) {
                    // One campaign failing never stops the others.
                    report.errors.push(`${school.orgId}/${c.id}: ${err instanceof Error ? err.message.slice(0, 120) : 'error'}`);
                }
            }
        }
    } finally {
        await deps.repo.releaseLock(BATCH_TICK_LOCK, holder);
    }
    if (report.campaigns || report.errors.length) logger.info('Batch tick', LOG, { ...report, errors: report.errors.length });
    return report;
}

// ── Reads and actions ───────────────────────────────────────────────────────

export type BatchCampaignView = Omit<BatchCampaign, 'leaseHolder' | 'leaseUntil' | 'dedupeKey'> & {
    classLabel: string;
    progress: BatchProgress;
    retryable: number;
};

async function viewOf(_deps: BatchDeps, c: BatchCampaign): Promise<BatchCampaignView> {
    const { leaseHolder: _l, leaseUntil: _u, dedupeKey: _d, ...rest } = c;
    return { ...rest, classLabel: classLabel(c.grade, c.section), progress: progressOf(c), retryable: c.recipients.filter(isRetryable).length };
}

async function loadAuthorised(deps: BatchDeps, orgId: string, uid: string, id: string): Promise<BatchCampaign> {
    const c = await deps.batches.get(orgId, id);
    if (!c) throw notFound('BATCH_NOT_FOUND', 'Campaign not found');
    await requireClass(deps, orgId, uid, c.grade, c.section);
    return c;
}

export async function listBatches(deps: BatchDeps, orgId: string, uid: string, limit = 30): Promise<BatchCampaignView[]> {
    await getSchoolOrThrow({ repo: deps.repo, clock: deps.clock }, orgId);
    const all = await deps.batches.list(orgId, Math.min(Math.max(limit, 1), 100));
    const out: BatchCampaignView[] = [];
    for (const c of all) if (await deps.canManageClass(orgId, uid, c.grade, c.section)) out.push(await viewOf(deps, c));
    return out;
}

export interface BatchDetail {
    campaign: BatchCampaignView;
    /** Every call this campaign placed (synopsis, answers, state — never a transcript). */
    calls: ConversationCallView[];
}

export async function getBatch(deps: BatchDeps, orgId: string, uid: string, id: string): Promise<BatchDetail> {
    let c = await loadAuthorised(deps, orgId, uid, id);
    // Reads mirror call outcomes (no dialling): the page is current even without the scheduler.
    c = await reconcileRecipients(deps, c);
    const ids = c.recipients.flatMap((r) => r.callIds);
    const calls = (await Promise.all(ids.map(async (callId) => {
        try {
            return (await getRiyaCall(deps, orgId, callId)).call;
        } catch {
            return null;
        }
    }))).filter((x): x is ConversationCallView => x !== null && x.batch?.campaignId === c.id);
    return { campaign: await viewOf(deps, c), calls };
}

export async function actOnBatch(deps: BatchDeps, orgId: string, uid: string, id: string, action: BatchActionInput): Promise<BatchDetail> {
    const c = await loadAuthorised(deps, orgId, uid, id);
    const at = deps.clock.now().toISOString();
    const audit = (name: string, detail: Record<string, unknown> = {}) => deps.repo.appendAudit(orgId, { at, actor: uid, action: `batch_campaign.${name}`, target: `batch_campaign/${id}`, detail });
    switch (action.action) {
        case 'pause': {
            if (c.status !== 'running') throw conflict('NOT_RUNNING', 'Only a running campaign can be paused');
            await deps.batches.mutate(orgId, id, (x) => (x.status !== 'running' ? null : { ...x, status: 'paused', pauseReason: 'PAUSED_BY_STAFF', pausedAt: at, updatedAt: at }));
            await audit('paused', { by: 'staff' });
            break;
        }
        case 'resume': {
            if (c.status !== 'paused') throw conflict('NOT_PAUSED', 'Only a paused campaign can be resumed');
            await deps.batches.mutate(orgId, id, (x) => (x.status !== 'paused' ? null : { ...x, status: 'running', open: true, pauseReason: null, pausedAt: null, updatedAt: at }));
            await audit('resumed');
            await advanceBatch(deps, orgId, id);
            break;
        }
        case 'cancel': {
            if (c.status === 'cancelled' || c.status === 'completed') throw conflict('NOT_ACTIVE', 'This campaign has already ended');
            await deps.batches.mutate(orgId, id, (x) => {
                if (x.status === 'cancelled' || x.status === 'completed') return null;
                // Pending families are not called; calls already ringing finish and are recorded.
                const recipients = x.recipients.map((r) => (r.status === 'pending' ? { ...r, status: 'cancelled' as const, updatedAt: at } : r));
                return { ...x, recipients, status: 'cancelled', open: isOpen({ status: 'cancelled', recipients }), cancelledAt: at, cancelledBy: uid, waitingReason: null, updatedAt: at };
            });
            await audit('cancelled');
            break;
        }
        case 'retry': {
            if (c.status === 'cancelled') throw conflict('CANCELLED', 'A cancelled campaign cannot be retried');
            const wanted = action.recipientIds ? new Set(action.recipientIds) : null;
            const chosen = c.recipients.filter((r) => isRetryable(r) && (!wanted || wanted.has(r.id)));
            if (!chosen.length) throw conflict('NOTHING_TO_RETRY', 'No family in this campaign can be retried');
            const ids = new Set(chosen.map((r) => r.id));
            await deps.batches.mutate(orgId, id, (x) => {
                if (x.status === 'cancelled') return null;
                const recipients = x.recipients.map((r) => (ids.has(r.id) && isRetryable(r) ? { ...r, status: 'pending' as const, currentCallId: null, claimUntil: null, updatedAt: at } : r));
                return { ...x, recipients, status: x.status === 'completed' ? 'running' : x.status, open: true, completedAt: null, updatedAt: at };
            });
            await audit('retry', { recipients: chosen.length });
            await advanceBatch(deps, orgId, id);
            break;
        }
        case 'advance': {
            if (c.open) await advanceBatch(deps, orgId, id);
            break;
        }
    }
    return getBatch(deps, orgId, uid, id);
}

/** Which recipient a call belongs to, for checks and tooling. */
export function recipientForCall(c: BatchCampaign, call: Pick<ConversationCall, 'id' | 'batch'>): BatchRecipient | null {
    if (call.batch?.campaignId !== c.id) return null;
    return c.recipients.find((r) => r.id === call.batch?.recipientId && r.callIds.includes(call.id)) ?? null;
}
