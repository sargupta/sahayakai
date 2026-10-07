/**
 * Plain-language labels for Sampark codes.
 *
 * Every label is a literal quoted-string call to t() so the i18n key scanner
 * (scripts/find-missing-i18n-keys.mjs) sees it and the ten locale files carry
 * a translation. Server codes never reach the screen raw: an unknown code
 * falls back to the code itself only as a last resort.
 */
import { purposeSpec } from '@/lib/sampark/catalogue';
import { callOutcomeClass } from '@/lib/sampark/call-outcome';
import type { SamparkSchoolView } from '@/lib/api/sampark';
import type {
    BlockReason,
    CallLogEntry,
    CallOutcomeClass,
    CallState,
    Campaign,
    CampaignHoldReason,
    CampaignStatus,
    ClipKind,
    ClosureReason,
    ConsentGroup,
    ConsentStatus,
    EventType,
    HeardLevel,
    ImportRun,
    ParentLanguage,
    PhoneClass,
    PurposeId,
    SamparkGuardian,
    SamparkMode,
    SchoolPause,
    Suppression,
} from '@/types/sampark';

export type Translate = (key: string) => string;

/** Replace `{name}` placeholders in an already-translated template. */
export function fmt(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in vars ? String(vars[name]) : whole,
    );
}

/** `brand` is the saffron of a call in progress; every other tone is a status token. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

// ── Purposes ─────────────────────────────────────────────────────────────────

export function purposeLabel(t: Translate, id: PurposeId): string {
    switch (id) {
        case 'ptm_invite': return t("PTM invitation");
        case 'event_invite': return t("Event invitation");
        case 'emergency_closure': return t("Emergency closure");
        default: return id;
    }
}

export function purposeDescription(t: Translate, id: PurposeId): string {
    switch (id) {
        case 'ptm_invite':
            return t("Invite families to a parent-teacher meeting. No child is named. Parents press 1 if they will come and 2 if the time does not suit them.");
        case 'event_invite':
            return t("Invite families to a school event such as Annual Day or Sports Day. No child is named. Parents press 1 if they will come and 2 if they cannot.");
        case 'emergency_closure':
            return t("Tell families the school is closed today or tomorrow because of rain, a landslide or a bandh. Calls may start at 6 am and stop at the end of the closure day.");
        default:
            return '';
    }
}

// ── Campaigns ────────────────────────────────────────────────────────────────

export function campaignStatusLabel(t: Translate, status: CampaignStatus): string {
    switch (status) {
        case 'draft': return t("Draft");
        case 'rendering': return t("Preparing audio");
        case 'render_failed': return t("Audio check failed");
        case 'scheduled': return t("Scheduled");
        case 'dispatching': return t("Calling");
        case 'completed': return t("Completed");
        case 'cancelled': return t("Cancelled");
        default: return status;
    }
}

export function campaignStatusTone(status: CampaignStatus): Tone {
    switch (status) {
        case 'draft': return 'neutral';
        case 'rendering':
        case 'scheduled':
        case 'dispatching': return 'info';
        case 'completed': return 'success';
        case 'render_failed': return 'danger';
        case 'cancelled': return 'neutral';
        default: return 'neutral';
    }
}

/**
 * Why a campaign is not calling right now, in a principal's words (H2, H3), with what
 * to do about it. `campaign.mode` is the mode it was approved for.
 */
export function holdReasonText(t: Translate, reason: CampaignHoldReason, campaign: Pick<Campaign, 'mode'>): string {
    switch (reason) {
        case 'mode_changed':
            return campaign.mode
                ? fmt(t("On hold: the school's mode has changed since this campaign was approved for {mode}. Switch back to that mode to continue, or cancel the campaign and create a new one."), { mode: modeLabel(t, campaign.mode) })
                : t("On hold: the school's mode has changed since this campaign was approved. Cancel the campaign and create a new one.");
        case 'school_paused':
            return t("On hold: school calls are paused. The campaign continues when calls are resumed.");
        case 'mode_not_pinned':
            return t("On hold: this campaign was approved before this version of school calls, so it does not record which mode it was approved for. Cancel it and create it again to send it.");
        default:
            return reason;
    }
}

/**
 * The hold to show for a campaign that is still meant to be calling: the one the
 * dispatcher recorded, or — between a pause and the dispatcher's next pass — the
 * school's pause, so the page never says "Calling" while nothing can ring.
 */
export function effectiveHoldReason(
    campaign: Pick<Campaign, 'status' | 'purpose' | 'holdReason'>,
    pause: SchoolPause | null | undefined,
): CampaignHoldReason | null {
    if (!HOLDABLE_CAMPAIGN_STATUSES.includes(campaign.status)) return null;
    if (campaign.holdReason) return campaign.holdReason;
    return pauseApplies(pause, campaign.purpose) ? 'school_paused' : null;
}

/** Statuses in which the dispatcher dials a campaign, and so can hold it. */
export const HOLDABLE_CAMPAIGN_STATUSES: readonly CampaignStatus[] = ['scheduled', 'dispatching'];

/** Whether a school pause stops this purpose: every purpose for scope 'all', all but emergency closures for 'routine'. */
export function pauseApplies(pause: SchoolPause | null | undefined, purpose: PurposeId): boolean {
    if (!pause) return false;
    return pause.scope === 'all' || purpose !== 'emergency_closure';
}

export function pauseScopeLabel(t: Translate, scope: SchoolPause['scope']): string {
    return scope === 'all' ? t("All calls, including emergency closures") : t("Everything except emergency closures");
}

/** Statuses in which the campaign is still moving and the page should refresh itself. */
export const LIVE_CAMPAIGN_STATUSES: readonly CampaignStatus[] = ['rendering', 'scheduled', 'dispatching'];

/** Statuses from which a campaign may still be cancelled. */
export const CANCELLABLE_CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
    'draft', 'rendering', 'render_failed', 'scheduled', 'dispatching',
];

export function eventTypeLabel(t: Translate, type: EventType): string {
    switch (type) {
        case 'annual_day': return t("Annual Day");
        case 'sports_day': return t("Sports Day");
        case 'science_fair': return t("Science Fair");
        case 'cultural_programme': return t("Cultural programme");
        case 'parent_workshop': return t("Parent workshop");
        default: return type;
    }
}

export const EVENT_TYPES: readonly EventType[] = [
    'annual_day', 'sports_day', 'science_fair', 'cultural_programme', 'parent_workshop',
];

export function closureReasonLabel(t: Translate, reason: ClosureReason): string {
    switch (reason) {
        case 'rain_landslide': return t("Rain and landslide risk");
        case 'heavy_rain': return t("Heavy rain");
        case 'bandh': return t("Bandh (strike)");
        case 'local_emergency': return t("Local emergency");
        default: return reason;
    }
}

export const CLOSURE_REASONS: readonly ClosureReason[] = ['rain_landslide', 'heavy_rain', 'bandh', 'local_emergency'];

// ── Blocked families ─────────────────────────────────────────────────────────

export function blockReasonLabel(t: Translate, reason: BlockReason): string {
    switch (reason) {
        case 'no_consent': return t("No consent recorded for recorded notices");
        case 'consent_denied': return t("The family said no to recorded notices");
        case 'suppressed': return t("The family asked the school to stop these calls");
        case 'crm_do_not_contact': return t("Marked do-not-contact in the school records");
        case 'invalid_number': return t("The phone number is not valid");
        case 'language_unknown': return t("No language recorded, and the school asks families first");
        case 'fee_category_excluded': return t("Not sent to RTE or fee-waived families");
        case 'sensitive_flag': return t("A sensitive flag on the child stops automated calls");
        case 'human_only_purpose': return t("A member of staff must make this call");
        case 'frequency_cap': return t("Already called four times in the last 30 days");
        case 'mode_forbids_dialing': return t("The current mode does not allow calls");
        case 'synthetic_number_not_allowed': return t("A test number, reachable only in Practice mode");
        case 'purpose_not_available': return t("This kind of call is not available yet");
        case 'school_not_enabled': return t("School calls are not switched on for this school");
        case 'student_inactive': return t("The child has left the school");
        case 'not_guardian_of_record': return t("No longer the child's guardian in the school records");
        case 'custody_restricted': return t("A custody restriction on the child: the office informs this family by hand");
        case 'test_mode_sample': return t("Test mode: only one family per language rings the test phone");
        default: return reason;
    }
}

// ── Calls ────────────────────────────────────────────────────────────────────

export function callStateLabel(t: Translate, state: CallState): string {
    switch (state) {
        case 'dialing': return t("Dialling");
        case 'ringing': return t("Ringing");
        case 'in_progress': return t("In progress");
        case 'completed': return t("Answered");
        case 'no_answer': return t("No answer");
        case 'busy': return t("Busy");
        case 'failed': return t("Could not connect");
        case 'unknown': return t("Result lost");
        case 'cancelled': return t("Cancelled");
        default: return state;
    }
}

export function callStateMeaning(t: Translate, state: CallState): string {
    switch (state) {
        case 'dialing': return t("The call is being placed.");
        case 'ringing': return t("The phone is ringing.");
        case 'in_progress': return t("The family is on the line.");
        case 'completed': return t("The family picked up and the call ended normally.");
        case 'no_answer': return t("The phone rang but nobody picked up.");
        case 'busy': return t("The line was busy.");
        case 'failed': return t("The call could not be placed.");
        case 'unknown': return t("The result of this call was lost. It is never retried automatically, so check with the family.");
        case 'cancelled': return t("The campaign was cancelled before this call was made.");
        default: return '';
    }
}

export function callStateTone(state: CallState): Tone {
    switch (state) {
        case 'completed': return 'success';
        case 'dialing':
        case 'ringing':
        case 'in_progress': return 'info';
        case 'no_answer':
        case 'busy': return 'warning';
        case 'failed':
        case 'unknown': return 'danger';
        default: return 'neutral';
    }
}

export function heardLabel(t: Translate, heard: HeardLevel): string {
    switch (heard) {
        case 'none': return t("Not heard");
        case 'early_hangup': return t("Hung up early");
        case 'partial': return t("Heard part");
        case 'full': return t("Heard in full");
        default: return heard;
    }
}

export function heardMeaning(t: Translate, heard: HeardLevel): string {
    switch (heard) {
        case 'none': return t("The family did not hear the message.");
        case 'early_hangup': return t("The family hung up before the key fact.");
        case 'partial': return t("The family heard part of the message.");
        case 'full': return t("The family heard the whole message.");
        default: return '';
    }
}

export function heardTone(heard: HeardLevel): Tone {
    switch (heard) {
        case 'full': return 'success';
        case 'partial': return 'info';
        case 'early_hangup': return 'warning';
        default: return 'neutral';
    }
}

export const HEARD_LEVELS: readonly HeardLevel[] = ['full', 'partial', 'early_hangup', 'none'];

/** What the family answered, in words, using the purpose's own key menu. Null when nothing was pressed. */
export function outcomeLabel(t: Translate, entry: Pick<CallLogEntry, 'purpose' | 'outcome'>): { label: string; tone: Tone } | null {
    const { outcome } = entry;
    if (outcome.optOut === 'confirmed') return { label: t("Stopped these calls (pressed 9 twice)"), tone: 'warning' };
    if (outcome.optOut === 'requested') return { label: t("Asked to stop calls, not confirmed"), tone: 'warning' };
    let key1: string | null = null;
    try {
        key1 = purposeSpec(entry.purpose).menu?.key1 ?? null;
    } catch {
        key1 = null;
    }
    if (outcome.confirmed) {
        return key1 === 'heard'
            ? { label: t("Confirmed they heard (pressed 1)"), tone: 'success' }
            : { label: t("Will come (pressed 1)"), tone: 'success' };
    }
    if (outcome.declined) return { label: t("Cannot come (pressed 2)"), tone: 'neutral' };
    return null;
}

/**
 * One short phrase for how a call ended (CallOutcomeClass), in the purpose's own words
 * for keys 1, 2 and 9, and the call's own state for calls that did not connect.
 */
export function outcomeClassLabel(t: Translate, call: Pick<CallLogEntry, 'purpose' | 'state' | 'outcome'>): string {
    const cls = callOutcomeClass(call);
    switch (cls) {
        case 'on_call': return t("On a call now");
        case 'opted_out':
        case 'confirmed':
        case 'declined': return outcomeLabel(t, call)?.label ?? t("Heard the key fact");
        case 'heard': return t("Heard the key fact");
        case 'hung_up': return heardLabel(t, call.outcome.heard);
        case 'no_answer':
        case 'failed': return callStateLabel(t, call.state);
        default: return cls;
    }
}

export function outcomeClassTone(cls: CallOutcomeClass): Tone {
    switch (cls) {
        case 'on_call': return 'brand';
        case 'confirmed': return 'success';
        case 'declined': return 'warning';
        case 'heard': return 'info';
        case 'opted_out':
        case 'failed': return 'danger';
        default: return 'neutral';
    }
}

export function clipKindLabel(t: Translate, kind: ClipKind): string {
    switch (kind) {
        case 'message': return t("Message");
        case 'confirm_1': return t("After the parent presses 1");
        case 'confirm_2': return t("After the parent presses 2");
        case 'opt_out_confirm': return t("After the parent presses 9");
        case 'opt_out_done': return t("After the parent confirms stopping calls");
        case 'no_input': return t("If no key is pressed");
        case 'fallback_office': return t("If something goes wrong");
        case 'withdrawn': return t("If the campaign was cancelled before the family answered");
        default: return kind;
    }
}

export function variantLabel(t: Translate, variant: 'default' | 'today' | 'tomorrow'): string {
    switch (variant) {
        case 'today': return t("If the closure is today");
        case 'tomorrow': return t("If the closure is tomorrow");
        default: return '';
    }
}

// ── Families ─────────────────────────────────────────────────────────────────

export function relationLabel(t: Translate, relation: SamparkGuardian['relation']): string {
    switch (relation) {
        case 'mother': return t("Mother");
        case 'father': return t("Father");
        case 'guardian': return t("Guardian");
        case 'other': return t("Other");
        default: return relation;
    }
}

export const CONSENT_GROUPS: readonly ConsentGroup[] = ['notices', 'progress', 'recorded_conversation', 'hpc_input'];

export function consentGroupLabel(t: Translate, group: ConsentGroup): string {
    switch (group) {
        case 'notices': return t("Recorded notices");
        case 'progress': return t("Progress calls");
        case 'recorded_conversation': return t("Recorded conversations");
        case 'hpc_input': return t("Holistic card input");
        default: return group;
    }
}

export function consentStatusLabel(t: Translate, status: ConsentStatus): string {
    switch (status) {
        case 'granted': return t("Granted");
        case 'denied': return t("Denied");
        case 'unknown': return t("Not recorded");
        default: return status;
    }
}

export function consentTone(status: ConsentStatus): Tone {
    switch (status) {
        case 'granted': return 'success';
        case 'denied': return 'danger';
        default: return 'neutral';
    }
}

export function phoneClassLabel(t: Translate, phoneClass: PhoneClass): string {
    switch (phoneClass) {
        case 'mobile': return t("Mobile");
        case 'synthetic': return t("Test number");
        case 'invalid': return t("Invalid number");
        default: return phoneClass;
    }
}

export function suppressionScopeLabel(t: Translate, scope: Suppression['scope']): string {
    return scope === 'all' ? t("All calls stopped") : t("Routine calls stopped");
}

export function suppressionSourceLabel(t: Translate, source: Suppression['source']): string {
    switch (source) {
        case 'keypad': return t("Keypad, confirmed");
        case 'keypad_unconfirmed': return t("Keypad, not confirmed");
        case 'office': return t("School office");
        case 'crm': return t("School records");
        case 'carrier_invalid_number': return t("The phone company says this number is not in use");
        default: return source;
    }
}

export function suppressionVerificationLabel(t: Translate, v: Suppression['officeVerification']): string {
    switch (v) {
        case 'pending': return t("Office to confirm with the family");
        case 'confirmed': return t("Confirmed with the family");
        case 'reversed': return t("Reversed");
        default: return v;
    }
}

// ── Languages ────────────────────────────────────────────────────────────────

/** The parent language's name in the teacher's UI language. */
export function languageName(t: Translate, language: ParentLanguage | 'unknown' | null): string {
    switch (language) {
        case 'English': return t("English");
        case 'Hindi': return t("Hindi");
        case 'Bengali': return t("Bengali");
        case 'Nepali': return t("Nepali");
        default: return t("Not recorded");
    }
}

// ── Mode ─────────────────────────────────────────────────────────────────────

export function modeLabel(t: Translate, mode: SamparkMode): string {
    switch (mode) {
        case 'practice': return t("Practice — no calls");
        case 'test': return t("Test — my phone only");
        case 'live': return t("Live — parents");
        default: return mode;
    }
}

/** The banner's headline. In Test mode it names the phone that rings (last four digits only). */
export function modeBannerText(t: Translate, mode: SamparkMode, testPhoneLast4?: string | null): string {
    switch (mode) {
        case 'practice': return t("Practice — no real calls are made");
        case 'test':
            return testPhoneLast4
                ? fmt(t("Test — every call rings only the phone ending {last4}"), { last4: testPhoneLast4 })
                : t("Test — every call goes to the school test phone");
        case 'live': return t("Live — families receive real calls");
        default: return mode;
    }
}

/**
 * Why this deployment cannot place Test-mode calls, in a principal's words.
 * These are facts about how SahayakAI is set up, not school settings, so each
 * one says who can change it.
 */
export function liveDialBlockerText(t: Translate, blocker: NonNullable<SamparkSchoolView['liveDialBlocker']>): string {
    switch (blocker) {
        case 'LIVE_DIAL_DISABLED':
            return t("Real calls have not been switched on yet. Your SahayakAI contact switches them on when your school is ready to test.");
        case 'PUBLIC_BASE_URL_MISSING':
            return t("The phone company cannot reach SahayakAI yet, so a call could not play the message or record key presses. Your SahayakAI contact will set this up.");
        case 'CARRIER_UNCONFIGURED':
            return t("The phone line that places school calls has not been set up yet. Your SahayakAI contact will set this up.");
        default:
            return t("Test mode is not available yet.");
    }
}

export function modeDescription(t: Translate, mode: SamparkMode): string {
    switch (mode) {
        case 'practice':
            return t("Calls are simulated. No phone rings, and the results appear in the call log so you can see how a campaign would go.");
        case 'test':
            return t("Every call rings only the school test phone, so you hear exactly what parents will hear.");
        case 'live':
            return t("Families receive real calls from the school number.");
        default:
            return '';
    }
}

// ── Imports ──────────────────────────────────────────────────────────────────

export function importStatusLabel(t: Translate, status: ImportRun['status']): string {
    switch (status) {
        case 'running': return t("Importing");
        case 'succeeded': return t("Imported");
        case 'failed': return t("Import failed");
        default: return status;
    }
}

export function importStatusTone(status: ImportRun['status']): Tone {
    switch (status) {
        case 'running': return 'info';
        case 'succeeded': return 'success';
        case 'failed': return 'danger';
        default: return 'neutral';
    }
}

export function entityLabel(t: Translate, entity: 'student' | 'guardian'): string {
    return entity === 'student' ? t("Student") : t("Guardian");
}

// ── Server error codes ───────────────────────────────────────────────────────

/** Turn a server `{ error }` code into words; plain messages pass through. */
export function serverErrorText(t: Translate, message: string): string {
    switch (message) {
        case 'LIVE_DIAL_DISABLED':
        case 'PUBLIC_BASE_URL_MISSING':
        case 'CARRIER_UNCONFIGURED':
            return liveDialBlockerText(t, message);
        case 'TEST_PHONE_MISSING': return t("Save a test phone first. In Test mode every call rings that phone.");
        case 'TEST_PHONE_INVALID': return t("Enter an Indian mobile number: 10 digits starting with 6, 7, 8 or 9.");
        case 'LIVE_MODE_NOT_AVAILABLE': return t("Live mode, calling families, is not available yet.");
        default: return message;
    }
}
