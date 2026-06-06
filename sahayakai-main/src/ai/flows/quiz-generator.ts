/**
 * @fileOverview Creates quizzes based on a topic, context from an image, and user-specified parameters.
 *
 * - generateQuiz - A function that returns a structured quiz with an answer key.
 */

import { QuizGeneratorInput, QuizGeneratorOutput, QuizVariantsOutput } from '@/ai/schemas/quiz-generator-schemas';
import { getStorageInstance, getDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { quizGeneratorFlow } from './quiz-definitions';
import { logger } from '@/lib/logger';
import { AIQuotaExhaustedError } from '@/ai/genkit';
import { validateChapterForFlow, type ValidationWarning } from '@/lib/ncert/validate-chapter';
import { defaultNumQuestionsForGrade, getGradeBand, getBandDisplayLabel } from '@/lib/grade-bands';

/**
 * True when the error is (or wraps) an AIQuotaExhaustedError, or surfaces a
 * 429/RESOURCE_EXHAUSTED signal in its message. Checks `name` first — survives
 * production minification where `instanceof` fails across chunk boundaries.
 */
function looksLikeQuota(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { name?: string; message?: string };
  if (anyErr.name === 'AIQuotaExhaustedError') return true;
  const msg = String(anyErr.message || '');
  return msg.includes('429')
    || msg.includes('quota')
    || msg.includes('RESOURCE_EXHAUSTED')
    || msg.includes('temporarily overloaded');
}

export type { QuizGeneratorOutput, QuizVariantsOutput } from '@/ai/schemas/quiz-generator-schemas';

export async function generateQuiz(input: QuizGeneratorInput): Promise<QuizVariantsOutput> {
  const uid = input.userId;
  let localizedInput = { ...input };

  // F18-01: Grade-aware numQuestions default. The Zod schema's
  // `default(5)` is a one-size-fits-all fallback that is wrong for
  // every band except primary. We override BEFORE schema validation so
  // the caller's explicit value still wins.
  // - Primary (1-5)   → 5
  // - Middle  (6-8)   → 10
  // - Secondary (9-10)→ 15
  // - Senior (11-12)  → 20
  if (input.numQuestions === undefined || input.numQuestions === null) {
    localizedInput.numQuestions = defaultNumQuestionsForGrade(localizedInput.gradeLevel);
  }

  // F18-03: Derive gradeBandLabel ("Primary (Class 1-5)" etc.) for the
  // prompt's vocabulary-age constraint — prevents Class 3 quizzes from
  // leaking Class 9 vocabulary.
  localizedInput.gradeBandLabel = getBandDisplayLabel(getGradeBand(localizedInput.gradeLevel));

  if (uid) {
    // Fetch user's preferred language if not provided
    if (!input.language) {
      const { dbAdapter } = await import('@/lib/db/adapter');
      const profile = await dbAdapter.getUser(uid);
      if (profile?.preferredLanguage) {
        localizedInput.language = profile.preferredLanguage;
      }
    }

    // Fetch teacher context for AI personalisation
    try {
      const { getTeacherContextLine } = await import('@/lib/teacher-context');
      localizedInput.teacherContext = await getTeacherContextLine(uid);
    } catch {
      // Non-blocking — proceed without teacher context
    }
  }

  // Normalise language ("en" → "English") before the prompt's LANGUAGE LOCK
  // reads it. See src/ai/lib/normalize-language.ts.
  const { normalizeLanguage } = await import('@/ai/lib/normalize-language');
  localizedInput.language = normalizeLanguage(localizedInput.language);

  // Soft NCERT chapter validation — best-effort, never blocks generation.
  let validationWarning: ValidationWarning | null = null;
  try {
    validationWarning = validateChapterForFlow({
      gradeLevel: localizedInput.gradeLevel,
      subject: localizedInput.subject,
      chapter: localizedInput.topic,
    });
    if (validationWarning) {
      logger.warn('NCERT chapter validation flagged quiz input', 'QUIZ', validationWarning);
      // High-confidence auto-correct: rewrite topic to canonical chapter title.
      if (validationWarning.autoCorrectTo && validationWarning.invalid) {
        localizedInput.topic = validationWarning.autoCorrectTo.title;
      }
    }
  } catch (validationError) {
    logger.warn('NCERT validation threw (non-blocking)', 'QUIZ', { error: String(validationError) });
  }

  const difficulties = ['easy', 'medium', 'hard'] as const;
  const contentId = uuidv4();
  const now = new Date();
  const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');

  // Run 3 generations in parallel. Track per-variant errors so we can re-throw
  // a typed AIQuotaExhaustedError if every variant quota-failed — that lets the
  // route layer return 503 + Retry-After instead of a generic 500.
  const variantErrors: Array<unknown> = [];
  const results = await Promise.allSettled(
    difficulties.map(async (difficulty) => {
      try {
        const difficultyInput = { ...localizedInput, targetDifficulty: difficulty };
        return await quizGeneratorFlow(difficultyInput);
      } catch (error) {
        variantErrors.push(error);

        const errorDetails = {
          difficulty,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorName: (error as any)?.name,
          errorMessage: error instanceof Error ? error.message : String(error),
          // Check name first — AIQuotaExhaustedError's wrapped message
          // ("temporarily overloaded…") doesn't contain "429" so the old
          // string-only classifier silently returned false.
          isQuotaError: looksLikeQuota(error),
          isAuthError: error instanceof Error && (
            error.message?.includes('401') ||
            error.message?.includes('403') ||
            error.message?.includes('PERMISSION_DENIED') ||
            error.message?.includes('UNAUTHENTICATED')
          ),
          isConfigError: error instanceof Error && (
            error.message?.includes('API key') ||
            error.message?.includes('Secret Manager')
          ),
          timestamp: new Date().toISOString()
        };

        // Per-variant failure is WARN not ERROR — if even one of the three
        // variants succeeds, the user still gets a usable quiz.
        const errorMsg = `Quiz Generation Failed (${difficulty} variant) for topic: "${input.topic || 'Unknown'}"`;
        logger.warn(errorMsg, 'QUIZ', errorDetails);
        return null;
      }
    })
  );

  // Convert PromiseSettledResult to values
  const [easy, medium, hard] = results.map(r => r.status === 'fulfilled' ? r.value : null);

  // Extract metadata from one of the successful outputs (prefer medium)
  const metaSource = medium || easy || hard;
  const inferredGrade = metaSource?.gradeLevel;
  const inferredSubject = metaSource?.subject;

  const output: QuizVariantsOutput = {
    easy,
    medium,
    hard,
    id: contentId,
    gradeLevel: inferredGrade || localizedInput.gradeLevel || 'Class 5',
    subject: inferredSubject || localizedInput.subject || 'General',
    topic: input.topic,
    isSaved: !!input.userId, // If userId is present, it will be auto-saved below
    validationWarning: validationWarning ?? undefined,
  };

  // If all failed, surface the best-shaped error so the route layer can map
  // to the correct HTTP status. If *any* variant failed with a quota signal,
  // re-throw AIQuotaExhaustedError → handleAIError → 503 + Retry-After.
  if (!easy && !medium && !hard) {
    if (variantErrors.some(looksLikeQuota)) {
      throw new AIQuotaExhaustedError(
        'AI service is temporarily overloaded. Please try again in a minute.',
        60,
      );
    }
    throw new Error('The AI model failed to generate any valid quiz variants.');
  }

  if (input.userId) {
    const storage = await getStorageInstance();
    // const db = await getDb(); // Removed unused

    const fileName = `${timestamp}-${contentId}.json`;
    const filePath = `users/${input.userId}/quizzes/${fileName}`;
    const file = storage.bucket().file(filePath);

    await file.save(JSON.stringify(output), {
      contentType: 'application/json',
    });

    const { dbAdapter } = await import('@/lib/db/adapter');
    const { Timestamp } = await import('firebase-admin/firestore');

    await dbAdapter.saveContent(input.userId, {
      id: contentId,
      type: 'quiz', // Keep type 'quiz' but data is now multi-variant
      title: input.topic || 'Quiz',
      gradeLevel: (output.gradeLevel || input.gradeLevel || 'Class 5') as any,
      subject: (output.subject || 'General') as any,
      topic: input.topic,
      language: input.language as any || 'English',
      storagePath: filePath,
      isPublic: false,
      isDraft: false,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      data: output,
    });
  }

  return output;
}
