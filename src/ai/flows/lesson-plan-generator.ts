
'use server';

/**
 * @fileOverview Generates lesson plans based on user-provided topics using voice or text input.
 *
 * - generateLessonPlan - A function that takes a topic as input and returns a generated lesson plan.
 * - LessonPlanInput - The input type for the generateLessonPlan function.
 * - LessonPlanOutput - The return type for the generateLessonPlan function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleSearch } from '../tools/google-search';
import { getIndianContextPrompt } from '@/lib/indian-context';

const LessonPlanInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate a lesson plan.'),
  language: z.string().optional().describe('The language in which to generate the lesson plan. Defaults to English if not specified.'),
  gradeLevels: z.array(z.string()).optional().describe('The grade levels for the lesson plan.'),
  imageDataUri: z.string().optional().describe(
    "An optional image of a textbook page or other material, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
  ),
  userId: z.string().optional().describe('The ID of the user for whom the lesson plan is being generated.'),
  useRuralContext: z.boolean().optional().describe('Use Indian rural context with local examples (farming, monsoon, Indian festivals, etc.). Defaults to true.'),
  ncertChapter: z.object({
    title: z.string(),
    number: z.number(),
    subject: z.string().optional(),
    learningOutcomes: z.array(z.string()),
  }).optional().describe('Specific NCERT chapter details to align the lesson plan with.'),
  resourceLevel: z.enum(['low', 'medium', 'high']).optional().describe('The level of resources available in the classroom. low=chalk&talk, medium=basic aids, high=tech enabled. Defaults to low.'),
  difficultyLevel: z.enum(['remedial', 'standard', 'advanced']).optional().describe('The difficulty level for the lesson content. remedial=simplified, standard=grade-level, advanced=challenging. Defaults to standard.'),
});
export type LessonPlanInput = z.infer<typeof LessonPlanInputSchema>;

const LessonPlanOutputSchema = z.object({
  title: z.string().describe('A concise and engaging title for the lesson plan.'),
  gradeLevel: z.string().optional().describe('The grade level for this lesson (e.g., "5th Grade").'),
  duration: z.string().optional().describe('The total estimated duration for the lesson (e.g., "45 minutes").'),
  subject: z.string().optional().describe('The subject area (e.g., "Science", "Mathematics", "Social Studies").'),
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
  input: { schema: LessonPlanInputSchema },
  output: { schema: LessonPlanOutputSchema, format: 'json' },
  tools: [googleSearch],
  prompt: `You are an expert teacher who creates culturally and geographically relevant educational content, especially for multi-grade classrooms. Generate a detailed lesson plan based on the following inputs.

You MUST follow the specified JSON output format. Your response must be a valid JSON object that adheres to the defined schema. Do not return null or any other non-JSON response.

**IMPORTANT: You MUST include the following metadata in your response:**
- gradeLevel: The primary grade level for this lesson (e.g., "5th Grade", "6th Grade")
- duration: The total estimated time for the complete lesson (e.g., "45 minutes", "1 hour", "2 class periods")
- subject: The primary subject area (e.g., "Science", "Mathematics", "Social Studies", "Language Arts", "History")

{{#if useRuralContext}}
**INDIAN RURAL CONTEXT - VERY IMPORTANT:**
- Use examples from Indian daily life (farming, local markets, festivals like Diwali, Holi, Eid)
- Reference Indian geography (Ganga, Himalayas, monsoon, Indian states and cities)
- Use Indian currency (₹) in all money-related examples
- Include culturally relevant examples (roti, dal, rice, cricket, kabaddi, etc.)
- Avoid Western examples (pizza, snow, dollars, hamburgers, etc.)
- Consider agricultural context - many students' families are farmers
- Use simple, relatable scenarios from rural Indian life
- Reference Indian heroes and historical figures (Gandhi, APJ Kalam, etc.)

**RESOURCE CONSTRAINTS (Current Level: {{resourceLevel}}):**
- **If Level is 'low' (or unspecified):**
  - **STRICTLY LIMIT resources to: Chalk, Blackboard, Textbook.**
  - Do NOT suggest posters, chart papers, or bringing objects from home unless extremely common (like a stone or leaf).
  - Activities must be doable with oral discussion, blackboard drawing, and student notebooks.
  - NO technology, NO printed worksheets, NO lab equipment.
- **If Level is 'medium':**
  - Resources allowed: Chalk, Blackboard, Textbook, Chart paper, Sketch pens, Local objects (stones, leaves, sticks).
  - Simple group activities are encouraged.
  - NO technology (projectors/computers).
- **If Level is 'high':**
  - Resources allowed: Projector, Computer, Internet (for teacher), Lab equipment.
  - You can suggest showing a short video or using a digital simulation.

**DIFFERENTIATION (Current Level: {{difficultyLevel}}):**
- **If Level is 'remedial':**
  - **Focus on FOUNDATIONAL concepts.**
  - Use very simple language and concrete examples.
  - Break down complex tasks into small, manageable steps.
  - Provide extra scaffolding and guided practice.
  - Focus on "must-know" vocabulary.
- **If Level is 'advanced':**
  - **Focus on EXTENSION and CRITICAL THINKING.**
  - Challenge students with open-ended questions.
  - Encourage independent research or complex problem-solving.
  - Connect concepts to broader real-world issues.
  - Use more sophisticated vocabulary.
- **If Level is 'standard' (or unspecified):**
  - Target grade-level expectations.
{{/if}}

{{#if ncertChapter}}
**NCERT CURRICULUM ALIGNMENT:**
- This lesson MUST align with NCERT Chapter {{ncertChapter.number}}: "{{ncertChapter.title}}"
- Ensure the following learning outcomes are addressed:
  {{#each ncertChapter.learningOutcomes}}
  - {{this}}
  {{/each}}
- Use terminology consistent with the NCERT textbook for this chapter.
- Structure the lesson to help students achieve these specific outcomes.
{{/if}}

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
    const { output } = await lessonPlanPrompt(input);

    if (!output) {
      throw new Error("The AI model failed to generate a valid lesson plan. The returned output was null.");
    }

    /* if (input.userId) {
      const now = new Date();
      const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
      const contentId = uuidv4();
      const fileName = `${timestamp}-${contentId}.json`;
      const filePath = `users/${input.userId}/lesson-plans/${fileName}`;
      const file = storage.bucket().file(filePath);

      await file.save(JSON.stringify(output), {
        contentType: 'application/json',
      });

      await db.collection('users').doc(input.userId).collection('content').doc(contentId).set({
        type: 'lesson-plan',
        topic: input.topic,
        gradeLevels: input.gradeLevels,
        language: input.language,
        storagePath: filePath,
        createdAt: now,
        isPublic: false,
      });
    } */

    return output;
  }
);
