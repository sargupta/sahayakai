/**
 * Slice 2 domain types: adopted rules, proposals, approvals, pages.
 *
 * Plan §2A, §2C, §4③⑤. A RULE is a pure function over CRM signals; it ships
 * OFF; a school ADOPTS it in writing with its thresholds (an immutable
 * Adoption record); each firing becomes a PROPOSAL carrying its evidence; a
 * person with the right ROLE approves it; only then does an intent exist.
 */

import type { Approver, PurposeId, SamparkRole } from '@/types/sampark';

/** A rule is identified by the purpose it proposes — one rule per purpose in slice 2. */
export const RULE_IDS = [
    'attendance_talk', // A1
    'absence_today',   // A2
    'academic_talk',   // A3
    'conduct_talk',    // A4
    'recognition',     // A5
    'fee_due',         // C1
    'fee_overdue',     // C2
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export function isRuleId(value: unknown): value is RuleId {
    return typeof value === 'string' && (RULE_IDS as readonly string[]).includes(value);
}

/** Concern purposes: requests to talk about a child's difficulties. Never state the concern, never Fri/Sat (plan §2A). */
export const CONCERN_PURPOSES: readonly PurposeId[] = ['attendance_talk', 'academic_talk', 'conduct_talk'];

export interface SectionRef {
    grade: number;
    section: string;
}

// ── Roles (plan §8) ─────────────────────────────────────────────────────────

export interface RoleAssignment {
    orgId: string;
    uid: string;
    role: SamparkRole;
    /** class_teacher only: the sections this person approves for. */
    sections: SectionRef[];
    displayName: string;
    grantedBy: string;
    grantedAt: string;
}

// ── Adoption (plan §2A "Rules ship switched off", §6) ───────────────────────

export interface AttendanceThresholds {
    /** Consecutive school days absent that triggers A1 (plan: >= 3). */
    minConsecutiveAbsentDays: number;
    /** Session attendance only counts once this many marked school days have elapsed. */
    minSessionDaysElapsed: number;
    /** Session attendance below this percentage triggers A1 (plan: 75). */
    sessionAttendancePercentBelow: number;
}
export interface AcademicThresholds {
    /** Scored assessments averaged for the "below" test (plan: >= 2). */
    minAssessments: number;
    averagePercentBelow: number;
    /** Successive assessments that must each fall for "sustained drop" (plan: >= 2 drops). */
    dropAssessments: number;
    minTotalDropPoints: number;
}
export interface ConductThresholds {
    windowDays: number;
    minConcernNotes: number;
}
export interface RecognitionThresholds {
    windowDays: number;
    minPositiveNotes: number;
    minRespondents: number;
    rubricLevelUp: boolean;
    /** The school opts in to approving recognition calls without a person (plan §2A A5). */
    autoApprove: boolean;
}
export interface AbsenceTodayThresholds {
    /** Absent by this IST hour with no leave note (plan: 10:00). */
    absentByHour: number;
    /** No same-day proposals after this IST hour: a "same day" call at night helps nobody. */
    latestProposalHour: number;
}
export interface FeeDueThresholds {
    /** Propose when the due date is within this many days (plan: 7). */
    daysBeforeDue: number;
}
export interface FeeOverdueThresholds {
    overdueAfterDays: number;
    /** Beyond this many days overdue the matter is for the accounts officer (C3), not a machine. */
    stopAfterDays: number;
}

export interface ThresholdsByRule {
    attendance_talk: AttendanceThresholds;
    absence_today: AbsenceTodayThresholds;
    academic_talk: AcademicThresholds;
    conduct_talk: ConductThresholds;
    recognition: RecognitionThresholds;
    fee_due: FeeDueThresholds;
    fee_overdue: FeeOverdueThresholds;
}
export type ThresholdsOf<R extends RuleId> = ThresholdsByRule[R];

/** Immutable. A change of thresholds, or a withdrawal, is a NEW record with the next version. */
export interface Adoption<R extends RuleId = RuleId> {
    id: string;
    orgId: string;
    ruleId: R;
    version: number;
    status: 'adopted' | 'withdrawn';
    thresholds: ThresholdsOf<R>;
    adoptedBy: string;
    adopterName: string;
    /** The wording the adopter agreed to; the version is kept so the record proves what they saw. */
    statementVersion: string;
    adoptedAt: string;
}

export const ADOPTION_STATEMENT_V1 =
    'On behalf of the school, I adopt this rule with these thresholds. The school decides to use it, ' +
    'it will only ever propose a call for a person to approve, and the school may withdraw it at any time.';

// ── Proposals ───────────────────────────────────────────────────────────────

export interface EvidenceItem {
    kind: 'attendance' | 'assessment' | 'note' | 'rubric' | 'fee' | 'summary';
    /** YYYY-MM-DD the evidence is about, if any. */
    date: string | null;
    /** For the approver only — never spoken to the parent. Confidential (nurse/counsellor) text never appears here. */
    text: string;
    /** Who observed it, for notes ("teacher", "bus_attendant"). */
    source?: string;
}

export type ProposalStatus =
    | 'pending'            // waiting for the approver
    | 'approved'           // intents created
    | 'dismissed'          // "Not now": never resurrected
    | 'handled_by_person'  // "I'll call myself"
    | 'needs_attention'    // approved but could not be turned into calls (e.g. no reviewed spoken name); a person must act
    | 'expired';

export interface FeeFacts {
    kind: 'fee';
    dueId: string;
    amountRupees: number;
    /** YYYY-MM-DD */
    dueDate: string;
}
export type ProposalFacts = FeeFacts | null;

export interface Proposal {
    /** = hash of dedupeKey; created create-only so a dismissed proposal can never come back. */
    id: string;
    dedupeKey: string;
    orgId: string;
    purpose: RuleId;
    studentId: string;
    section: SectionRef;
    /** What the script may state (fees only); concern purposes carry none. */
    facts: ProposalFacts;
    /** Plain-language one-liner for the approver. */
    summary: string;
    evidence: EvidenceItem[];
    approverRole: Approver;
    /** E.g. "No class teacher is assigned to 7B; routed to the principal." */
    routingNote: string | null;
    /** True when an open meeting request already exists for this child and reason (a person already knows). */
    alreadyKnown: boolean;
    status: ProposalStatus;
    /** Earliest dial time (IST-aware, never Fri/Sat for concern purposes). Null = as soon as the window allows. */
    notBefore: string | null;
    expiresAt: string;
    adoptionVersion: number;
    thresholds: Record<string, unknown>;
    decidedBy: string | null;
    decidedAt: string | null;
    decisionNote: string | null;
    intentIds: string[];
    createdAt: string;
    updatedAt: string;
}

/** What a rule emits; the service stamps ids, routing and times. */
export type ProposalDraft = Pick<
    Proposal,
    'dedupeKey' | 'purpose' | 'studentId' | 'section' | 'facts' | 'summary' | 'evidence' | 'alreadyKnown' | 'expiresAt'
> & {
    /** A2 only: the class teacher's one-tap confirmation is itself the approval. */
    preApprovedBy?: string;
};

// ── Exclusions: plain reasons for every child a rule did not propose ────────

export type ExclusionCode =
    | 'sensitive_flag'
    | 'counsellor_involved'
    | 'open_wellbeing_matter'
    | 'fee_category_excluded'
    | 'left_school'
    | 'awaiting_class_confirmation'
    | 'fee_call_budget_spent'
    | 'fee_amount_not_sayable'
    | 'fee_waived_due';

export interface ExcludedChild {
    studentId: string;
    purpose: RuleId;
    code: ExclusionCode;
    /** Plain English for the approver/principal; never a note, never a diagnosis. */
    plain: string;
}

// ── A2 confirmation and paging ──────────────────────────────────────────────

export interface ClassConfirmation {
    id: string;
    orgId: string;
    /** YYYY-MM-DD (IST) */
    date: string;
    grade: number;
    section: string;
    confirmedBy: string;
    confirmedAt: string;
}

export type PageReason = 'parent_said_did_not_know' | 'no_answer';

/** A page to a named person (plan §2A A2): a task, not a call. */
export interface Page {
    id: string;
    orgId: string;
    proposalId: string | null;
    callId: string;
    studentId: string;
    reason: PageReason;
    targets: ('class_teacher' | 'principal')[];
    status: 'open' | 'acknowledged';
    acknowledgedBy: string | null;
    createdAt: string;
    updatedAt: string;
}
