/**
 * Class-wide outreach reasons: which announcements may go to a whole class as one batch of
 * individual Riya calls, and which agent workflow speaks each one. Client-safe (no server code).
 *
 * A batch reason is a GENERIC class announcement: the same fact for every family (a holiday, a
 * closure, an exam date, an event, a general PTM day). Each parent still gets their own call, with
 * their own child's name filled from school records, but nothing child-specific is said.
 *
 * Child-specific conversations (absence, academic performance, behaviour, achievement, and a
 * personalised PTM slot per parent) are NEVER batchable: they stay on the individual call page.
 * `INDIVIDUAL_ONLY_PURPOSES` is enforced on the server as well as hidden in the UI.
 *
 * Reasons the school asked for that the Riya agent has no workflow for yet (timetable change,
 * homework reminder, policy reminder, other) are listed as unavailable: inventing their wording
 * would mean free text reaching a parent, which Sampark never allows.
 */

import { RIYA_PURPOSES, type RiyaPurpose } from '@/lib/sampark/conversation/riya-purposes';

export const BATCH_REASON_IDS = [
    'holiday_announcement',
    'school_closure',
    'exam_reminder',
    'school_event',
    'ptm_general',
    'timetable_change',
    'homework_reminder',
    'policy_reminder',
    'other_class_communication',
] as const;
export type BatchReasonId = (typeof BATCH_REASON_IDS)[number];

export interface BatchReason {
    id: BatchReasonId;
    /** The Riya workflow that speaks it, or null when the agent has no workflow for it yet. */
    purpose: RiyaPurpose | null;
    /** English label (translated in the UI through t()). */
    label: string;
    /** One line for the reason picker. */
    hint: string;
}

export const BATCH_REASONS: readonly BatchReason[] = [
    { id: 'holiday_announcement', purpose: 'holiday_notice', label: 'Holiday announcement', hint: 'Holidays already on the school calendar.' },
    { id: 'school_closure', purpose: 'emergency_closure', label: 'School closure', hint: 'The school is closed on a day, with the reason and bus information.' },
    { id: 'exam_reminder', purpose: 'exam_schedule_notice', label: 'Exam reminder', hint: 'Exam subjects, dates and times for the class.' },
    { id: 'school_event', purpose: 'event_invitation', label: 'School event announcement', hint: 'An event for all parents (annual day, sports day, …).' },
    { id: 'ptm_general', purpose: 'ptm_invitation', label: 'Parent-teacher meeting (general announcement)', hint: 'One date and time for the whole class. Individual PTM slots are booked per parent instead.' },
    { id: 'timetable_change', purpose: null, label: 'Timetable change', hint: 'Riya has no approved wording for this yet.' },
    { id: 'homework_reminder', purpose: null, label: 'Homework or assignment reminder', hint: 'Riya has no approved wording for this yet.' },
    { id: 'policy_reminder', purpose: null, label: 'Attendance or school-policy reminder', hint: 'Riya has no approved wording for this yet.' },
    { id: 'other_class_communication', purpose: null, label: 'Other class-wide communication', hint: 'Riya has no approved wording for this yet.' },
];

/**
 * Workflows that speak about ONE child (or need a different fact per parent). Never batched,
 * whatever a request says: they continue through the individual Riya call.
 */
export const INDIVIDUAL_ONLY_PURPOSES: readonly RiyaPurpose[] = ['absence_notice', 'academic_performance', 'classroom_behaviour', 'student_achievement'];

export const BATCH_PURPOSES: readonly RiyaPurpose[] = RIYA_PURPOSES.filter((p) => !INDIVIDUAL_ONLY_PURPOSES.includes(p));

export function isBatchablePurpose(p: RiyaPurpose): boolean {
    return BATCH_PURPOSES.includes(p);
}

export function batchReason(id: BatchReasonId): BatchReason {
    const r = BATCH_REASONS.find((x) => x.id === id);
    if (!r) throw new Error(`Unknown batch reason: ${String(id)}`);
    return r;
}

/** The class a batch addresses: grade + section, as stored on Sampark student records. */
export function classKey(grade: number, section: string): string {
    return `${grade}-${section}`;
}

export function classLabel(grade: number, section: string): string {
    return `Class ${grade}${section}`;
}
