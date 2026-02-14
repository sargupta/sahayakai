
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
import { validateTopicSafety } from '@/lib/safety';
import { validateLessonPlanPayload } from '@/tools/validate_lesson_plan';
import { saveContent } from '@/lib/content-persistence';
import { logger, logError } from '@/lib/cloud-logging';
// import { checkServerRateLimit } from '@/lib/server-safety'; // Imported dynamically to avoid client bundle leak

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
  gradeLevel: z.string().describe('The grade level for this lesson (e.g., "5th Grade"). MUST NOT be null.'),
  duration: z.string().describe('The total estimated duration for the lesson (e.g., "45 minutes"). MUST NOT be null.'),
  subject: z.string().describe('The subject area (e.g., "Science", "Mathematics", "Social Studies"). MUST NOT be null.'),
  objectives: z.array(z.string()).describe('A list of clear, measurable learning objectives (e.g., "SWBAT identify...").'),
  keyVocabulary: z.array(z.object({
    term: z.string(),
    meaning: z.string().describe('A simple, student-friendly definition.'),
  })).optional().describe('Key terms with meanings.'),
  materials: z.array(z.string()).describe('A list of materials needed for the lesson.'),
  activities: z.array(z.object({
    phase: z.enum(['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate']).describe('The 5E model phase.'),
    name: z.string().describe('The name of the activity.'),
    description: z.string().describe('A detailed description of the activity.'),
    duration: z.string().describe('The estimated duration (e.g., "15 minutes").'),
    teacherTips: z.string().optional().describe('Crucial advice for the teacher on how to execute this specific activity effectively.'),
    understandingCheck: z.string().optional().describe('A quick question for the teacher to check if students followed this phase.'),
  })).describe('A list of structured activities following the 5E model.'),
  assessment: z.string().describe('A description of the summative assessment method.'),
  homework: z.string().optional().describe('A relevant follow-up activity for home.'),
});
export type LessonPlanOutput = z.infer<typeof LessonPlanOutputSchema>;

export async function generateLessonPlan(input: LessonPlanInput): Promise<LessonPlanOutput> {
  const startTime = Date.now();
  const userId = input.userId;

  // 1. Server-Side Safety Check
  const safety = validateTopicSafety(input.topic);
  if (!safety.safe) {
    throw new Error(`Safety Violation: ${safety.reason}`);
  }

  try {
    await logger.info({
      event: 'lesson_plan_generation_started',
      userId,
      metadata: { topic: input.topic }
    });

    const output = await lessonPlanFlow(input);

    const latencyMs = Date.now() - startTime;
    await logger.info({
      event: 'lesson_plan_generation_completed',
      userId,
      latencyMs,
      metadata: { topic: input.topic }
    });

    if (userId) {
      await saveContent({
        userId,
        contentType: 'lesson-plan',
        title: output.title,
        content: output,
        metadata: {
          gradeLevel: output.gradeLevel,
          language: input.language,
          subject: output.subject,
        }
      });
    }

    return output;
  } catch (error: any) {
    await logError({
      event: 'lesson_plan_generation_failed',
      error,
      userId,
      metadata: { topic: input.topic }
    });
    throw error;
  }
}

const lessonPlanPrompt = ai.definePrompt({
  name: 'lessonPlanPrompt',
  input: { schema: LessonPlanInputSchema },
  output: { schema: LessonPlanOutputSchema, format: 'json' },
  tools: [googleSearch],
  prompt: `You are an expert teacher who creates highly precise, balanced, and pedagogically robust lesson plans, especially for multi-grade and rural Indian classrooms.

**Your Goal:** Generate a lesson plan that is exactly right for the teacher—not too complex, not too simple, but deeply informative.

**Structural Instructions (5E Model):**
You MUST organize the activities into the 5E Instructional Model:
1. **Engage**: Catch student interest, connect to prior knowledge (e.g., a story, a riddle, or a real-life scenario).
2. **Explore**: Hands-on experience or guided inquiry where students investigate.
3. **Explain**: Direct instruction where the core concept is clarified.
4. **Elaborate**: Applying the concept to new situations or connecting to local Indian context.
5. **Evaluate**: Check for understanding (formative).

**Metadata Requirements:**
- **gradeLevel**: (e.g., "5th Grade"). Mandatory.
- **duration**: (e.g., "45 minutes"). Mandatory.
- **subject**: (e.g., "Science"). Mandatory.
- **teacherTips**: For every activity, provide 1-2 sentences of "Behind the Lesson" advice (e.g., "If students struggle with X, try demonstrating Y").
- **understandingCheck**: A simple focus question for the teacher to ask at the end of each phase.

{{#if useRuralContext}}
**INDIAN RURAL CONTEXT - CRITICAL:**
${getIndianContextPrompt(true)}
- Resource Constraint (Level: {{resourceLevel}}): 
  - **low**: Only Chalk, Blackboard, and local items (leaves, stones).
  - **medium**: Adds chart papers, pens, basic local objects.
  - **high**: Adds projector/internet.
{{/if}}

{{#if ncertChapter}}
**NCERT ALIGNMENT:**
- Align with Chapter {{ncertChapter.number}}: "{{ncertChapter.title}}"
- Address these outcomes: {{#each ncertChapter.learningOutcomes}}- {{this}} {{/each}}
{{/if}}

{{#if imageDataUri}}
**Visual Context:**
Primary content is in the provided textbook image: {{media url=imageDataUri}}
{{/if}}

Topic: {{{topic}}}
Grade Levels: {{#each gradeLevels}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Language: {{{language}}}
Difficulty: {{{difficultyLevel}}}

Respond ONLY with valid JSON following the schema.
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

    // 3. Deterministic Architecture Validation (Layer 3)
    const validation = validateLessonPlanPayload(output);
    if (!validation.valid) {
      console.warn("Architecture Validation Warnings:", validation.errors);
      // In a strict mode, we could trigger a self-healing retry here.
      // For now, we log it to maintain the Audit Trail.
    }

    return output;
  }
);

/**
 * Smart Feature: Convert a generated lesson plan into a professional PPTX slide deck.
 */
export async function convertLessonPlanToSlides(lessonPlan: LessonPlanOutput, userId?: string) {
  const { SkillBridge } = await import('@/ai/utils/skill-bridge');

  await logger.info({
    event: 'lesson_plan_to_slides_started',
    userId,
    metadata: { title: lessonPlan.title }
  });

  const result = await SkillBridge.generatePresentation({ lessonPlan, userId });

  if (result.success) {
    await logger.info({
      event: 'lesson_plan_to_slides_completed',
      userId,
      metadata: { outputPath: result.outputPath }
    });
  }

  return result;
}
