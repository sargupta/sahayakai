/**
 * Callbacks: scheduled Riya calls to one family (types and layout in
 * src/lib/sampark/callbacks/types.ts, state machine in state.ts).
 *
 * People (org admins, through /api/sampark/[orgId]/callbacks):
 *   preview → create (approves the announcement) → reschedule / confirm / cancel.
 *   Every write re-runs the Riya checks AT THE REQUESTED INSTANT (calling hours,
 *   holidays, opt-out, consent, frequency cap, pause, facts still valid). A time the
 *   rules refuse is refused with the next permitted instant in the message: the
 *   person chooses; the time is never shifted silently.
 *
 * The worker (runCallbackTick, from the existing /api/jobs/sampark-dispatch tick,
 * i.e. Cloud Scheduler — never a browser timer):
 *   single-flight lock → per school, queueAt <= now → transactional claim → re-check
 *   (still an admin, still Practice unless real callbacks are enabled, all Riya
 *   checks) → startRiyaCall with key (callback id, version) → record the outcome.
 *   Crash after the call started: the lease expires, the next tick re-claims with the
 *   same version, startRiyaCall returns the existing call, nothing is dialled twice.
 *
 * Fail-closed: Riya off → nothing runs. A real provider (Test mode, ElevenLabs) needs
 * SAMPARK_CALLBACKS_REAL_PROVIDER === 'true' as well as every existing Riya flag;
 * Live mode stays refused by startRiyaCall itself.
 */

import crypto from 'node:crypto';
import os from 'node:os';

import { z } from 'zod';

import { getCallbackRepo } from '@/lib/sampark/callbacks/factory';
import type { CallbackRepo } from '@/lib/sampark/callbacks/repo';
import {
    CALLBACK_MAX_AHEAD_MS,
    CALLBACK_MIN_LEAD_MS,
    cancel,
    claim,
    complete,
    fail,
    reschedule,
    retryOrFail,
    runIdempotencyKey,
    type TransitionRefusal,
} from '@/lib/sampark/callbacks/state';
import { formatInZone, isValidTimeZone, parseCallbackTime, type CallbackTimeParse } from '@/lib/sampark/callbacks/time';
import type { CallbackView, SamparkCallback } from '@/lib/sampark/callbacks/types';
import { RiyaFactsSchema, type RiyaFacts } from '@/lib/sampark/conversation/facts';
import { RiyaPurposeSchema, type RiyaPurpose } from '@/lib/sampark/conversation/riya-purposes';
import type { Clock } from '@/lib/sampark/ports';
import { logger } from '@/lib/logger';
import { requireOrgAdmin } from '@/server/sampark/auth';
import {
    previewRiyaCall,
    riyaDeps,
    riyaEnabled,
    startRiyaCall,
    type RiyaDeps,
    type RiyaPreview,
    type RiyaRefusal,
} from '@/server/sampark/conversation';
import { badRequest, conflict, notFound, SamparkServiceError } from '@/server/sampark/errors';

const LOG = 'SAMPARK_CALLBACKS';
export const CALLBACK_LOCK = 'sampark-callbacks';
const CALLBACK_LOCK_TTL_MS = 2 * 60_000;
export const CALLBACKS_PER_SCHOOL_PER_TICK = 10;
const MAX_LIST = 300;
const MAX_RANGE_MS = 62 * 24 * 60 * 60_000;

/** Riya refusals that may clear on their own: the worker retries these. */
const RETRYABLE = new Set(['RIYA_CALL_IN_PROGRESS', 'UNRESOLVED_PREVIOUS_CALL']);

export interface CallbackDeps extends RiyaDeps {
    callbacks: CallbackRepo;
    /** Re-checked at run time: the approver must still administer the school. */
    isOrgAdmin: (orgId: string, uid: string) => Promise<boolean>;
}

export async function callbackDeps(ctx: { repo: RiyaDeps['repo']; clock: Clock }): Promise<CallbackDeps> {
    const base = await riyaDeps(ctx);
    return { ...base, callbacks: base.callbacks ?? (await getCallbackRepo()), isOrgAdmin: requireOrgAdmin };
}

export function realProviderCallbacksEnabled(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): boolean {
    return env.SAMPARK_CALLBACKS_REAL_PROVIDER === 'true';
}

// ── Requests ────────────────────────────────────────────────────────────────

const DocId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'invalid id');
const Instant = z.string().datetime({ offset: true, message: 'scheduledAt must be an ISO 8601 date-time with an offset' });
const TimeZone = z.string().refine(isValidTimeZone, 'timeZone must be an IANA time zone');

/** Call back about an earlier Riya call (the usual case), or name the call in full. */
const TargetSchema = z.union([
    z.object({ sourceCallId: DocId }),
    z.object({ purpose: RiyaPurposeSchema, guardianId: DocId, studentId: DocId, facts: RiyaFactsSchema.optional(), campaignId: DocId.optional() }),
]);

export const CallbackPreviewSchema = z.object({ target: TargetSchema, scheduledAt: Instant, timeZone: TimeZone }).strict();
export type CallbackPreviewInput = z.infer<typeof CallbackPreviewSchema>;

export const CallbackCreateSchema = CallbackPreviewSchema.extend({
    /** Client-chosen; a retried request returns the original callback. */
    requestKey: z.string().uuid(),
    /** The announcement the person approved in the preview. */
    confirmedAnnouncement: z.string().min(1).max(2000),
    note: z.string().max(300).optional(),
}).strict();
export type CallbackCreateInput = z.infer<typeof CallbackCreateSchema>;

const ChangeTime = z.object({
    scheduledAt: Instant,
    timeZone: TimeZone,
    confirmedAnnouncement: z.string().min(1).max(2000),
    expectedVersion: z.number().int().min(0),
});
export const CallbackUpdateSchema = z.discriminatedUnion('action', [
    ChangeTime.extend({ action: z.literal('reschedule') }).strict(),
    ChangeTime.extend({ action: z.literal('confirm') }).strict(),
    z.object({ action: z.literal('cancel'), expectedVersion: z.number().int().min(0) }).strict(),
    /** Preview a new time for this callback (nothing is written). */
    z.object({ action: z.literal('preview'), scheduledAt: Instant, timeZone: TimeZone }).strict(),
]);
export type CallbackUpdateInput = z.infer<typeof CallbackUpdateSchema>;

export const CallbackParseSchema = z.object({ text: z.string().min(1).max(200), timeZone: TimeZone }).strict();

export const CallbackListQuerySchema = z.object({ from: Instant, to: Instant });

// ── Checks at an instant ────────────────────────────────────────────────────

interface Target {
    purpose: RiyaPurpose;
    guardianId: string;
    studentId: string;
    facts: RiyaFacts | null;
    campaignId: string | null;
    sourceCallId: string | null;
}

export type CallbackRefusal =
    | RiyaRefusal
    | { code: 'TOO_SOON' }
    | { code: 'TOO_FAR' }
    | { code: 'CALLBACKS_PRACTICE_ONLY' };

export interface CallbackPreview {
    ok: boolean;
    refusals: CallbackRefusal[];
    scheduledAt: string;
    timeZone: string;
    /** "Mon 27 Oct, 5:00 PM" in the chosen zone. */
    scheduledLabel: string;
    announcement: string | null;
    recipient: RiyaPreview['recipient'];
    provider: RiyaPreview['provider'];
    /** When the time is outside calling hours: the next permitted instant, for the person to choose. */
    nextAllowedAt: string | null;
}

async function resolveTarget(deps: CallbackDeps, orgId: string, target: CallbackPreviewInput['target']): Promise<Target> {
    if ('sourceCallId' in target) {
        const call = await deps.calls.getCall(orgId, target.sourceCallId); // scoped to this school's subcollection
        if (!call) throw notFound('CALLBACK_SOURCE_NOT_FOUND', 'That call was not found');
        if (!call.facts && !call.campaignId) {
            throw conflict('CALLBACK_SOURCE_UNAVAILABLE', 'That call was made before callbacks were recorded; start a new call from the Riya tab instead');
        }
        return { purpose: call.riyaPurpose, guardianId: call.guardianId, studentId: call.studentId, facts: call.facts ?? null, campaignId: call.campaignId ?? null, sourceCallId: call.id };
    }
    if (!target.facts && !target.campaignId) throw badRequest('FACTS_REQUIRED', 'Give the facts or a campaign for the call');
    return { purpose: target.purpose, guardianId: target.guardianId, studentId: target.studentId, facts: target.facts ?? null, campaignId: target.campaignId ?? null, sourceCallId: null };
}

function riyaInput(t: Pick<Target, 'purpose' | 'guardianId' | 'studentId' | 'facts' | 'campaignId'>) {
    return {
        purpose: t.purpose,
        guardianId: t.guardianId,
        studentId: t.studentId,
        ...(t.campaignId ? { campaignId: t.campaignId } : { facts: t.facts ?? undefined }),
    };
}

/** Every Riya check, evaluated as if it were `at` (calling window, holidays, facts' dates). */
async function checkAt(deps: CallbackDeps, orgId: string, target: Target, at: Date, timeZone: string): Promise<CallbackPreview> {
    const now = deps.clock.now();
    const refusals: CallbackRefusal[] = [];
    if (at.getTime() - now.getTime() < CALLBACK_MIN_LEAD_MS) refusals.push({ code: 'TOO_SOON' });
    if (at.getTime() - now.getTime() > CALLBACK_MAX_AHEAD_MS) refusals.push({ code: 'TOO_FAR' });
    const atClock: Clock = { now: () => new Date(at.getTime()) };
    const preview = await previewRiyaCall({ ...deps, clock: atClock }, orgId, riyaInput(target));
    refusals.push(...preview.refusals);
    const env = deps.env ?? process.env;
    if (preview.provider === 'elevenlabs' && !realProviderCallbacksEnabled(env)) refusals.push({ code: 'CALLBACKS_PRACTICE_ONLY' });
    const outside = preview.refusals.find((r): r is Extract<RiyaRefusal, { code: 'OUTSIDE_CALLING_HOURS' }> => r.code === 'OUTSIDE_CALLING_HOURS');
    return {
        ok: refusals.length === 0,
        refusals,
        scheduledAt: at.toISOString(),
        timeZone,
        scheduledLabel: formatInZone(at, timeZone),
        announcement: preview.announcement,
        recipient: preview.recipient,
        provider: preview.provider,
        nextAllowedAt: outside?.nextAllowedAt ?? null,
    };
}

const REFUSAL_MESSAGE: Partial<Record<CallbackRefusal['code'], string>> = {
    TOO_SOON: 'Choose a time at least a minute from now',
    TOO_FAR: 'Callbacks can be scheduled up to 30 days ahead',
    CALLBACKS_PRACTICE_ONLY: 'Scheduled callbacks run in Practice mode only until real callbacks are switched on for this deployment',
    GATE_BLOCKED: 'This family cannot be called at that time (opt-out, consent or call limits)',
    RECORDING_CONSENT_REQUIRED: 'This family has not agreed to recorded calls',
    SCHOOL_PAUSED: 'Calls are paused for this school',
    FACTS_INVALID: 'The details of this call are no longer valid at that time (for example, the date has passed)',
    PROVIDER_UNAVAILABLE: 'Riya calls are not available for this school right now',
    LANGUAGE_NOT_SUPPORTED: "Riya cannot call this family in their language",
    NOT_GUARDIAN_OF_RECORD: 'This guardian is not on record for this student',
    STUDENT_INACTIVE: 'This student is no longer active',
    PURPOSE_NOT_ENABLED: 'This kind of Riya call is not switched on',
};

function refusalToError(p: CallbackPreview): SamparkServiceError {
    const first = p.refusals[0];
    if (first.code === 'OUTSIDE_CALLING_HOURS') {
        const next = p.nextAllowedAt ? ` The next permitted time is ${formatInZone(new Date(p.nextAllowedAt), p.timeZone)}.` : '';
        return conflict('OUTSIDE_CALLING_HOURS', `${p.scheduledLabel} is outside the school's calling hours.${next} Choose a permitted time.`);
    }
    return conflict(first.code, REFUSAL_MESSAGE[first.code] ?? 'This callback cannot be scheduled at that time');
}

const TRANSITION_MESSAGE: Record<TransitionRefusal, string> = {
    CALLBACK_IN_PROGRESS: 'The call is being started right now; wait for it to finish',
    CALLBACK_NOT_OPEN: 'This callback is already finished or cancelled',
    CALLBACK_CHANGED: 'This callback changed since you opened it; reload and try again',
    CALLBACK_NOT_PROPOSED: 'Only a proposed callback can be confirmed',
};

// ── People ──────────────────────────────────────────────────────────────────

export async function previewCallback(deps: CallbackDeps, orgId: string, input: CallbackPreviewInput): Promise<CallbackPreview> {
    const target = await resolveTarget(deps, orgId, input.target);
    return checkAt(deps, orgId, target, new Date(input.scheduledAt), input.timeZone);
}

export function callbackIdFor(orgId: string, requestKey: string): string {
    return crypto.createHash('sha256').update(`${orgId}|callback|${requestKey}`).digest('hex').slice(0, 32);
}

export async function createCallback(deps: CallbackDeps, orgId: string, uid: string, input: CallbackCreateInput): Promise<{ callback: CallbackView; duplicate: boolean }> {
    const id = callbackIdFor(orgId, input.requestKey);
    const existing = await deps.callbacks.get(orgId, id);
    if (existing) {
        if (existing.createdBy !== uid) throw conflict('IDEMPOTENCY_KEY_REUSED', 'This request key was already used');
        return { callback: (await viewsOf(deps, orgId, [existing]))[0], duplicate: true };
    }
    const target = await resolveTarget(deps, orgId, input.target);
    const at = new Date(input.scheduledAt);
    const preview = await checkAt(deps, orgId, target, at, input.timeZone);
    if (!preview.ok) throw refusalToError(preview);
    if (input.confirmedAnnouncement.trim() !== preview.announcement) {
        throw conflict('ANNOUNCEMENT_CHANGED', 'What Riya would say has changed since the preview; review it again');
    }
    const nowIso = deps.clock.now().toISOString();
    const cb: SamparkCallback = {
        id,
        orgId,
        guardianId: target.guardianId,
        studentId: target.studentId,
        riyaPurpose: target.purpose,
        facts: target.facts,
        campaignId: target.campaignId,
        announcement: preview.announcement,
        scheduledAt: at.toISOString(),
        timeZone: input.timeZone,
        candidates: [],
        status: 'scheduled',
        version: 1,
        queueAt: at.toISOString(),
        attempts: 0,
        lease: null,
        riyaCallId: null,
        lastError: null,
        source: 'staff',
        sourceCallId: target.sourceCallId,
        requestedText: null,
        note: input.note?.trim() || null,
        createdBy: uid,
        approvedBy: uid,
        createdAt: nowIso,
        updatedAt: nowIso,
        cancelledBy: null,
        completedAt: null,
    };
    if (!(await deps.callbacks.createIfAbsent(cb))) {
        const again = await deps.callbacks.get(orgId, id);
        if (!again) throw conflict('CALLBACK_CREATE_RACE', 'Please try again');
        return { callback: (await viewsOf(deps, orgId, [again]))[0], duplicate: true };
    }
    await deps.repo.appendAudit(orgId, {
        at: nowIso, actor: uid, action: 'callback.create', target: `callback/${id}`,
        detail: { scheduledAt: cb.scheduledAt, timeZone: cb.timeZone, purpose: cb.riyaPurpose, guardianId: cb.guardianId, sourceCallId: cb.sourceCallId },
    });
    return { callback: (await viewsOf(deps, orgId, [cb]))[0], duplicate: false };
}

export async function updateCallback(deps: CallbackDeps, orgId: string, uid: string, id: string, input: CallbackUpdateInput): Promise<CallbackView | CallbackPreview> {
    const current = await deps.callbacks.get(orgId, id);
    if (!current) throw notFound('CALLBACK_NOT_FOUND', 'Callback not found');
    const target: Target = { purpose: current.riyaPurpose, guardianId: current.guardianId, studentId: current.studentId, facts: current.facts, campaignId: current.campaignId, sourceCallId: current.sourceCallId };
    const now = deps.clock.now();

    if (input.action === 'preview') return checkAt(deps, orgId, target, new Date(input.scheduledAt), input.timeZone);

    let result: { record: SamparkCallback; changed: boolean } | null;
    // Assigned inside the transaction callbacks below (declared wide so TS does not narrow it to null).
    let refusal = null as TransitionRefusal | null;
    if (input.action === 'cancel') {
        result = await deps.callbacks.mutate(orgId, id, (cb) => {
            const t = cancel(cb, { uid, now, expectedVersion: input.expectedVersion });
            if (!t.ok) { refusal = t.code; return null; }
            return t.next;
        });
    } else {
        if (input.action === 'confirm' && current.status !== 'proposed') throw conflict('CALLBACK_NOT_PROPOSED', TRANSITION_MESSAGE.CALLBACK_NOT_PROPOSED);
        if (input.action === 'reschedule' && current.status === 'proposed') throw conflict('CALLBACK_NOT_CONFIRMED', 'Confirm this proposed callback first');
        const at = new Date(input.scheduledAt);
        const preview = await checkAt(deps, orgId, target, at, input.timeZone);
        if (!preview.ok) throw refusalToError(preview);
        if (input.confirmedAnnouncement.trim() !== preview.announcement) {
            throw conflict('ANNOUNCEMENT_CHANGED', 'What Riya would say has changed since the preview; review it again');
        }
        result = await deps.callbacks.mutate(orgId, id, (cb) => {
            const t = reschedule(cb, { scheduledAt: at, timeZone: input.timeZone, announcement: preview.announcement as string, uid, now, expectedVersion: input.expectedVersion });
            if (!t.ok) { refusal = t.code; return null; }
            return t.next;
        });
    }
    if (!result) throw notFound('CALLBACK_NOT_FOUND', 'Callback not found');
    if (refusal) throw conflict(refusal, TRANSITION_MESSAGE[refusal]);
    await deps.repo.appendAudit(orgId, {
        at: now.toISOString(), actor: uid, action: `callback.${input.action}`, target: `callback/${id}`,
        detail: { version: result.record.version, scheduledAt: result.record.scheduledAt },
    });
    return (await viewsOf(deps, orgId, [result.record]))[0];
}

export async function getCallback(deps: CallbackDeps, orgId: string, id: string): Promise<CallbackView> {
    const cb = await deps.callbacks.get(orgId, id);
    if (!cb) throw notFound('CALLBACK_NOT_FOUND', 'Callback not found');
    return (await viewsOf(deps, orgId, [cb]))[0];
}

/**
 * A callback's audit trail, newest first: who created, confirmed, moved or cancelled
 * it, and each run of the worker (started with its Riya call id, retried, failed,
 * missed). Read from the school's own audit log; never a phone number.
 */
export interface CallbackHistoryEntry {
    at: string;
    action: string;
    actor: string;
    code: string | null;
    riyaCallId: string | null;
    attempt: number | null;
}

export async function getCallbackHistory(deps: CallbackDeps, orgId: string, id: string): Promise<CallbackHistoryEntry[]> {
    if (!(await deps.callbacks.get(orgId, id))) throw notFound('CALLBACK_NOT_FOUND', 'Callback not found');
    const entries = await deps.repo.listAuditFor(orgId, `callback/${id}`, 50);
    return entries.map((e) => {
        const d = (e.detail ?? {}) as Record<string, unknown>;
        return {
            at: e.at,
            action: e.action,
            actor: e.actor,
            code: typeof d.code === 'string' ? d.code : null,
            riyaCallId: typeof d.riyaCallId === 'string' ? d.riyaCallId : null,
            attempt: typeof d.attempt === 'number' ? d.attempt : null,
        };
    });
}

export interface CallbackListing {
    callbacks: CallbackView[];
    /** Proposals waiting for a person, whatever their time. */
    proposed: CallbackView[];
}

export async function listCallbacks(deps: CallbackDeps, orgId: string, fromIso: string, toIso: string): Promise<CallbackListing> {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (!(to.getTime() > from.getTime())) throw badRequest('INVALID_RANGE', '`to` must be after `from`');
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) throw badRequest('RANGE_TOO_LONG', 'Ask for at most 62 days at a time');
    const [inRange, proposed] = await Promise.all([
        deps.callbacks.listScheduledBetween(orgId, from.toISOString(), to.toISOString(), MAX_LIST),
        deps.callbacks.listProposed(orgId, 50),
    ]);
    const all = await viewsOf(deps, orgId, [...inRange, ...proposed.filter((p) => !inRange.some((c) => c.id === p.id))]);
    return { callbacks: all.slice(0, inRange.length), proposed: all.filter((v) => v.status === 'proposed') };
}

/** Recent Riya calls a person can schedule a callback for (they carry their facts). */
export async function callbackSources(deps: CallbackDeps, orgId: string): Promise<Array<{ callId: string; guardianId: string; studentId: string; guardianDisplayName: string | null; studentDisplayName: string | null; purpose: RiyaPurpose; announcement: string; state: string; createdAt: string }>> {
    const calls = (await deps.calls.listCalls(orgId, 50)).filter((c) => c.facts || c.campaignId);
    const guardians = new Map((await deps.repo.listGuardians(orgId, [...new Set(calls.map((c) => c.guardianId))])).map((g) => [g.id, g]));
    const students = new Map((await deps.repo.listStudents(orgId)).map((s) => [s.id, s]));
    return calls.map((c) => ({
        callId: c.id,
        guardianId: c.guardianId,
        studentId: c.studentId,
        guardianDisplayName: guardians.get(c.guardianId)?.displayName ?? null,
        studentDisplayName: students.get(c.studentId)?.displayName ?? null,
        purpose: c.riyaPurpose,
        announcement: c.announcement,
        state: c.state,
        createdAt: c.createdAt,
    }));
}

export function parseCallbackRequest(deps: Pick<CallbackDeps, 'clock'>, text: string, timeZone: string): { parse: CallbackTimeParse; labels: string[] } {
    const parse = parseCallbackTime(text, deps.clock.now(), timeZone);
    const instants = parse.status === 'exact' ? [parse.at] : parse.status === 'ambiguous' ? parse.candidates : [];
    return { parse, labels: instants.map((d) => formatInZone(d, timeZone)) };
}

async function viewsOf(deps: CallbackDeps, orgId: string, records: SamparkCallback[]): Promise<CallbackView[]> {
    if (records.length === 0) return [];
    const guardians = new Map((await deps.repo.listGuardians(orgId, [...new Set(records.map((r) => r.guardianId))])).map((g) => [g.id, g]));
    const students = new Map((await deps.repo.listStudents(orgId)).map((s) => [s.id, s]));
    return Promise.all(records.map(async (r) => {
        const { lease: _lease, ...rest } = r;
        const call = r.riyaCallId ? await deps.calls.getCall(orgId, r.riyaCallId) : null;
        return {
            ...rest,
            guardianDisplayName: guardians.get(r.guardianId)?.displayName ?? null,
            studentDisplayName: students.get(r.studentId)?.displayName ?? null,
            guardianPhoneLast4: guardians.get(r.guardianId)?.phoneLast4 ?? null,
            callState: call?.state ?? null,
        };
    }));
}

// ── The worker ──────────────────────────────────────────────────────────────

export interface CallbackTickReport {
    skipped: boolean;
    reason?: string;
    schools: number;
    claimed: number;
    completed: number;
    retried: number;
    failed: number;
    missed: number;
    errors: string[];
}

function holderId(): string {
    return `callbacks:${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
}

/** One worker tick. Safe to run concurrently and repeatedly. */
export async function runCallbackTick(deps: CallbackDeps, opts: { holder?: string; perSchool?: number } = {}): Promise<CallbackTickReport> {
    const env = deps.env ?? process.env;
    const report: CallbackTickReport = { skipped: false, schools: 0, claimed: 0, completed: 0, retried: 0, failed: 0, missed: 0, errors: [] };
    if (env.SAMPARK_ENABLED !== 'true' || !riyaEnabled(env)) return { ...report, skipped: true, reason: 'riya_disabled' };
    const holder = opts.holder ?? holderId();
    const now = deps.clock.now();
    if (!(await deps.repo.acquireLock(CALLBACK_LOCK, holder, now, CALLBACK_LOCK_TTL_MS))) return { ...report, skipped: true, reason: 'another_worker' };
    try {
        for (const school of await deps.repo.listSchools()) {
            report.schools += 1;
            const queued = await deps.callbacks.listQueued(school.orgId, deps.clock.now().toISOString(), opts.perSchool ?? CALLBACKS_PER_SCHOOL_PER_TICK);
            for (const candidate of queued) {
                try {
                    await runOne(deps, school.orgId, candidate.id, holder, report);
                } catch (err) {
                    report.errors.push(`${school.orgId}/${candidate.id}: ${err instanceof Error ? err.message.slice(0, 120) : 'error'}`);
                }
            }
        }
    } finally {
        await deps.repo.releaseLock(CALLBACK_LOCK, holder);
    }
    if (report.claimed || report.errors.length) logger.info('Callback tick', LOG, { ...report, errors: report.errors.length });
    return report;
}

async function runOne(deps: CallbackDeps, orgId: string, id: string, holder: string, report: CallbackTickReport): Promise<void> {
    const env = deps.env ?? process.env;
    let outcome = 'skip' as 'claimed' | 'missed' | 'skip';
    const claimed = await deps.callbacks.mutate(orgId, id, (cb) => {
        const c = claim(cb, { holder, now: deps.clock.now() });
        outcome = c.kind;
        return c.kind === 'skip' ? null : c.next;
    });
    if (!claimed || outcome === 'skip') return;
    const at = deps.clock.now().toISOString();
    if (outcome === 'missed') {
        report.missed += 1;
        await deps.repo.appendAudit(orgId, { at, actor: 'system', action: 'callback.missed', target: `callback/${id}` });
        return;
    }
    report.claimed += 1;
    const cb = claimed.record;
    const finish = async (mutate: (c: SamparkCallback) => SamparkCallback | null, action: string, detail: Record<string, unknown> = {}) => {
        await deps.callbacks.mutate(orgId, id, mutate);
        await deps.repo.appendAudit(orgId, { at: deps.clock.now().toISOString(), actor: 'system', action, target: `callback/${id}`, detail: { attempt: cb.attempts, ...detail } });
    };
    const failWith = async (code: string, message: string) => {
        report.failed += 1;
        await finish((c) => fail(c, { holder, now: deps.clock.now(), code, message }), 'callback.failed', { code });
    };

    // Re-check what may have changed since a person approved it.
    if (!cb.approvedBy || !cb.announcement) return failWith('CALLBACK_NOT_APPROVED', 'This callback was never approved');
    if (!(await deps.isOrgAdmin(orgId, cb.approvedBy))) return failWith('APPROVER_NO_LONGER_ADMIN', 'The person who scheduled this callback no longer administers the school');
    const input = riyaInput({ purpose: cb.riyaPurpose, guardianId: cb.guardianId, studentId: cb.studentId, facts: cb.facts, campaignId: cb.campaignId });
    const preview = await previewRiyaCall(deps, orgId, input);
    if (preview.provider === 'elevenlabs' && !realProviderCallbacksEnabled(env)) {
        return failWith('CALLBACKS_PRACTICE_ONLY', REFUSAL_MESSAGE.CALLBACKS_PRACTICE_ONLY as string);
    }
    if (!preview.ok) {
        const first = preview.refusals[0];
        // Calling hours, opt-out, consent, pause, facts: a person must decide. Never shift the time.
        const message = first.code === 'OUTSIDE_CALLING_HOURS'
            ? `The school's calling rules do not allow this call now.${first.nextAllowedAt ? ` The next permitted time is ${formatInZone(new Date(first.nextAllowedAt), cb.timeZone)}.` : ''} Choose a new time.`
            : REFUSAL_MESSAGE[first.code] ?? 'A Riya check refused this call';
        return failWith(first.code, message);
    }

    const key = runIdempotencyKey(crypto.createHash('sha256').update(`${orgId}|${cb.id}|${cb.version}`).digest('hex'));
    try {
        const result = await startRiyaCall(deps, orgId, cb.approvedBy, { ...input, idempotencyKey: key, confirmedAnnouncement: cb.announcement });
        report.completed += 1;
        await finish((c) => complete(c, { holder, now: deps.clock.now(), riyaCallId: result.call.id }), 'callback.started', { riyaCallId: result.call.id, duplicate: result.duplicate });
    } catch (err) {
        if (err instanceof SamparkServiceError && !RETRYABLE.has(err.code)) return failWith(err.code, err.message);
        const code = err instanceof SamparkServiceError ? err.code : 'CALL_START_ERROR';
        const message = err instanceof SamparkServiceError ? err.message : 'The call could not be started';
        let retried = false as boolean;
        await deps.callbacks.mutate(orgId, id, (c) => {
            const next = retryOrFail(c, { holder, now: deps.clock.now(), code, message });
            retried = next?.status === 'scheduled';
            return next;
        });
        if (retried) report.retried += 1;
        else report.failed += 1;
        await deps.repo.appendAudit(orgId, { at: deps.clock.now().toISOString(), actor: 'system', action: retried ? 'callback.retry' : 'callback.failed', target: `callback/${id}`, detail: { code, attempt: cb.attempts } });
    }
}
