import { z } from 'zod';
import { SAHAYAK_LANGUAGES } from '../shared/schema';

/**
 * Public contract of the `create_lesson_plan` MCP tool.
 *
 * Every field maps onto an option the EXISTING Sahayak lesson-plan service
 * already supports (see ./service.ts); nothing here is a new capability.
 * Inputs are strict: unknown fields (e.g. a client-supplied org/tenant id)
 * are rejected rather than silently ignored.
 */

/** Shared with every Sahayak MCP server (src/lib/mcp/shared/schema.ts). */
export const LESSON_PLAN_LANGUAGES = SAHAYAK_LANGUAGES;

/**
 * Canonical service levels plus the everyday words agents naturally use.
 * The aliases are mapped to the canonical level in ./service.ts.
 */
export const DIFFICULTY_VALUES = ['remedial', 'standard', 'advanced', 'easy', 'medium', 'hard'] as const;
export const DIFFICULTY_ALIASES = { easy: 'remedial', medium: 'standard', hard: 'advanced' } as const;

export const CreateLessonPlanInput = z.object({
    topic: z.string({ required_error: 'Missing topic. Provide the lesson topic, e.g. "Photosynthesis".' })
        .trim()
        .min(3, 'Topic is too short. Use 3–200 characters, e.g. "Equivalent fractions".')
        .max(200, 'Topic is too long. Use 3–200 characters; put detail in ncert_chapter instead.')
        .describe('What the lesson teaches, e.g. "Photosynthesis" or "Equivalent fractions". One topic per call.'),
    grade: z.number({ required_error: 'Missing grade. Expected an integer between 1 and 12.', invalid_type_error: 'Invalid grade. Expected an integer between 1 and 12.' })
        .int('Invalid grade. Expected an integer between 1 and 12.')
        .min(1, 'Invalid grade. Expected an integer between 1 and 12.')
        .max(12, 'Invalid grade. Expected an integer between 1 and 12.')
        .describe('School grade / class (Indian "Class 1"–"Class 12"). Pedagogy adapts to the grade band.'),
    subject: z.string().trim().min(2).max(60).optional()
        .describe('Subject, e.g. "Science", "Mathematics", "Social Science". Recommended; inferred from the topic if omitted.'),
    language: z.enum(LESSON_PLAN_LANGUAGES, {
        errorMap: () => ({ message: `Unsupported language. Use one of: ${LESSON_PLAN_LANGUAGES.join(', ')}.` }),
    }).default('English')
        .describe('Language the lesson plan is written in. Default English.'),
    classroom_resources: z.enum(['low', 'medium', 'high'], {
        errorMap: () => ({ message: 'Invalid classroom_resources. Use "low" (chalk and talk), "medium" (basic aids) or "high" (projector/devices).' }),
    }).default('low')
        .describe('What the classroom has: "low" = chalkboard only, "medium" = charts and basic aids, "high" = projector or devices. Default "low".'),
    difficulty: z.enum(DIFFICULTY_VALUES, {
        errorMap: () => ({ message: 'Invalid difficulty. Use "remedial", "standard" or "advanced" (aliases: "easy", "medium", "hard").' }),
    }).default('standard')
        .describe('"remedial" simplifies, "standard" is grade level, "advanced" stretches. "easy" / "medium" / "hard" are accepted as aliases. Default "standard".'),
    use_local_context: z.boolean().default(true)
        .describe('Use Indian, locally familiar examples (farming, monsoon, festivals, rupees). Default true.'),
    ncert_chapter: z.object({
        number: z.number().int().min(1, 'ncert_chapter.number must be a positive integer.').max(40),
        title: z.string().trim().min(2).max(150),
        learning_outcomes: z.array(z.string().trim().min(2).max(300)).max(10).default([]),
    }).strict().optional()
        .describe('Optional NCERT chapter to align with (number, title, learning outcomes). Omit for non-NCERT curricula.'),
}).strict();

export type CreateLessonPlanInput = z.infer<typeof CreateLessonPlanInput>;

export const LESSON_PHASES = ['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate'] as const;

export const LessonPlanResult = z.object({
    title: z.string(),
    grade: z.number().int(),
    subject: z.string().nullable(),
    language: z.string(),
    duration: z.string().nullable().describe('Total lesson time as written by the plan, e.g. "45 minutes".'),
    learning_objectives: z.array(z.string()),
    key_vocabulary: z.array(z.object({ term: z.string(), meaning: z.string() })),
    materials: z.array(z.string()),
    activities: z.array(z.object({
        phase: z.enum(LESSON_PHASES).describe('5E phase.'),
        name: z.string(),
        description: z.string(),
        duration: z.string(),
        teacher_tips: z.string().nullable(),
        understanding_check: z.string().nullable(),
    })).describe('Teaching sequence in 5E order (Engage → Explore → Explain → Elaborate → Evaluate).'),
    assessment: z.string().nullable(),
    homework: z.string().nullable(),
    curriculum_note: z.string().nullable().describe('Present when the NCERT chapter given did not match the syllabus; the plan was still generated.'),
});

export type LessonPlanResult = z.infer<typeof LessonPlanResult>;
