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

  // Normalize language: form/API often sends ISO code ("en", "hi") but the
  // prompt's "Language Lock" instruction is clearer when given the full name
  // ("English", "Hindi"). Without this, the AI sometimes read "en" as a hint
  // that English + Hinglish mixing was acceptable and produced quizzes with
  // ~1,000 Devanagari words leaking into a supposedly-English output.
  if (localizedInput.language) {
    const { LANGUAGE_CODE_MAP } = await import('@/types/index');
    const lower = localizedInput.language.toLowerCase();
    const mapped = (LANGUAGE_CODE_MAP as Record<string, string>)[lower];
    if (mapped) localizedInput.language = mapped;
  } else {
    localizedInput.language = 'English';
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
    isSaved: !!input.userId // If userId is present, it will be auto-saved below
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
