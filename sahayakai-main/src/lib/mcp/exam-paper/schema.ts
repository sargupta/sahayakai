import { z } from 'zod';
import { EDUCATION_BOARDS } from '@/types';
import { gradeField, languageField } from '../shared/schema';

/**
 * Public contract of the `create_exam_paper` MCP tool.
 *
 * Every field maps onto an option the EXISTING Sahayak exam-paper service
 * supports (see ./service.ts). Nothing here is a new capability: there is no
 * "exam type" in the service, so a short unit test is expressed with
 * `max_marks` / `duration_minutes` / `chapters`. Inputs are strict: unknown
 * fields (e.g. a client-supplied org/tenant id) are rejected.
 */

export const EXAM_DIFFICULTY_VALUES = ['easy', 'moderate', 'hard', 'mixed', 'medium'] as const;
export const EXAM_DIFFICULTY_ALIASES = { medium: 'moderate' } as const;

export const CreateExamPaperInput = z.object({
    board: z.enum(EDUCATION_BOARDS, {
        errorMap: () => ({ message: 'Unsupported board. Use "CBSE", "ICSE / ISC" or one of the Indian state boards Sahayak lists (e.g. "Karnataka State Board (KSEEB)").' }),
    }).default('CBSE')
        .describe('Exam board whose paper pattern to follow. Default "CBSE". Blueprint-accurate patterns exist for CBSE Class 9–10; other boards follow the board style from the syllabus.'),
    grade: gradeField('School grade / class (Indian "Class 1"–"Class 12").'),
    subject: z.string({ required_error: 'Missing subject, e.g. "Science" or "Mathematics".' })
        .trim().min(2, 'Subject is too short.').max(60, 'Subject is too long.')
        .describe('Subject, e.g. "Science", "Mathematics", "Social Science".'),
    chapters: z.array(
        z.string().trim().min(2, 'Each chapter needs at least 2 characters.').max(150, 'Each chapter must be at most 150 characters.'),
    ).max(20, 'At most 20 chapters per paper.').default([])
        .describe('Chapters to cover, e.g. ["Force and Pressure"]. Omit or [] for the whole syllabus — only possible where Sahayak has the board blueprint or NCERT syllabus for that grade and subject; otherwise list chapters.'),
    difficulty: z.enum(EXAM_DIFFICULTY_VALUES, {
        errorMap: () => ({ message: 'Invalid difficulty. Use "easy", "moderate", "hard" or "mixed" ("medium" is accepted as "moderate").' }),
    }).default('mixed')
        .describe('Overall difficulty. "mixed" (default) follows the board distribution; "medium" is accepted as "moderate".'),
    language: languageField('the paper'),
    max_marks: z.number().int('max_marks must be a whole number.').min(5, 'max_marks must be between 5 and 100.').max(100, 'max_marks must be between 5 and 100.').optional()
        .describe('Total marks, 5–100 (e.g. 20 for a unit test, 80 for a CBSE board paper). Defaults to the board blueprint.'),
    duration_minutes: z.number().int('duration_minutes must be a whole number.').min(10, 'duration_minutes must be between 10 and 180.').max(180, 'duration_minutes must be between 10 and 180.').optional()
        .describe('Exam duration in minutes, 10–180. Defaults to the board blueprint.'),
    pyq_percent: z.number().min(0, 'pyq_percent must be between 0 and 100.').max(100, 'pyq_percent must be between 0 and 100.').optional()
        .describe('Target share (0–100) of previous-year (PYQ) style questions; the rest are new. Omit for Sahayak\'s default mix.'),
    include_answer_key: z.boolean().default(true).describe('Include answers / model answers. Default true.'),
    include_marking_scheme: z.boolean().default(true).describe('Include step-wise marking schemes. Default true.'),
}).strict();

export type CreateExamPaperInput = z.infer<typeof CreateExamPaperInput>;

const Question = z.object({
    number: z.number(),
    text: z.string(),
    marks: z.number(),
    origin: z.enum(['previous_year', 'new']).describe('previous_year = adapted from a past board paper; new = freshly written.'),
    source_note: z.string().nullable().describe('e.g. "PYQ 2023 Set 1" for previous-year questions.'),
    options: z.array(z.string()).describe('MCQ options "(a) …"–"(d) …"; empty for non-MCQ.'),
    correct_option: z.string().nullable().describe('MCQ answer letter; null for non-MCQ.'),
    internal_choice: z.string().nullable().describe('An "OR" alternative question, if any.'),
    answer_key: z.string().nullable(),
    marking_scheme: z.string().nullable(),
});

export const ExamPaperResult = z.object({
    title: z.string(),
    board: z.string(),
    grade: z.number().int(),
    subject: z.string(),
    language: z.string(),
    duration: z.string().describe('As printed on the paper, e.g. "1 Hour".'),
    max_marks: z.number(),
    total_question_marks: z.number().describe('Sum of all question marks (equals max_marks for a balanced paper).'),
    general_instructions: z.array(z.string()),
    sections: z.array(z.object({
        name: z.string(),
        label: z.string(),
        total_marks: z.number(),
        questions: z.array(Question),
    })),
    blueprint: z.object({
        chapter_marks: z.array(z.object({ chapter: z.string(), marks: z.number() })),
        difficulty_mix: z.array(z.object({ level: z.string(), percentage: z.number() })),
    }),
    previous_year_sources: z.array(z.object({ year: z.number().nullable(), set: z.string().nullable(), chapter: z.string().nullable() })),
    review_notes: z.array(z.string()).describe('Things a teacher should check (chapter not in syllabus, answers that need review). Empty when none.'),
});

export type ExamPaperResult = z.infer<typeof ExamPaperResult>;
