import { z } from 'zod';
import { gradeField, languageField } from '../shared/schema';

/**
 * Public contract of the `create_quiz` MCP tool.
 *
 * Every field maps onto an option the EXISTING Sahayak quiz service supports
 * (see ./service.ts); defaults mirror the Sahayak app's quiz form. The textbook
 * photo input of the app (`imageDataUri`, base64 up to 14 MB) is deliberately
 * not exposed. Inputs are strict: unknown fields (e.g. a client-supplied
 * org/tenant id) are rejected.
 */

export const QUIZ_QUESTION_TYPES = ['multiple_choice', 'true_false', 'fill_in_the_blanks', 'short_answer'] as const;
export const BLOOMS_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] as const;
export const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export const CreateQuizInput = z.object({
    topic: z.string({ required_error: 'Missing topic, e.g. "Fractions" or "The water cycle".' })
        .trim().min(3, 'Topic is too short.').max(200, 'Topic is too long (max 200 characters).')
        .describe('What the quiz is about, e.g. "Fractions", "Adding fractions with unlike denominators". One topic per call.'),
    grade: gradeField('School grade / class (Indian "Class 1"–"Class 12"). Vocabulary and depth adapt to the grade.'),
    subject: z.string().trim().min(2, 'Subject is too short.').max(60, 'Subject is too long.').optional()
        .describe('Subject, e.g. "Mathematics". Recommended; inferred from the topic if omitted.'),
    num_questions: z.number().int('num_questions must be a whole number.').min(1, 'num_questions must be between 1 and 20.').max(20, 'num_questions must be between 1 and 20.').optional()
        .describe('Questions per quiz, 1–20. Default by grade: Class 1–5 → 5, 6–8 → 10, 9–10 → 15, 11–12 → 20.'),
    question_types: z.array(z.enum(QUIZ_QUESTION_TYPES, {
        errorMap: () => ({ message: `Invalid question type. Use: ${QUIZ_QUESTION_TYPES.join(', ')}.` }),
    })).min(1, 'Give at least one question type.').max(4).default(['multiple_choice', 'short_answer'])
        .describe('Question types to mix. Default ["multiple_choice", "short_answer"].'),
    difficulty: z.enum(QUIZ_DIFFICULTIES, {
        errorMap: () => ({ message: 'Invalid difficulty. Use "easy", "medium" or "hard", or omit it to get all three levels.' }),
    }).optional()
        .describe('Return one level ("easy", "medium", "hard"). Omit to get all three levels of the same quiz (for differentiated teaching).'),
    blooms_levels: z.array(z.enum(BLOOMS_LEVELS, {
        errorMap: () => ({ message: `Invalid Bloom's level. Use: ${BLOOMS_LEVELS.join(', ')}.` }),
    })).min(1).max(6).default(['Remember', 'Understand'])
        .describe('Bloom\'s taxonomy levels to target. Default ["Remember", "Understand"].'),
    language: languageField('the quiz'),
}).strict();

export type CreateQuizInput = z.infer<typeof CreateQuizInput>;

const Question = z.object({
    number: z.number().int(),
    type: z.enum(QUIZ_QUESTION_TYPES),
    question: z.string(),
    options: z.array(z.string()).describe('Answer choices for multiple_choice / true_false; empty otherwise.'),
    correct_answer: z.string(),
    explanation: z.string().describe('Why the answer is correct, written for students.'),
});

export const QuizResult = z.object({
    topic: z.string(),
    grade: z.number().int(),
    subject: z.string().nullable(),
    language: z.string(),
    quizzes: z.array(z.object({
        difficulty: z.enum(QUIZ_DIFFICULTIES),
        title: z.string(),
        teacher_instructions: z.string().nullable().describe('How to run the quiz in a chalk-and-board classroom.'),
        questions: z.array(Question),
    })).describe('One quiz per requested difficulty level, easy → hard.'),
    review_notes: z.array(z.string()).describe('Things a teacher should know (topic matched to an NCERT chapter, fewer questions than asked, a level that failed). Empty when none.'),
});

export type QuizResult = z.infer<typeof QuizResult>;
