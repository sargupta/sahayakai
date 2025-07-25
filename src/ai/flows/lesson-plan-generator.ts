
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
import { googleSearch } from '../tools/google-search';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const LessonPlanInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate a lesson plan.'),
  language: z.string().optional().describe('The language in which to generate the lesson plan. Defaults to English if not specified.'),
  gradeLevels: z.array(z.string()).optional().describe('The grade levels for the lesson plan.'),
  imageDataUri: z.string().optional().describe(
    "An optional image of a textbook page or other material, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
  ),
});
export type LessonPlanInput = z.infer<typeof LessonPlanInputSchema>;

const LessonPlanOutputSchema = z.object({
  title: z.string().describe('A concise and engaging title for the lesson plan.'),
  objectives: z.array(z.string()).describe('A list of clear learning objectives for the lesson.'),
  materials: z.array(z.string()).describe('A list of materials needed for the lesson.'),
  activities: z.array(z.object({
    name: z.string().describe('The name of the activity.'),
    description: z.string().describe('A detailed description of the activity.'),
    duration: z.string().describe('The estimated duration for the activity (e.g., "15 minutes").'),
  })).describe('A list of activities to be performed during the lesson.'),
  assessment: z.string().describe('A description of the assessment method to evaluate student learning.'),
});
export type LessonPlanOutput = z.infer<typeof LessonPlanOutputSchema>;

export async function generateLessonPlan(input: LessonPlanInput): Promise<LessonPlanOutput> {
  return lessonPlanFlow(input);
}

const lessonPlanPrompt = ai.definePrompt({
  name: 'lessonPlanPrompt',
  input: {schema: LessonPlanInputSchema},
  output: {schema: LessonPlanOutputSchema, format: 'json'},
  tools: [googleSearch],
  prompt: `You are an expert teacher who creates culturally and geographically relevant educational content, especially for multi-grade classrooms. Generate a detailed lesson plan based on the following inputs.

You MUST follow the specified JSON output format. Your response must be a valid JSON object that adheres to the defined schema. Do not return null or any other non-JSON response.

{{#if imageDataUri}}
**Primary Context from Image:**
Analyze the following image and use it as the primary source of information for creating the lesson plan. The user's topic should be used to refine the focus.
{{media url=imageDataUri}}
{{/if}}

Topic: {{{topic}}}
Grade Levels: {{#each gradeLevels}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Language: {{{language}}}

If the user asks for a video, use the googleSearch tool to find one.
`,
});

const lessonPlanFlow = ai.defineFlow(
  {
    name: 'lessonPlanFlow',
    inputSchema: LessonPlanInputSchema,
    outputSchema: LessonPlanOutputSchema,
  },
  async input => {
    const {output} = await lessonPlanPrompt(input);
    
    if (!output) {
      throw new Error("The AI model failed to generate a valid lesson plan. The returned output was null.");
    }

    const user = auth.currentUser;
    if (user) {
      await addDoc(collection(db, 'users', user.uid, 'content'), {
        type: 'lesson-plan',
        topic: input.topic,
        gradeLevels: input.gradeLevels,
        language: input.language,
        content: output,
        createdAt: serverTimestamp(),
        isPublic: false,
      });
    }

    return output;
  }
);
