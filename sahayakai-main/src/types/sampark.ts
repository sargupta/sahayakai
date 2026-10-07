/**
 * Sampark — school-to-parent calling. Domain types shared by the engine, the
 * server layer, the API routes and the console.
 *
 * Plan: docs/sampark/SAMPARK_PLAN.md (v2). Read §1 (principles), §2 (purposes),
 * §4 (pipeline) before changing anything here — these shapes encode decisions
 * made there, and the comments say which.
 *
 * Tenancy: a school IS an existing `organizations/{orgId}`. Every Sampark
 * record carries `orgId` and lives under `sampark_schools/{orgId}/…`
 * (collection ids are all prefixed `sampark_` so they can never collide with
 * the existing `classes/{id}/students`).
 *
 * PII: a guardian's full phone number exists in exactly one place — the
 * encrypted `phoneEnc` on SamparkGuardian. Everything else (calls, intents,
 * suppressions, API responses) carries `phoneHash` and/or `phoneLast4` only.
 */

// ── Languages ────────────────────────────────────────────────────────────────

/**
 * The languages a PARENT can be called in. Deliberately separate from the UI
 * `Language` type in `@/types`: Nepali is a parent language here without
 * becoming a twelfth teacher-UI language (plan §5, §14).
 */
export const PARENT_LANGUAGES = ['English', 'Hindi', 'Bengali', 'Nepali'] as const;
export type ParentLanguage = (typeof PARENT_LANGUAGES)[number];

/** Short codes used on the CRM wire format and in template file names. */
export type ParentLanguageCode = 'en' | 'hi' | 'bn' | 'ne';

// ── Purposes ─────────────────────────────────────────────────────────────────

/** Every purpose in the plan's catalogue (§2). `catalogue.ts` holds the metadata. */
export type PurposeId =
    // A — progress & holistic card
    | 'attendance_talk'      // A1 request to talk
    | 'absence_today'        // A2 same-day unexplained absence
    | 'academic_talk'        // A3 request to talk
    | 'conduct_talk'         // A4 request to talk
    | 'recognition'          // A5
    | 'term_summary'         // A6
    | 'hpc_parent_input'     // A7 (conversation, phase 4)
    // B — meetings
    | 'ptm_invite'           // B1
    | 'principal_meeting_confirm' // B2 (slot confirmation only; human-first)
    | 'meeting_reminder'     // B4
    // C — fees & administration
    | 'fee_due'              // C1
    | 'fee_overdue'          // C2
    | 'documents_pending'    // C4
    | 're_enrolment'         // C5
    | 'deadline_notice'      // C6
    // D — events & notices
    | 'event_invite'         // D1
    | 'exam_notice'          // D2
    | 'holiday_notice'       // D3
    | 'emergency_closure'    // D4 (own path)
    | 'transport_notice'     // D5
    | 'early_dismissal'      // D6
    | 'illness_notice'       // D7
    | 'health_camp'          // D8
    | 'boarder_notice'       // D9
    // E — human-only (engine pages a person, never dials)
    | 'counsellor_meeting'   // B3
    | 'fee_hardship'         // C3
    | 'child_unwell'         // E1
    | 'wellbeing'            // E2
    | 'safeguarding'         // E3
    | 'discipline_decision'  // E4
    | 'child_missing'        // E5
    | 'security_incident';   // E6

export type PurposeFamily = 'progress' | 'meeting' | 'fees' | 'notice' | 'human';

/** notice = pre-rendered audio + keypad; conversation = live agent; human_only = page a person. */
export type CallMode = 'notice' | 'conversation' | 'human_only';

/** class = names no child (broadcast); child = child-specific, listener check first. */
export type PurposeAudience = 'class' | 'child';

export type ChannelRule = 'call_first' | 'message_first';

/** Staff roles inside Sampark (plan §8). Granted by the org admin. */
export type SamparkRole =
    | 'principal'
    | 'coordinator'
    | 'class_teacher'
    | 'accounts'
    | 'transport'
    | 'office'
    | 'counsellor';

/** Who approves a purpose. `principal` also covers the org admin in slice 1. */
export type Approver = SamparkRole | 'auto' | 'none';

/** Consent is recorded per guardian per purpose GROUP (plan §4④, §6). */
export type ConsentGroup = 'notices' | 'progress' | 'recorded_conversation' | 'hpc_input';

/** Every purpose is classified once. Only `service` may ever be scheduled (class gate 8). */
export type CommercialClass = 'service' | 'promotional';

// ── School (tenant) ──────────────────────────────────────────────────────────

/** practice = simulated carrier only; test = every call goes to the school's test phone; live = parents. */
export type SamparkMode = 'practice' | 'test' | 'live';

export interface CallingWindow {
    /** IST hour, inclusive. Must be >= 10 for routine purposes (plan §4④). */
    startHour: number;
    /** IST hour, exclusive. Must be <= 20 for routine purposes. */
    endHour: number;
    /** 0 = Sunday … 6 = Saturday. Default [0]. */
    offDays: number[];
}

/** A place the school holds events. Names are reviewed per language — no free text reaches TTS. */
export interface SchoolVenue {
    id: string;
    names: Record<ParentLanguage, string>;
}

export interface SamparkSchool {
    orgId: string;
    /** The school's name as SPOKEN in each language (reviewed). Parents hear this, never "Sampark". */
    spokenName: Record<ParentLanguage, string>;
    /** Display name for the console. */
    displayName: string;
    mode: SamparkMode;
    /** Demo organisations can never reach a real carrier in any mode (class gate 4). */
    isDemo: boolean;
    callingWindow: CallingWindow;
    /** YYYY-MM-DD school holidays; routine calls are suppressed on these days. */
    holidays: string[];
    venues: SchoolVenue[];
    /** Used when a guardian's language is unknown AND the school chose to default rather than ask. Null = ask (plan §4④). */
    defaultLanguage: ParentLanguage | null;
    /** Test-mode destination (phase 2). Stored encrypted; console sees last4 only. */
    testPhoneEnc?: string | null;
    testPhoneLast4?: string | null;
    /** Peppered hash of the test phone: a test call is recorded against THIS, never the guardian's, so it can neither count towards a parent's frequency cap nor suppress a parent. */
    testPhoneHash?: string | null;
    crm: CrmConnectionConfig | null;
    /** Whether an emergency closure may reach guardians without `notices` consent. Default false until counsel rules (plan §15.5). */
    emergencyBypassConsent: boolean;
    /**
     * School-level pause (hardening H3, EDGE_CASES.md §3). While set, no new call starts
     * (scope 'all'), or none but emergency closures (scope 'routine'); calls still ringing
     * when it was set are hung up. Null or missing = not paused.
     */
    pause?: SchoolPause | null;
    /** Holidays the school entered in the console. A CRM import never removes these (H10). */
    manualHolidays?: string[];
    /** Holidays from the last CRM import. `holidays` is always the sorted union of both lists. */
    crmHolidays?: string[];
    createdAt: string;
    updatedAt: string;
}

/** A school-level pause (H3): who set it, why, and whether emergency closures still go out. */
export interface SchoolPause {
    at: string;
    by: string;
    /** Free text for staff only (never spoken), at most 200 characters. */
    reason: string;
    /** 'all' stops every call; 'routine' lets emergency closures (D4) continue. */
    scope: 'routine' | 'all';
}

/** Why a deployment cannot place real (Test-mode) calls. */
export type LiveDialBlocker = 'LIVE_DIAL_DISABLED' | 'PUBLIC_BASE_URL_MISSING' | 'CARRIER_UNCONFIGURED';

/**
 * What the console is sent for a school (GET/PUT school, PUT mode, enable). The stored
 * test-phone ciphertext and hash never leave the server; `testPhoneLast4` is always
 * present (null when no phone is saved), with the deployment's ability to place
 * Test-mode calls and, when it cannot, why.
 */
export type SamparkSchoolView = Omit<SamparkSchool, 'testPhoneEnc' | 'testPhoneHash' | 'testPhoneLast4'> & {
    testPhoneLast4: string | null;
    liveDialAvailable: boolean;
    liveDialBlocker: LiveDialBlocker | null;
};

export interface CrmConnectionConfig {
    kind: 'rest' | 'csv';
    /** https only; validated against SSRF on save (plan §4①). Null for csv. */
    baseUrl: string | null;
    /** Name of the Secret Manager secret (or env var in dev) holding the API key. Never the key itself. */
    apiKeySecretName: string | null;
    lastImportAt: string | null;
    lastImportId: string | null;
}

// ── Canonical snapshot (normalised from the CRM) ─────────────────────────────

export type FeeCategory = 'regular' | 'rte' | 'waived' | 'scholarship' | 'staff_ward';

/**
 * Reason codes only — the CRM never sends note text for these (plan §2E).
 * Any of them suppresses every automated call about the child except class-wide notices.
 */
export type SensitiveFlag =
    | 'domestic_issue'
    | 'severe_illness'
    | 'counsellor_referral'
    | 'custody_restriction'
    | 'safeguarding_open';

export interface SamparkStudent {
    orgId: string;
    /** CRM id. */
    id: string;
    grade: number;           // 1–12
    section: string;         // 'A' | 'B' | …
    /** First name as it should be SPOKEN in each language (reviewed CRM field). Missing = child-specific calls in that language are blocked. */
    spokenFirstName: Partial<Record<ParentLanguage, string>>;
    displayName: string;
    feeCategory: FeeCategory;
    sensitiveFlags: SensitiveFlag[];
    boarding: boolean;
    transportRoute: string | null;
    /** Guardians of RECORD for this child (bundling uses this, never a shared phone number). */
    guardianIds: string[];
    /**
     * The guardians of record the CRM marks primary for this child (H6: one call per family,
     * primary guardian first). Missing on records imported before 7 Oct 2026.
     */
    primaryGuardianIds?: string[];
    active: boolean;
    crmUpdatedAt: string;
    importedAt: string;
}

export type PhoneClass = 'mobile' | 'synthetic' | 'invalid';

export interface SamparkGuardian {
    orgId: string;
    id: string;
    displayName: string;
    relation: 'mother' | 'father' | 'guardian' | 'other';
    /** AES-GCM ciphertext of the E.164 number. The only place a full number is stored. */
    phoneEnc: string;
    /** Peppered SHA-256 of the E.164 number — the key for suppressions and frequency caps. */
    phoneHash: string;
    phoneLast4: string;
    phoneClass: PhoneClass;
    /** Students for whom this person is a guardian of record. */
    studentIds: string[];
    /** From the CRM, may be overridden in the preferences registry. */
    crmLanguage: ParentLanguage | null;
    /** CRM do-not-contact flag (custody restriction, family request). */
    crmDoNotContact: boolean;
    active: boolean;
    crmUpdatedAt: string;
    importedAt: string;
}

// ── Preferences registry (Sampark owns consent + language, plan §4④, §6) ─────

export type ConsentStatus = 'granted' | 'denied' | 'unknown';
export type ConsentSource = 'crm' | 'office' | 'parent_form' | 'keypad';

export interface ConsentRecord {
    status: ConsentStatus;
    /** Version id of the notice the parent was shown (itemised DPDP notice). */
    noticeVersion: string | null;
    language: ParentLanguage | null;
    recordedAt: string | null;
    source: ConsentSource;
}

export interface GuardianPreferences {
    orgId: string;
    guardianId: string;
    /** Overrides crmLanguage when set. */
    language: ParentLanguage | null;
    consent: Record<ConsentGroup, ConsentRecord>;
    updatedAt: string;
    updatedBy: string;   // uid or 'import'
}

/** Keyed by phoneHash so it survives CRM re-keying (plan §4②). */
export interface Suppression {
    orgId: string;
    phoneHash: string;
    phoneLast4: string;
    /** routine = stops everything except emergency notices; all = stops everything. */
    scope: 'routine' | 'all';
    /**
     * 'carrier_invalid_number': the carrier reported the number unallocated, invalid or changed
     * (H7); written with scope 'all' so no purpose dials it until the office corrects it.
     */
    source: 'keypad' | 'keypad_unconfirmed' | 'office' | 'crm' | 'carrier_invalid_number';
    /** Office must confirm with the family within two school days (plan §5.1). */
    officeVerification: 'pending' | 'confirmed' | 'reversed';
    createdAt: string;
    callId: string | null;
}

// ── Imports ─────────────────────────────────────────────────────────────────

export interface ImportRejectedRow {
    entity: 'student' | 'guardian';
    crmId: string | null;
    /** Row number for CSV; null for REST. */
    row: number | null;
    reason: string;
}

export interface ImportRun {
    id: string;
    orgId: string;
    source: 'rest' | 'csv';
    startedAt: string;
    finishedAt: string | null;
    status: 'running' | 'succeeded' | 'failed';
    counts: { students: number; guardians: number; rejected: number; tombstoned: number };
    rejected: ImportRejectedRow[];
    error: string | null;
    startedBy: string;
}

// ── Campaign facts (typed per purpose — no free text reaches TTS) ────────────

export type EventType = 'annual_day' | 'sports_day' | 'science_fair' | 'cultural_programme' | 'parent_workshop';
export type ClosureReason = 'rain_landslide' | 'heavy_rain' | 'bandh' | 'local_emergency';

/** Time of day restricted to whole and half hours so every language can say it naturally. */
export interface SpokenTime { hour: number; minute: 0 | 30 }

export interface PtmFacts { kind: 'ptm_invite'; date: string; time: SpokenTime; venueId: string }
export interface EventFacts { kind: 'event_invite'; eventType: EventType; date: string; time: SpokenTime; venueId: string }
export interface ClosureFacts {
    kind: 'emergency_closure';
    /** The closure day (YYYY-MM-DD, IST). Audio variant 'today'/'tomorrow' is chosen at dial time from this. */
    date: string;
    reason: ClosureReason;
    busesRunning: boolean;
}
export type CampaignFacts = PtmFacts | EventFacts | ClosureFacts;

export interface CampaignAudience {
    /** Empty = whole school. */
    sections: { grade: number; section: string }[];
}

export type CampaignStatus =
    | 'draft'
    | 'rendering'      // approved; audio being rendered + transcribe-back checked
    | 'render_failed'  // a clip failed verification; nothing dispatched
    | 'scheduled'      // intents materialised, waiting for the dispatcher
    | 'dispatching'
    | 'completed'
    | 'cancelled';

export interface CampaignCounts {
    guardians: number;
    blocked: number;
    queued: number;
    inFlight: number;
    heardKeyFact: number;
    confirmedYes: number;     // key 1
    declinedOrOther: number;  // key 2
    noAnswer: number;
    failed: number;
    optOuts: number;
}

/** Why a dispatchable campaign is on hold (H2, H3). */
export type CampaignHoldReason = 'mode_changed' | 'mode_not_pinned' | 'school_paused';

export interface Campaign {
    id: string;
    orgId: string;
    purpose: PurposeId;
    facts: CampaignFacts;
    audience: CampaignAudience;
    status: CampaignStatus;
    /** Earliest dispatch time (ISO). Null = as soon as the window allows. */
    notBefore: string | null;
    /** After this instant no new attempt is started (D4: end of the closure day). */
    expiresAt: string;
    createdBy: string;
    createdAt: string;
    approvedBy: string | null;
    approvedAt: string | null;
    renderProgress: { done: number; total: number; failures: string[] };
    counts: CampaignCounts;
    /**
     * The school's mode when the campaign was approved (H2). The dispatcher dials only while
     * the school is still in this mode. Missing on campaigns approved before 7 Oct 2026: such
     * a campaign is never dialled (holdReason 'mode_not_pinned').
     */
    mode?: SamparkMode;
    /** Why a scheduled or dispatching campaign is not dialling right now; null or missing when it is. */
    holdReason?: CampaignHoldReason | null;
    /**
     * The verified clip keys, frozen when the campaign's audio passed its checks (H4):
     * `${language}|${variant}` → clip kind → key. A call plays exactly what was approved;
     * later edits to the school's settings never change it. Missing on older campaigns.
     */
    clipKeys?: Record<string, Partial<Record<ClipKind, string>>>;
    updatedAt: string;
}

// ── Intents (one per guardian per campaign for class-level purposes) ────────

export type IntentStatus =
    | 'approved'       // waiting for the dispatcher
    | 'dialing'        // claimed by a dispatcher (a call record exists for this attempt)
    | 'retry_wait'     // back off until notBefore
    | 'done'           // terminal: the parent heard the key fact, pressed a key, or attempts exhausted
    | 'blocked'        // terminal: a gate refused it (reason recorded)
    | 'needs_review'   // terminal until a person acts: a call was lost in 'dialing' (never re-dialled)
    | 'expired'
    | 'cancelled';

export type BlockReason =
    | 'no_consent'
    | 'consent_denied'
    | 'suppressed'
    | 'crm_do_not_contact'
    | 'invalid_number'
    | 'language_unknown'
    | 'fee_category_excluded'
    | 'sensitive_flag'
    | 'human_only_purpose'
    | 'frequency_cap'
    | 'mode_forbids_dialing'
    | 'synthetic_number_not_allowed'
    | 'purpose_not_available'
    | 'school_not_enabled'
    // Hardening sprint, 7 Oct 2026 (EDGE_CASES.md §3)
    | 'student_inactive'          // H6: every child on the intent has left the school
    | 'not_guardian_of_record'    // H6: the guardian is no longer of record for any child on the intent
    | 'custody_restricted'        // H8: a child on the intent has a custody restriction; the office informs the family
    | 'test_mode_sample';         // H9: Test mode rings the test phone for one family per language; the rest are not called

export interface Intent {
    /** = hash of dedupeKey. Created with a create-only write (class gate 13). */
    id: string;
    dedupeKey: string;
    orgId: string;
    campaignId: string | null;
    purpose: PurposeId;
    guardianId: string;
    /** Guardian-of-record children this call concerns (bundled siblings share one intent per campaign). */
    studentIds: string[];
    language: ParentLanguage;
    status: IntentStatus;
    blockReason: BlockReason | null;
    attempts: number;
    maxAttempts: number;
    notBefore: string | null;
    expiresAt: string;
    lastCallId: string | null;
    /**
     * Carrier refusals (429, congestion) within the current attempt (H7). They never spend the
     * family's attempt; after MAX_CARRIER_REQUEUES the next refusal does. Reset when an attempt is spent.
     */
    carrierRequeues?: number;
    createdAt: string;
    updatedAt: string;
}

// ── Calls ───────────────────────────────────────────────────────────────────

export type CallState =
    | 'dialing'      // claimed; carrier being contacted
    | 'ringing'
    | 'in_progress'
    | 'completed'    // terminal: answered and ended
    | 'no_answer'    // terminal
    | 'busy'         // terminal
    | 'failed'       // terminal: carrier error
    | 'unknown'      // terminal: lost in 'dialing' past its lease — NEVER re-dialled (class gate 3)
    | 'cancelled';   // terminal

export const TERMINAL_CALL_STATES: readonly CallState[] = [
    'completed', 'no_answer', 'busy', 'failed', 'unknown', 'cancelled',
] as const;

/** How much of the message the listener heard, classified from duration vs audio length (plan §4⑧). */
export type HeardLevel = 'none' | 'early_hangup' | 'partial' | 'full';

export interface CallOutcome {
    heard: HeardLevel;
    /** Every key pressed, in order. */
    digits: string;
    /** Key 1 on a purpose whose menu means "yes/confirm/heard". */
    confirmed: boolean;
    /** Key 2. */
    declined: boolean;
    optOut: 'none' | 'requested' | 'confirmed';
}

export type CarrierKind = 'simulated' | 'vobiz';

/** Who the dialled number belongs to. In test mode every call rings the school's own test phone, never a parent. */
export type CallDestination = 'guardian' | 'test_phone';

export interface SamparkCall {
    /** = hash(intentId, attempt) — one record per attempt, created inside the claim transaction. */
    id: string;
    orgId: string;
    intentId: string;
    campaignId: string | null;
    purpose: PurposeId;
    guardianId: string;
    phoneHash: string;
    phoneLast4: string;
    language: ParentLanguage;
    /** For D4: which audio variant was chosen at dial time. */
    variant: 'default' | 'today' | 'tomorrow';
    attempt: number;
    state: CallState;
    /** A 'dialing' call whose lease has passed is swept to 'unknown', never re-dialled. */
    leaseUntil: string;
    carrier: CarrierKind;
    /** Missing on records written before phase 2a = 'guardian'. */
    destination?: CallDestination;
    /** The id returned when the call was PLACED (Vobiz: request_uuid). */
    providerCallId: string | null;
    /** The id Vobiz reports on the live leg (answer/gather/hangup `CallUUID`); differs from the request id. */
    vobizCallUuid?: string | null;
    /**
     * Set exactly once, when this call's terminal state was applied to its intent, the
     * suppression list and the campaign counts (dispatch/settle.ts). Guards against a
     * retried or duplicated hangup webhook settling twice.
     */
    settledAt?: string | null;
    outcome: CallOutcome;
    /** Seconds from answer to hangup. */
    durationSeconds: number | null;
    /** Carrier-billed seconds (60 s units on Vobiz). */
    billedSeconds: number | null;
    costPaise: number | null;
    /** Length of the audio the parent should have heard, for HeardLevel classification. */
    audioSeconds: number | null;
    createdAt: string;
    updatedAt: string;
    endedAt: string | null;
    failureReason: string | null;
    /** The carrier's raw hangup cause (Q.850 name, upper case), when it sent one (H7). */
    hangupCause?: string | null;
    /** Which carrier requeue of this attempt this dial is: 0 (or missing) = the first (H7). */
    requeue?: number;
}

/** Events a carrier (real webhooks in phase 2, the simulator now) feeds into the call reducer. */
export type CallEvent =
    | { type: 'placed'; at: string; providerCallId: string }
    | { type: 'place_failed'; at: string; reason: string }
    | { type: 'ringing'; at: string }
    | { type: 'answered'; at: string }
    | { type: 'digit'; at: string; digit: string }
    | { type: 'hangup'; at: string; cause: 'completed' | 'no_answer' | 'busy' | 'failed'; durationSeconds: number; billedSeconds: number; hangupCause?: string };

// ── Rendered audio ──────────────────────────────────────────────────────────

/** Named pieces of a notice call. `message` is played inside the keypad gather. */
/** `withdrawn` (H4): played instead of the message when a call is answered after its campaign was cancelled. */
export type ClipKind = 'message' | 'confirm_1' | 'confirm_2' | 'opt_out_confirm' | 'opt_out_done' | 'no_input' | 'fallback_office' | 'withdrawn';

export interface RenderedClip {
    /** Content hash of (engine, voice, language, text) — also the storage key. */
    key: string;
    orgId: string;
    campaignId: string | null;
    purpose: PurposeId;
    language: ParentLanguage;
    variant: 'default' | 'today' | 'tomorrow';
    kind: ClipKind;
    text: string;
    engine: 'gemini-tts' | 'gemini-tts-vertex' | 'chirp3-hd';
    voice: string;
    model: string;
    languageCode: string;
    durationSeconds: number;
    /** Transcribe-back check (plan §4⑥). */
    verification: { status: 'passed' | 'failed' | 'skipped'; transcript: string | null; similarity: number | null; checkedAt: string | null };
    createdAt: string;
}

// ── Console / API DTOs ──────────────────────────────────────────────────────

export interface TodayCallCounts { calls: number; heardKeyFact: number; confirmedYes: number; optOuts: number }

export interface SamparkOverview {
    school: Pick<SamparkSchool, 'orgId' | 'displayName' | 'mode' | 'isDemo' | 'callingWindow'> & {
        crm: CrmConnectionConfig | null;
        /** True when this deployment can place real calls in Test mode (flag + public base URL + carrier config). */
        liveDialAvailable: boolean;
        /** Last four digits of the school's test phone; the full number never leaves the server. */
        testPhoneLast4: string | null;
    };
    windowOpenNow: boolean;
    nextWindowOpensAt: string | null;
    guardians: { total: number; byLanguage: Record<ParentLanguage | 'unknown', number>; withNoticesConsent: number; suppressed: number };
    /** Real calls to families today (Live mode only; always zero in this release). Rehearsals are counted apart (H9). */
    today: TodayCallCounts;
    /** Today's rehearsals: Practice (simulated, nothing rang) and Test (rang only the school's test phone). */
    rehearsal: { practice: TodayCallCounts; test: TodayCallCounts };
    /** Set while the school is paused (H3). */
    pause: SchoolPause | null;
    activeCampaigns: number;
    lastImport: Pick<ImportRun, 'id' | 'status' | 'finishedAt' | 'counts'> | null;
}

/** A rendered preview of what the parent will hear, per language. */
export interface ScriptPreview {
    language: ParentLanguage;
    variant: 'default' | 'today' | 'tomorrow';
    clips: { kind: ClipKind; text: string; audioKey: string | null; durationSeconds: number | null }[];
    /** Estimated spoken seconds of message + menu (must fit the 60 s billing unit, plan §7). */
    estimatedSeconds: number;
    warnings: string[];
}

export interface CallLogEntry extends Pick<SamparkCall,
    'id' | 'campaignId' | 'purpose' | 'language' | 'variant' | 'attempt' | 'state' | 'outcome' |
    'durationSeconds' | 'billedSeconds' | 'costPaise' | 'phoneLast4' | 'createdAt' | 'endedAt' | 'carrier' | 'destination'> {
    guardianDisplayName: string;
    studentDisplayNames: string[];
}
