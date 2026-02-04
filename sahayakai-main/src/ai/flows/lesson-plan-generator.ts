
'use server';

/**
 * @fileOverview Generates lesson plans based on user-provided topics using voice or text input.
 *
 * - generateLessonPlan - A function that takes a topic as input and returns a generated lesson plan.
 * - LessonPlanInput - The input type for the generateLessonPlan function.
 * - LessonPlanOutput - The return type for the generateLessonPlan function.
 */

import { ai, runResiliently } from '@/ai/genkit';
import { z } from 'genkit';
import { googleSearch } from '../tools/google-search';
import { getIndianContextPrompt } from '@/lib/indian-context';
import { validateTopicSafety } from '@/lib/safety';
// import { checkServerRateLimit } from '@/lib/server-safety'; // Imported dynamically to avoid client bundle leak

import { GRADE_LEVELS, LANGUAGES } from '@/types/index';
import { getStorageInstance } from '@/lib/firebase-admin';
import { format } from 'date-fns';

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

function normalizeInput(input: LessonPlanInput): LessonPlanInput {
  let { language, gradeLevels } = input;

  if (language) {
    const langMap: Record<string, string> = {
      'en': 'English', 'hi': 'Hindi', 'kn': 'Kannada',
      'ta': 'Tamil', 'te': 'Telugu', 'mr': 'Marathi', 'bn': 'Bengali'
    };
    language = langMap[language.toLowerCase()] || language;
  }

  if (gradeLevels?.length) {
    gradeLevels = gradeLevels.map(g => {
      const match = g.match(/(\d+)/);
      if (match) return `Class ${match[1]}`;
      if (g.toLowerCase().includes('nursery')) return 'Nursery';
      if (g.toLowerCase().includes('lkg')) return 'LKG';
      if (g.toLowerCase().includes('ukg')) return 'UKG';
      return g;
    });
  }

  return { ...input, language, gradeLevels };
}
export type LessonPlanInput = z.infer<typeof LessonPlanInputSchema>;

const LessonPlanOutputSchema = z.object({
  title: z.string().describe('A concise and engaging title for the lesson plan.'),
  gradeLevel: z.string().nullable().optional().describe('The grade level for this lesson (e.g., "5th Grade").'),
  duration: z.string().nullable().optional().describe('The total estimated duration for the lesson (e.g., "45 minutes").'),
  subject: z.string().nullable().optional().describe('The subject area (e.g., "Science", "Mathematics", "Social Studies").'),
  objectives: z.array(z.string()).describe('A list of clear, measurable learning objectives (e.g., "SWBAT identify...").'),
  keyVocabulary: z.array(z.object({
    term: z.string(),
    meaning: z.string().describe('A simple, student-friendly definition.'),
  })).nullable().optional().describe('Key terms with meanings.'),
  materials: z.array(z.string()).describe('A list of materials needed for the lesson.'),
  activities: z.array(z.object({
    phase: z.enum(['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate']).describe('The 5E model phase.'),
    name: z.string().describe('The name of the activity.'),
    description: z.string().describe('A detailed description of the activity.'),
    duration: z.string().describe('The estimated duration (e.g., "15 minutes").'),
    teacherTips: z.string().nullable().optional().describe('Crucial advice for the teacher on how to execute this specific activity effectively.'),
    understandingCheck: z.string().nullable().optional().describe('A quick question for the teacher to check if students followed this phase.'),
  })).describe('A list of structured activities following the 5E model.'),
  assessment: z.string().nullable().optional().describe('A description of the summative assessment method.'),
  homework: z.string().nullable().optional().describe('A relevant follow-up activity for home.'),
});
export type LessonPlanOutput = z.infer<typeof LessonPlanOutputSchema>;

export async function generateLessonPlan(input: LessonPlanInput): Promise<LessonPlanOutput> {
  // 1. Server-Side Safety Check
  const safety = validateTopicSafety(input.topic);
  if (!safety.safe) {
    throw new Error(`Safety Violation: ${safety.reason}`);
  }

  // 2. Server-Side Rate Limiting
  // Use input.userId or fallback to "anonymous" (IP-based limits not implemented yet in this scope)
  const uid = input.userId || 'anonymous_user';
  if (uid !== 'anonymous_user') {
    const { checkServerRateLimit } = await import('@/lib/server-safety');
    await checkServerRateLimit(uid);
  } else {
    // Optional: limit anonymous globally? For now, skip to avoid blocking legitimate first-time users without IDs.
    // In production, we'd use IP.
  }

  return lessonPlanFlow(input);
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
- **gradeLevel**: (e.g., "5th Grade")
- **duration**: (e.g., "45 minutes")
- **subject**: (e.g., "Science")
- **teacherTips**: For every activity, provide 1-2 sentences of "Behind the Lesson" advice (e.g., "If students struggle with X, try demonstrating Y").
- **understandingCheck**: A simple focus question for the teacher to ask at the end of each phase.
- **Assessment**: A brief description of how to assess student learning at the end of the lesson.

{{#if useRuralContext}}
**INDIAN RURAL CONTEXT - CRITICAL:**
- Examples MUST be from Indian daily life (farming, seasons, local markets, festivals like Diwali, Eid, Baisakhi).
- Use Indian currency (₹) and metrics.
- Avoid all Western-specific references (pizza, burgers, snow-themed Christmas, miles).
- Use names of Indian rivers, mountains, and local foods (roti, khichdi, etc.).
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
    const { logger } = await import('@/lib/logger'); // Keep old logger if needed for timers, or migrate? Sentry is here.
    const { StructuredLogger } = await import('@/lib/logger/structured-logger');
    const { FlowExecutionError, SchemaValidationError, PersistenceError } = await import('@/lib/errors');
    const Sentry = await import('@sentry/nextjs');
    const { v4: uuidv4 } = await import('uuid');

    return Sentry.withServerActionInstrumentation('lessonPlanFlow', { recordResponse: true }, async () => {
      const requestId = uuidv4();
      const startTime = Date.now();

      const normalizedInput = normalizeInput(input);

      try {
        StructuredLogger.info('Starting lesson plan generation flow', {
          service: 'lesson-plan-flow',
          operation: 'generateLessonPlan',
          userId: normalizedInput.userId,
          requestId,
          input: {
            topic: normalizedInput.topic,
            language: normalizedInput.language,
            gradeLevels: normalizedInput.gradeLevels,
            resourceLevel: normalizedInput.resourceLevel
          }
        });

        // 1. AI Generation Phase
        const genTimer = logger.startTimer(`AI Lesson Plan Generation`, 'AI', { topic: normalizedInput.topic }); // Legacy logger

        const { output } = await Sentry.startSpan({ name: 'AI Generation', op: 'ai.generate' }, async () => {
          return await runResiliently(async (resilienceConfig) => {
            return await lessonPlanPrompt(normalizedInput, resilienceConfig);
          });
        });
        genTimer.stop();

        if (!output) {
          throw new FlowExecutionError(
            'AI model returned null output',
            {
              modelUsed: 'gemini-2.0-flash',
              input: input.topic
            }
          );
        }

        // Validate schema explicitly to catch issues early and with detail
        try {
          LessonPlanOutputSchema.parse(output);
        } catch (validationError: any) {
          throw new SchemaValidationError(
            `Schema validation failed: ${validationError.message}`,
            {
              parseErrors: validationError.errors,
              rawOutput: output,
              expectedSchema: 'LessonPlanOutputSchema'
            }
          );
        }

        // LOG THE RAW OUTPUT - Enhanced logging
        StructuredLogger.info('AI output received and validated', {
          service: 'lesson-plan-flow',
          operation: 'generateLessonPlan',
          requestId,
          metadata: {
            hasTitle: !!output?.title,
            hasObjectives: !!output?.objectives,
            hasActivities: !!output?.activities,
            activitiesCount: output?.activities?.length
          }
        });


        const userId = input.userId;
        if (userId) {
          try {
            await Sentry.startSpan({ name: 'Persistence Phase', op: 'db.save' }, async () => {
              const persistTimer = logger.startTimer(`Persisting Lesson Plan`, 'STORAGE', { userId });
              const storage = await getStorageInstance();
              const now = new Date();
              const timestamp = format(now, 'yyyyMMdd_HHmmss');
              const contentId = crypto.randomUUID();
              const safeTitle = (output.title || input.topic).replace(/[^a-z0-9]+/gi, '_').toLowerCase().replace(/^_|_$/g, '');
              const fileName = `${timestamp}_${safeTitle}.json`;
              const filePath = `users/${userId}/lesson-plans/${fileName}`;
              const file = storage.bucket().file(filePath);

              const downloadToken = crypto.randomUUID();
              await Sentry.startSpan({ name: 'GCP Storage Write', op: 'storage.write' }, async () => {
                await file.save(JSON.stringify(output), {
                  resumable: false,
                  metadata: {
                    contentType: 'application/json',
                    metadata: {
                      firebaseStorageDownloadTokens: downloadToken,
                    }
                  },
                });
              });

              const { dbAdapter } = await import('@/lib/db/adapter');
              const { Timestamp } = await import('firebase-admin/firestore');

              await Sentry.startSpan({ name: 'Firestore Write', op: 'db.firestore.write' }, async () => {
                await dbAdapter.saveContent(userId, {
                  id: contentId,
                  type: 'lesson-plan',
                  title: output.title || `Lesson Plan: ${input.topic}`,
                  gradeLevel: input.gradeLevels?.[0] as any || 'Class 5',
                  subject: output.subject as any || 'Science',
                  topic: input.topic,
                  language: input.language as any || 'English',
                  storagePath: filePath,
                  isPublic: false,
                  isDraft: false,
                  createdAt: Timestamp.fromDate(now),
                  updatedAt: Timestamp.fromDate(now),
                  data: output,
                });
              });
              persistTimer.stop();

              StructuredLogger.info('Content persisted successfully', {
                service: 'lesson-plan-flow',
                operation: 'persistContent',
                userId,
                requestId,
                metadata: { contentId }
              });

            });
          } catch (persistenceError: any) {
            StructuredLogger.error(
              'Failed to persist lesson plan',
              {
                service: 'lesson-plan-flow',
                operation: 'persistContent',
                userId,
                requestId
              },
              new PersistenceError('Persistence failed', 'saveContent')
            );
            // Non-blocking error
          }
        }

        const duration = Date.now() - startTime;
        StructuredLogger.info('Lesson plan flow completed successfully', {
          service: 'lesson-plan-flow',
          operation: 'generateLessonPlan',
          requestId,
          duration
        });

        return output;

      } catch (flowError: any) {
        const duration = Date.now() - startTime;

        const errorId = StructuredLogger.error(
          'Lesson plan flow execution failed',
          {
            service: 'lesson-plan-flow',
            operation: 'generateLessonPlan',
            userId: input.userId,
            requestId,
            input: {
              topic: input.topic
            },
            duration,
            metadata: {
              errorType: flowError.constructor?.name,
              errorCode: flowError.errorCode
            }
          },
          flowError
        );

        if (typeof flowError === 'object' && flowError !== null) {
          flowError.errorId = errorId;
        }
        throw flowError;
      }
    });
  }
);
