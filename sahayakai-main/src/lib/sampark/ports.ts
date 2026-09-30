/**
 * Ports — the boundaries the Sampark engine depends on, so the engine is pure
 * and every adapter is swappable and testable:
 *
 *   SamparkRepo       Firestore in the app, in-memory in tests (repo/)
 *   CrmSource         REST (mock CRM or a real one) or CSV (crm/)
 *   Carrier           simulated now, Vobiz in phase 2 (dispatch/)
 *   SpeechSynthesizer Gemini-TTS / Chirp 3 HD (speech/)
 *   SpeechVerifier    Chirp 2 transcribe-back (speech/)
 *   AudioStore        local filesystem in dev, GCS later (speech/)
 *   Clock             injected so hours/retries/leases are testable
 */

import type {
    CallEvent,
    Campaign,
    CarrierKind,
    GuardianPreferences,
    ImportRun,
    Intent,
    ParentLanguage,
    RenderedClip,
    SamparkCall,
    SamparkGuardian,
    SamparkSchool,
    SamparkStudent,
    Suppression,
} from '@/types/sampark';
import type { SpeechEngineConfig } from '@/lib/sampark/languages';

export interface Clock {
    now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

// ── Persistence ─────────────────────────────────────────────────────────────

export interface AuditEntry {
    at: string;
    actor: string;            // uid, 'system', 'dispatcher', 'import'
    action: string;           // e.g. 'campaign.approve', 'suppression.add'
    target: string;           // e.g. 'campaign/abc'
    detail?: Record<string, unknown>;
}

export interface CallListFilter {
    campaignId?: string;
    limit: number;
}

export type ClaimResult = 'claimed' | 'not_claimable';

export interface SamparkRepo {
    // School
    getSchool(orgId: string): Promise<SamparkSchool | null>;
    upsertSchool(school: SamparkSchool): Promise<void>;
    /** Schools whose Sampark record exists (the dispatcher iterates these). */
    listSchools(): Promise<SamparkSchool[]>;

    // Snapshot
    upsertStudents(orgId: string, students: SamparkStudent[]): Promise<void>;
    upsertGuardians(orgId: string, guardians: SamparkGuardian[]): Promise<void>;
    listStudents(orgId: string): Promise<SamparkStudent[]>;
    listGuardians(orgId: string, ids?: string[]): Promise<SamparkGuardian[]>;
    getGuardian(orgId: string, guardianId: string): Promise<SamparkGuardian | null>;

    // Preferences registry + suppressions
    getPreferences(orgId: string, guardianIds: string[]): Promise<Map<string, GuardianPreferences>>;
    upsertPreferences(prefs: GuardianPreferences[]): Promise<void>;
    getSuppression(orgId: string, phoneHash: string): Promise<Suppression | null>;
    listSuppressions(orgId: string): Promise<Suppression[]>;
    upsertSuppression(s: Suppression): Promise<void>;

    // Imports
    createImportRun(run: ImportRun): Promise<void>;
    updateImportRun(run: ImportRun): Promise<void>;
    getLatestImportRun(orgId: string): Promise<ImportRun | null>;

    // Campaigns
    createCampaign(c: Campaign): Promise<void>;
    getCampaign(orgId: string, campaignId: string): Promise<Campaign | null>;
    updateCampaign(orgId: string, campaignId: string, patch: Partial<Campaign>): Promise<void>;
    listCampaigns(orgId: string, limit: number): Promise<Campaign[]>;

    // Intents
    /** Create-only. Returns false if an intent with this id already exists (it is NOT overwritten). */
    createIntentIfAbsent(intent: Intent): Promise<boolean>;
    getIntent(orgId: string, intentId: string): Promise<Intent | null>;
    updateIntent(orgId: string, intentId: string, patch: Partial<Intent>): Promise<void>;
    /** Intents in 'approved' or 'retry_wait' whose notBefore is null or <= now, oldest first. */
    listDueIntents(orgId: string, now: Date, limit: number): Promise<Intent[]>;
    listIntentsByCampaign(orgId: string, campaignId: string): Promise<Intent[]>;

    /**
     * THE at-most-once primitive (plan §4⑦, class gate 3). In ONE transaction:
     *   - re-read the intent; it must be 'approved' or 'retry_wait' with notBefore <= now;
     *   - the call record `call.id` must not exist;
     *   - write the call (state 'dialing', with leaseUntil) and set the intent to
     *     'dialing' with attempts = call.attempt and lastCallId = call.id.
     * Returns 'not_claimable' (and writes nothing) if any condition fails.
     * The carrier is contacted only AFTER this returns 'claimed'.
     */
    claimIntentForDial(orgId: string, intentId: string, call: SamparkCall, now: Date): Promise<ClaimResult>;

    // Calls
    getCall(orgId: string, callId: string): Promise<SamparkCall | null>;
    updateCall(orgId: string, callId: string, patch: Partial<SamparkCall>): Promise<void>;
    listCalls(orgId: string, filter: CallListFilter): Promise<SamparkCall[]>;
    /** Calls still in 'dialing' whose lease has passed — swept to 'unknown', never re-dialled. */
    listExpiredDialingCalls(orgId: string, now: Date): Promise<SamparkCall[]>;
    /** Calls in a non-terminal state (for the concurrency cap — computed from records, not a counter). */
    countNonTerminalCalls(orgId: string): Promise<number>;
    /** Calls to this phone hash created at or after `since` (frequency cap). Emergency purposes excluded when asked. */
    countCallsToPhoneSince(orgId: string, phoneHash: string, since: Date, excludeEmergency: boolean): Promise<number>;

    // Rendered audio metadata
    saveClip(clip: RenderedClip): Promise<void>;
    getClip(orgId: string, key: string): Promise<RenderedClip | null>;
    listClipsForCampaign(orgId: string, campaignId: string): Promise<RenderedClip[]>;

    // Single-flight lease for the dispatcher tick
    acquireLock(name: string, holder: string, now: Date, ttlMs: number): Promise<boolean>;
    releaseLock(name: string, holder: string): Promise<void>;

    // Audit
    appendAudit(orgId: string, entry: AuditEntry): Promise<void>;
}

// ── CRM ─────────────────────────────────────────────────────────────────────

/**
 * Raw records straight off the wire. The importer validates EACH record with
 * the Zod schemas in crm/schema.ts and quarantines failures with a reason —
 * a malformed record is never half-imported.
 */
export interface CrmSource {
    kind: 'rest' | 'csv';
    fetchSchool(): Promise<unknown>;
    fetchStudents(updatedSince: string | null): Promise<unknown[]>;
    fetchGuardians(updatedSince: string | null): Promise<unknown[]>;
}

// ── Carrier ─────────────────────────────────────────────────────────────────

export interface PlaceCallRequest {
    call: SamparkCall;
    /** The number actually dialled. In test mode this is the school's test phone, never the guardian. */
    destinationE164: string;
    /** Total seconds of the message + menu audio, for heard-level classification. */
    audioSeconds: number;
}

export type PlaceCallResult =
    | {
          ok: true;
          providerCallId: string;
          /**
           * The simulated carrier returns the whole lifecycle up front; the
           * dispatcher feeds each event through the same reducer that real
           * carrier webhooks will use in phase 2. Real carriers return [].
           */
          events: CallEvent[];
      }
    | { ok: false; reason: string; retryable: boolean };

export interface Carrier {
    kind: CarrierKind;
    place(req: PlaceCallRequest): Promise<PlaceCallResult>;
}

// ── Speech ──────────────────────────────────────────────────────────────────

export interface SynthesisResult {
    /**
     * Telephony-ready audio: 8 kHz mono G.711 μ-law in a WAV container, requested
     * directly from the TTS API (audioEncoding MULAW, sampleRateHertz 8000), so no
     * transcoder is needed on Cloud Run. Duration = (bytes − WAV header) / 8000.
     */
    audio: Buffer;
    mimeType: 'audio/wav';
    durationSeconds: number;
}

export interface SpeechSynthesizer {
    synthesize(req: { text: string; language: ParentLanguage; speech: SpeechEngineConfig }): Promise<SynthesisResult>;
}

export interface SpeechVerifier {
    transcribe(req: { audio: Buffer; mimeType: string; language: ParentLanguage; sttLanguageCode: string }): Promise<{ transcript: string; confidence: number }>;
}

export interface AudioStore {
    put(key: string, audio: Buffer, mimeType: string): Promise<void>;
    get(key: string): Promise<{ audio: Buffer; mimeType: string } | null>;
    exists(key: string): Promise<boolean>;
}
