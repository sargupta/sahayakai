'use server';

/**
 * @fileOverview Provides instant answers to user questions using a knowledge base augmented by Google Search.
 *
 * - instantAnswer - A function that takes a question and returns a direct answer, potentially with a video suggestion.
 * - InstantAnswerInput - The input type for the instantAnswer function.
 * - InstantAnswerOutput - The return type for the instantAnswer function.
 */

import { ai, runResiliently } from '@/ai/genkit';
import { z } from 'genkit';
import { googleSearch } from '@/ai/tools/google-search';
import { getStorageInstance, getDb } from '@/lib/firebase-admin';
import { format } from 'date-fns';

import { validateTopicSafety } from '@/lib/safety';
import { GRADE_LEVELS, LANGUAGES } from '@/types';

const InstantAnswerInputSchema = z.object({
  question: z.string().describe('The question asked by the user.'),
  language: z.enum([...LANGUAGES] as [string, ...string[]]).optional().describe('The language for the answer.'),
  gradeLevel: z.enum([...GRADE_LEVELS] as [string, ...string[]]).optional().describe('The grade level the answer should be tailored for.'),
  userId: z.string().optional().describe('The ID of the user for whom the answer is being generated.'),
});
export type InstantAnswerInput = z.infer<typeof InstantAnswerInputSchema>;

const InstantAnswerOutputSchema = z.object({
  answer: z.string().describe('The generated answer to the question.'),
  videoSuggestionUrl: z.string().nullable().optional().describe('A URL to a relevant YouTube video.'),
});
export type InstantAnswerOutput = z.infer<typeof InstantAnswerOutputSchema>;

export async function instantAnswer(input: InstantAnswerInput): Promise<InstantAnswerOutput> {
  // 1. Safety Check
  const safety = validateTopicSafety(input.question);
  if (!safety.safe) throw new Error(`Safety Violation: ${safety.reason}`);

  // 2. Rate Limit
  const uid = input.userId || 'anonymous_user';
  if (uid !== 'anonymous_user') {
    const { checkServerRateLimit } = await import('@/lib/server-safety');
    await checkServerRateLimit(uid);
  }

  return instantAnswerFlow(input);
}

const instantAnswerPrompt = ai.definePrompt({
  name: 'instantAnswerPrompt',
  input: { schema: InstantAnswerInputSchema },
  output: { schema: InstantAnswerOutputSchema },
  tools: [googleSearch],
  prompt: `You are an expert educator and knowledge base. Your goal is to answer questions accurately and concisely.

**Instructions:**
1.  **Use Tools:** If the question requires current information or facts, use the \`googleSearch\` tool to get up-to-date information.
2.  **Tailor the Answer:** Adjust the complexity and vocabulary of your answer based on the provided \`gradeLevel\`. If no grade level is given, answer for a general audience.
3.  **Language:** Respond in the specified \`language\`.
4.  **Analogies:** For complex topics, use simple analogies, especially for younger grade levels.
5.  **Video Suggestions:** If the user's question implies they want a visual explanation (e.g., "show me," "explain how"), or if a video would be a great supplement, provide a YouTube Search URL in the \`videoSuggestionUrl\` field. The format MUST be: \`https://www.youtube.com/results?search_query=\` followed by a concise, relevant search query (e.g., "photosynthesis for class 5"). Do NOT try to guess a specific video ID (like watch?v=xyz) as it might be fake. Always use the search results URL.
6.  **Be Direct:** Provide the answer directly without conversational filler.

**User's Question:**
- **Question:** {{{question}}}
- **Grade Level:** {{{gradeLevel}}}
- **Language:** {{{language}}}
`,
});

const instantAnswerFlow = ai.defineFlow(
  {
    name: 'instantAnswerFlow',
    inputSchema: InstantAnswerInputSchema,
    outputSchema: InstantAnswerOutputSchema,
  },
  async input => {
    try {
      console.log('[Instant Answer Flow] Starting execution', {
        timestamp: new Date().toISOString(),
        hasQuestion: !!input.question,
        questionLength: input.question?.length,
        language: input.language,
        gradeLevel: input.gradeLevel
      });

      const { output } = await runResiliently(async (resilienceConfig) => {
        return await instantAnswerPrompt(input, resilienceConfig);
      });

      // LOG THE RAW OUTPUT - This is critical for debugging schema issues
      console.log('[Instant Answer Flow] Raw AI output received', {
        timestamp: new Date().toISOString(),
        outputExists: !!output,
        outputType: typeof output,
        outputKeys: output ? Object.keys(output) : [],
        outputAnswerType: output?.answer ? typeof output.answer : 'missing',
        outputVideoType: output?.videoSuggestionUrl ? typeof output.videoSuggestionUrl : 'missing',
        rawOutput: JSON.stringify(output, null, 2)
      });

      if (!output) {
        throw new Error('The AI model failed to generate an instant answer. The returned output was null.');
      }

      // Validate and sanitize output to ensure it matches schema
      const sanitizedOutput: InstantAnswerOutput = {
        answer: output.answer || 'Unable to generate an answer at this time.',
        videoSuggestionUrl: output.videoSuggestionUrl || null,
      };

      console.log('[Instant Answer Flow] Output sanitized successfully', {
        timestamp: new Date().toISOString(),
        hasAnswer: !!sanitizedOutput.answer,
        hasVideo: !!sanitizedOutput.videoSuggestionUrl
      });

      if (input.userId) {
        try {
          const storage = await getStorageInstance();
          const now = new Date();
          const timestamp = format(now, 'yyyyMMdd_HHmmss');
          const contentId = crypto.randomUUID();
          const safeTitle = input.question.substring(0, 50).replace(/[^a-z0-9]+/gi, '_').toLowerCase().replace(/^_|_$/g, '');
          const fileName = `${timestamp}_${safeTitle}.json`;
          const filePath = `users/${input.userId}/instant-answers/${fileName}`;
          const file = storage.bucket().file(filePath);

          const downloadToken = crypto.randomUUID();
          await file.save(JSON.stringify(sanitizedOutput), {
            resumable: false,
            metadata: {
              contentType: 'application/json',
              metadata: {
                firebaseStorageDownloadTokens: downloadToken,
              }
            },
          });

          const { dbAdapter } = await import('@/lib/db/adapter');
          const { Timestamp } = await import('firebase-admin/firestore');

          await dbAdapter.saveContent(input.userId, {
            id: contentId,
            type: 'instant-answer',
            title: input.question,
            gradeLevel: input.gradeLevel as any || 'Class 5',
            subject: 'General', // Instant answer can be anything
            topic: input.question,
            language: input.language as any || 'English',
            storagePath: filePath,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: sanitizedOutput,
          });
        } catch (persistenceError) {
          console.error("[Persistence Error] Failed to save instant answer:", persistenceError);
          // We don't throw here, so the user still gets the answer
        }
      }

      return sanitizedOutput;
    } catch (flowError: any) {
      // CRITICAL ERROR LOGGING - Capture flow execution failures
      console.error('[Instant Answer Flow] EXECUTION FAILED', {
        timestamp: new Date().toISOString(),
        errorType: flowError.constructor?.name || 'Unknown',
        errorName: flowError.name,
        errorMessage: flowError.message,
        errorCode: flowError.code,
        errorStatus: flowError.status,
        errorDetail: flowError.detail,
        parseErrors: flowError.detail?.parseErrors,
        errorStack: flowError.stack,
        input: {
          question: input.question,
          language: input.language,
          gradeLevel: input.gradeLevel
        },
        fullError: JSON.stringify(flowError, Object.getOwnPropertyNames(flowError), 2)
      });

      // Re-throw to propagate the error
      throw flowError;
    }
  });
