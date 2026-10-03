/**
 * The CRM signals the rules read (plan §3, §4②): attendance, holistic-card
 * entries, assessments, meeting requests, incidents and fee dues, per student.
 *
 * ASSUMPTION about the CRM data shape (flagged for the founder): this mirrors
 * the mock CRM's v1 draft endpoints (`/v1/hpc/entries`, `/v1/attendance`,
 * `/v1/assessments`, `/v1/meetings`, `/v1/incidents`). The real school's ERP
 * will differ; the adapter that fills a CrmSignals is the only place that
 * changes. FEE DUES are not served by the mock CRM at all yet: `FeeDue` is the
 * shape the rules need, filled from fixtures until a real export exists.
 *
 * Confidentiality (plan §2E): hpc entries from nurse and counsellor carry a
 * reason code and `note: null`. The schema below REFUSES a confidential entry
 * that carries note text, so confidential words can never reach a rule or the
 * approver's screen even if a CRM mis-sends them.
 */

import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const isoDateTime = z.string().datetime({ offset: true });

export const CONFIDENTIAL_RESPONDENT_TYPES = ['nurse', 'counsellor'] as const;
/** Respondents whose concern notes may TRIGGER a conduct request (plan §2A A4). */
export const TEACHING_RESPONDENT_TYPES = ['teacher', 'coordinator'] as const;
/** Non-teaching staff: their notes may SUPPORT a trigger, never cause one. */
export const SUPPORT_RESPONDENT_TYPES = ['bus_attendant', 'coach', 'librarian'] as const;

export const AttendanceMarkSchema = z.object({
    studentId: z.string().min(1),
    date: isoDate,
    status: z.enum(['present', 'absent', 'late', 'on_leave']),
    /** A written leave note reached the class teacher. */
    leaveNote: z.boolean(),
    markedAt: isoDateTime.optional(),
});
export type AttendanceMark = z.infer<typeof AttendanceMarkSchema>;

export const HpcNoteSchema = z
    .object({
        id: z.string().min(1),
        studentId: z.string().min(1),
        observedOn: isoDate,
        respondentType: z.string().min(1),
        sentiment: z.enum(['positive', 'neutral', 'concern']),
        /** Short note; null for self/peer/parent and for confidential roles. */
        note: z.string().max(280).nullable(),
        confidential: z.boolean(),
        reasonCode: z.string().nullable(),
        unitId: z.string().nullable(),
        ability: z.string().nullable(),
        rubric: z.object({ level: z.number().int().min(1).max(3), label: z.string() }).nullable(),
    })
    .superRefine((e, ctx) => {
        if ((e.confidential || (CONFIDENTIAL_RESPONDENT_TYPES as readonly string[]).includes(e.respondentType)) && e.note !== null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'confidential entries carry a reason code, never note text', path: ['note'] });
        }
    });
export type HpcNote = z.infer<typeof HpcNoteSchema>;

export const AssessmentScoreSchema = z.object({
    studentId: z.string().min(1),
    assessmentId: z.string().min(1),
    assessmentName: z.string().min(1),
    subjectId: z.string().min(1),
    date: isoDate,
    maxMarks: z.number().positive(),
    /** Null when the student did not sit the test: a missed test is never scored as zero. */
    marks: z.number().min(0).nullable(),
    status: z.enum(['scored', 'absent', 'exempt']),
});
export type AssessmentScore = z.infer<typeof AssessmentScoreSchema>;

export const MeetingRequestSignalSchema = z.object({
    studentId: z.string().min(1),
    reasonCode: z.string().min(1),
    status: z.enum(['requested', 'scheduled', 'completed', 'cancelled']),
});
export type MeetingRequestSignal = z.infer<typeof MeetingRequestSignalSchema>;

export const IncidentSignalSchema = z.object({
    studentId: z.string().min(1),
    reasonCode: z.string().min(1),
    severity: z.enum(['low', 'medium', 'high']),
    status: z.enum(['open', 'closed']),
});
export type IncidentSignal = z.infer<typeof IncidentSignalSchema>;

export const FeeDueSchema = z.object({
    id: z.string().min(1),
    studentId: z.string().min(1),
    /** e.g. "second instalment" (informational for the approver). */
    label: z.string().optional(),
    dueDate: isoDate,
    /** Whole rupees. */
    amountRupees: z.number().int().positive(),
    status: z.enum(['open', 'paid', 'waived']),
});
export type FeeDue = z.infer<typeof FeeDueSchema>;

export const CrmSignalsSchema = z.object({
    attendance: z.array(AttendanceMarkSchema),
    hpc: z.array(HpcNoteSchema),
    assessments: z.array(AssessmentScoreSchema),
    meetings: z.array(MeetingRequestSignalSchema),
    incidents: z.array(IncidentSignalSchema),
    feeDues: z.array(FeeDueSchema),
});
export type CrmSignals = z.infer<typeof CrmSignalsSchema>;

export function emptySignals(): CrmSignals {
    return { attendance: [], hpc: [], assessments: [], meetings: [], incidents: [], feeDues: [] };
}

/**
 * Notes a rule may read: nurse and counsellor entries, confidential entries, and
 * anything without a recognised respondent are removed BEFORE any rule runs
 * (plan §2E "Nurse and counsellor notes are excluded from every rule").
 */
export function usableNotes(notes: readonly HpcNote[]): HpcNote[] {
    const allowed: readonly string[] = [...TEACHING_RESPONDENT_TYPES, ...SUPPORT_RESPONDENT_TYPES];
    return notes.filter((n) => !n.confidential && allowed.includes(n.respondentType));
}

/** Whole days from `from` to `to` (YYYY-MM-DD, calendar arithmetic). */
export function daysBetween(from: string, to: string): number {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}
