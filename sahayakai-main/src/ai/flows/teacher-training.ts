
'use server';

/**
 * @fileOverview Provides professional development advice and encouragement for teachers.
 *
 * - getTeacherTrainingAdvice - A function that takes a question and returns personalized advice.
 * - TeacherTrainingInput - The input type for the getTeacherTrainingAdvice function.
 * - TeacherTrainingOutput - The return type for the getTeacherTrainingAdvice function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getStorageInstance, getDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const TeacherTrainingInputSchema = z.object({
  question: z.string().describe("The teacher's question or request for advice."),
  language: z.string().optional().describe('The language for the response.'),
  userId: z.string().optional().describe('The ID of the user for whom the advice is being generated.'),
});
export type TeacherTrainingInput = z.infer<typeof TeacherTrainingInputSchema>;

const TeacherTrainingOutputSchema = z.object({
  introduction: z.string().describe("A brief, empathetic introduction acknowledging the teacher's question."),
  advice: z.array(z.object({
    strategy: z.string().describe("A clear, actionable strategy or technique the teacher can use."),
    pedagogy: z.string().describe("The name of the core pedagogical principle behind the strategy (e.g., 'Constructivism', 'Scaffolding')."),
    explanation: z.string().describe("A simple explanation of the pedagogical principle and why it works, including a relevant analogy."),
  })).describe("A list of advice points."),
  conclusion: z.string().describe("A final, encouraging and motivational closing statement for the teacher."),
});
export type TeacherTrainingOutput = z.infer<typeof TeacherTrainingOutputSchema>;

export async function getTeacherTrainingAdvice(input: TeacherTrainingInput): Promise<TeacherTrainingOutput> {
  return teacherTrainingFlow(input);
}

const teacherTrainingPrompt = ai.definePrompt({
  name: 'teacherTrainingPrompt',
  input: { schema: TeacherTrainingInputSchema },
  output: { schema: TeacherTrainingOutputSchema, format: 'json' },
  prompt: `You are SahayakAI, a compassionate and experienced professional development coach for teachers in India. Your goal is to provide supportive, practical, and encouraging advice that is grounded in sound pedagogy.

**Instructions:**
1.  **Empathy First:** Start with a supportive and understanding introduction that acknowledges the teacher's specific challenge.
2.  **Actionable Strategies:** Provide a list of clear, concrete strategies. Each strategy should be a separate item in the 'advice' array.
3.  **MANDATORY Pedagogy Connection:** For EACH strategy, you MUST identify the core pedagogical principle at play. Put the name of this principle in the \`pedagogy\` field.
4.  **Explain the 'Why':** In the \`explanation\` field, briefly explain what the pedagogical principle means and why the strategy is effective. Use simple, relevant analogies (especially from an Indian context) to make the concept easier to understand.
5.  **Encouraging Conclusion:** End with a warm, motivational closing statement to remind the teacher of their value.
6.  **Language:** Respond entirely in the specified \`language\`.
7.  **JSON Output:** You MUST conform strictly to the required JSON output format.

**Teacher's Request:**
-   **Question/Concern:** {{{question}}}
-   **Language:** {{{language}}}
`,
});

const teacherTrainingFlow = ai.defineFlow(
  {
    name: 'teacherTrainingFlow',
    inputSchema: TeacherTrainingInputSchema,
    outputSchema: TeacherTrainingOutputSchema,
  },
  async input => {
    const { runResiliently } = await import('@/ai/genkit');
    const { StructuredLogger } = await import('@/lib/logger/structured-logger');
    const { FlowExecutionError, SchemaValidationError, PersistenceError } = await import('@/lib/errors');
    // Imports for persistence
    const { getStorageInstance } = await import('@/lib/firebase-admin');
    const { format } = await import('date-fns');
    const { v4: uuidv4 } = await import('uuid');

    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      StructuredLogger.info('Starting teacher training flow', {
        service: 'teacher-training-flow',
        operation: 'getTeacherTrainingAdvice',
        userId: input.userId,
        requestId,
        input: {
          question: input.question,
          language: input.language
        }
      });

      const { output } = await runResiliently(async (resilienceConfig) => {
        return await teacherTrainingPrompt(input, resilienceConfig);
      });

      if (!output) {
        throw new FlowExecutionError(
          'AI model returned null output',
          {
            modelUsed: 'gemini-2.0-flash',
            input: input.question
          }
        );
      }

      // Validate schema explicit check
      try {
        TeacherTrainingOutputSchema.parse(output);
      } catch (validationError: any) {
        throw new SchemaValidationError(
          `Schema validation failed: ${validationError.message}`,
          {
            parseErrors: validationError.errors,
            rawOutput: output,
            expectedSchema: 'TeacherTrainingOutputSchema'
          }
        );
      }

      if (input.userId) {
        try {
          const now = new Date();
          const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
          const contentId = uuidv4();
          const fileName = `${timestamp}-${contentId}.json`;
          const filePath = `users/${input.userId}/teacher-training/${fileName}`;

          const storage = await getStorageInstance();
          const file = storage.bucket().file(filePath);

          await file.save(JSON.stringify(output), {
            contentType: 'application/json',
          });

          // Use dbAdapter if possible, or fallback to direct Firestore if dbAdapter doesn't support this type yet?
          // Looking at previous files, they used dbAdapter or getDb.
          // The original code used getDb(). Let's use getDb to match original logic but wrapped involved in try/catch

          const { getDb } = await import('@/lib/firebase-admin');
          const db = await getDb();
          await db.collection('users').doc(input.userId).collection('content').doc(contentId).set({
            type: 'teacher-training',
            topic: input.question,
            language: input.language,
            storagePath: filePath,
            createdAt: now,
            isPublic: false,
          });

          StructuredLogger.info('Content persisted successfully', {
            service: 'teacher-training-flow',
            operation: 'persistContent',
            userId: input.userId,
            requestId,
            metadata: { contentId }
          });

        } catch (persistenceError: any) {
          StructuredLogger.error(
            'Failed to persist teacher training advice',
            {
              service: 'teacher-training-flow',
              operation: 'persistContent',
              userId: input.userId,
              requestId
            },
            new PersistenceError('Persistence failed', 'saveContent')
          );
        }
      }

      const duration = Date.now() - startTime;
      StructuredLogger.info('Teacher training flow completed successfully', {
        service: 'teacher-training-flow',
        operation: 'getTeacherTrainingAdvice',
        requestId,
        duration
      });

      return output;

    } catch (flowError: any) {
      const duration = Date.now() - startTime;

      const errorId = StructuredLogger.error(
        'Teacher training flow execution failed',
        {
          service: 'teacher-training-flow',
          operation: 'getTeacherTrainingAdvice',
          requestId,
          input: {
            question: input.question
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
  }
);
