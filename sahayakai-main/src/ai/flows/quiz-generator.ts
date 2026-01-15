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
  const output = await quizGeneratorFlow(input);

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

    await db.collection('users').doc(input.userId).collection('content').doc(contentId).set({
      type: 'quiz',
      topic: input.topic,
      gradeLevels: [input.gradeLevel],
      language: input.language,
      storagePath: filePath,
      createdAt: now,
      isPublic: false,
    });
  }

  return output;
}
