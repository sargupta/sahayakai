'use server';

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
  }

  // Define the difficulties to generate
  const difficulties = ['easy', 'medium', 'hard'] as const;

  // Run 3 generations in parallel with detailed error tracking
  const results = await Promise.allSettled(
    difficulties.map(async (difficulty) => {
      try {
        const difficultyInput = { ...localizedInput, targetDifficulty: difficulty };
        return await quizGeneratorFlow(difficultyInput);
      } catch (error) {
        // Enhanced diagnostic logging
        const errorDetails = {
          difficulty,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          // NEW: Expose quota/auth signals
          isQuotaError: error instanceof Error && (
            error.message?.includes('429') ||
            error.message?.includes('quota') ||
            error.message?.includes('RESOURCE_EXHAUSTED')
          ),
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

        console.error(`❌ [Quiz Generator] ${difficulty} variant failed:`, errorDetails);
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
    gradeLevel: inferredGrade,
    subject: inferredSubject,
    topic: input.topic
  };

  // If all failed, throw error
  if (!easy && !medium && !hard) {
    throw new Error('The AI model failed to generate any valid quiz variants.');
  }

  if (input.userId) {
    const storage = await getStorageInstance();
    // const db = await getDb(); // Removed unused

    const now = new Date();
    const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
    const contentId = uuidv4();
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
