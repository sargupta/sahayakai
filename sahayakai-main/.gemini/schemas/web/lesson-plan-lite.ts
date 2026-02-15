// Lesson Plan Lite Schema - Optimized for Token Efficiency
import { z } from 'zod';

export const LessonPlanInputSchema = z.object({
    topic: z.string(),
    gradeLevel: z.string(),
    subject: z.string(),
    language: z.string().default('English'),
    ncertChapter: z.string().optional(),
    difficultyLevel: z.enum(['Foundation', 'Standard', 'Advanced']).default('Standard'),
}).describe('Essential inputs for lesson plan generation');

export const LessonPlanOutputSchema = z.object({
    title: z.string(),
    objectives: z.array(z.string()),
    sections: z.array(z.object({
        title: z.string(),
        content: z.string(),
        duration: z.string(),
    })),
}).describe('Core lesson plan structure');
