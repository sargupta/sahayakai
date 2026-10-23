import { z } from 'zod';
import { SUBJECTS } from '@/types';

/**
 * Public contract of the Sahayak Parent Calling MCP.
 *
 * Mirrors the app's attendance "Contact" flow (see docs/mcp/calling/CODEX_CALLING_AUDIT.md).
 * There is deliberately NO phone-number input anywhere: Sahayak only ever
 * dials the parent number stored on the student record, exactly like the app.
 * Classes and students are addressed by their Sahayak ids, which a school
 * gets from `list_parent_contacts`.
 */

export const OUTREACH_REASONS = ['consecutive_absences', 'poor_performance', 'behavioral_concern', 'positive_feedback'] as const;

const sahayakId = (what: string) => z.string({ required_error: `Missing ${what}.` })
    .trim()
    .min(1, `Missing ${what}.`)
    .max(128, `Invalid ${what}.`)
    .regex(/^[A-Za-z0-9_-]+$/, `Invalid ${what}.`);

export const ListParentContactsInput = z.object({
    class_id: sahayakId('class_id').optional()
        .describe('Only this class. Omit to list every class of the school\'s teachers.'),
}).strict();
export type ListParentContactsInput = z.infer<typeof ListParentContactsInput>;

export const ParentContactsResult = z.object({
    classes: z.array(z.object({
        class_id: z.string(),
        name: z.string(),
        subject: z.string().nullable(),
        grade: z.string().nullable(),
        students: z.array(z.object({
            student_id: z.string(),
            name: z.string(),
            roll_number: z.number().nullable(),
            parent_language: z.string().nullable(),
            parent_reachable: z.boolean().describe('Whether a parent phone number is on record.'),
            parent_phone_last4: z.string().describe('Last 4 digits only, to recognise the contact. The full number is never returned.'),
        })),
    })),
});
export type ParentContactsResult = z.infer<typeof ParentContactsResult>;

export const InitiateParentCallInput = z.object({
    class_id: sahayakId('class_id').describe('Sahayak class id (from list_parent_contacts).'),
    student_id: sahayakId('student_id').describe('Sahayak student id (from list_parent_contacts).'),
    reason: z.enum(OUTREACH_REASONS, {
        errorMap: () => ({ message: `Invalid reason. Use one of: ${OUTREACH_REASONS.join(', ')}.` }),
    }).describe('Why the school is calling the parent.'),
    teacher_note: z.string().trim().max(500, 'teacher_note must be at most 500 characters.').optional()
        .describe('Optional context for the message, e.g. "Missed the science test on Monday".'),
    subject: z.enum(SUBJECTS, {
        errorMap: () => ({ message: 'Unsupported subject.' }),
    }).optional().describe('Subject the call is about. Defaults to the class subject.'),
}).strict();
export type InitiateParentCallInput = z.infer<typeof InitiateParentCallInput>;

export const ParentCallResult = z.object({
    status: z.literal('call_initiated').describe('The phone provider accepted the call; the parent\'s phone is now ringing.'),
    student_name: z.string(),
    class_name: z.string(),
    reason: z.enum(OUTREACH_REASONS),
    parent_language: z.string(),
    parent_phone_last4: z.string(),
    message: z.string().describe('The message the call delivers, as written for the parent.'),
    spoken_script: z.string().nullable().describe('The phone rendition actually spoken, when Sahayak produced one.'),
});
export type ParentCallResult = z.infer<typeof ParentCallResult>;
