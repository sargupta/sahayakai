/**
 * @fileOverview Generates lesson plans based on user-provided topics using voice or text input.
 *
 * - generateLessonPlan - A function that takes a topic as input and returns a generated lesson plan.
 * - LessonPlanInput - The input type for the generateLessonPlan function.
 * - LessonPlanOutput - The return type for the generateLessonPlan function.
 */

import { ai, runResiliently } from '@/ai/genkit';
import { z } from 'genkit';
import { getIndianContextPrompt } from '@/lib/indian-context';
import { renderRegionalContextBlock, getRegionalAnchors } from '@/lib/regional-examples';
import { validateTopicSafety } from '@/lib/safety';
import { logger } from '@/lib/logger';
// import { checkServerRateLimit } from '@/lib/server-safety'; // Imported dynamically to avoid client bundle leak

import { GRADE_LEVELS, LANGUAGES, LANGUAGE_CODE_MAP } from '@/types/index';
import { getStorageInstance } from '@/lib/firebase-admin';
import { format } from 'date-fns';
import { extractGradeFromTopic } from '@/lib/grade-utils';
import { UsageTracker } from '@/lib/usage-tracker';
import { validateChapterForFlow, type ValidationWarning } from '@/lib/ncert/validate-chapter';

export const LessonPlanInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate a lesson plan.'),
  language: z.string().optional().describe('The language in which to generate the lesson plan. Defaults to English if not specified.'),
  gradeLevels: z.array(z.string()).optional().describe('The grade levels for the lesson plan.'),
  imageDataUri: z.string().optional().describe(
    "An optional image of a textbook page or other material, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
  ),
  userId: z.string().optional().describe('The ID of the user for whom the lesson plan is being generated.'),
  teacherContext: z.string().optional().describe('Career-stage context for personalising AI output tone and depth.'),
  useRuralContext: z.boolean().optional().describe('Use Indian rural context with local examples (farming, monsoon, Indian festivals, etc.). Defaults to true.'),
  ncertChapter: z.object({
    title: z.string(),
    number: z.number(),
    subject: z.string().optional(),
    learningOutcomes: z.array(z.string()),
  }).optional().describe('Specific NCERT chapter details to align the lesson plan with.'),
  resourceLevel: z.enum(['low', 'medium', 'high']).optional().describe('The level of resources available in the classroom. low=chalk&talk, medium=basic aids, high=tech enabled. Defaults to low.'),
  difficultyLevel: z.enum(['remedial', 'standard', 'advanced']).optional().describe('The difficulty level for the lesson content. remedial=simplified, standard=grade-level, advanced=challenging. Defaults to standard.'),
  subject: z.string().optional().describe('The academic subject area.'),
  // Hyperlocal context — populated server-side from the teacher's profile.
  // These are NOT user-supplied (the UI does not expose them); they are
  // threaded in by the API route after reading the teacher doc.
  state: z.string().optional().describe('The teacher\'s state (used to localise examples: crops, festivals, geography).'),
  district: z.string().optional().describe('The teacher\'s district (used for finer locality references in the prompt).'),
  schoolType: z.string().optional().describe('Type of school (government / private / chain) — currently informational; may inform resource-level inference in future.'),
  teacherMotherTongue: z.string().optional().describe('Teacher\'s primary language preference, distinct from the output language when bilingual code-switching matters.'),
  regionalContextBlock: z.string().optional().describe('Pre-rendered prompt block listing local crops/festivals/geography for the prompt template. Computed server-side; ignored if absent.'),
});

function normalizeInput(input: LessonPlanInput): LessonPlanInput {
  let { language, gradeLevels } = input;

  if (language) {
    language = LANGUAGE_CODE_MAP[language.toLowerCase() as keyof typeof LANGUAGE_CODE_MAP] || language;
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
  language: z.string().optional().describe('The language of the generated lesson plan.'),
  validationWarning: z.object({
    invalid: z.boolean(),
    lenient: z.boolean(),
    message: z.string(),
    autoCorrectTo: z.object({ number: z.number(), title: z.string() }).optional(),
  }).nullable().optional().describe('Soft NCERT chapter validation warning surfaced to the teacher. Generation still proceeds; the UI displays the warning so the teacher can correct the chapter/topic.'),
});
export type LessonPlanOutput = z.infer<typeof LessonPlanOutputSchema>;

/**
 * Audits materials list against activities to ensure consistency.
 * Returns merged materials list that includes items mentioned in activities.
 */
async function auditMaterials(output: LessonPlanOutput, language?: string): Promise<string[]> {
  try {
    const activitiesText = output.activities
      .map(a => `${a.name}: ${a.description}`)
      .join('\n\n');

    const materialsText = output.materials.join(', ');

    const auditResult = await runResiliently(async (resilienceConfig) => {
      return await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt: `You are a lesson plan auditor.
  
  Materials Listed: ${materialsText}
  
  Activities:
  ${activitiesText}
  
  Task:
  1. Identify items/objects mentioned in activities that are NOT in the materials list.
  2. Return ONLY a JSON array of missing items written in ${language || 'English'}.
     Example: ["basket", "measuring tape"]

  If no missing items, return: []
  
  Output ONLY the JSON array, no explanation.`,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          ...resilienceConfig.config
        }
      });
    }, 'lessonPlan.materialsAudit');

    const missingMaterials = auditResult.output
      ? auditResult.output
      : JSON.parse(auditResult.text);

    // Merge materials
    if (Array.isArray(missingMaterials) && missingMaterials.length > 0) {
      return [...output.materials, ...missingMaterials];
    }

    return output.materials;
  } catch (error) {
    // If audit fails, return original materials
    logger.warn('Materials audit failed', 'AI', { error: String(error) });
    return output.materials;
  }
}

export async function generateLessonPlan(input: LessonPlanInput): Promise<LessonPlanOutput> {
  // 1. Server-Side Safety Check
  const safety = validateTopicSafety(input.topic);
  if (!safety.safe) {
    throw new Error(`Safety Violation: ${safety.reason}`);
  }

  // 2. Grade Override: Extract from topic if explicitly mentioned
  const extractedGrade = extractGradeFromTopic(input.topic);
  if (extractedGrade) {
    // User explicitly mentioned a grade in their prompt - OVERRIDE config
    input.gradeLevels = [extractedGrade];
  }

  // 3. Server-Side Rate Limiting & User Profile Context
  const uid = input.userId || 'anonymous_user';
  let localizedInput = { ...input };

  if (uid !== 'anonymous_user') {
    const { checkServerRateLimit } = await import('@/lib/server-safety');
    await checkServerRateLimit(uid);

    // Pull the teacher profile once and reuse for language + locality.
    // Was previously two separate reads — collapsing them avoids an extra
    // Firestore round trip per generation and ensures state/language are
    // pulled from the same snapshot.
    const { dbAdapter } = await import('@/lib/db/adapter');
    const profile = await dbAdapter.getUser(uid).catch(() => null);

    // Profile-language fallback is intentionally STRICT: only fires when
    // the client truly omitted `language` (undefined/null). An empty
    // string from a half-filled form must NOT silently flip to the
    // profile preference — that was the second half of the NCERT-demo
    // 2026-05-19 language leak (form showed English, output came back
    // Hindi because VIDYA had earlier poisoned profile.preferredLanguage
    // and the form forgot to forward its dropdown value). The form path
    // is now belt-and-braces hardened to always send a non-empty
    // `language`; this stays as a safety net for legacy callers
    // (server-side actions, scripts) that may genuinely lack the field.
    if (
      profile?.preferredLanguage &&
      (input.language === undefined || input.language === null)
    ) {
      localizedInput.language = profile.preferredLanguage;
    }

    // Hyperlocal context — populated from the same profile snapshot.
    // Caller (API route) may also pass these explicitly (test harness,
    // sidecar). Profile values are the fallback, never the override.
    if (profile?.state && !localizedInput.state) {
      localizedInput.state = profile.state;
    }
    if (profile?.district && !localizedInput.district) {
      localizedInput.district = profile.district;
    }
    if (profile?.preferredLanguage && !localizedInput.teacherMotherTongue) {
      localizedInput.teacherMotherTongue = profile.preferredLanguage;
    }
    // If teacher has subjects on profile and the call didn't specify a
    // subject, use the first subject. This is best-effort: the lesson
    // topic itself usually implies subject, but having it on the prompt
    // helps maths examples skew to maths anchors (rupees) vs science
    // anchors (crops, trees).
    if (!localizedInput.subject && profile?.subjects?.length) {
      localizedInput.subject = profile.subjects[0];
    }

    // Fetch teacher context (career stage) for AI personalisation
    try {
      const { getTeacherContextLine } = await import('@/lib/teacher-context');
      localizedInput.teacherContext = await getTeacherContextLine(uid);
    } catch {
      // Non-blocking — proceed without teacher context
    }
  }

  // Pre-render the regional anchor block. The flow falls back to the
  // pan-India block when no state is available — never to a Western
  // default — so even profile-less users get rupees + Indian context.
  localizedInput.regionalContextBlock = renderRegionalContextBlock(
    localizedInput.state,
    localizedInput.subject,
  );

  return lessonPlanFlow(localizedInput);
}

import { SAHAYAK_SOUL_PROMPT, STRUCTURED_OUTPUT_OVERRIDE } from '@/ai/soul';
import { generateLessonPlanCacheKey, getCachedLessonPlan, setCachedLessonPlan } from '@/lib/lesson-plan-cache';

const lessonPlanPrompt = ai.definePrompt({
  name: 'lessonPlanPrompt',
  input: { schema: LessonPlanInputSchema },
  output: { schema: LessonPlanOutputSchema, format: 'json' },
  prompt: `${SAHAYAK_SOUL_PROMPT}${STRUCTURED_OUTPUT_OVERRIDE}
{{#if teacherContext}}{{{teacherContext}}}{{/if}}

You are an expert teacher who creates highly precise, balanced, and pedagogically robust lesson plans, especially for multi-grade and rural Indian classrooms.

**Your Goal:** Generate a lesson plan that is exactly right for the teacher—not too complex, not too simple, but deeply informative.

**CRITICAL: Grade Level Priority**
- **ALWAYS use the EXACT grade level(s) specified**: {{#each gradeLevels}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
- **Indian Context**: "Class X" and "Grade X" mean the SAME thing (e.g., "Class 7" = "Grade 7" = "7th Grade")
- **Your gradeLevel output MUST match** what the user specified - do NOT change it to a different grade
- **If topic mentions a grade** (e.g., "for grade 7 students"), that grade takes absolute priority
- **If no grade mentioned in topic**, use the gradeLevels parameter provided above

**Structural Instructions (5E Model):**
You MUST organize the activities into the 5E Instructional Model:
1. **Engage**: Catch student interest, connect to prior knowledge (e.g., a story, a riddle, or a real-life scenario).
2. **Explore**: Hands-on experience or guided inquiry where students investigate.
3. **Explain**: Direct instruction where the core concept is clarified.
4. **Elaborate**: Applying the concept to new situations or connecting to local Indian context.
5. **Evaluate**: Check for understanding (formative).

**Metadata Requirements:**
- **gradeLevel**: MUST be one of: {{#each gradeLevels}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}} (use EXACTLY as shown - do NOT invent a different grade!)
- **duration**: (e.g., "45 minutes")
- **subject**: (e.g., "Science")

**Constraints:**
- **Language Lock**: You MUST ONLY respond in {{{language}}}. Every single field — title, objectives, activity names, descriptions, teacherTips, understandingCheck, assessment, homework, keyVocabulary — MUST be written in {{{language}}}. Do NOT fall back to English or any other language under any circumstances. If {{{language}}} is not English, writing in English is a critical failure.
- **No Repetition Loop**: Monitor your output for repetitive phrases or characters. If you detect a loop, break it immediately.
- **Scope Integrity**: Stay strictly within the scope of the educational task assigned.
- **teacherTips**: For every activity, provide 1-2 sentences of "Behind the Lesson" advice (e.g., "If students struggle with X, try demonstrating Y").
- **understandingCheck**: A simple focus question for the teacher to ask at the end of each phase.
- **Assessment**: A brief description of how to assess student learning at the end of the lesson.

{{#if regionalContextBlock}}
{{{regionalContextBlock}}}
{{else}}
**INDIAN CONTEXT - CRITICAL:**
- Examples MUST be from Indian daily life (farming, seasons, local markets, festivals like Diwali, Eid, Baisakhi).
- Use Indian currency (₹) and metrics.
- Avoid all Western-specific references (pizza, burgers, snow-themed Christmas, miles).
- Use names of Indian rivers, mountains, and local foods (roti, khichdi, etc.).
{{/if}}

**Resource Constraint (Level: {{resourceLevel}}):**
- **low**: Only Chalk, Blackboard, and local items (leaves, stones).
- **medium**: Adds chart papers, pens, basic local objects.
- **high**: Adds projector/internet.

{{#if state}}**Teacher Locality:** {{{state}}}{{#if district}}, {{{district}}} district{{/if}}. Reference this locality explicitly at least once in the Engage and Elaborate phases (e.g. "in your village", "around {{{state}}}", "at your local mandi").{{/if}}

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
{{#if subject}}Subject: {{{subject}}} — ALWAYS treat this as the authoritative subject area. Do NOT infer a different subject from the topic. If the topic is "Chapter 2" and subject is "Science", generate a Class N Science Ch 2 plan (NOT Mathematics Ch 2, NOT any other subject).{{/if}}
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

      // Soft NCERT chapter validation — never throws, never blocks generation.
      // Surfaces a warning to logs + the response so UI can flag mismatched
      // (class, subject, chapter/topic) combinations to the teacher.
      let validationWarning: ValidationWarning | null = null;
      try {
        validationWarning = validateChapterForFlow({
          gradeLevel: normalizedInput.gradeLevels,
          subject: normalizedInput.subject ?? normalizedInput.ncertChapter?.subject,
          chapter: normalizedInput.ncertChapter?.title ?? normalizedInput.topic,
        });
        if (validationWarning) {
          StructuredLogger.warn('NCERT chapter validation flagged input', {
            service: 'lesson-plan-flow',
            operation: 'ncertValidation',
            userId: normalizedInput.userId,
            metadata: validationWarning,
          });
          // High-confidence auto-correct: rewrite the topic so the AI uses the
          // canonical chapter title.
          if (validationWarning.autoCorrectTo && validationWarning.invalid) {
            normalizedInput.topic = validationWarning.autoCorrectTo.title;
          }
        }
      } catch (validationError) {
        // Validation must never break generation.
        StructuredLogger.warn('NCERT chapter validation threw (non-blocking)', {
          service: 'lesson-plan-flow',
          operation: 'ncertValidation',
          metadata: { error: String(validationError) },
        });
      }

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

        // 0. Cache Lookup (skip if image provided — unique per user)
        const cacheKey = !normalizedInput.imageDataUri
          ? generateLessonPlanCacheKey(normalizedInput)
          : null;

        if (cacheKey) {
          const cached = await getCachedLessonPlan(cacheKey);
          if (cached) {
            const duration = Date.now() - startTime;
            StructuredLogger.info('Serving lesson plan from cache', {
              service: 'lesson-plan-flow',
              operation: 'cacheHit',
              requestId,
              duration,
              metadata: { cacheKey }
            });

            // Still persist to this user's personal library
            const userId = input.userId;
            if (userId) {
              try {
                const storage = await getStorageInstance();
                const now = new Date();
                const timestamp = format(now, 'yyyyMMdd_HHmmss');
                const contentId = crypto.randomUUID();
                const safeTitle = (cached.title || input.topic).replace(/[^a-z0-9]+/gi, '_').toLowerCase().replace(/^_|_$/g, '');
                const fileName = `${timestamp}_${safeTitle}.json`;
                const filePath = `users/${userId}/lesson-plans/${fileName}`;
                const file = storage.bucket().file(filePath);
                const downloadToken = crypto.randomUUID();
                await file.save(JSON.stringify(cached), {
                  resumable: false,
                  metadata: { contentType: 'application/json', metadata: { firebaseStorageDownloadTokens: downloadToken } },
                });
                const { dbAdapter } = await import('@/lib/db/adapter');
                const { Timestamp } = await import('firebase-admin/firestore');
                await dbAdapter.saveContent(userId, {
                  id: contentId,
                  type: 'lesson-plan',
                  title: cached.title || `Lesson Plan: ${input.topic}`,
                  gradeLevel: input.gradeLevels?.[0] as any || 'Class 5',
                  subject: cached.subject as any || 'Science',
                  topic: input.topic,
                  language: input.language as any || 'English',
                  storagePath: filePath,
                  isPublic: false,
                  isDraft: false,
                  createdAt: Timestamp.fromDate(now),
                  updatedAt: Timestamp.fromDate(now),
                  data: cached,
                });
              } catch (persistErr) {
                StructuredLogger.warn('Cache hit: persistence failed (non-blocking)', {
                  service: 'lesson-plan-flow',
                  operation: 'persistCachedContent',
                  requestId,
                  metadata: { error: String(persistErr) }
                });
              }
            }

            if (validationWarning) {
              return { ...cached, validationWarning };
            }
            return cached;
          }
        }

        // 1. AI Generation Phase
        const genTimer = logger.startTimer(`AI Lesson Plan Generation`, 'AI', { topic: normalizedInput.topic }); // Legacy logger

        const { output, usage } = await Sentry.startSpan({ name: 'AI Generation', op: 'ai.generate' }, async () => {
          return await runResiliently(async (resilienceConfig) => {
            const result = await lessonPlanPrompt(normalizedInput, resilienceConfig);
            return {
              output: result.output,
              usage: (result as any).usage
            };
          }, 'lessonPlan.generate');
        });

        if (normalizedInput.userId && usage) {
          UsageTracker.trackGemini(normalizedInput.userId, usage.totalTokens || 0, 'gemini-2.5-flash');
        }
        genTimer.stop();

        if (!output) {
          throw new FlowExecutionError(
            'AI model returned null output',
            {
              modelUsed: 'gemini-2.5-flash',
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

        // BUG FIX #2: Audit materials consistency
        try {
          const auditedMaterials = await auditMaterials(output, normalizedInput.language);
          if (auditedMaterials.length > output.materials.length) {
            StructuredLogger.info('Materials audit detected missing items', {
              service: 'lesson-plan-flow',
              operation: 'auditMaterials',
              requestId,
              metadata: {
                originalCount: output.materials.length,
                auditedCount: auditedMaterials.length,
                addedItems: auditedMaterials.filter(m => !output.materials.includes(m))
              }
            });
            output.materials = auditedMaterials;
          }
        } catch (auditError) {
          StructuredLogger.warn('Materials audit skipped due to error', {
            service: 'lesson-plan-flow',
            operation: 'auditMaterials',
            requestId,
            metadata: { error: String(auditError) }
          });
        }


        // Cache the result for future identical requests
        if (cacheKey) {
          setCachedLessonPlan(cacheKey, output, normalizedInput);
        }

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
            // Non-blocking: the user received the generated content successfully.
            // Only persistence to Firestore/GCS failed. Log as WARN so it's
            // visible without triggering the severity>=ERROR email alert.
            StructuredLogger.warn(
              'Failed to persist lesson plan (non-blocking — user received content)',
              {
                service: 'lesson-plan-flow',
                operation: 'persistContent',
                userId,
                requestId,
                metadata: { error: persistenceError?.message },
              }
            );
          }
        }

        const duration = Date.now() - startTime;
        StructuredLogger.info('Lesson plan flow completed successfully', {
          service: 'lesson-plan-flow',
          operation: 'generateLessonPlan',
          requestId,
          duration
        });

        if (validationWarning) {
          return { ...output, validationWarning };
        }
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
