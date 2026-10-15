/**
 * Riya conversation calls — the ONE place a Riya call is started, reconciled or
 * settled (riya-gates.test.ts). Additive to the notice pipeline: no notice-call code
 * path, carrier, dispatcher, webhook or Vobiz teacher route is changed by it.
 *
 * Start order (each step refuses before the next; nothing reaches a phone until all pass):
 *   1. SAMPARK_ENABLED (route shell) and SAMPARK_ELEVENLABS_ENABLED === 'true', else 404
 *   2. the school's mode decides the provider:
 *        practice → simulated (no network), the requested scenario only here
 *        test     → ElevenLabs, ringing ONLY the school's test phone; needs
 *                   SAMPARK_LIVE_DIAL_ENABLED === 'true' and a valid ElevenLabs config
 *        live     → refused (LIVE_MODE_NOT_AVAILABLE), whatever the flags say
 *   3. the workflow is on this deployment's allow-list (SAMPARK_RIYA_PURPOSES)
 *   4. recipient resolved from Sampark records: guardian and student by id, guardian
 *      of record for that student, both active. Names, class and phone come from the
 *      records, never from the request
 *   5. facts: typed; holidays must be on the school calendar; campaign facts by id
 *   6. the Sampark gate (purpose, do-not-contact, suppression, number class, demo
 *      school, consent group, sensitive flags, custody, language, frequency cap,
 *      calling hours), plus pause and recorded-conversation consent
 *   7. the announcement staff confirmed must equal the one the server renders now
 *   8. idempotency: call id = hash(org | idempotency key); a repeat returns the same call
 *   9. one Riya call in flight per school (lock); test-mode daily cap; an unreviewed
 *      'unknown' call for the same family and announcement blocks another attempt
 *  10. create-only call record ('initiating'), THEN the provider is contacted
 *
 * Unknown outcomes (timeout, 5xx) are recorded as 'unknown' and never re-dialled.
 */

import crypto from 'node:crypto';

import { z } from 'zod';

import { logger } from '@/lib/logger';
import { purposeSpec } from '@/lib/sampark/catalogue';
import {
    fetchConversation,
    maskId,
    readElevenLabsConfig,
    startRiyaOutboundCall,
    type ElevenLabsConfig,
    type HttpDeps,
    type OutboundCallResult,
} from '@/lib/sampark/conversation/elevenlabs-client';
import { getConversationRepo } from '@/lib/sampark/conversation/factory';
import { buildRiyaVariables, RiyaFactsSchema, type RiyaFactProblem, type RiyaFacts } from '@/lib/sampark/conversation/facts';
import type { ConversationCallRepo } from '@/lib/sampark/conversation/repo';
import { enabledRiyaPurposes, riyaPurposeSpec, RiyaPurposeSchema, type RiyaPurpose } from '@/lib/sampark/conversation/riya-purposes';
import { simulateRiyaCall, SimulationScenarioSchema, type SimulationScenario } from '@/lib/sampark/conversation/simulated-provider';
import { applyRiyaEvent, applyRiyaSnapshot } from '@/lib/sampark/conversation/state';
import {
    isTerminalConversationState,
    type ConversationCall,
    type ConversationCallView,
    type ConversationProviderKind,
} from '@/lib/sampark/conversation/types';
import { MAX_WEBHOOK_BYTES, parseRiyaWebhook, verifyElevenLabsSignature, type RiyaWebhookEvent } from '@/lib/sampark/conversation/webhook';
import { hashId } from '@/lib/sampark/intents';
import { decryptPhone, hashPhone } from '@/lib/sampark/phone';
import { evaluateGate, FREQUENCY_WINDOW_MS } from '@/lib/sampark/policy/gate';
import { SAMPARK_NONPROD_DATABASE } from '@/lib/sampark/repo/factory';
import { pauseStopsPurpose } from '@/lib/sampark/policy/pause';
import type { Clock, SamparkRepo } from '@/lib/sampark/ports';
import type { BlockReason, CallDestination, Campaign, SamparkGuardian, SamparkSchool, SamparkStudent } from '@/types/sampark';
import { badRequest, conflict, notFound, SamparkServiceError } from '@/server/sampark/errors';
import { getSchoolOrThrow } from '@/server/sampark/school';

const LOG = 'SAMPARK_RIYA';

/** A call still 'initiating' this long after creation was lost mid-request: swept to 'unknown'. */
export const INITIATING_LEASE_MS = 2 * 60_000;
/** The per-school single-flight lock: ring timeout + max conversation (10 min) + margin. */
export const RIYA_LOCK_TTL_MS = 15 * 60_000;
export const DEFAULT_TEST_DAILY_CAP = 5;
export const DEFAULT_TRANSCRIPT_DAYS = 30;
/** An unknown webhook conversation younger than this is answered 503 so ElevenLabs retries (the link may not be written yet). */
export const UNLINKED_RETRY_WINDOW_SECONDS = 15 * 60;

type Env = Record<string, string | undefined>;

export interface RiyaDeps {
    repo: SamparkRepo;
    calls: ConversationCallRepo;
    clock: Clock;
    env?: Env;
    http?: HttpDeps;
}

export async function riyaDeps(ctx: { repo: SamparkRepo; clock: Clock }): Promise<RiyaDeps> {
    return { repo: ctx.repo, clock: ctx.clock, calls: await getConversationRepo() };
}

// ── Flags and configuration ─────────────────────────────────────────────────

export function riyaEnabled(env: Env = process.env): boolean {
    return env.SAMPARK_ELEVENLABS_ENABLED === 'true';
}

function storeTranscripts(env: Env): boolean {
    return env.SAMPARK_RIYA_STORE_TRANSCRIPTS === 'true';
}

function transcriptDays(env: Env): number {
    const n = Number(env.SAMPARK_RIYA_TRANSCRIPT_DAYS);
    return Number.isInteger(n) && n >= 1 && n <= 90 ? n : DEFAULT_TRANSCRIPT_DAYS;
}

function testDailyCap(env: Env): number {
    const n = Number(env.SAMPARK_RIYA_TEST_DAILY_CAP);
    return Number.isInteger(n) && n >= 0 && n <= 20 ? n : DEFAULT_TEST_DAILY_CAP;
}

/** The operator confirmed the agent records no audio and keeps no transcript (privacy settings on the ElevenLabs agent). */
function recordingOffConfirmed(env: Env): boolean {
    return env.SAMPARK_RIYA_RECORDING_OFF_CONFIRMED === 'true';
}

export type RiyaBlocker =
    | 'RIYA_DISABLED'
    | 'LIVE_MODE_NOT_AVAILABLE'
    | 'LIVE_DIAL_DISABLED'
    | 'ELEVENLABS_UNCONFIGURED'
    | 'NONPROD_DATABASE_REQUIRED'
    | 'TEST_PHONE_MISSING';

export interface RiyaAvailability {
    enabled: boolean;
    mode: SamparkSchool['mode'];
    provider: ConversationProviderKind | null;
    blocker: RiyaBlocker | null;
    /** Problems with the ElevenLabs configuration (names only, never values). */
    configProblems: string[];
    purposes: RiyaPurpose[];
    agentId: string | null;
    agentPhoneNumberId: string | null;
    destinationLast4: string | null;
    storeTranscripts: boolean;
    transcriptDays: number;
    testDailyCap: number;
    recordingConsentRequired: boolean;
}

function providerFor(school: SamparkSchool, env: Env): { provider: ConversationProviderKind; config: ElevenLabsConfig | null } | { blocker: RiyaBlocker; problems: string[] } {
    if (!riyaEnabled(env)) return { blocker: 'RIYA_DISABLED', problems: [] };
    if (school.mode === 'practice') return { provider: 'simulated', config: null };
    if (school.mode !== 'test') return { blocker: 'LIVE_MODE_NOT_AVAILABLE', problems: [] };
    if (env.SAMPARK_LIVE_DIAL_ENABLED !== 'true') return { blocker: 'LIVE_DIAL_DISABLED', problems: [] };
    const cfg = readElevenLabsConfig(env);
    if (!cfg.ok) return { blocker: 'ELEVENLABS_UNCONFIGURED', problems: cfg.problems };
    // The preview/staging service runs with NODE_ENV=production in the PRODUCTION Firestore project, so
    // Sampark's own environment guard lets it read the default database. A real Riya call sends a
    // child's name and school facts to ElevenLabs, so it additionally requires the separate
    // non-production database — unless a reviewed production rollout sets
    // SAMPARK_RIYA_PRODUCTION_DATA_APPROVED. (Test mode still rings only the school test phone.)
    if (env.SAMPARK_FIRESTORE_DATABASE?.trim() !== SAMPARK_NONPROD_DATABASE && env.SAMPARK_RIYA_PRODUCTION_DATA_APPROVED !== 'true') {
        return { blocker: 'NONPROD_DATABASE_REQUIRED', problems: [] };
    }
    if (!school.testPhoneEnc || !school.testPhoneHash || !school.testPhoneLast4) return { blocker: 'TEST_PHONE_MISSING', problems: [] };
    return { provider: 'elevenlabs', config: cfg.config };
}

export function riyaAvailability(school: SamparkSchool, env: Env = process.env): RiyaAvailability {
    const p = providerFor(school, env);
    const cfg = readElevenLabsConfig(env);
    return {
        enabled: riyaEnabled(env),
        mode: school.mode,
        provider: 'provider' in p ? p.provider : null,
        blocker: 'blocker' in p ? p.blocker : null,
        configProblems: cfg.ok ? [] : cfg.problems,
        purposes: riyaEnabled(env) ? enabledRiyaPurposes(env) : [],
        agentId: cfg.ok ? maskId(cfg.config.agentId) : null,
        agentPhoneNumberId: cfg.ok ? maskId(cfg.config.agentPhoneNumberId) : null,
        destinationLast4: school.mode === 'test' ? school.testPhoneLast4 ?? null : null,
        storeTranscripts: storeTranscripts(env),
        transcriptDays: transcriptDays(env),
        testDailyCap: testDailyCap(env),
        recordingConsentRequired: !recordingOffConfirmed(env),
    };
}

const BLOCKER_MESSAGE: Record<RiyaBlocker, string> = {
    RIYA_DISABLED: 'Riya calling is not enabled for this deployment',
    LIVE_MODE_NOT_AVAILABLE: 'Live mode is not available in this release; Riya calls run in Practice or Test mode only',
    LIVE_DIAL_DISABLED: 'Live dialling is disabled for this deployment',
    ELEVENLABS_UNCONFIGURED: 'The Riya agent is not configured for this deployment',
    NONPROD_DATABASE_REQUIRED: 'Riya test calls need the separate non-production database on this deployment',
    TEST_PHONE_MISSING: 'Test mode needs a test phone number for this school',
};

// ── Requests ────────────────────────────────────────────────────────────────

const DocId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'invalid id');

const RiyaCallBaseSchema = z.object({
    purpose: RiyaPurposeSchema,
    guardianId: DocId,
    studentId: DocId,
    /** Typed facts, or the id of a Sampark campaign whose facts to use (PTM, event, closure). */
    facts: RiyaFactsSchema.optional(),
    campaignId: DocId.optional(),
});

export const RiyaPreviewSchema = RiyaCallBaseSchema.strict();
export type RiyaPreviewInput = z.infer<typeof RiyaPreviewSchema>;

export const RiyaStartSchema = RiyaCallBaseSchema.extend({
    idempotencyKey: z.string().uuid(),
    /** The announcement the person approved in the preview; must still be what the server would send. */
    confirmedAnnouncement: z.string().min(1).max(2000),
    /** Practice only. */
    scenario: SimulationScenarioSchema.optional(),
}).strict();
export type RiyaStartInput = z.infer<typeof RiyaStartSchema>;

export const RiyaReviewSchema = z.object({ note: z.enum(['did_not_ring', 'rang', 'cannot_tell']) }).strict();

// ── Resolution ──────────────────────────────────────────────────────────────

export type RiyaRefusal =
    | { code: 'PURPOSE_NOT_ENABLED' }
    | { code: 'FACTS_REQUIRED' }
    | { code: 'FACTS_INVALID'; problems: RiyaFactProblem[] }
    | { code: 'CAMPAIGN_FACTS_UNAVAILABLE' }
    | { code: 'NOT_GUARDIAN_OF_RECORD' }
    | { code: 'STUDENT_INACTIVE' }
    | { code: 'SCHOOL_PAUSED' }
    | { code: 'GATE_BLOCKED'; reason: BlockReason }
    | { code: 'OUTSIDE_CALLING_HOURS'; nextAllowedAt: string; reason: string }
    | { code: 'RECORDING_CONSENT_REQUIRED' }
    | { code: 'LANGUAGE_NOT_SUPPORTED'; language: string }
    | { code: 'PROVIDER_UNAVAILABLE'; blocker: RiyaBlocker; message: string };

export interface RiyaPreview {
    ok: boolean;
    refusals: RiyaRefusal[];
    purpose: RiyaPurpose;
    provider: ConversationProviderKind | null;
    destination: CallDestination | null;
    destinationLast4: string | null;
    recipient: {
        guardianDisplayName: string;
        relation: SamparkGuardian['relation'];
        guardianPhoneLast4: string;
        studentDisplayName: string;
        grade: number;
        section: string;
    } | null;
    /** Exactly what the agent will be given; empty strings are "not provided". */
    variables: Record<string, string> | null;
    /** The line Riya says after the listener confirms they are the parent or guardian. */
    announcement: string | null;
    /** The opening line (the agent's first message with the school name filled in). */
    opening: string | null;
    agentId: string | null;
    agentPhoneNumberId: string | null;
}

interface Resolved {
    school: SamparkSchool;
    guardian: SamparkGuardian;
    student: SamparkStudent;
    facts: RiyaFacts | null;
}

function campaignToFacts(c: Campaign, purpose: RiyaPurpose): RiyaFacts | null {
    if (c.status === 'cancelled') return null;
    const f = c.facts;
    if (purpose === 'ptm_invitation' && f.kind === 'ptm_invite') return { purpose, date: f.date, time: f.time };
    if (purpose === 'event_invitation' && f.kind === 'event_invite') return { purpose, eventType: f.eventType, date: f.date, time: f.time };
    if (purpose === 'emergency_closure' && f.kind === 'emergency_closure') return { purpose, date: f.date, reason: f.reason, busesRunning: f.busesRunning };
    return null;
}

async function resolve(deps: RiyaDeps, orgId: string, input: RiyaPreviewInput, refusals: RiyaRefusal[]): Promise<Resolved> {
    const school = await getSchoolOrThrow({ repo: deps.repo, clock: deps.clock }, orgId);
    const [guardian, students] = await Promise.all([deps.repo.getGuardian(orgId, input.guardianId), deps.repo.listStudents(orgId)]);
    const student = students.find((s) => s.id === input.studentId) ?? null;
    if (!guardian || !student) throw notFound('RECIPIENT_NOT_FOUND', 'That family is not in this school’s records');
    if (!student.guardianIds.includes(guardian.id) || !guardian.studentIds.includes(student.id)) refusals.push({ code: 'NOT_GUARDIAN_OF_RECORD' });
    if (!student.active) refusals.push({ code: 'STUDENT_INACTIVE' });

    let facts: RiyaFacts | null = null;
    if (input.campaignId) {
        const campaign = await deps.repo.getCampaign(orgId, input.campaignId);
        facts = campaign ? campaignToFacts(campaign, input.purpose) : null;
        if (!facts) refusals.push({ code: 'CAMPAIGN_FACTS_UNAVAILABLE' });
    } else if (input.facts) {
        facts = input.facts;
    } else {
        refusals.push({ code: 'FACTS_REQUIRED' });
    }
    return { school, guardian, student, facts };
}

function destinationOf(school: SamparkSchool, guardian: SamparkGuardian): { destination: CallDestination; phoneHash: string; phoneLast4: string } {
    if (school.mode === 'test' && school.testPhoneHash && school.testPhoneLast4) {
        return { destination: 'test_phone', phoneHash: school.testPhoneHash, phoneLast4: school.testPhoneLast4 };
    }
    return { destination: 'guardian', phoneHash: guardian.phoneHash, phoneLast4: guardian.phoneLast4 };
}

async function evaluate(deps: RiyaDeps, orgId: string, input: RiyaPreviewInput): Promise<{ preview: RiyaPreview; resolved: Resolved; config: ElevenLabsConfig | null }> {
    const env = deps.env ?? process.env;
    const now = deps.clock.now();
    const refusals: RiyaRefusal[] = [];
    const resolved = await resolve(deps, orgId, input, refusals);
    const { school, guardian, student, facts } = resolved;

    if (!enabledRiyaPurposes(env).includes(input.purpose)) refusals.push({ code: 'PURPOSE_NOT_ENABLED' });

    const p = providerFor(school, env);
    if ('blocker' in p) refusals.push({ code: 'PROVIDER_UNAVAILABLE', blocker: p.blocker, message: BLOCKER_MESSAGE[p.blocker] });
    const provider = 'provider' in p ? p.provider : null;
    const config = 'provider' in p ? p.config : null;

    const riyaSpec = riyaPurposeSpec(input.purpose);
    const spec = { ...purposeSpec(riyaSpec.samparkPurpose), status: 'available' as const, mode: 'conversation' as const };
    if (pauseStopsPurpose(school.pause, spec.id)) refusals.push({ code: 'SCHOOL_PAUSED' });

    const preferences = (await deps.repo.getPreferences(orgId, [guardian.id])).get(guardian.id) ?? null;
    const suppression = await deps.repo.getSuppression(orgId, guardian.phoneHash);
    const since = new Date(now.getTime() - FREQUENCY_WINDOW_MS);
    // As in the notice dispatcher: the cap is counted on the GUARDIAN's number even in Test mode
    // (test calls are recorded against the test phone, so they never add to it).
    const recentCallsToPhone = spec.emergency
        ? 0
        : (await deps.repo.countCallsToPhoneSince(orgId, guardian.phoneHash, since, true)) +
          (await deps.calls.countRealCallsToPhoneSince(orgId, guardian.phoneHash, since));

    const verdict = evaluateGate({
        school,
        spec,
        guardian,
        students: [student],
        preferences,
        suppression,
        recentCallsToPhone,
        // An ElevenLabs call rides the agent's Vobiz SIP trunk: a real carrier for every gate rule.
        carrierKind: provider === 'elevenlabs' ? 'vobiz' : 'simulated',
        now,
        stage: 'dispatch',
    });
    if (verdict.kind === 'block') refusals.push({ code: 'GATE_BLOCKED', reason: verdict.reason });
    // Riya speaks English only (agent prompt §5): a family whose language is another is not called by her.
    if (verdict.kind === 'allow' && verdict.language !== 'English') refusals.push({ code: 'LANGUAGE_NOT_SUPPORTED', language: verdict.language });
    if (verdict.kind === 'defer') refusals.push({ code: 'OUTSIDE_CALLING_HOURS', nextAllowedAt: verdict.until.toISOString(), reason: verdict.reason });

    // The agent records audio and keeps transcripts unless the operator has turned that off.
    if (!recordingOffConfirmed(env) && preferences?.consent?.recorded_conversation?.status !== 'granted') {
        refusals.push({ code: 'RECORDING_CONSENT_REQUIRED' });
    }

    let variables: Record<string, string> | null = null;
    let announcement: string | null = null;
    if (facts) {
        const built = buildRiyaVariables({ purpose: input.purpose, facts, school, student, now });
        if (built.ok) {
            variables = built.variables;
            announcement = built.announcement;
        } else {
            refusals.push({ code: 'FACTS_INVALID', problems: built.problems });
        }
    }

    const dest = provider ? destinationOf(school, guardian) : null;
    const preview: RiyaPreview = {
        ok: refusals.length === 0,
        refusals,
        purpose: input.purpose,
        provider,
        destination: dest?.destination ?? null,
        destinationLast4: dest?.phoneLast4 ?? null,
        recipient: {
            guardianDisplayName: guardian.displayName,
            relation: guardian.relation,
            guardianPhoneLast4: guardian.phoneLast4,
            studentDisplayName: student.displayName,
            grade: student.grade,
            section: student.section,
        },
        variables,
        announcement,
        opening: variables ? `Hello, this is Riya, calling from ${variables.school_name}, with an important update. Is this a good time to talk?` : null,
        agentId: maskId(config?.agentId),
        agentPhoneNumberId: maskId(config?.agentPhoneNumberId),
    };
    return { preview, resolved, config };
}

export async function previewRiyaCall(deps: RiyaDeps, orgId: string, input: RiyaPreviewInput): Promise<RiyaPreview> {
    return (await evaluate(deps, orgId, input)).preview;
}

// ── Start ───────────────────────────────────────────────────────────────────

export function riyaCallId(orgId: string, idempotencyKey: string): string {
    return hashId(`riya|${orgId}|${idempotencyKey}`);
}

export function factsHashOf(purpose: RiyaPurpose, variables: Record<string, string>): string {
    const canonical = JSON.stringify(Object.keys(variables).sort().map((k) => [k, variables[k]]));
    return crypto.createHash('sha256').update(`${purpose}|${canonical}`).digest('hex').slice(0, 32);
}

/** user_id sent to ElevenLabs: opaque ids only, so a post-call payload can be matched even if the link write was lost. */
export function riyaUserId(orgId: string, callId: string): string {
    return `${orgId}~${callId}`;
}

function lockName(orgId: string): string {
    return `riya:${orgId}`;
}

export interface RiyaStartResult {
    call: ConversationCallView;
    /** True when this idempotency key had already started this call; nothing new was dialled. */
    duplicate: boolean;
}

function refusalError(refusals: RiyaRefusal[]): SamparkServiceError {
    const first = refusals[0];
    if (first.code === 'PROVIDER_UNAVAILABLE') return conflict(first.blocker, first.message);
    const message: Record<RiyaRefusal['code'], string> = {
        PURPOSE_NOT_ENABLED: 'This Riya workflow is not enabled for this deployment',
        FACTS_REQUIRED: 'The call needs its facts',
        FACTS_INVALID: 'Some facts are missing or cannot be said; nothing was dialled',
        CAMPAIGN_FACTS_UNAVAILABLE: 'That campaign has no facts for this workflow',
        NOT_GUARDIAN_OF_RECORD: 'This person is not a guardian of record for that student',
        STUDENT_INACTIVE: 'That student is no longer active in the school records',
        SCHOOL_PAUSED: 'Calls are paused for this school',
        GATE_BLOCKED: 'The calling rules do not allow this call',
        OUTSIDE_CALLING_HOURS: 'Outside the school’s calling hours',
        RECORDING_CONSENT_REQUIRED: 'This family has not agreed to recorded calls',
        LANGUAGE_NOT_SUPPORTED: 'Riya speaks English only; this family is called in another language',
        PROVIDER_UNAVAILABLE: '',
    };
    const detail = first.code === 'GATE_BLOCKED' ? `: ${first.reason}` : first.code === 'OUTSIDE_CALLING_HOURS' ? ` (next opening ${first.nextAllowedAt})` : '';
    return conflict(first.code, `${message[first.code]}${detail}`);
}

export async function startRiyaCall(deps: RiyaDeps, orgId: string, uid: string, input: RiyaStartInput): Promise<RiyaStartResult> {
    const env = deps.env ?? process.env;
    const now = deps.clock.now();
    const callId = riyaCallId(orgId, input.idempotencyKey);

    // 8. Idempotency first: a double-click or a retried request returns the original call.
    const existing = await deps.calls.getCall(orgId, callId);
    if (existing) {
        if (existing.createdBy !== uid || existing.guardianId !== input.guardianId || existing.studentId !== input.studentId || existing.riyaPurpose !== input.purpose) {
            throw conflict('IDEMPOTENCY_KEY_REUSED', 'This request key was already used for a different call');
        }
        return { call: await viewOf(deps, existing), duplicate: true };
    }

    const { preview, resolved, config } = await evaluate(deps, orgId, input);
    if (!preview.ok || !preview.variables || !preview.announcement || !preview.provider || !preview.destination) {
        await deps.repo.appendAudit(orgId, {
            at: now.toISOString(), actor: uid, action: 'riya_call.refused', target: `guardian/${input.guardianId}`,
            detail: { purpose: input.purpose, refusals: preview.refusals.map((r) => r.code) },
        });
        throw refusalError(preview.refusals.length ? preview.refusals : [{ code: 'FACTS_REQUIRED' }]);
    }
    if (input.confirmedAnnouncement.trim() !== preview.announcement) {
        throw conflict('ANNOUNCEMENT_CHANGED', 'What Riya would say has changed since the preview; review it again');
    }
    const provider = preview.provider;
    if (input.scenario && provider !== 'simulated') throw badRequest('SCENARIO_PRACTICE_ONLY', 'Scenarios can only be chosen in Practice mode');

    const { school, guardian, student } = resolved;
    const dest = destinationOf(school, guardian);
    const factsHash = factsHashOf(input.purpose, preview.variables);

    // 9a. An unresolved earlier attempt at the same announcement to the same family blocks this one.
    const recent = await deps.calls.listCalls(orgId, 100);
    const unresolved = recent.find((c) =>
        c.guardianId === guardian.id && c.studentId === student.id && c.factsHash === factsHash &&
        (!isTerminalConversationState(c.state) || (c.state === 'unknown' && !c.reviewedAt)));
    if (unresolved) throw conflict('UNRESOLVED_PREVIOUS_CALL', 'An earlier call to this family about the same thing has no confirmed outcome yet; check it before calling again');

    // 9b. Test mode: a small daily cap on calls to the test phone.
    if (provider === 'elevenlabs') {
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
        if ((await deps.calls.countCallsSince(orgId, dayAgo, 'elevenlabs')) >= testDailyCap(env)) {
            throw conflict('TEST_CALL_CAP_REACHED', 'The daily cap on Riya test calls for this school has been reached');
        }
    }

    // 9c. One Riya call in flight per school.
    if (!(await deps.repo.acquireLock(lockName(orgId), callId, now, RIYA_LOCK_TTL_MS))) {
        throw conflict('RIYA_CALL_IN_PROGRESS', 'Another Riya call for this school is still in progress');
    }

    const nowIso = now.toISOString();
    const call: ConversationCall = {
        id: callId,
        orgId,
        provider,
        mode: school.mode,
        destination: dest.destination,
        riyaPurpose: input.purpose,
        purpose: riyaPurposeSpec(input.purpose).samparkPurpose,
        guardianId: guardian.id,
        studentId: student.id,
        phoneHash: dest.phoneHash,
        phoneLast4: dest.phoneLast4,
        language: 'English',
        variables: preview.variables as ConversationCall['variables'],
        announcement: preview.announcement,
        factsHash,
        state: 'initiating',
        leaseUntil: new Date(now.getTime() + INITIATING_LEASE_MS).toISOString(),
        providerConversationId: null,
        providerCallId: null,
        agentId: config?.agentId ?? null,
        agentPhoneNumberId: config?.agentPhoneNumberId ?? null,
        durationSeconds: null,
        providerStatus: null,
        terminationReason: null,
        failureReason: null,
        callSuccessful: null,
        dataCollection: {},
        stopRequested: false,
        transcript: null,
        transcriptExpiresAt: null,
        appliedEvents: [],
        lastEventAt: null,
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
        createdBy: uid,
        createdAt: nowIso,
        updatedAt: nowIso,
        endedAt: null,
    };

    // 10. Create-only record BEFORE any provider contact.
    if (!(await deps.calls.createCallIfAbsent(call))) {
        await deps.repo.releaseLock(lockName(orgId), callId);
        const again = await deps.calls.getCall(orgId, callId);
        if (!again) throw conflict('RIYA_CALL_IN_PROGRESS', 'Please try again');
        return { call: await viewOf(deps, again), duplicate: true };
    }
    await deps.repo.appendAudit(orgId, {
        at: nowIso, actor: uid, action: 'riya_call.start', target: `riya_call/${callId}`,
        detail: { purpose: input.purpose, provider, mode: school.mode, destination: dest.destination, guardianId: guardian.id, studentId: student.id },
    });
    logger.info('Riya call starting', LOG, { orgId, callId, purpose: input.purpose, provider, destination: dest.destination });

    let result: OutboundCallResult;
    let simulatedEvents: RiyaWebhookEvent[] = [];
    if (provider === 'simulated') {
        const run = simulateRiyaCall(callId, input.purpose, (input.scenario ?? 'answered_positive') as SimulationScenario, Math.floor(now.getTime() / 1000));
        result = run.start;
        simulatedEvents = run.events;
    } else {
        let toNumber: string;
        try {
            toNumber = testPhoneE164(school);
        } catch (err) {
            await finishBeforeDial(deps, call, 'failed', `destination_unavailable: ${(err as Error).message.split(':')[0]}`);
            throw conflict('TEST_PHONE_MISMATCH', 'The school test phone could not be verified; nothing was dialled');
        }
        result = await startRiyaOutboundCall(config as ElevenLabsConfig, {
            toNumberE164: toNumber,
            dynamicVariables: preview.variables,
            userId: riyaUserId(orgId, callId),
        }, deps.http);
    }

    const after = await recordStartResult(deps, call, result);
    for (const event of simulatedEvents) {
        // Delivered twice on purpose: Practice proves duplicate webhooks are harmless.
        await applyEvent(deps, after.orgId, after.id, event);
        await applyEvent(deps, after.orgId, after.id, event);
    }
    const final = (await deps.calls.getCall(orgId, callId)) ?? after;
    return { call: await viewOf(deps, final), duplicate: false };
}

/** Decrypts the school's test phone and checks it against its recorded hash. The ONLY number a Riya call may dial in this release. */
function testPhoneE164(school: SamparkSchool): string {
    if (school.mode !== 'test') throw new Error('LIVE_MODE_NOT_AVAILABLE: only Test mode dials');
    if (!school.testPhoneEnc || !school.testPhoneHash) throw new Error('TEST_PHONE_MISSING: the school has no test phone');
    const e164 = decryptPhone(school.testPhoneEnc);
    if (hashPhone(e164) !== school.testPhoneHash) throw new Error('TEST_PHONE_MISMATCH: the test phone does not match its recorded hash');
    return e164;
}

async function finishBeforeDial(deps: RiyaDeps, call: ConversationCall, state: 'failed', reason: string): Promise<void> {
    const at = deps.clock.now().toISOString();
    await deps.calls.mutateCall(call.orgId, call.id, (c) => (c.state === 'initiating' ? { ...c, state, failureReason: reason, endedAt: at, updatedAt: at } : null));
    await deps.repo.releaseLock(lockName(call.orgId), call.id);
}

async function recordStartResult(deps: RiyaDeps, call: ConversationCall, result: OutboundCallResult): Promise<ConversationCall> {
    const at = deps.clock.now().toISOString();
    if (result.kind === 'accepted') {
        const linked = await deps.calls.linkConversation(result.conversationId, { orgId: call.orgId, callId: call.id, createdAt: at });
        if (!linked) {
            // A conversation id already linked elsewhere: never re-point it. The call is surfaced for a person.
            logger.warn('Riya conversation id already linked', LOG, { orgId: call.orgId, callId: call.id });
        }
        const updated = await deps.calls.mutateCall(call.orgId, call.id, (c) => c.state !== 'initiating' ? null : {
            ...c,
            state: linked ? 'initiated' : 'unknown',
            providerConversationId: result.conversationId,
            providerCallId: result.sipCallId,
            providerStatus: 'initiated',
            failureReason: linked ? null : 'conversation_id_already_linked',
            updatedAt: at,
        });
        logger.info('Riya call accepted by provider', LOG, { orgId: call.orgId, callId: call.id });
        return updated ?? call;
    }
    const state = result.kind === 'rejected' ? 'failed' : 'unknown';
    const reason = `${result.kind}:${result.category}${result.httpStatus ? `:${result.httpStatus}` : ''}`;
    const updated = await deps.calls.mutateCall(call.orgId, call.id, (c) => c.state !== 'initiating' ? null : {
        ...c, state, failureReason: reason, endedAt: at, updatedAt: at,
    });
    // A rejected call never rang, so the school may place another; an unknown one keeps the lock until it expires.
    if (result.kind === 'rejected') await deps.repo.releaseLock(lockName(call.orgId), call.id);
    await deps.repo.appendAudit(call.orgId, { at, actor: 'riya', action: `riya_call.${state}`, target: `riya_call/${call.id}`, detail: { reason } });
    logger.warn('Riya call not accepted', LOG, { orgId: call.orgId, callId: call.id, outcome: result.kind, category: result.category, httpStatus: result.httpStatus });
    return updated ?? call;
}

// ── Events (webhooks, Practice, reconciliation) ─────────────────────────────

async function applyEvent(deps: RiyaDeps, orgId: string, callId: string, event: RiyaWebhookEvent): Promise<ConversationCall | null> {
    const env = deps.env ?? process.env;
    const now = deps.clock.now();
    let changed = false;
    const after = await deps.calls.mutateCall(orgId, callId, (c) => {
        const next = applyRiyaEvent(c, event, { now, storeTranscript: storeTranscripts(env), transcriptDays: transcriptDays(env) });
        changed = next !== null;
        return next;
    });
    if (after && changed && isTerminalConversationState(after.state)) await settle(deps, after);
    return after;
}

/** Terminal side effects: free the school's slot, note a stop request, audit. Idempotent. */
async function settle(deps: RiyaDeps, call: ConversationCall): Promise<void> {
    const at = deps.clock.now().toISOString();
    await deps.repo.releaseLock(lockName(call.orgId), call.id);
    await deps.repo.appendAudit(call.orgId, {
        at, actor: 'riya', action: `riya_call.${call.state}`, target: `riya_call/${call.id}`,
        detail: { durationSeconds: call.durationSeconds, stopRequested: call.stopRequested, provider: call.provider },
    });
    if (!call.stopRequested) return;
    if (call.provider === 'simulated' || call.destination === 'test_phone') {
        // A rehearsal: never suppress a parent, never list the test phone (same rule as the keypad 9).
        await deps.repo.appendAudit(call.orgId, { at, actor: 'riya', action: 'riya_call.stop_requested_rehearsal', target: `riya_call/${call.id}` });
        return;
    }
    const existing = await deps.repo.getSuppression(call.orgId, call.phoneHash);
    if (existing && existing.officeVerification !== 'reversed') return;
    await deps.repo.upsertSuppression({
        orgId: call.orgId,
        phoneHash: call.phoneHash,
        phoneLast4: call.phoneLast4,
        scope: 'routine',
        source: 'conversation_request',
        officeVerification: 'pending',
        createdAt: at,
        callId: call.id,
    });
    await deps.repo.appendAudit(call.orgId, { at, actor: 'riya', action: 'suppression.add', target: `suppression/${call.phoneHash}`, detail: { callId: call.id, source: 'conversation_request', scope: 'routine' } });
}

export interface WebhookOutcome {
    status: 200 | 400 | 401 | 404 | 413 | 503;
    body: { ok: boolean; error?: string };
}

/**
 * POST /api/webhooks/elevenlabs-riya. Authentic (HMAC) → parsed (bounded) → ours (agent id)
 * → linked (conversation id → our call, create-only link) → applied (idempotent reducer).
 */
export async function handleRiyaWebhook(deps: RiyaDeps, rawBody: string, signatureHeader: string | null): Promise<WebhookOutcome> {
    const env = deps.env ?? process.env;
    if (env.SAMPARK_ENABLED !== 'true' || !riyaEnabled(env)) return { status: 404, body: { ok: false, error: 'Not found' } };
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BYTES) return { status: 413, body: { ok: false, error: 'too large' } };
    const nowSec = Math.floor(deps.clock.now().getTime() / 1000);
    const sig = verifyElevenLabsSignature(rawBody, signatureHeader, env.ELEVENLABS_WEBHOOK_SECRET?.trim(), nowSec);
    if (!sig.ok) {
        logger.warn('Riya webhook refused', LOG, { reason: sig.reason });
        return { status: sig.reason === 'no_secret' ? 503 : 401, body: { ok: false, error: 'unauthorized' } };
    }
    const event = parseRiyaWebhook(rawBody);
    if (!event) return { status: 400, body: { ok: false, error: 'unreadable' } };
    if (event.kind === 'ignored') return { status: 200, body: { ok: true } };

    const cfg = readElevenLabsConfig(env);
    if (!cfg.ok) return { status: 503, body: { ok: false, error: 'unconfigured' } };
    if (event.agentId !== cfg.config.agentId) {
        // Not our agent (another agent on the same workspace webhook): accept so it is not retried, change nothing.
        logger.info('Riya webhook for another agent ignored', LOG, {});
        return { status: 200, body: { ok: true } };
    }

    let link = await deps.calls.getLink(event.conversationId);
    if (!link && event.kind === 'post_call' && event.userId) {
        // The start request may have timed out after ElevenLabs accepted it: match our own opaque user id,
        // but only onto a call of OURS that has no conversation yet and used this agent.
        const [orgId, callId] = event.userId.split('~');
        if (orgId && callId && /^[A-Za-z0-9_-]{1,128}$/.test(orgId) && /^[a-f0-9]{32}$/.test(callId)) {
            const candidate = await deps.calls.getCall(orgId, callId);
            if (candidate && candidate.providerConversationId === null && candidate.agentId === event.agentId) {
                const at = deps.clock.now().toISOString();
                if (await deps.calls.linkConversation(event.conversationId, { orgId, callId, createdAt: at })) {
                    await deps.calls.mutateCall(orgId, callId, (c) => (c.providerConversationId === null ? { ...c, providerConversationId: event.conversationId, updatedAt: at } : null));
                    link = { orgId, callId, createdAt: at };
                }
            }
        }
    }
    if (!link) {
        const young = nowSec - event.eventTimestamp < UNLINKED_RETRY_WINDOW_SECONDS;
        logger.warn('Riya webhook for an unknown conversation', LOG, { retry: young });
        return young ? { status: 503, body: { ok: false, error: 'not yet linked' } } : { status: 200, body: { ok: true } };
    }
    const call = await deps.calls.getCall(link.orgId, link.callId);
    if (!call || call.orgId !== link.orgId || (call.providerConversationId !== null && call.providerConversationId !== event.conversationId)) {
        logger.warn('Riya webhook link does not match its call', LOG, { orgId: link.orgId, callId: link.callId });
        return { status: 200, body: { ok: true } };
    }
    await applyEvent(deps, call.orgId, call.id, event);
    return { status: 200, body: { ok: true } };
}

// ── Reads, reconciliation, review ───────────────────────────────────────────

/** Lazily: a call lost in 'initiating' becomes 'unknown'; an expired transcript is deleted. */
async function maintain(deps: RiyaDeps, call: ConversationCall): Promise<ConversationCall> {
    const now = deps.clock.now();
    const at = now.toISOString();
    let next: ConversationCall | null = null;
    if (call.state === 'initiating' && new Date(call.leaseUntil).getTime() < now.getTime()) {
        next = { ...call, state: 'unknown', failureReason: 'lost_while_initiating', endedAt: at, updatedAt: at };
    }
    if (call.transcript && call.transcriptExpiresAt && new Date(call.transcriptExpiresAt).getTime() < now.getTime()) {
        next = { ...(next ?? call), transcript: null, updatedAt: at };
    }
    if (!next) return call;
    const target = next;
    const stored = await deps.calls.mutateCall(call.orgId, call.id, (c) => (c.updatedAt === call.updatedAt ? target : null));
    return stored ?? call;
}

async function viewOf(deps: RiyaDeps, call: ConversationCall): Promise<ConversationCallView> {
    const [guardian, students] = await Promise.all([deps.repo.getGuardian(call.orgId, call.guardianId), deps.repo.listStudents(call.orgId)]);
    const { phoneHash: _h, appliedEvents: _e, transcript: _t, ...rest } = call;
    return {
        ...rest,
        agentId: maskId(call.agentId),
        agentPhoneNumberId: maskId(call.agentPhoneNumberId),
        guardianDisplayName: guardian?.displayName ?? null,
        studentDisplayName: students.find((s) => s.id === call.studentId)?.displayName ?? null,
    };
}

export async function listRiyaCalls(deps: RiyaDeps, orgId: string, limit = 50): Promise<ConversationCallView[]> {
    await getSchoolOrThrow({ repo: deps.repo, clock: deps.clock }, orgId);
    const calls = await deps.calls.listCalls(orgId, Math.min(Math.max(limit, 1), 200));
    const maintained = await Promise.all(calls.map((c) => maintain(deps, c)));
    const [guardians, students] = await Promise.all([deps.repo.listGuardians(orgId, [...new Set(maintained.map((c) => c.guardianId))]), deps.repo.listStudents(orgId)]);
    const gName = new Map(guardians.map((g) => [g.id, g.displayName]));
    const sName = new Map(students.map((s) => [s.id, s.displayName]));
    return maintained.map((call) => {
        const { phoneHash: _h, appliedEvents: _e, transcript: _t, ...rest } = call;
        return { ...rest, agentId: maskId(call.agentId), agentPhoneNumberId: maskId(call.agentPhoneNumberId), guardianDisplayName: gName.get(call.guardianId) ?? null, studentDisplayName: sName.get(call.studentId) ?? null };
    });
}

/** GET /riya: what this school can do with Riya now, and its latest calls. */
export async function riyaOverview(deps: RiyaDeps, orgId: string): Promise<{ availability: RiyaAvailability; calls: ConversationCallView[] }> {
    const school = await getSchoolOrThrow({ repo: deps.repo, clock: deps.clock }, orgId);
    return { availability: riyaAvailability(school, deps.env ?? process.env), calls: await listRiyaCalls(deps, orgId, 50) };
}

export interface RiyaCallDetail {
    call: ConversationCallView;
    transcript: ConversationCall['transcript'];
}

export async function getRiyaCall(deps: RiyaDeps, orgId: string, callId: string): Promise<RiyaCallDetail> {
    const call = await deps.calls.getCall(orgId, callId);
    if (!call) throw notFound('CALL_NOT_FOUND', 'Call not found');
    const current = await maintain(deps, call);
    return { call: await viewOf(deps, current), transcript: current.transcript };
}

export async function reconcileRiyaCall(deps: RiyaDeps, orgId: string, callId: string): Promise<RiyaCallDetail> {
    const env = deps.env ?? process.env;
    const call = await deps.calls.getCall(orgId, callId);
    if (!call) throw notFound('CALL_NOT_FOUND', 'Call not found');
    if (call.provider !== 'elevenlabs') return getRiyaCall(deps, orgId, callId);
    if (!call.providerConversationId) throw conflict('NO_PROVIDER_ID', 'The provider never returned an id for this call; it cannot be looked up');
    const cfg = readElevenLabsConfig(env);
    if (!cfg.ok) throw conflict('ELEVENLABS_UNCONFIGURED', BLOCKER_MESSAGE.ELEVENLABS_UNCONFIGURED);
    const fetched = await fetchConversation(cfg.config, call.providerConversationId, deps.http);
    if (fetched.kind === 'not_found') throw conflict('PROVIDER_NOT_FOUND', 'The provider has no record of this conversation');
    if (fetched.kind === 'error') throw conflict('PROVIDER_ERROR', `The provider could not be reached (${fetched.category})`);
    if (fetched.snapshot.agentId && fetched.snapshot.agentId !== call.agentId) throw conflict('AGENT_MISMATCH', 'The provider reports a different agent for this conversation');
    let changed = false;
    const after = await deps.calls.mutateCall(orgId, callId, (c) => {
        const next = applyRiyaSnapshot(c, fetched.snapshot, deps.clock.now());
        changed = next !== null;
        return next;
    });
    if (after && changed && isTerminalConversationState(after.state)) await settle(deps, after);
    return getRiyaCall(deps, orgId, callId);
}

export async function reviewRiyaCall(deps: RiyaDeps, orgId: string, callId: string, uid: string, note: z.infer<typeof RiyaReviewSchema>['note']): Promise<RiyaCallDetail> {
    const at = deps.clock.now().toISOString();
    const call = await deps.calls.getCall(orgId, callId);
    if (!call) throw notFound('CALL_NOT_FOUND', 'Call not found');
    if (call.state !== 'unknown') throw conflict('NOT_UNKNOWN', 'Only a call with an unknown outcome needs a review');
    await deps.calls.mutateCall(orgId, callId, (c) => ({ ...c, reviewedAt: at, reviewedBy: uid, reviewNote: note, updatedAt: at }));
    await deps.repo.releaseLock(lockName(orgId), callId);
    await deps.repo.appendAudit(orgId, { at, actor: uid, action: 'riya_call.reviewed', target: `riya_call/${callId}`, detail: { note } });
    return getRiyaCall(deps, orgId, callId);
}
