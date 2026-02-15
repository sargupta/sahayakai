'use server';

import { QuizInput, QuizOutput, QuizInputSchema } from '@/ai/schemas/quiz-schema';
import { saveContent } from '@/lib/content-persistence';
import { quizGeneratorFlow } from './quiz-definitions';
import { logger, logError } from '@/lib/cloud-logging';

export type { QuizOutput as QuizGeneratorOutput } from '@/ai/schemas/quiz-schema';

export async function generateQuiz(input: any): Promise<QuizOutput> {
  const startTime = Date.now();
  const userId = input.userId;

  try {
    // Map legacy fields from UI to new schema fields
    const validatedInput: QuizInput = QuizInputSchema.parse({
      ...input,
      questionCount: input.numQuestions || input.questionCount || 5,
      // Default to Science if subject missing (per user context)
      subject: input.subject || 'Science',
      // Map UI underscore types to schema hyphenated/short types
      questionTypes: input.questionTypes?.map((t: string) => {
        if (t === 'multiple_choice') return 'mcq';
        if (t === 'fill_in_the_blanks') return 'fill-blank';
        if (t === 'short_answer') return 'short-answer';
        if (t === 'true_false') return 'true-false';
        return t;
      }),
    });

    await logger.info({
      event: 'quiz_generation_started',
      userId,
      metadata: { topic: validatedInput.topic, gradeLevel: validatedInput.gradeLevel }
    });

    const output = await quizGeneratorFlow(validatedInput);

    if (!output) {
      throw new Error('The AI model failed to generate a valid quiz. The returned output was null.');
    }

    const latencyMs = Date.now() - startTime;
    await logger.info({
      event: 'quiz_generation_completed',
      userId,
      latencyMs,
      metadata: { topic: validatedInput.topic, questionCount: output.questions.length }
    });

    if (userId) {
      await saveContent({
        userId,
        contentType: 'quiz',
        title: output.topic || validatedInput.topic,
        content: output,
        metadata: {
          gradeLevel: validatedInput.gradeLevel,
          subject: validatedInput.subject,
          language: validatedInput.language,
          description: `Quiz on ${validatedInput.topic} (${output.questions.length} questions)`,
        }
      });
    }

    return output;
  } catch (error: any) {
    await logError({
      event: 'quiz_generation_failed',
      error,
      userId,
      metadata: { topic: input.topic }
    });
    throw error;
  }
}
