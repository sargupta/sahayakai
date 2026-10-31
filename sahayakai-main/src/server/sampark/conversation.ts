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
    findConversationByUserId,
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
import { enabledRiyaPurposes, riyaOpening, riyaPurposeSpec, RiyaPurposeSchema, type RiyaPurpose } from '@/lib/sampark/conversation/riya-purposes';
import { simulateRiyaCall, SimulationScenarioSchema, type SimulationScenario } from '@/lib/sampark/conversation/simulated-provider';
import { applyRiyaEvent, applyRiyaSnapshot } from '@/lib/sampark/conversation/state';
import {
    isTerminalConversationState,
    type ConversationCall,
    type ConversationCallView,
    type ConversationProviderKind,
    type ConversationTranscriptTurn,
} from '@/lib/sampark/conversation/types';
import { MAX_WEBHOOK_BYTES, parseRiyaWebhook, verifyElevenLabsSignature, type RiyaWebhookEvent } from '@/lib/sampark/conversation/webhook';
import { hashId } from '@/lib/sampark/intents';
import { decryptPhone, hashPhone } from '@/lib/sampark/phone';
import { evaluateGate, FREQUENCY_WINDOW_MS } from '@/lib/sampark/policy/gate';
import { SAMPARK_NONPROD_DATABASE } from '@/lib/sampark/repo/factory';
import { SARGVISION_ORG_ID } from '@/lib/sampark/sargvision';
import { acceptSynopsis, rulesSynopsis, spokenTurns, synopsisNeedsWrite, type RiyaSynopsis, type SynopsisInput } from '@/lib/sampark/conversation/synopsis';
import { pauseStopsPurpose } from '@/lib/sampark/policy/pause';
import { type Clock, type SamparkRepo, systemClock } from '@/lib/sampark/ports';
import type { BlockReason, CallDestination, Campaign, SamparkGuardian, SamparkSchool, SamparkStudent } from '@/types/sampark';
import { badRequest, conflict, notFound, SamparkServiceError } from '@/server/sampark/errors';
import { getSchoolOrThrow } from '@/server/sampark/school';
import { getCallbackRepo } from '@/lib/sampark/callbacks/factory';
import type { CallbackRepo } from '@/lib/sampark/callbacks/repo';
import { proposeCallbackFromCall } from '@/server/sampark/callback-proposals';

const LOG = 'SAMPARK_RIYA';

/** A call still 'initiating' this long after creation was lost mid-request: swept to 'unknown'. */
export const INITIATING_LEASE_MS = 2 * 60_000;
/** The per-school single-flight lock: ring timeout + max conversation (10 min) + margin. */
export const RIYA_LOCK_TTL_MS = 15 * 60_000;
export const DEFAULT_TEST_DAILY_CAP = 5;
/** The privacy policy's retention: a stored transcript lives at most 7 days (the provider's own copy is deleted after 7 too). */
export const DEFAULT_TRANSCRIPT_DAYS = 7;
/** An unknown webhook conversation younger than this is answered 503 so ElevenLabs retries (the link may not be written yet). */
export const UNLINKED_RETRY_WINDOW_SECONDS = 15 * 60;

type Env = Record<string, string | undefined>;

export interface RiyaDeps {
    repo: SamparkRepo;
    calls: ConversationCallRepo;
    clock: Clock;
    /**
     * Real wall-clock time, used only to check the freshness of a webhook signature. The
     * sender signs with ITS real clock, so this must never follow the local rehearsal clock
     * (SAMPARK_DEV_NOW), which can be hours away. Defaults to `clock` (tests pin both).
     */
    wallClock?: Clock;
    env?: Env;
    http?: HttpDeps;
    /** Where a parent's "call me back" becomes a proposed callback. Absent: not recorded. */
    callbacks?: CallbackRepo;
    /** Writes a call synopsis with the model (real calls only). Absent or failing: the rules synopsis. */
    synopsis?: (input: SynopsisInput) => Promise<{ bullets: string[]; callbackRequest: string | null }>;
}

export async function riyaDeps(ctx: { repo: SamparkRepo; clock: Clock }): Promise<RiyaDeps> {
    return {
        repo: ctx.repo,
        clock: ctx.clock,
        wallClock: systemClock,
        calls: await getConversationRepo(),
        callbacks: await getCallbackRepo(),
        // Loaded on first use, so routes that never finish a call never load the model client.
        synopsis: async (input) => (await import('@/ai/flows/riya-call-synopsis')).generateRiyaSynopsis(input),
    };
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
    // Shorter is allowed; longer never: the env cannot turn 7-day storage into long-term storage.
    return Number.isInteger(n) && n >= 1 && n <= DEFAULT_TRANSCRIPT_DAYS ? n : DEFAULT_TRANSCRIPT_DAYS;
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
    | 'DEMO_SCHOOL_PRACTICE_ONLY'
    | 'TEST_PHONE_MISSING'
    | 'TEST_PHONE_NOT_ALLOWED';

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
    agentBranchId: string | null;
    nonProductionDatabase: boolean;
    /** The post-call webhook secret is configured server-side (the value is never exposed). */
    webhookSecretConfigured: boolean;
    /** The staging test-window override as it applies to this school now. */
    testWindowOverride: StagingTestWindowOverride;
    /** Local Sargvision roster: each call rings the chosen contact's own (allow-listed) number. */
    rosterMode: boolean;
    /** When the local after-hours test window is armed and open (roster or single test). */
    localAfterHoursUntil: string | null;
}

function providerFor(school: SamparkSchool, env: Env): { provider: ConversationProviderKind; config: ElevenLabsConfig | null } | { blocker: RiyaBlocker; problems: string[] } {
    if (!riyaEnabled(env)) return { blocker: 'RIYA_DISABLED', problems: [] };
    if (school.mode === 'practice') return { provider: 'simulated', config: null };
    if (school.mode !== 'test') return { blocker: 'LIVE_MODE_NOT_AVAILABLE', problems: [] };
    // A demo school (organisation isDemoData) never places a real Riya call, even to its test phone:
    // its families are synthetic and it exists to rehearse. Real test calls need a non-demo school.
    if (school.isDemo) return { blocker: 'DEMO_SCHOOL_PRACTICE_ONLY', problems: [] };
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
    // The local Sargvision roster rings each contact's own number; its allow-list is checked per call.
    if (sargvisionRosterMode(env, school)) return { provider: 'elevenlabs', config: cfg.config };
    if (!school.testPhoneEnc || !school.testPhoneHash || !school.testPhoneLast4) return { blocker: 'TEST_PHONE_MISSING', problems: [] };
    if (!allowedTestNumbers(env).some((e164) => hashPhone(e164) === school.testPhoneHash)) return { blocker: 'TEST_PHONE_NOT_ALLOWED', problems: [] };
    return { provider: 'elevenlabs', config: cfg.config };
}

/**
 * The local Sargvision test roster (scripts/sampark/sargvision-roster.json): in Test mode, a call to
 * one of its contacts rings THAT contact's own number instead of the school test phone. Only when
 * ALL of these hold — otherwise every school keeps the test-phone-only rule:
 *   - the app runs against the local Firestore emulator, not in production, on `sampark-nonprod`;
 *   - the school is SARGVISION_ORG_ID, is not a demo school, and is in Test mode.
 * Each call still needs the contact's number on SAMPARK_RIYA_TEST_ALLOWED_NUMBERS (checked against
 * the stored hash at preview and against the decrypted number at dial time), plus every gate rule,
 * the per-contact daily cap, the lock and idempotency.
 */
export function sargvisionRosterMode(env: Env, school: SamparkSchool): boolean {
    return Boolean(env.FIRESTORE_EMULATOR_HOST?.trim())
        && env.NODE_ENV !== 'production'
        && env.SAMPARK_FIRESTORE_DATABASE?.trim() === SAMPARK_NONPROD_DATABASE
        && school.orgId === SARGVISION_ORG_ID
        && !school.isDemo
        && school.mode === 'test';
}

function rosterNumberAllowed(env: Env, guardian: SamparkGuardian): boolean {
    return allowedTestNumbers(env).some((e164) => hashPhone(e164) === guardian.phoneHash);
}

/** Decrypts a roster contact's number, checks its hash and the allow-list. Throws otherwise. */
function rosterContactE164(guardian: SamparkGuardian, env: Env): string {
    const e164 = decryptPhone(guardian.phoneEnc);
    if (hashPhone(e164) !== guardian.phoneHash) throw new Error('TEST_PHONE_MISMATCH: the contact number does not match its recorded hash');
    if (!allowedTestNumbers(env).includes(e164)) throw new Error('TEST_PHONE_NOT_ALLOWED: the contact number is not on the allowed list');
    return e164;
}

/**
 * Evening testing on the local roster: the same arming field as `localAfterHoursTestOverride`
 * (`school.localAfterHoursTest`, written only by the emulator seed), but for any roster contact on
 * the allow-list, until it expires (at most 3 hours). The per-contact daily cap limits attempts.
 */
export function sargvisionAfterHoursOverride(env: Env, school: SamparkSchool, guardian: SamparkGuardian, destination: CallDestination | null, now: Date): StagingTestWindowOverride {
    const arm = school.localAfterHoursTest;
    if (!arm) return { active: false, until: null, inactiveReason: null };
    const untilMs = Date.parse(arm.until);
    const armedMs = Date.parse(arm.armedAt);
    if (!Number.isFinite(untilMs) || !Number.isFinite(armedMs)) return { active: false, until: null, inactiveReason: 'unparseable' };
    const until = new Date(untilMs).toISOString();
    const off = (inactiveReason: string): StagingTestWindowOverride => ({ active: false, until, inactiveReason });
    if (!sargvisionRosterMode(env, school)) return off('not_roster_school');
    if (destination !== 'guardian' || !rosterNumberAllowed(env, guardian)) return off('not_allowed_number');
    if (untilMs <= now.getTime()) return off('expired');
    if (untilMs - armedMs > STAGING_TEST_WINDOW_MAX_MS || untilMs - now.getTime() > STAGING_TEST_WINDOW_MAX_MS) return off('longer_than_3_hours');
    return { active: true, until, inactiveReason: null };
}

const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * SAMPARK_RIYA_TEST_ALLOWED_NUMBERS — comma-separated E.164 numbers a real Riya call may ring
 * (spaces inside a number are ignored). Required: unset or empty means no real call, whatever
 * test phone the school saved. Checked against the test phone's hash when the provider is
 * chosen and again against the decrypted number just before dialling.
 */
export function allowedTestNumbers(env: Env): string[] {
    return (env.SAMPARK_RIYA_TEST_ALLOWED_NUMBERS ?? '')
        .split(',')
        .map((n) => n.replace(/\s+/g, ''))
        .filter((n) => E164.test(n));
}

/** Longest window the staging test override may stay open, so a forgotten setting expires by itself. */
export const STAGING_TEST_WINDOW_MAX_MS = 3 * 60 * 60 * 1000;

export interface StagingTestWindowOverride {
    active: boolean;
    /** When the override ends (ISO), if one is configured and well formed. */
    until: string | null;
    /** Why a configured override is NOT active (machine string), or null. */
    inactiveReason: string | null;
}

/**
 * SAMPARK_RIYA_STAGING_TEST_WINDOW_UNTIL — a narrow, self-expiring exception to the school
 * calling window for ONE controlled Riya test on the isolated staging service. It replaces only
 * the calling-hours deferral (gate rule 15, which runs after every other rule), and only when ALL
 * of these hold:
 *   - the value is an ISO time in the future, at most 3 hours away (it switches itself off);
 *   - this deployment uses the separate `sampark-nonprod` database;
 *   - the school is in Test mode, is not a demo school, and the call rings its saved test phone.
 * Consent, school authorisation, opt-outs, suppression, the source-agent refusal, the daily cap,
 * the in-flight lock and webhook verification are untouched. Every call placed under it is
 * audited with `testWindowOverride`.
 */
export function stagingTestWindowOverride(
    env: Env,
    school: SamparkSchool,
    destination: CallDestination | null,
    now: Date,
): StagingTestWindowOverride {
    const raw = env.SAMPARK_RIYA_STAGING_TEST_WINDOW_UNTIL?.trim();
    if (!raw) return { active: false, until: null, inactiveReason: null };
    const untilMs = Date.parse(raw);
    if (!Number.isFinite(untilMs)) return { active: false, until: null, inactiveReason: 'unparseable' };
    const until = new Date(untilMs).toISOString();
    const off = (inactiveReason: string): StagingTestWindowOverride => ({ active: false, until, inactiveReason });
    if (untilMs <= now.getTime()) return off('expired');
    if (untilMs - now.getTime() > STAGING_TEST_WINDOW_MAX_MS) return off('longer_than_3_hours');
    if (env.SAMPARK_FIRESTORE_DATABASE?.trim() !== SAMPARK_NONPROD_DATABASE) return off('not_nonprod_database');
    if (school.isDemo) return off('demo_school');
    if (school.mode !== 'test' || destination !== 'test_phone') return off('not_test_phone');
    return { active: true, until, inactiveReason: null };
}

export function riyaAvailability(school: SamparkSchool, env: Env = process.env, now: Date = new Date()): RiyaAvailability {
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
        destinationLast4: school.mode === 'test' && !sargvisionRosterMode(env, school) ? school.testPhoneLast4 ?? null : null,
        storeTranscripts: storeTranscripts(env),
        transcriptDays: transcriptDays(env),
        testDailyCap: testDailyCap(env),
        recordingConsentRequired: !recordingOffConfirmed(env),
        agentBranchId: cfg.ok ? maskId(cfg.config.branchId ?? null) : null,
        nonProductionDatabase: env.SAMPARK_FIRESTORE_DATABASE?.trim() === SAMPARK_NONPROD_DATABASE,
        webhookSecretConfigured: Boolean(env.ELEVENLABS_WEBHOOK_SECRET?.trim()),
        testWindowOverride: stagingTestWindowOverride(env, school, school.mode === 'test' ? 'test_phone' : null, now),
        rosterMode: sargvisionRosterMode(env, school),
        localAfterHoursUntil: school.localAfterHoursTest && Date.parse(school.localAfterHoursTest.until) > now.getTime() && Boolean(env.FIRESTORE_EMULATOR_HOST?.trim()) && env.NODE_ENV !== 'production'
            ? new Date(Date.parse(school.localAfterHoursTest.until)).toISOString()
            : null,
    };
}

const BLOCKER_MESSAGE: Record<RiyaBlocker, string> = {
    RIYA_DISABLED: 'Riya calling is not enabled for this deployment',
    LIVE_MODE_NOT_AVAILABLE: 'Live mode is not available in this release; Riya calls run in Practice or Test mode only',
    LIVE_DIAL_DISABLED: 'Live dialling is disabled for this deployment',
    ELEVENLABS_UNCONFIGURED: 'The Riya agent is not configured for this deployment',
    NONPROD_DATABASE_REQUIRED: 'Riya test calls need the separate non-production database on this deployment',
    TEST_PHONE_MISSING: 'Test mode needs a test phone number for this school',
    TEST_PHONE_NOT_ALLOWED: 'The school test phone is not on the list of numbers Riya may call on this deployment',
    DEMO_SCHOOL_PRACTICE_ONLY: 'This is a demo school: Riya calls stay in Practice. Real test calls need a non-demo school',
};

/** The one authorised local after-hours Riya test (user's own phone, 2026-10-29): the only school, student and number it covers. */
export const LOCAL_AFTER_HOURS_TEST = { orgId: 'riya-test-local', studentId: 'riya-test-student-alyssa', phoneE164: '+918431339732' } as const;

/**
 * A narrower, local-only sibling of `stagingTestWindowOverride`: replaces only the calling-hours
 * deferral for ONE real Riya attempt, and only when ALL of these hold:
 *   - the app runs against the local Firestore emulator, not in production, on `sampark-nonprod`;
 *   - the school is LOCAL_AFTER_HOURS_TEST.orgId (non-demo, Test mode) and the call rings its
 *     saved test phone, which is LOCAL_AFTER_HOURS_TEST.phoneE164 and on the allow-list;
 *   - the student is LOCAL_AFTER_HOURS_TEST.studentId;
 *   - it was armed (`school.localAfterHoursTest`) at most 3 hours ago and has not expired;
 *   - no ElevenLabs call (accepted, unknown or refused) was created since it was armed.
 * Every other refusal, the daily cap, the lock and idempotency still apply.
 */
export function localAfterHoursTestOverride(
    env: Env,
    school: SamparkSchool,
    studentId: string,
    destination: CallDestination | null,
    now: Date,
    realAttemptsSinceArmed: number,
): StagingTestWindowOverride {
    const arm = school.localAfterHoursTest;
    if (!arm) return { active: false, until: null, inactiveReason: null };
    const untilMs = Date.parse(arm.until);
    const armedMs = Date.parse(arm.armedAt);
    if (!Number.isFinite(untilMs) || !Number.isFinite(armedMs)) return { active: false, until: null, inactiveReason: 'unparseable' };
    const until = new Date(untilMs).toISOString();
    const off = (inactiveReason: string): StagingTestWindowOverride => ({ active: false, until, inactiveReason });
    if (!env.FIRESTORE_EMULATOR_HOST?.trim() || env.NODE_ENV === 'production') return off('not_local_emulator');
    if (env.SAMPARK_FIRESTORE_DATABASE?.trim() !== SAMPARK_NONPROD_DATABASE) return off('not_nonprod_database');
    if (school.orgId !== LOCAL_AFTER_HOURS_TEST.orgId || school.isDemo) return off('not_test_school');
    if (studentId !== LOCAL_AFTER_HOURS_TEST.studentId) return off('not_test_student');
    if (school.mode !== 'test' || destination !== 'test_phone') return off('not_test_phone');
    if (school.testPhoneHash !== hashPhone(LOCAL_AFTER_HOURS_TEST.phoneE164) || !allowedTestNumbers(env).includes(LOCAL_AFTER_HOURS_TEST.phoneE164)) return off('not_test_number');
    if (untilMs <= now.getTime()) return off('expired');
    if (untilMs - armedMs > STAGING_TEST_WINDOW_MAX_MS || untilMs - now.getTime() > STAGING_TEST_WINDOW_MAX_MS) return off('longer_than_3_hours');
    if (realAttemptsSinceArmed > 0) return off('already_used');
    return { active: true, until, inactiveReason: null };
}

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
    | { code: 'PROVIDER_UNAVAILABLE'; blocker: RiyaBlocker; message: string }
    | { code: 'NUMBER_NOT_ALLOWED' };

export interface RiyaPreview {
    ok: boolean;
    refusals: RiyaRefusal[];
    purpose: RiyaPurpose;
    provider: ConversationProviderKind | null;
    destination: CallDestination | null;
    destinationLast4: string | null;
    /** Real calls only: the full test-phone number that will ring, so the admin can check it before confirming. */
    destinationE164: string | null;
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
    /** Masked agent branch id (Test mode). */
    agentBranchId: string | null;
    /** This deployment stores Sampark data in the separate non-production database. */
    nonProductionDatabase: boolean;
    /** Set when this call is allowed only because of the staging test-window override. */
    testWindowOverride: { until: string } | null;
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

function destinationOf(school: SamparkSchool, guardian: SamparkGuardian, env: Env): { destination: CallDestination; phoneHash: string; phoneLast4: string } {
    if (sargvisionRosterMode(env, school)) return { destination: 'guardian', phoneHash: guardian.phoneHash, phoneLast4: guardian.phoneLast4 };
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
        ...(sargvisionRosterMode(env, school) ? { destination: 'guardian' as const } : {}),
        now,
        stage: 'dispatch',
    });
    if (verdict.kind === 'block') refusals.push({ code: 'GATE_BLOCKED', reason: verdict.reason });
    // Riya speaks English only (agent prompt §5): a family whose language is another is not called by her.
    if (verdict.kind === 'allow' && verdict.language !== 'English') refusals.push({ code: 'LANGUAGE_NOT_SUPPORTED', language: verdict.language });
    const destPreview = provider ? destinationOf(school, guardian, env) : null;
    const stagingOverride = stagingTestWindowOverride(env, school, provider === 'elevenlabs' ? destPreview?.destination ?? null : null, now);
    const armedAt = school.localAfterHoursTest?.armedAt;
    const windowOverride = stagingOverride.active || !armedAt || provider !== 'elevenlabs'
        ? stagingOverride
        : sargvisionRosterMode(env, school)
        ? sargvisionAfterHoursOverride(env, school, guardian, destPreview?.destination ?? null, now)
        : localAfterHoursTestOverride(env, school, student.id, destPreview?.destination ?? null, now,
            (await deps.calls.listCalls(orgId, 100)).filter((c) => c.provider === 'elevenlabs' && c.createdAt >= armedAt).length);
    let gateLanguage = verdict.kind === 'allow' ? verdict.language : null;
    if (verdict.kind === 'defer' && windowOverride.active) {
        // Only rule 15 deferred (it runs last); re-read the verdict without it for the language.
        const rest = evaluateGate({
            school, spec, guardian, students: [student], preferences, suppression, recentCallsToPhone,
            carrierKind: 'vobiz', now, stage: 'materialise',
            ...(sargvisionRosterMode(env, school) ? { destination: 'guardian' as const } : {}),
        });
        if (rest.kind === 'block') refusals.push({ code: 'GATE_BLOCKED', reason: rest.reason });
        else if (rest.kind === 'allow') gateLanguage = rest.language;
    } else if (verdict.kind === 'defer') {
        refusals.push({ code: 'OUTSIDE_CALLING_HOURS', nextAllowedAt: verdict.until.toISOString(), reason: verdict.reason });
    }
    if (verdict.kind === 'defer' && windowOverride.active && gateLanguage && gateLanguage !== 'English') {
        refusals.push({ code: 'LANGUAGE_NOT_SUPPORTED', language: gateLanguage });
    }

    if (provider === 'elevenlabs' && sargvisionRosterMode(env, school) && !rosterNumberAllowed(env, guardian)) refusals.push({ code: 'NUMBER_NOT_ALLOWED' });

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

    const dest = provider ? destinationOf(school, guardian, env) : null;
    const preview: RiyaPreview = {
        ok: refusals.length === 0,
        refusals,
        purpose: input.purpose,
        provider,
        destination: dest?.destination ?? null,
        destinationLast4: dest?.phoneLast4 ?? null,
        destinationE164: provider !== 'elevenlabs' ? null
            : dest?.destination === 'test_phone' ? displayTestPhone(school, env)
            : sargvisionRosterMode(env, school) ? displayRosterContact(guardian, env)
            : null,
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
        opening: variables ? riyaOpening(variables.school_name) : null,
        agentId: maskId(config?.agentId),
        agentPhoneNumberId: maskId(config?.agentPhoneNumberId),
        agentBranchId: maskId(config?.branchId ?? null),
        nonProductionDatabase: env.SAMPARK_FIRESTORE_DATABASE?.trim() === SAMPARK_NONPROD_DATABASE,
        testWindowOverride: windowOverride.active && verdict.kind === 'defer' ? { until: windowOverride.until as string } : null,
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
        NUMBER_NOT_ALLOWED: 'This contact’s number is not on the list of numbers Riya may call on this deployment',
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
    const dest = destinationOf(school, guardian, env);
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
        // A call ElevenLabs refused outright (4xx, no conversation) never rang, so it does not use the
        // allowance. Accepted and unknown outcomes always count. Refusals older than `recent` stay
        // counted, so this can only over-count.
        const refused = recent.filter((c) => c.provider === 'elevenlabs' && c.createdAt >= dayAgo.toISOString()
            && c.state === 'failed' && !c.providerConversationId && (c.failureReason ?? '').startsWith('rejected:')).length;
        if (sargvisionRosterMode(env, school)) {
            // Roster: the cap is per contact (their own number), counted the same way.
            const toContact = recent.filter((c) => c.provider === 'elevenlabs' && c.createdAt >= dayAgo.toISOString() && c.phoneHash === dest.phoneHash
                && !(c.state === 'failed' && !c.providerConversationId && (c.failureReason ?? '').startsWith('rejected:'))).length;
            if (toContact >= testDailyCap(env)) throw conflict('TEST_CALL_CAP_REACHED', 'The daily cap on Riya test calls to this contact has been reached');
        } else if ((await deps.calls.countCallsSince(orgId, dayAgo, 'elevenlabs')) - refused >= testDailyCap(env)) {
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
        facts: input.facts ?? null,
        campaignId: input.campaignId ?? null,
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
        detail: { purpose: input.purpose, provider, mode: school.mode, destination: dest.destination, guardianId: guardian.id, studentId: student.id, ...(preview.testWindowOverride ? { testWindowOverride: preview.testWindowOverride.until } : {}) },
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
            toNumber = sargvisionRosterMode(env, school) ? rosterContactE164(guardian, env) : testPhoneE164(school, env);
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
function testPhoneE164(school: SamparkSchool, env: Env): string {
    if (school.mode !== 'test') throw new Error('LIVE_MODE_NOT_AVAILABLE: only Test mode dials');
    if (!school.testPhoneEnc || !school.testPhoneHash) throw new Error('TEST_PHONE_MISSING: the school has no test phone');
    const e164 = decryptPhone(school.testPhoneEnc);
    if (hashPhone(e164) !== school.testPhoneHash) throw new Error('TEST_PHONE_MISMATCH: the test phone does not match its recorded hash');
    if (!allowedTestNumbers(env).includes(e164)) throw new Error('TEST_PHONE_NOT_ALLOWED: the test phone is not on the allowed list');
    return e164;
}

function displayRosterContact(guardian: SamparkGuardian, env: Env): string | null {
    try {
        return rosterContactE164(guardian, env);
    } catch {
        return null;
    }
}

function displayTestPhone(school: SamparkSchool, env: Env): string | null {
    try {
        return testPhoneE164(school, env);
    } catch {
        return null;
    }
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
    const providerMessage = result.kind === 'rejected' ? result.providerMessage ?? null : null;
    const reason = `${result.kind}:${result.category}${result.httpStatus ? `:${result.httpStatus}` : ''}${providerMessage ? ` — ${providerMessage}` : ''}`;
    const updated = await deps.calls.mutateCall(call.orgId, call.id, (c) => c.state !== 'initiating' ? null : {
        ...c, state, failureReason: reason, endedAt: at, updatedAt: at,
    });
    // A rejected call never rang, so the school may place another; an unknown one keeps the lock until it expires.
    if (result.kind === 'rejected') await deps.repo.releaseLock(lockName(call.orgId), call.id);
    await deps.repo.appendAudit(call.orgId, { at, actor: 'riya', action: `riya_call.${state}`, target: `riya_call/${call.id}`, detail: { reason } });
    logger.warn('Riya call not accepted', LOG, { orgId: call.orgId, callId: call.id, outcome: result.kind, category: result.category, httpStatus: result.httpStatus, providerMessage });
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
    if (after && !changed && event.kind === 'post_call' && after.state === 'completed') {
        // Already applied, e.g. a status check recorded the result before the provider had the
        // transcript: a later delivery (webhook or status check) may only fill what is missing.
        await backfillTranscript(deps, orgId, callId, event.transcript);
    }
    if (after && isTerminalConversationState(after.state)) {
        await ensureSynopsis(deps, orgId, callId, event.kind === 'post_call' ? event.transcript : after.transcript ?? []);
    }
    return (await deps.calls.getCall(orgId, callId)) ?? after;
}

/** Stores a transcript that arrived after its result was applied: once, only within retention. */
async function backfillTranscript(deps: RiyaDeps, orgId: string, callId: string, transcript: ConversationTranscriptTurn[]): Promise<void> {
    const env = deps.env ?? process.env;
    if (!storeTranscripts(env) || spokenTurns(transcript) === 0) return;
    const now = deps.clock.now();
    const days = transcriptDays(env);
    await deps.calls.mutateCall(orgId, callId, (c) => (!mayBackfillTranscript(c, now, days, spokenTurns(transcript)) ? null : {
        ...c,
        transcript,
        // Retention runs from the end of the call, not from the late arrival.
        transcriptExpiresAt: new Date(Date.parse(c.endedAt ?? c.createdAt) + days * 86_400_000).toISOString(),
        updatedAt: now.toISOString(),
    }));
}

const PURPOSE_TEXT: Record<RiyaPurpose, string> = {
    event_invitation: 'Event invitation',
    ptm_invitation: 'PTM invitation',
    holiday_notice: 'Holiday notice',
    exam_schedule_notice: 'Exam schedule notice',
    absence_notice: 'Absence notice',
    emergency_closure: 'Emergency closure',
};

function synopsisOutcome(state: ConversationCall['state']): SynopsisInput['outcome'] {
    return state === 'completed' || state === 'no_answer' || state === 'busy' || state === 'failed' ? state : 'unknown';
}

/**
 * Writes the call's synopsis from the provider's transcript (whether or not the transcript itself
 * is kept) and the collected answers. Without spoken turns it is 'provisional'; with them 'final'.
 * Idempotent: a provisional one is replaced by a final one (a late transcript), a final one only by a
 * more complete transcript, and an equal or poorer result changes nothing (no model call either). A model failure or a
 * malformed answer falls back to the deterministic rules synopsis.
 */
async function ensureSynopsis(deps: RiyaDeps, orgId: string, callId: string, transcript: ConversationTranscriptTurn[]): Promise<void> {
    const call = await deps.calls.getCall(orgId, callId);
    if (!call || !isTerminalConversationState(call.state)) return;
    const turns = spokenTurns(transcript);
    // Only a missing synopsis, or a more complete transcript than the current one was written from.
    if (!synopsisNeedsWrite(call.synopsis, turns)) return;
    const now = deps.clock.now().toISOString();
    const input: SynopsisInput = {
        purposeLabel: PURPOSE_TEXT[call.riyaPurpose] ?? 'Riya',
        announcement: call.announcement,
        outcome: synopsisOutcome(call.state),
        durationSeconds: call.durationSeconds,
        answers: call.dataCollection,
        stopRequested: call.stopRequested,
        transcript,
    };
    let synopsis: RiyaSynopsis | null = null;
    if (call.provider === 'elevenlabs' && deps.synopsis && turns > 0) {
        try {
            synopsis = acceptSynopsis(await deps.synopsis(input), now);
        } catch (err) {
            logger.warn('Riya synopsis fell back to rules', LOG, { orgId, callId, error: err instanceof Error ? err.message.slice(0, 120) : 'unknown' });
        }
    }
    // A request the agent collected always wins over the model's reading.
    const rules = rulesSynopsis(input, now);
    const written: RiyaSynopsis = {
        ...(synopsis ? { ...synopsis, callbackRequest: rules.callbackRequest ?? synopsis.callbackRequest } : rules),
        status: turns > 0 ? 'final' : 'provisional',
        transcriptTurns: turns,
    };
    // Re-checked inside the transaction: a concurrent webhook or status check may have written first.
    await deps.calls.mutateCall(orgId, callId, (c) => {
        if (!synopsisNeedsWrite(c.synopsis, turns)) return null;
        return { ...c, synopsis: written, updatedAt: now };
    });
}

/**
 * Whether a transcript that arrives late (a status check after the event was applied) may still be
 * stored: only when it is more complete than the one already kept, never once retention has deleted
 * it, and never past the retention window of the call.
 */
function mayBackfillTranscript(call: ConversationCall, now: Date, days: number, incomingTurns: number): boolean {
    if (call.transcript && spokenTurns(call.transcript) >= incomingTurns) return false;
    if (call.transcriptPurgedAt) return false; // retention already deleted it: never again
    if (call.transcriptExpiresAt && Date.parse(call.transcriptExpiresAt) <= now.getTime()) return false; // due for deletion
    const ended = Date.parse(call.endedAt ?? call.createdAt);
    return now.getTime() < ended + days * 86_400_000;
}

/** Terminal side effects: free the school's slot, note a stop request, audit. Idempotent. */
async function settle(deps: RiyaDeps, call: ConversationCall): Promise<void> {
    const at = deps.clock.now().toISOString();
    await deps.repo.releaseLock(lockName(call.orgId), call.id);
    await deps.repo.appendAudit(call.orgId, {
        at, actor: 'riya', action: `riya_call.${call.state}`, target: `riya_call/${call.id}`,
        detail: { durationSeconds: call.durationSeconds, stopRequested: call.stopRequested, provider: call.provider },
    });
    if (!call.stopRequested && deps.callbacks) await proposeCallbackFromCall({ callbacks: deps.callbacks, repo: deps.repo, clock: deps.clock }, call);
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
    const nowSec = Math.floor((deps.wallClock ?? deps.clock).now().getTime() / 1000);
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
    if (next) {
        const target = next;
        const seen = call.updatedAt;
        call = (await deps.calls.mutateCall(call.orgId, call.id, (c) => (c.updatedAt === seen ? target : null))) ?? call;
    }
    return transcriptDue(call, now) ? (await purgeTranscript(deps, call.orgId, call.id, now)) ?? call : call;
}

function transcriptDue(call: ConversationCall, now: Date): boolean {
    return call.transcriptExpiresAt !== null && Date.parse(call.transcriptExpiresAt) <= now.getTime();
}

/**
 * Deletes ONE call's stored transcript (only the transcript fields; the call record, its answers
 * and its synopsis stay). Re-checked inside the transaction, so it is safe to run twice.
 */
async function purgeTranscript(deps: RiyaDeps, orgId: string, callId: string, now: Date): Promise<ConversationCall | null> {
    const at = now.toISOString();
    return deps.calls.mutateCall(orgId, callId, (c) => (!transcriptDue(c, now) ? null : {
        ...c, transcript: null, transcriptExpiresAt: null, transcriptPurgedAt: at, updatedAt: at,
    }));
}

/** Bounds of one sweep: pages per school, and calls per page. */
export const PURGE_PAGE_SIZE = 100;
export const PURGE_MAX_PAGES = 10;

/**
 * Scheduled retention sweep (the dispatch job, at most hourly): deletes every expired Riya
 * transcript in every Sampark school, not only those someone happens to open. Queries the expired
 * ones directly (oldest first, paged); a purged call drops out of the query, so each page is fresh.
 * Bounded per school per run; touches only transcript fields. Returns how many were deleted.
 */
export async function purgeExpiredRiyaTranscripts(deps: RiyaDeps, opts: { pageSize?: number; maxPages?: number } = {}): Promise<number> {
    const pageSize = opts.pageSize ?? PURGE_PAGE_SIZE;
    const maxPages = opts.maxPages ?? PURGE_MAX_PAGES;
    const now = deps.clock.now();
    let purged = 0;
    for (const school of await deps.repo.listSchools()) {
        for (let page = 0; page < maxPages; page += 1) {
            const due = await deps.calls.listExpiredTranscripts(school.orgId, now, pageSize);
            let progressed = 0;
            for (const call of due) {
                if (call.orgId !== school.orgId) continue;
                if (await purgeTranscript(deps, school.orgId, call.id, now)) progressed += 1;
            }
            purged += progressed;
            if (due.length < pageSize || progressed === 0) break;
        }
    }
    if (purged > 0) logger.info('Riya transcripts purged', LOG, { purged });
    return purged;
}

export const PURGE_LOCK_NAME = 'riya-transcript-purge';
export const PURGE_EVERY_MS = 60 * 60_000;

/**
 * The scheduler's entry point: at most one sweep per hour across every instance and restart.
 * The lease is taken and never released, so it simply expires an hour later. Returns the number
 * deleted, or null when this tick was not the one to sweep.
 */
export async function runScheduledTranscriptPurge(deps: RiyaDeps): Promise<number | null> {
    if (!(await deps.repo.acquireLock(PURGE_LOCK_NAME, `purge-${crypto.randomUUID()}`, deps.clock.now(), PURGE_EVERY_MS))) return null;
    return purgeExpiredRiyaTranscripts(deps);
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
    return { availability: riyaAvailability(school, deps.env ?? process.env, deps.clock.now()), calls: await listRiyaCalls(deps, orgId, 50) };
}

/** A call for the console. The transcript is never included: it stays in the database (see synopsis). */
export interface RiyaCallDetail {
    call: ConversationCallView;
}

export async function getRiyaCall(deps: RiyaDeps, orgId: string, callId: string): Promise<RiyaCallDetail> {
    const call = await deps.calls.getCall(orgId, callId);
    if (!call) throw notFound('CALL_NOT_FOUND', 'Call not found');
    const current = await maintain(deps, call);
    return { call: await viewOf(deps, current) };
}

export async function reconcileRiyaCall(deps: RiyaDeps, orgId: string, callId: string): Promise<RiyaCallDetail> {
    const env = deps.env ?? process.env;
    const call = await deps.calls.getCall(orgId, callId);
    if (!call) throw notFound('CALL_NOT_FOUND', 'Call not found');
    if (call.provider !== 'elevenlabs') return getRiyaCall(deps, orgId, callId);
    const cfg = readElevenLabsConfig(env);
    if (!cfg.ok) throw conflict('ELEVENLABS_UNCONFIGURED', BLOCKER_MESSAGE.ELEVENLABS_UNCONFIGURED);
    let conversationId = call.providerConversationId;
    if (!conversationId) {
        // The request timed out after ElevenLabs had started the call: find it by our own user id
        // (read-only), link it create-only, then read its outcome like any other call.
        if (call.state !== 'unknown') throw conflict('NO_PROVIDER_ID', 'The provider never returned an id for this call; it cannot be looked up');
        const since = Math.floor(Date.parse(call.createdAt) / 1000) - 60;
        const found = await findConversationByUserId(cfg.config, riyaUserId(orgId, callId), since, deps.http);
        if (found.kind === 'error') throw conflict('PROVIDER_ERROR', `The provider could not be reached (${found.category})`);
        if (found.kind === 'none') throw conflict('PROVIDER_NOT_FOUND', 'The provider has no conversation for this call yet; nothing was rung or it is still starting');
        if (!(await deps.calls.linkConversation(found.conversationId, { orgId, callId, createdAt: deps.clock.now().toISOString() }))) {
            throw conflict('CONVERSATION_ALREADY_LINKED', 'That conversation is already linked to another call');
        }
        await deps.calls.mutateCall(orgId, callId, (c) => (c.providerConversationId ? null : { ...c, providerConversationId: found.conversationId, updatedAt: deps.clock.now().toISOString() }));
        conversationId = found.conversationId;
        logger.info('Riya unknown call matched by user id', LOG, { orgId, callId });
    }
    const fetched = await fetchConversation(cfg.config, conversationId, deps.http);
    if (fetched.kind === 'not_found') throw conflict('PROVIDER_NOT_FOUND', 'The provider has no record of this conversation');
    if (fetched.kind === 'error') throw conflict('PROVIDER_ERROR', `The provider could not be reached (${fetched.category})`);
    if (fetched.snapshot.agentId && fetched.snapshot.agentId !== call.agentId) throw conflict('AGENT_MISMATCH', 'The provider reports a different agent for this conversation');
    if (fetched.snapshot.status === 'done') {
        // A finished conversation carries everything a post-call webhook would (transcript, collected
        // answers, a callback request). Apply it through the SAME parser and reducer, so a status check
        // and a webhook record exactly the same outcome (transcript only when stored, with expiry).
        const event = parseRiyaWebhook(JSON.stringify({ type: 'post_call_transcription', event_timestamp: Math.floor(deps.clock.now().getTime() / 1000), data: fetched.snapshot.raw }));
        if (event && event.kind === 'post_call' && event.conversationId === conversationId) {
            // The same path as the webhook: apply once, later fill a missing transcript, then the synopsis.
            await applyEvent(deps, orgId, callId, event);
            return getRiyaCall(deps, orgId, callId);
        }
    }
    let changed = false;
    const after = await deps.calls.mutateCall(orgId, callId, (c) => {
        const next = applyRiyaSnapshot(c, fetched.snapshot, deps.clock.now());
        changed = next !== null;
        return next;
    });
    if (after && changed && isTerminalConversationState(after.state)) await settle(deps, after);
    // Ended without a conversation (failed, busy, no answer): the synopsis says so; no transcript will come.
    if (after && isTerminalConversationState(after.state) && after.state !== 'completed') await ensureSynopsis(deps, orgId, callId, []);
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
