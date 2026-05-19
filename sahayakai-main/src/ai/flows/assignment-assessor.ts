/**
 * @fileOverview AI-powered assessment of a single handwritten student
 * assignment.
 *
 * - assessAssignment — takes a photo (data URI) + optional rubric and
 *   returns a structured grade: transcript, score, per-criterion feedback,
 *   strengths, improvements, next steps, and confidence per criterion.
 *
 * Mirrors `rubric-generator.ts` for flow shape (Zod schemas, `runResiliently`,
 * dbAdapter persistence, StructuredLogger, structured errors).
 *
 * Model: `gemini-2.5-pro` — vision + reasoning quality matter for grading
 * subjective handwriting. `temperature: 0.1` keeps scoring stable across
 * runs. The 5-stage chain-of-thought inside the prompt is intentional: a
 * transcribe→presence-check→score→feedback→summarise pipeline kills the
 * "model invents an answer for a blank region" failure documented in
 * arxiv literature for multi-modal LLMs.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { SAHAYAK_SOUL_PROMPT, STRUCTURED_OUTPUT_OVERRIDE } from '@/ai/soul';
import { normalizeLanguage } from '@/ai/lib/normalize-language';
import { HANDWRITING_FEW_SHOTS } from '@/ai/lib/handwriting-fewshots';
import { validateAssessment } from './assignment-assessor-validation';
import { RubricGeneratorOutputSchema, type RubricGeneratorOutput } from './rubric-generator';

const ASSESSMENT_MODEL = 'googleai/gemini-2.5-pro';

const RubricSnapshotSchema = RubricGeneratorOutputSchema;

const PerCriterionScoreSchema = z.object({
  criterionName: z.string().describe("The name of the rubric criterion being scored."),
  level: z.string().describe("The performance level the student reached for this criterion (e.g. 'Proficient')."),
  points: z.number().describe("Points awarded for this criterion."),
  maxPoints: z.number().describe("Maximum points possible for this criterion."),
  feedback: z.string().describe("1-2 sentences citing the transcript when possible. No emojis."),
  confidence: z.number().min(0).max(1).describe("Model's self-rated confidence for this criterion. <0.5 surfaces a warning in the UI."),
});

export const AssessAssignmentInputSchema = z.object({
  imageDataUri: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,/, 'imageDataUri must be a base64 data URI for jpeg/png/webp')
    .describe("The student's handwritten work as a base64 data URI."),
  rubricSnapshot: RubricSnapshotSchema.optional().describe('Rubric to grade against. If omitted, the model will infer a sensible rubric from the work.'),
  language: z.string().optional().describe('Output language (display name or ISO code).'),
  subject: z.string().optional().describe('Academic subject hint.'),
  gradeLevel: z.string().optional().describe('Grade level hint (e.g. "Class 5").'),
  studentId: z
    .string()
    .max(64)
    .optional()
    .describe('Anonymous student handle — NEVER a name. Name PII must be stripped at the API boundary.'),
  editedTranscript: z.string().optional().describe("If the teacher has corrected the transcript before scoring, pass it here and set mode='score'."),
  mode: z.enum(['full', 'transcribe', 'score']).default('full').describe("'full' runs all 5 stages. 'transcribe' returns only the transcript stage. 'score' uses editedTranscript without re-reading the image."),
  userId: z.string().optional().describe('Owner uid for persistence + usage tracking.'),
  teacherContext: z.string().optional().describe('Career-stage context line for tone calibration.'),
});
export type AssessAssignmentInput = z.infer<typeof AssessAssignmentInputSchema>;

export const AssessAssignmentOutputSchema = z.object({
  assessmentId: z.string().describe('Server-assigned UUID; the model may leave this blank.'),
  rawTranscript: z.string().describe("Literal transcription of the student's handwriting. Uses [BLANK] for empty regions and [???] for unreadable text. NEVER invented answers."),
  editedTranscript: z.string().nullable().describe('Echo of the teacher-edited transcript when one was provided; null otherwise.'),
  language: z.string().describe('Output language used for feedback (display name).'),
  overallScore: z.number().min(0).max(100).describe('Round(100 * pointsEarned / pointsPossible).'),
  pointsEarned: z.number(),
  pointsPossible: z.number(),
  perCriterionScores: z.array(PerCriterionScoreSchema).describe('One row per rubric criterion.'),
  strengths: z.array(z.string()).min(1).max(5).describe('Up to 5 specific things the student did well.'),
  improvements: z.array(z.string()).min(1).max(5).describe('Up to 5 specific things to work on.'),
  nextSteps: z.array(z.string()).min(1).max(3).describe('Up to 3 concrete next-step practice tasks.'),
  teacherNote: z.string().describe('One short paragraph the teacher can read aloud to the student.'),
  confidenceOverall: z.number().min(0).max(1).describe('Overall self-rated confidence across all criteria.'),
  warnings: z.array(z.string()).default([]).describe('Machine-readable warnings: "page_appears_blank" | "low_contrast" | "partial_writing" | "language_mismatch".'),
  rubricSnapshot: RubricSnapshotSchema.describe('The rubric that was applied (echoed back for audit).'),
  studentId: z.string().nullable().describe('Echo of the anonymous student handle, if one was provided.'),
  createdAtIso: z.string().describe('ISO timestamp set server-side.'),
});
export type AssessAssignmentOutput = z.infer<typeof AssessAssignmentOutputSchema>;

const PromptInputSchema = AssessAssignmentInputSchema.extend({
  rubricJson: z.string().describe('Stringified rubricSnapshot for the prompt.'),
  fewShots: z.string().describe('Stringified few-shot exemplars.'),
});

export async function assessAssignment(input: AssessAssignmentInput): Promise<AssessAssignmentOutput> {
  const localizedInput: AssessAssignmentInput = { ...input };

  if (localizedInput.userId && localizedInput.userId !== 'anonymous_user') {
    if (!localizedInput.language || !localizedInput.gradeLevel) {
      try {
        const { dbAdapter } = await import('@/lib/db/adapter');
        const profile = await dbAdapter.getUser(localizedInput.userId);
        if (!localizedInput.language && profile?.preferredLanguage) {
          localizedInput.language = profile.preferredLanguage;
        }
        if (!localizedInput.gradeLevel && profile?.teachingGradeLevels?.length) {
          localizedInput.gradeLevel = profile.teachingGradeLevels[0];
        }
      } catch {
        // Profile fetch is non-blocking — fall through with the original input.
      }
    }

    try {
      const { getTeacherContextLine } = await import('@/lib/teacher-context');
      localizedInput.teacherContext = await getTeacherContextLine(localizedInput.userId);
    } catch {
      // Non-blocking.
    }
  }

  localizedInput.language = normalizeLanguage(localizedInput.language);

  return assignmentAssessorFlow(localizedInput);
}

const assignmentAssessorPrompt = ai.definePrompt({
  name: 'assignmentAssessorPrompt',
  model: ASSESSMENT_MODEL,
  config: {
    temperature: 0.1,
    topP: 0.95,
    maxOutputTokens: 8192,
  },
  input: { schema: PromptInputSchema },
  output: { schema: AssessAssignmentOutputSchema },
  prompt: `${SAHAYAK_SOUL_PROMPT}${STRUCTURED_OUTPUT_OVERRIDE}
{{#if teacherContext}}{{{teacherContext}}}{{/if}}

You are an experienced Indian school teacher assessing ONE student's handwritten assignment. Rigorous, kind, specific.

**LANGUAGE LOCK**: Respond ONLY in {{{language}}} for every field (teacherNote, feedback, strengths, improvements, nextSteps). The transcript field preserves whatever scripts the student actually wrote (Devanagari + English digits is fine — keep it verbatim).

**Stage 1 — Transcribe (literal)**
Read region by region (top to bottom, left to right). Write exact text into rawTranscript. Mark unreadable words [???]. If a region has NO ink/marks, write [BLANK]. NEVER invent answers.

**Stage 2 — Presence check (hard rule)**
If the page is entirely blank or only contains the printed question/prompt (no student ink, no drawings):
- Set overallScore=0
- Append "page_appears_blank" to warnings
- Set every per-criterion confidence to 0.1 and every per-criterion points to 0
- teacherNote = "No student work was detected in this image. Please verify the photo and try again."
- Skip stages 3–5; still produce the required output schema.

**Stage 3 — Score against the rubric**
For EACH criterion in rubricSnapshot.criteria:
- Pick the best-matching level
- Record its points (from that level's points) and the maxPoints (the highest points value across that criterion's levels)
- Set confidence (0.0–1.0). Mark <0.5 when handwriting is partial / illegible / borderline.

**Stage 4 — Per-criterion feedback (Indian classroom tone)**
1-2 sentences naming WHAT the student did or missed. Quote the transcript when possible (e.g. "wrote 'पानी का चक्र' correctly" / "answered 12 instead of 15"). No emojis. No "great job!" platitudes. Specific.

**Stage 5 — Strengths / Improvements / Next Steps**
Up to 3 strengths, 3 improvements, 3 next-step practice tasks. teacherNote = one paragraph the teacher could read aloud — warm, specific, ends with one concrete encouragement.

**Rubric to apply (JSON)**:
{{{rubricJson}}}

**Few-shot Indic exemplars (DO NOT copy verbatim — calibration only)**:
{{{fewShots}}}

**Image of the student's work**:
{{media url=imageDataUri}}

{{#if editedTranscript}}
**Teacher-edited transcript (use this verbatim INSTEAD of re-reading the image for stages 3–5)**:
{{{editedTranscript}}}
{{/if}}

**Hard constraints**:
- Output MUST match the response schema exactly. No prose outside the JSON.
- overallScore = round(100 * pointsEarned / pointsPossible). If pointsPossible is 0, overallScore = 0.
- assessmentId may be the empty string (server overwrites).
- createdAtIso may be the empty string (server overwrites).
- NEVER include the student's name in any field — refer to "the student".
- echo rubricSnapshot back exactly as provided in the input.
`,
});

const assignmentAssessorFlow = ai.defineFlow(
  {
    name: 'assignmentAssessorFlow',
    inputSchema: AssessAssignmentInputSchema,
    outputSchema: AssessAssignmentOutputSchema,
  },
  async (input): Promise<AssessAssignmentOutput> => {
    const { runResiliently } = await import('@/ai/genkit');
    const { StructuredLogger } = await import('@/lib/logger/structured-logger');
    const { FlowExecutionError, SchemaValidationError, PersistenceError } = await import('@/lib/errors');
    const { v4: uuidv4 } = await import('uuid');
    const { format } = await import('date-fns');

    const requestId = uuidv4();
    const startTime = Date.now();
    const language = normalizeLanguage(input.language);

    StructuredLogger.info('Starting assignment assessment flow', {
      service: 'assignment-assessor-flow',
      operation: 'assessAssignment',
      userId: input.userId,
      requestId,
      metadata: {
        mode: input.mode,
        language,
        subject: input.subject,
        gradeLevel: input.gradeLevel,
        hasRubric: !!input.rubricSnapshot,
        hasEditedTranscript: !!input.editedTranscript,
      },
    });

    const effectiveRubric: RubricGeneratorOutput =
      input.rubricSnapshot && input.rubricSnapshot.criteria?.length
        ? (input.rubricSnapshot as RubricGeneratorOutput)
        : DEFAULT_RUBRIC;

    const rubricJson = JSON.stringify(effectiveRubric, null, 2);

    try {
      const { output, usage } = await runResiliently(async (resilienceConfig) => {
        return assignmentAssessorPrompt(
          {
            ...input,
            language,
            rubricJson,
            fewShots: HANDWRITING_FEW_SHOTS,
          },
          resilienceConfig,
        );
      }, 'assess.assignment');

      if (!output) {
        throw new FlowExecutionError('AI model returned null output', {
          modelUsed: ASSESSMENT_MODEL,
          mode: input.mode,
        });
      }

      const assessmentId = uuidv4();
      const createdAtIso = new Date().toISOString();

      const enriched: AssessAssignmentOutput = {
        ...output,
        assessmentId,
        createdAtIso,
        language,
        rubricSnapshot: effectiveRubric,
        studentId: input.studentId ?? null,
        editedTranscript: input.editedTranscript ?? output.editedTranscript ?? null,
        warnings: Array.isArray(output.warnings) ? output.warnings : [],
      };

      try {
        AssessAssignmentOutputSchema.parse(enriched);
      } catch (validationError: any) {
        throw new SchemaValidationError(`Schema validation failed: ${validationError.message}`, {
          parseErrors: validationError.errors,
          rawOutput: output,
          expectedSchema: 'AssessAssignmentOutputSchema',
        });
      }

      const guard = validateAssessment(enriched);
      const finalOutput: AssessAssignmentOutput = guard.repaired ?? enriched;
      if (guard.addedWarnings.length) {
        StructuredLogger.warn('Assessment presence guard triggered', {
          service: 'assignment-assessor-flow',
          operation: 'presenceGuard',
          userId: input.userId,
          requestId,
          metadata: { addedWarnings: guard.addedWarnings, assessmentId },
        });
      }

      if (input.userId && input.userId !== 'anonymous_user') {
        try {
          const { getStorageInstance } = await import('@/lib/firebase-admin');
          const storage = await getStorageInstance();
          const now = new Date();
          const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
          const filePath = `users/${input.userId}/assessments/${assessmentId}/${timestamp}-result.json`;
          const file = storage.bucket().file(filePath);
          await file.save(JSON.stringify(finalOutput), { contentType: 'application/json' });

          const { dbAdapter } = await import('@/lib/db/adapter');
          const { Timestamp } = await import('firebase-admin/firestore');

          await dbAdapter.saveContent(input.userId, {
            id: assessmentId,
            type: 'assessment',
            title: `Assessment: ${input.subject || finalOutput.rubricSnapshot.subject || 'Assignment'} (${finalOutput.overallScore}%)`,
            gradeLevel: (input.gradeLevel || finalOutput.rubricSnapshot.gradeLevel || 'Class 5') as any,
            subject: (input.subject || finalOutput.rubricSnapshot.subject || 'General') as any,
            topic: finalOutput.rubricSnapshot.title || 'Handwritten assignment',
            language: language as any,
            storagePath: filePath,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: finalOutput,
          });

          StructuredLogger.info('Assessment persisted', {
            service: 'assignment-assessor-flow',
            operation: 'persistAssessment',
            userId: input.userId,
            requestId,
            metadata: { assessmentId, storagePath: filePath },
          });
        } catch (persistenceError: any) {
          StructuredLogger.warn(
            'Failed to persist assessment (non-blocking — user received result)',
            {
              service: 'assignment-assessor-flow',
              operation: 'persistAssessment',
              userId: input.userId,
              requestId,
              metadata: { error: persistenceError?.message, assessmentId },
            },
          );
          // Surface but DON'T throw — persistence failure should not block the
          // teacher receiving their grade. The route returns the result with
          // `partial=true` only if PersistenceError is explicitly raised; here
          // we swallow because the model output is already user-visible.
          void PersistenceError;
        }
      }

      if (input.userId && usage?.totalTokens) {
        try {
          const { UsageTracker } = await import('@/lib/usage-tracker');
          UsageTracker.trackGemini(input.userId, usage.totalTokens, ASSESSMENT_MODEL);
        } catch (trackingError) {
          // Tracking is best-effort and must never fail the request.
          StructuredLogger.warn('Usage tracking failed', {
            service: 'assignment-assessor-flow',
            operation: 'trackUsage',
            userId: input.userId,
            requestId,
            metadata: { error: (trackingError as Error)?.message },
          });
        }
      }

      const duration = Date.now() - startTime;
      StructuredLogger.info('Assessment flow completed', {
        service: 'assignment-assessor-flow',
        operation: 'assessAssignment',
        requestId,
        duration,
        metadata: {
          assessmentId,
          overallScore: finalOutput.overallScore,
          warnings: finalOutput.warnings,
          confidenceOverall: finalOutput.confidenceOverall,
        },
      });

      return finalOutput;
    } catch (flowError: any) {
      const duration = Date.now() - startTime;
      const errorId = StructuredLogger.error(
        'Assessment flow execution failed',
        {
          service: 'assignment-assessor-flow',
          operation: 'assessAssignment',
          requestId,
          duration,
          metadata: {
            errorType: flowError?.constructor?.name,
            errorCode: flowError?.errorCode,
          },
        },
        flowError,
      );
      if (typeof flowError === 'object' && flowError !== null) {
        flowError.errorId = errorId;
      }
      throw flowError;
    }
  },
);

const DEFAULT_RUBRIC: RubricGeneratorOutput = {
  title: 'General Assignment Rubric',
  description: 'A 4-level rubric used when the teacher has not picked or generated one.',
  criteria: [
    {
      name: 'Understanding of the Topic',
      description: 'Does the student show conceptual grasp of what was asked?',
      levels: [
        { name: 'Exemplary', description: 'Demonstrates complete and accurate understanding.', points: 4 },
        { name: 'Proficient', description: 'Demonstrates correct understanding with minor gaps.', points: 3 },
        { name: 'Developing', description: 'Partial understanding; some key ideas missing.', points: 2 },
        { name: 'Beginning', description: 'Minimal evidence of understanding.', points: 1 },
      ],
    },
    {
      name: 'Accuracy of Answers',
      description: 'Are the answers correct?',
      levels: [
        { name: 'Exemplary', description: 'All answers are correct.', points: 4 },
        { name: 'Proficient', description: '0–1 minor errors.', points: 3 },
        { name: 'Developing', description: '2–3 errors that affect meaning.', points: 2 },
        { name: 'Beginning', description: 'More than 3 errors or major misconceptions.', points: 1 },
      ],
    },
    {
      name: 'Presentation & Handwriting',
      description: 'Is the work neat, legible, and well-organised?',
      levels: [
        { name: 'Exemplary', description: 'Neat, legible, well-organised throughout.', points: 4 },
        { name: 'Proficient', description: 'Mostly neat with minor lapses.', points: 3 },
        { name: 'Developing', description: 'Legible but inconsistent.', points: 2 },
        { name: 'Beginning', description: 'Hard to read or disorganised.', points: 1 },
      ],
    },
    {
      name: 'Completion',
      description: 'Did the student attempt all required parts?',
      levels: [
        { name: 'Exemplary', description: 'All parts attempted thoughtfully.', points: 4 },
        { name: 'Proficient', description: 'All parts attempted.', points: 3 },
        { name: 'Developing', description: 'Most parts attempted.', points: 2 },
        { name: 'Beginning', description: 'Many parts missing.', points: 1 },
      ],
    },
  ],
  gradeLevel: null,
  subject: null,
};
