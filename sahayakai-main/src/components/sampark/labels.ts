/**
 * Plain-language labels for Sampark codes.
 *
 * Every label is a literal quoted-string call to t() so the i18n key scanner
 * (scripts/find-missing-i18n-keys.mjs) sees it and the ten locale files carry
 * a translation. Server codes never reach the screen raw: an unknown code
 * falls back to the code itself only as a last resort.
 */
import { purposeSpec } from '@/lib/sampark/catalogue';
import type {
    BlockReason,
    CallLogEntry,
    CallState,
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
    Suppression,
} from '@/types/sampark';

export type Translate = (key: string) => string;

/** Replace `{name}` placeholders in an already-translated template. */
export function fmt(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in vars ? String(vars[name]) : whole,
    );
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

// ── Purposes ─────────────────────────────────────────────────────────────────

export function purposeLabel(t: Translate, id: PurposeId): string {
    switch (id) {
        case 'ptm_invite': return t("PTM invitation");
        case 'event_invite': return t("Event invitation");
        case 'emergency_closure': return t("Emergency closure");
        case 'attendance_talk': return t("Request to talk: attendance");
        case 'absence_today': return t("Same-day absence");
        case 'academic_talk': return t("Request to talk: progress");
        case 'conduct_talk': return t("Request to talk: conduct");
        case 'recognition': return t("Good news about a child");
        case 'fee_due': return t("Fee due soon");
        case 'fee_overdue': return t("Fee overdue");
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
        case 'fee_category_excluded': return t("Not sent to RTE, fee-waived, scholarship or staff-ward families");
        case 'sensitive_flag': return t("A sensitive flag on the child stops automated calls");
        case 'human_only_purpose': return t("A member of staff must make this call");
        case 'frequency_cap': return t("Already called four times in the last 30 days");
        case 'mode_forbids_dialing': return t("The current mode does not allow calls");
        case 'caller_id_not_ready': return t("The school's calling number is not set up for real calls");
        case 'synthetic_number_not_allowed': return t("A test number, reachable only in Practice mode");
        case 'purpose_not_available': return t("This kind of call is not available yet");
        case 'school_not_enabled': return t("School calls are not switched on for this school");
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

export function clipKindLabel(t: Translate, kind: ClipKind): string {
    switch (kind) {
        case 'message': return t("Message");
        case 'confirm_1': return t("After the parent presses 1");
        case 'confirm_2': return t("After the parent presses 2");
        case 'opt_out_confirm': return t("After the parent presses 9");
        case 'opt_out_done': return t("After the parent confirms stopping calls");
        case 'no_input': return t("If no key is pressed");
        case 'fallback_office': return t("If something goes wrong");
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

export function modeBannerText(t: Translate, mode: SamparkMode): string {
    switch (mode) {
        case 'practice': return t("Practice — no real calls are made");
        case 'test': return t("Test — every call goes to the school test phone");
        case 'live': return t("Live — families receive real calls");
        default: return mode;
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

export function entityLabel(t: Translate, entity: 'student' | 'guardian' | 'consent'): string {
    if (entity === 'consent') return t("Consent");
    return entity === 'student' ? t("Student") : t("Guardian");
}

// ── Server error codes ───────────────────────────────────────────────────────

/** Turn a server `{ error }` code into words; plain messages pass through. */
export function serverErrorText(t: Translate, message: string): string {
    switch (message) {
        case 'LIVE_DIAL_DISABLED': return t("Only Practice mode is available until the phase 2 approvals are in place.");
        default: return message;
    }
}


// ── Slice 2: rules, roles and approvals ──────────────────────────────────────

export type RuleLabelId = 'attendance_talk' | 'absence_today' | 'academic_talk' | 'conduct_talk' | 'recognition' | 'fee_due' | 'fee_overdue';

/** What makes a rule fire, in the school's words. Shown beside the thresholds the school adopts. */
export function ruleDescription(t: Translate, id: RuleLabelId): string {
    switch (id) {
        case 'attendance_talk': return t("A child is absent for several school days in a row, or attendance for the session falls below a set percentage.");
        case 'absence_today': return t("A child is marked absent by 10 am with no leave note. Only after the class teacher confirms that no message came through.");
        case 'academic_talk': return t("The average of at least two assessments is low, or results fall across at least two assessments. Never one test, and a missed test is never scored as zero.");
        case 'conduct_talk': return t("At least two concern notes in two weeks, at least one from a teacher. Notes from other staff can support but never start this.");
        case 'recognition': return t("At least two positive notes from at least two people in two weeks, or a move up a level on the progress card.");
        case 'fee_due': return t("A fee is due within a set number of days. The amount is only said after the parent confirms they are the child's parent.");
        case 'fee_overdue': return t("A fee is overdue. At most two automated calls per fee; after that the accounts officer takes over.");
        default: return '';
    }
}

export function roleLabel(t: Translate, role: string): string {
    switch (role) {
        case 'principal': return t("Principal");
        case 'coordinator': return t("Coordinator");
        case 'class_teacher': return t("Class teacher");
        case 'accounts': return t("Accounts");
        case 'transport': return t("Transport desk");
        case 'office': return t("Office");
        case 'counsellor': return t("Counsellor");
        default: return role;
    }
}

export const ASSIGNABLE_ROLE_IDS = ['principal', 'coordinator', 'class_teacher', 'accounts', 'transport', 'office', 'counsellor'] as const;

export function thresholdLabel(t: Translate, key: string): string {
    switch (key) {
        case 'minConsecutiveAbsentDays': return t("School days in a row absent");
        case 'minSessionDaysElapsed': return t("School days before the attendance percentage counts");
        case 'sessionAttendancePercentBelow': return t("Attendance below (%)");
        case 'absentByHour': return t("Absent by (hour, IST)");
        case 'latestProposalHour': return t("Latest hour to propose (IST)");
        case 'minAssessments': return t("Assessments averaged");
        case 'averagePercentBelow': return t("Average below (%)");
        case 'dropAssessments': return t("Successive falling assessments");
        case 'minTotalDropPoints': return t("Total fall (percentage points)");
        case 'windowDays': return t("Window (days)");
        case 'minConcernNotes': return t("Concern notes needed");
        case 'minPositiveNotes': return t("Positive notes needed");
        case 'minRespondents': return t("Different people needed");
        case 'rubricLevelUp': return t("Also count a move up a level on the card");
        case 'autoApprove': return t("Approve without a person");
        case 'reproposalCooldownDays': return t("Wait before proposing the same child again");
        case 'daysBeforeDue': return t("Days before the due date");
        case 'overdueAfterDays': return t("Days overdue before the first call");
        case 'stopAfterDays': return t("Days overdue before the accounts officer takes over");
        default: return key;
    }
}

export type ProposalStatusLabelId = 'pending' | 'approved' | 'dismissed' | 'handled_by_person' | 'needs_attention' | 'expired';

export function proposalStatusLabel(t: Translate, status: ProposalStatusLabelId): string {
    switch (status) {
        case 'pending': return t("Waiting for you");
        case 'approved': return t("Approved");
        case 'dismissed': return t("Not now");
        case 'handled_by_person': return t("A person is calling");
        case 'needs_attention': return t("Needs a person");
        case 'expired': return t("Expired");
        default: return status;
    }
}

export function proposalStatusTone(status: ProposalStatusLabelId): Tone {
    switch (status) {
        case 'pending': return 'info';
        case 'approved': return 'success';
        case 'needs_attention': return 'warning';
        default: return 'neutral';
    }
}

export function pageReasonLabel(t: Translate, reason: 'parent_said_did_not_know' | 'no_answer'): string {
    return reason === 'parent_said_did_not_know'
        ? t("The parent pressed 2: they did not know the child was absent")
        : t("Nobody answered the call about the absence");
}
