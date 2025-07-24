'use server';

/**
 * @fileOverview Generates lesson plans based on user-provided topics using voice or text input.
 *
 * - generateLessonPlan - A function that takes a topic as input and returns a generated lesson plan.
 * - LessonPlanInput - The input type for the generateLessonPlan function.
 * - LessonPlanOutput - The return type for the generateLessonPlan function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LessonPlanInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate a lesson plan.'),
  language: z.string().optional().describe('The language in which to generate the lesson plan. Defaults to English if not specified.'),
  localizationContext: z.string().optional().describe('The district, state, or dialect for localization.'),
  gradeLevel: z.string().optional().describe('The grade level for the lesson plan.'),
  duration: z.string().optional().describe('The duration of the lesson plan (e.g., 45 minutes).'),
});
export type LessonPlanInput = z.infer<typeof LessonPlanInputSchema>;

const LessonPlanOutputSchema = z.object({
  lessonPlan: z.string().describe('The generated lesson plan.'),
});
export type LessonPlanOutput = z.infer<typeof LessonPlanOutputSchema>;

export async function generateLessonPlan(input: LessonPlanInput): Promise<LessonPlanOutput> {
  return lessonPlanFlow(input);
}

const lessonPlanPrompt = ai.definePrompt({
  name: 'lessonPlanPrompt',
  input: {schema: LessonPlanInputSchema},
  output: {schema: LessonPlanOutputSchema},
  prompt: `You are an expert teacher. Generate a lesson plan for the following topic, tailored to the specified language and localization context.

Topic: {{{topic}}}
Grade Level: {{{gradeLevel}}}
Lesson Duration: {{{duration}}}
Language: {{{language}}}
Localization Context: {{{localizationContext}}}

Please structure the output in markdown format with clear headings for each section (e.g., ## Objectives, ## Materials, ## Activities, ## Assessment).

Lesson Plan:`,
});

const lessonPlanFlow = ai.defineFlow(
  {
    name: 'lessonPlanFlow',
    inputSchema: LessonPlanInputSchema,
    outputSchema: LessonPlanOutputSchema,
  },
  async input => {
    const {output} = await lessonPlanPrompt(input);
    return output!;
  }
);
