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
  gradeLevel: z.string().optional().describe('The grade level for the lesson plan.'),
  localContext: z.string().optional().describe('The district, state, or dialect for localization.'),
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
  prompt: `You are an expert teacher who creates culturally and geographically relevant educational content. Generate a detailed lesson plan based on the following inputs.

Topic: {{{topic}}}
Grade Level: {{{gradeLevel}}}
Language: {{{language}}}
Local Context: {{{localContext}}}

**Instructions for using Local Context:**
When a 'Local Context' is provided, you MUST use it to make the lesson plan more relatable for the student.
- For scientific concepts, use analogies from local life. For example, when explaining photosynthesis for a student in Tamil Nadu, you could relate it to the celebration of Pongal, which is a harvest festival.
- For stories or examples, use names of local places, cities, or villages.
- For cultural topics, reference local festivals, traditions, and customs. For instance, if the topic is 'festivals' for a student in Bengal, you must talk about Durga Puja.
- The goal is to make the student feel that the content is created specifically for their environment.

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
