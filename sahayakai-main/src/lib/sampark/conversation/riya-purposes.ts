/**
 * The Riya workflows: the `call_purpose` values of the hosted ElevenLabs agent, and how each
 * maps onto the Sampark catalogue.
 *
 * Since 4 Nov 2026 the agent is the unified SARGVISION agent ("Riya SARGVISION Unified
 * (Sampark + Athithi Vani)"), which serves two products from one Vobiz number. Its start node
 * routes first on `product_context` and then on `call_purpose`: every Sampark edge is
 * and_operator(product_context == "sampark", call_purpose == …). A call without
 * product_context "sampark" never reaches a school workflow (it lands on the agent's
 * "Context Missing Safe Exit" node), so the ElevenLabs client always sends
 * SAMPARK_PRODUCT_CONTEXT and nothing the caller supplies can change it.
 *
 * A call_purpose that matches no edge leaves the call on the agent's generic Sampark node,
 * so the identifiers below are the wire contract and are pinned by a test against the live
 * agent's edges. A UI label can never reach the wire: the console sends a `RiyaPurpose`,
 * validated by `RiyaPurposeSchema`, and nothing else.
 *
 * Variables: the agent's prompt references nineteen `{{…}}` variables. ElevenLabs
 * refuses to start a conversation whose prompt references a variable the caller did
 * not send (and only twelve of the nineteen have placeholders), so every call sends ALL
 * nineteen: the ones the workflow uses carry verified facts, the rest are the empty
 * string, which the prompt defines as "not provided" (§7 of the agent prompt).
 */

import { z } from 'zod';

import type { OutreachReason } from '@/types/attendance';
import type { PurposeId } from '@/types/sampark';

/**
 * The unified agent's routing key for every Sahayak AI / Sampark call. "athithi" belongs to
 * the Athithi Vani product and is never sent from here.
 */
export const SAMPARK_PRODUCT_CONTEXT = 'sampark' as const;

export const RIYA_PURPOSES = [
    'event_invitation',
    'ptm_invitation',
    'holiday_notice',
    'exam_schedule_notice',
    'absence_notice',
    'emergency_closure',
    'academic_performance',
    'classroom_behaviour',
    'student_achievement',
] as const;

export type RiyaPurpose = (typeof RIYA_PURPOSES)[number];

/**
 * Workflows the agent also routes on, which Sahayak does NOT offer: homework and
 * teacher-support follow-ups speak assignment or support details Sahayak has no record or
 * closed vocabulary for. Never sent as a call_purpose; listed so the contract test knows
 * every edge on the agent.
 */
export const RIYA_AGENT_PURPOSES_NOT_OFFERED = [
    'homework_followup',
    'student_support',
] as const;

/**
 * The four parent-outreach reasons of the attendance / Sampark demo views
 * (`OutreachReason`, src/types/attendance.ts) and the agent workflow each one is spoken
 * through. One reason, one workflow, so a call's reason is always recoverable from its
 * stored `riyaPurpose`.
 */
export const OUTREACH_REASON_PURPOSE: Readonly<Record<OutreachReason, RiyaPurpose>> = Object.freeze({
    consecutive_absences: 'absence_notice',
    poor_performance: 'academic_performance',
    behavioral_concern: 'classroom_behaviour',
    positive_feedback: 'student_achievement',
});

export const OUTREACH_REASONS = Object.keys(OUTREACH_REASON_PURPOSE) as OutreachReason[];

export function outreachReasonForPurpose(purpose: RiyaPurpose): OutreachReason | null {
    return OUTREACH_REASONS.find((r) => OUTREACH_REASON_PURPOSE[r] === purpose) ?? null;
}

export const RiyaPurposeSchema = z.enum(RIYA_PURPOSES);

/**
 * Every `{{variable}}` the agent prompt and workflow nodes reference (unified agent, 4 Nov 2026;
 * unchanged from the 30 Oct Sampark agent). academic_update, behaviour_summary and
 * achievement_details are filled only by their outreach workflows from closed sentences;
 * assignment_details and followup_details belong to RIYA_AGENT_PURPOSES_NOT_OFFERED and are
 * always sent as the empty string, never filled with an invented fact. product_context is not a
 * prompt variable: it only routes, and the ElevenLabs client adds it to every call.
 */
export const RIYA_VARIABLES = [
    'school_name',
    'call_purpose',
    'student_name',
    'class_name',
    'section_name',
    'event_name',
    'event_date',
    'event_time',
    'holiday_dates',
    'exam_schedule',
    'absence_date',
    'closure_date',
    'closure_reason',
    'transport_information',
    'academic_update',
    'behaviour_summary',
    'assignment_details',
    'achievement_details',
    'followup_details',
] as const;

export type RiyaVariable = (typeof RIYA_VARIABLES)[number];

/**
 * The hosted agent's first message, as Sahayak shows it in the preview. Updated 2026-10-19 to the
 * clone's live first message (verifier check 5d, report 2026-10-18), which opens with the AI disclosure. Kept in step with
 * the agent by scripts/sampark/verify-riya-clone.mjs (check 5d), which compares it word for
 * word with the live first message; riya-agent-sync.test.ts keeps the script's copy equal.
 */
export const RIYA_OPENING_TEMPLATE = "Hello, I'm Riya, an AI assistant calling on behalf of {{school_name}} with a school-related update. This conversation is transcribed by our service providers. Is this a good time to talk?";

export function riyaOpening(schoolName: string): string {
    return RIYA_OPENING_TEMPLATE.replace('{{school_name}}', schoolName);
}

export type RiyaVariables = Record<RiyaVariable, string>;

export interface RiyaPurposeSpec {
    id: RiyaPurpose;
    /** The Sampark catalogue purpose whose policy (consent group, emergency, hours, audience) applies. */
    samparkPurpose: PurposeId;
    /** Variables this workflow's node reads besides school_name / call_purpose / student_name. */
    factVariables: readonly RiyaVariable[];
    /** Variables that must be non-empty or the call is refused (never sent with a gap Riya would have to explain). */
    requiredVariables: readonly RiyaVariable[];
    /**
     * Rollout risk, for the console and the default allow-list:
     *   low    — class-wide fact, nothing about the child beyond the name (PTM, holidays, events)
     *   medium — a fact typed by staff with no system of record behind it yet (exam schedule)
     *   high   — child-specific sensitive fact or emergency handling (absence, closure)
     */
    risk: 'low' | 'medium' | 'high';
}

const SPECS: Record<RiyaPurpose, RiyaPurposeSpec> = {
    event_invitation: {
        id: 'event_invitation',
        samparkPurpose: 'event_invite',
        factVariables: ['event_name', 'event_date', 'event_time'],
        requiredVariables: ['event_name', 'event_date', 'event_time'],
        risk: 'low',
    },
    ptm_invitation: {
        id: 'ptm_invitation',
        samparkPurpose: 'ptm_invite',
        // The PTM node reads the meeting's date and time from event_date / event_time.
        factVariables: ['class_name', 'section_name', 'event_date', 'event_time'],
        requiredVariables: ['class_name', 'section_name', 'event_date', 'event_time'],
        risk: 'low',
    },
    holiday_notice: {
        id: 'holiday_notice',
        samparkPurpose: 'holiday_notice',
        factVariables: ['holiday_dates'],
        requiredVariables: ['holiday_dates'],
        risk: 'low',
    },
    exam_schedule_notice: {
        id: 'exam_schedule_notice',
        samparkPurpose: 'exam_notice',
        factVariables: ['exam_schedule'],
        requiredVariables: ['exam_schedule'],
        risk: 'medium',
    },
    absence_notice: {
        id: 'absence_notice',
        samparkPurpose: 'absence_today',
        factVariables: ['absence_date'],
        requiredVariables: ['absence_date'],
        risk: 'high',
    },
    emergency_closure: {
        id: 'emergency_closure',
        samparkPurpose: 'emergency_closure',
        // transport_information is optional: empty means "say you do not have transport details".
        factVariables: ['closure_date', 'closure_reason', 'transport_information'],
        requiredVariables: ['closure_date', 'closure_reason'],
        risk: 'high',
    },
    // The three outreach workflows speak a child-specific observation. It is assembled from the
    // closed phrases below (never staff free text) and goes through the same consent, quiet-hours
    // and frequency gate as every Riya call, under the catalogue's request-to-talk purposes.
    academic_performance: {
        id: 'academic_performance',
        samparkPurpose: 'academic_talk',
        factVariables: ['academic_update'],
        requiredVariables: ['academic_update'],
        risk: 'high',
    },
    classroom_behaviour: {
        id: 'classroom_behaviour',
        samparkPurpose: 'conduct_talk',
        factVariables: ['behaviour_summary'],
        requiredVariables: ['behaviour_summary'],
        risk: 'high',
    },
    student_achievement: {
        id: 'student_achievement',
        samparkPurpose: 'recognition',
        factVariables: ['achievement_details'],
        requiredVariables: ['achievement_details'],
        risk: 'medium',
    },
};

export function riyaPurposeSpec(id: RiyaPurpose): RiyaPurposeSpec {
    const spec = SPECS[id];
    if (!spec) throw new Error(`Unknown Riya purpose: ${String(id)}`);
    return spec;
}

/**
 * Workflows enabled for this deployment: SAMPARK_RIYA_PURPOSES, a comma-separated
 * allow-list of RiyaPurpose ids. Unset → PTM only (the first, lowest-risk workflow);
 * unknown ids are ignored, never guessed. Expanding is a config change reviewed per
 * workflow after it passes its end-to-end checks.
 */
export const DEFAULT_RIYA_PURPOSES: readonly RiyaPurpose[] = ['ptm_invitation'];

export function enabledRiyaPurposes(env: Record<string, string | undefined> = process.env): RiyaPurpose[] {
    const raw = env.SAMPARK_RIYA_PURPOSES?.trim();
    if (!raw) return [...DEFAULT_RIYA_PURPOSES];
    const wanted = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
    return RIYA_PURPOSES.filter((p) => wanted.has(p));
}

export function emptyRiyaVariables(purpose: RiyaPurpose): RiyaVariables {
    const out = Object.fromEntries(RIYA_VARIABLES.map((v) => [v, ''])) as RiyaVariables;
    out.call_purpose = purpose;
    return out;
}

// ── Closed fact vocabularies (shared with the console, so no server code is bundled) ──

export const EVENT_TYPES = ['annual_day', 'sports_day', 'science_fair', 'cultural_programme', 'parent_workshop'] as const;
export const CLOSURE_REASONS = ['rain_landslide', 'heavy_rain', 'bandh', 'local_emergency'] as const;

/**
 * Exam subjects Riya may name. Closed, so a typo or a sentence cannot reach the agent;
 * a school that needs another subject adds it here in a reviewed change.
 */
export const EXAM_SUBJECTS = {
    english: 'English',
    hindi: 'Hindi',
    bengali: 'Bengali',
    nepali: 'Nepali',
    sanskrit: 'Sanskrit',
    mathematics: 'Mathematics',
    science: 'Science',
    social_science: 'Social Science',
    evs: 'Environmental Studies',
    computer_science: 'Computer Science',
    physics: 'Physics',
    chemistry: 'Chemistry',
    biology: 'Biology',
    history: 'History',
    geography: 'Geography',
    political_science: 'Political Science',
    economics: 'Economics',
    accountancy: 'Accountancy',
    business_studies: 'Business Studies',
    general_knowledge: 'General Knowledge',
} as const;
export type ExamSubject = keyof typeof EXAM_SUBJECTS;

/**
 * What a poor-performance outreach call may say about the named subjects. Closed, reviewed
 * English sentences: `{subjects}` is replaced by the EXAM_SUBJECTS names ("Mathematics and
 * Science"); nothing else is inserted.
 */
export const ACADEMIC_CONCERNS = {
    below_expected: "Your child's recent work in {subjects} has been below the expected level.",
    marks_dropped: "Your child's recent marks in {subjects} have dropped compared with earlier in the term.",
    missed_assessments: 'Your child has missed recent tests or assignments in {subjects}.',
} as const;
export type AcademicConcern = keyof typeof ACADEMIC_CONCERNS;
export const MAX_ACADEMIC_SUBJECTS = 3;

/** Classroom observations a behaviour outreach call may share; each completes "Your child …". */
export const BEHAVIOUR_OBSERVATIONS = {
    attention: 'has been having difficulty paying attention in class',
    disturbing_others: 'has been disturbing other students during lessons',
    incomplete_classwork: 'has not been completing classwork in class',
    low_participation: 'has been taking less part in class activities',
    late_to_class: 'has been arriving late to class',
} as const;
export type BehaviourObservation = keyof typeof BEHAVIOUR_OBSERVATIONS;
export const MAX_BEHAVIOUR_OBSERVATIONS = 3;

/**
 * What a positive-feedback call may celebrate. `{subject}` marks the ones that name a subject
 * (an EXAM_SUBJECTS name); the others take none.
 */
export const ACHIEVEMENTS = {
    top_marks: 'Your child scored among the highest marks in the class in {subject}.',
    great_improvement: 'Your child has shown excellent improvement in {subject}.',
    active_participation: 'Your child has been taking a very active part in class activities.',
    helpful_to_classmates: 'Your child has been very helpful and kind to classmates.',
    full_attendance: 'Your child has had excellent attendance this term.',
} as const;
export type Achievement = keyof typeof ACHIEVEMENTS;

export function achievementNeedsSubject(a: Achievement): boolean {
    return ACHIEVEMENTS[a].includes('{subject}');
}
