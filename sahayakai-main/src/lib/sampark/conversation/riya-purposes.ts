/**
 * The Riya workflows: the six `call_purpose` values of the hosted ElevenLabs agent
 * "Riya School Calling Assistant" (Varunesh's export, 15 Oct 2026), and how each maps
 * onto the Sampark catalogue.
 *
 * The agent routes on `call_purpose` with six exact string-equality edges out of its
 * start node (workflow.edges[*].forward_condition: eq_operator(dynamic_variable
 * call_purpose, string_literal …)). A value that matches no edge leaves the call on
 * the start node with only the generic prompt, so the identifiers below are the wire
 * contract and are pinned by a test against the export's edge labels. A UI label can
 * never reach the wire: the console sends a `RiyaPurpose`, validated by
 * `RiyaPurposeSchema`, and nothing else.
 *
 * Variables: the agent's prompt references fourteen `{{…}}` variables. ElevenLabs
 * refuses to start a conversation whose prompt references a variable the caller did
 * not send (and only ten of the fourteen have placeholders), so every call sends ALL
 * fourteen: the ones the workflow uses carry verified facts, the rest are the empty
 * string, which the prompt defines as "not provided" (§7 of the agent prompt).
 */

import { z } from 'zod';

import type { PurposeId } from '@/types/sampark';

export const RIYA_PURPOSES = [
    'event_invitation',
    'ptm_invitation',
    'holiday_notice',
    'exam_schedule_notice',
    'absence_notice',
    'emergency_closure',
] as const;

export type RiyaPurpose = (typeof RIYA_PURPOSES)[number];

export const RiyaPurposeSchema = z.enum(RIYA_PURPOSES);

/** Every `{{variable}}` the agent prompt and workflow nodes reference (export of 15 Oct 2026). */
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
] as const;

export type RiyaVariable = (typeof RIYA_VARIABLES)[number];

/**
 * The hosted agent's first message, as Sahayak shows it in the preview. Kept in step with
 * the agent by scripts/sampark/verify-riya-clone.mjs (check 5d), which compares it word for
 * word with the live first message; riya-agent-sync.test.ts keeps the script's copy equal.
 */
export const RIYA_OPENING_TEMPLATE = 'Hello, this is Riya, calling from {{school_name}}, with an important update. Is this a good time to talk?';

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
