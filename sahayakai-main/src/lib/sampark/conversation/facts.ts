/**
 * Riya facts → the agent's dynamic variables.
 *
 * Every fact is TYPED (dates, whole/half-hour times, closed enums). No free text a
 * staff member types ever reaches the agent: the words Riya hears are produced here
 * by the same reviewed Indian-English speller the notice calls use
 * (src/lib/sampark/scripts/spoken.ts, locales/call-scripts/english.json). The agent
 * is English-only (prompt §5), so every phrase is rendered in English.
 *
 * Who and which school are NEVER taken from the request: `school_name` comes from the
 * school's reviewed spoken name, `student_name` / `class_name` / `section_name` from
 * the Sampark student record the server resolved. The demonstration values in the
 * export (DPS Siliguri, Samuel Jackson, …) are never used: the builder starts from
 * empty strings and a required value that cannot be filled refuses the call.
 */

import { z } from 'zod';

import { addDays, istDate } from '@/lib/sampark/policy/ist';
import { callScripts } from '@/lib/sampark/scripts/templates';
import { formatDate, formatTime, parseCalendarDate } from '@/lib/sampark/scripts/spoken';
import { ScriptRenderError } from '@/lib/sampark/scripts/types';
import type { ClosureReason, EventType, SamparkSchool, SamparkStudent, SpokenTime } from '@/types/sampark';

import {
    CLOSURE_REASONS,
    EVENT_TYPES,
    EXAM_SUBJECTS,
    emptyRiyaVariables,
    type ExamSubject,
    riyaPurposeSpec,
    type RiyaPurpose,
    type RiyaVariable,
    type RiyaVariables,
} from './riya-purposes';

// ── Schemas ─────────────────────────────────────────────────────────────────

const IsoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
    .refine((s) => {
        try {
            parseCalendarDate(s);
            return true;
        } catch {
            return false;
        }
    }, 'not a real date');

/** Same bounds as the campaign facts (06:00–19:30, whole or half hours): every accepted time is sayable. */
const SpokenTimeSchema = z
    .object({
        hour: z.number().int().min(6, 'time must be between 06:00 and 19:30').max(19, 'time must be between 06:00 and 19:30'),
        minute: z.union([z.literal(0), z.literal(30)], { errorMap: () => ({ message: 'minute must be 0 or 30' }) }),
    })
    .strict();

const EXAM_SUBJECT_IDS = Object.keys(EXAM_SUBJECTS) as [ExamSubject, ...ExamSubject[]];

export { CLOSURE_REASONS, EVENT_TYPES, EXAM_SUBJECTS, type ExamSubject };

export const MAX_HOLIDAY_DATES = 14;
export const MAX_EXAM_ENTRIES = 8;
/** An absence call is about a recent school day only. */
export const ABSENCE_LOOKBACK_DAYS = 3;
/** A closure is announced at most a week ahead. */
export const CLOSURE_LOOKAHEAD_DAYS = 7;

export const RiyaFactsSchema = z.discriminatedUnion('purpose', [
    z.object({ purpose: z.literal('ptm_invitation'), date: IsoDate, time: SpokenTimeSchema }).strict(),
    z.object({ purpose: z.literal('event_invitation'), eventType: z.enum(EVENT_TYPES), date: IsoDate, time: SpokenTimeSchema }).strict(),
    z.object({ purpose: z.literal('holiday_notice'), dates: z.array(IsoDate).min(1).max(MAX_HOLIDAY_DATES) }).strict(),
    z
        .object({
            purpose: z.literal('exam_schedule_notice'),
            entries: z
                .array(z.object({ subject: z.enum(EXAM_SUBJECT_IDS), date: IsoDate, time: SpokenTimeSchema.nullable() }).strict())
                .min(1)
                .max(MAX_EXAM_ENTRIES),
        })
        .strict(),
    z.object({ purpose: z.literal('absence_notice'), date: IsoDate }).strict(),
    z
        .object({
            purpose: z.literal('emergency_closure'),
            date: IsoDate,
            reason: z.enum(CLOSURE_REASONS),
            /** Null = the school has not said; Riya then says she has no transport details. */
            busesRunning: z.boolean().nullable(),
        })
        .strict(),
]);

export type RiyaFacts = z.infer<typeof RiyaFactsSchema>;

// ── Builder ─────────────────────────────────────────────────────────────────

export type RiyaFactProblem =
    | { code: 'MISSING_VALUE'; variable: RiyaVariable }
    | { code: 'DATE_IN_PAST'; date: string }
    | { code: 'DATE_TOO_FAR'; date: string }
    | { code: 'NOT_A_SCHOOL_HOLIDAY'; date: string }
    | { code: 'ABSENCE_DATE_OUT_OF_RANGE'; date: string }
    | { code: 'UNSAYABLE'; detail: string }
    | { code: 'PURPOSE_MISMATCH' };

export type RiyaBuildResult =
    | { ok: true; variables: RiyaVariables; announcement: string }
    | { ok: false; problems: RiyaFactProblem[] };

export interface RiyaBuildInput {
    purpose: RiyaPurpose;
    facts: RiyaFacts;
    school: Pick<SamparkSchool, 'spokenName' | 'holidays'>;
    student: Pick<SamparkStudent, 'spokenFirstName' | 'grade' | 'section'>;
    now: Date;
}

const ENGLISH = 'English' as const;

function gradeWord(grade: number): string {
    return callScripts(ENGLISH).lexicon.grade.gradeWords[String(grade)] ?? '';
}

function sectionWord(section: string): string {
    return callScripts(ENGLISH).lexicon.sectionLetters[String(section ?? '').trim().toUpperCase()] ?? '';
}

function eventName(t: EventType): string {
    return callScripts(ENGLISH).names.eventTypes[t] ?? '';
}

function closureReason(r: ClosureReason): string {
    return callScripts(ENGLISH).names.closureReasons[r] ?? '';
}

function busesLine(running: boolean | null): string {
    if (running === null) return '';
    const buses = callScripts(ENGLISH).purposes.emergency_closure?.buses as { running?: string; notRunning?: string } | undefined;
    return (running ? buses?.running : buses?.notRunning) ?? '';
}

/** "Monday, the nineteenth of October to Wednesday, the twenty-first of October" for a run, else a list. */
export function spokenDateList(dates: readonly string[]): string {
    const sorted = [...new Set(dates)].sort();
    if (sorted.length === 0) return '';
    if (sorted.length === 1) return formatDate(sorted[0], ENGLISH);
    const consecutive = sorted.every((d, i) => i === 0 || addDays(sorted[i - 1], 1) === d);
    if (consecutive) return `${formatDate(sorted[0], ENGLISH)} to ${formatDate(sorted[sorted.length - 1], ENGLISH)}`;
    const words = sorted.map((d) => formatDate(d, ENGLISH));
    return `${words.slice(0, -1).join('; ')}; and ${words[words.length - 1]}`;
}

function examSchedule(entries: { subject: ExamSubject; date: string; time: SpokenTime | null }[]): string {
    const sorted = [...entries].sort((a, b) => (a.date === b.date ? (a.time?.hour ?? 0) - (b.time?.hour ?? 0) : a.date < b.date ? -1 : 1));
    return sorted
        .map((e) => `${EXAM_SUBJECTS[e.subject]} on ${formatDate(e.date, ENGLISH)}${e.time ? `, at ${formatTime(e.time, ENGLISH)}` : ''}`)
        .join('; ');
}

/**
 * The line Riya says once the listener has confirmed they are the parent or guardian,
 * mirroring each workflow node's wording, so staff review exactly what will be said.
 */
function announcementFor(purpose: RiyaPurpose, v: RiyaVariables): string {
    switch (purpose) {
        case 'event_invitation':
            return `I'm calling to let you know about ${v.event_name} on ${v.event_date} at ${v.event_time}.`;
        case 'ptm_invitation':
            return `I'm calling to invite you to the parent-teacher meeting for your child's class, ${v.class_name}, section ${v.section_name}, on ${v.event_date} at ${v.event_time}.`;
        case 'holiday_notice':
            return `I'm calling to inform you that the school holiday dates are ${v.holiday_dates}.`;
        case 'exam_schedule_notice':
            return `I'm calling to share the upcoming exam schedule for your child: ${v.exam_schedule}.`;
        case 'absence_notice':
            return `Your child was marked absent on ${v.absence_date}. Is your child with you right now?`;
        case 'emergency_closure':
            return `I'm calling to inform you that the school will be closed on ${v.closure_date} due to ${v.closure_reason}.${v.transport_information ? ` ${v.transport_information}` : ''}`;
    }
}

export function buildRiyaVariables(input: RiyaBuildInput): RiyaBuildResult {
    const { purpose, facts, school, student, now } = input;
    if (facts.purpose !== purpose) return { ok: false, problems: [{ code: 'PURPOSE_MISMATCH' }] };

    const problems: RiyaFactProblem[] = [];
    const today = istDate(now);
    const v = emptyRiyaVariables(purpose);

    v.school_name = school.spokenName?.English?.trim() ?? '';
    v.student_name = student.spokenFirstName?.English?.trim() ?? '';

    const futureDate = (date: string) => {
        if (date < today) problems.push({ code: 'DATE_IN_PAST', date });
    };

    try {
        switch (facts.purpose) {
            case 'ptm_invitation':
                futureDate(facts.date);
                v.class_name = gradeWord(student.grade);
                v.section_name = sectionWord(student.section);
                v.event_date = formatDate(facts.date, ENGLISH);
                v.event_time = formatTime(facts.time, ENGLISH);
                break;
            case 'event_invitation':
                futureDate(facts.date);
                v.event_name = eventName(facts.eventType);
                v.event_date = formatDate(facts.date, ENGLISH);
                v.event_time = formatTime(facts.time, ENGLISH);
                break;
            case 'holiday_notice': {
                const known = new Set(school.holidays ?? []);
                for (const d of facts.dates) {
                    futureDate(d);
                    // Only dates already on the school calendar (manual or CRM holidays) can be announced.
                    if (!known.has(d)) problems.push({ code: 'NOT_A_SCHOOL_HOLIDAY', date: d });
                }
                v.holiday_dates = spokenDateList(facts.dates);
                break;
            }
            case 'exam_schedule_notice':
                for (const e of facts.entries) futureDate(e.date);
                v.exam_schedule = examSchedule(facts.entries);
                break;
            case 'absence_notice':
                if (facts.date > today || facts.date < addDays(today, -ABSENCE_LOOKBACK_DAYS)) {
                    problems.push({ code: 'ABSENCE_DATE_OUT_OF_RANGE', date: facts.date });
                }
                v.absence_date = formatDate(facts.date, ENGLISH);
                break;
            case 'emergency_closure':
                futureDate(facts.date);
                if (facts.date > addDays(today, CLOSURE_LOOKAHEAD_DAYS)) problems.push({ code: 'DATE_TOO_FAR', date: facts.date });
                v.closure_date = formatDate(facts.date, ENGLISH);
                v.closure_reason = closureReason(facts.reason);
                v.transport_information = busesLine(facts.busesRunning);
                break;
        }
    } catch (err) {
        if (err instanceof ScriptRenderError) problems.push({ code: 'UNSAYABLE', detail: err.message });
        else throw err;
    }

    const spec = riyaPurposeSpec(purpose);
    for (const name of ['school_name', 'student_name', ...spec.requiredVariables] as RiyaVariable[]) {
        if (!v[name] || v[name].trim() === '') problems.push({ code: 'MISSING_VALUE', variable: name });
    }
    // No unresolved template text may ever reach the agent.
    for (const [name, value] of Object.entries(v)) {
        if (/[{}]/.test(value)) problems.push({ code: 'UNSAYABLE', detail: `${name} contains a brace` });
    }

    if (problems.length > 0) return { ok: false, problems };
    return { ok: true, variables: v, announcement: announcementFor(purpose, v) };
}
