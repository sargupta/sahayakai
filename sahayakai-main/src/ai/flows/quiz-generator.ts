'use server';

/**
 * @fileOverview Creates quizzes based on a topic, context from an image, and user-specified parameters.
 *
 * - generateQuiz - A function that returns a structured quiz with an answer key.
 */

import { QuizGeneratorInput, QuizGeneratorOutput } from '@/ai/schemas/quiz-generator-schemas';
import { getStorageInstance, getDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { quizGeneratorFlow } from './quiz-definitions';

export type { QuizGeneratorOutput } from '@/ai/schemas/quiz-generator-schemas';

export async function generateQuiz(input: QuizGeneratorInput): Promise<QuizGeneratorOutput> {
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

  const output = await quizGeneratorFlow(localizedInput);

  if (!output) {
    throw new Error('The AI model failed to generate a valid quiz. The returned output was null.');
  }

  if (input.userId) {
    const storage = await getStorageInstance();
    const db = await getDb();

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
      type: 'quiz',
      title: input.topic || 'Quiz',
      gradeLevel: input.gradeLevel as any || 'Class 5',
      subject: 'General',
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
