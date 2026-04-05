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
import { LANGUAGE_CODE_MAP } from '@/types/index';
import { UsageTracker } from '@/lib/usage-tracker';


import { validateTopicSafety } from '@/lib/safety';
const InstantAnswerInputSchema = z.object({
  question: z.string().describe('The question asked by the user.'),
  language: z.string().optional().describe('The language for the answer (e.g. English, Hindi).'),
  gradeLevel: z.string().optional().describe('The grade level the answer should be tailored for.'),
  subject: z.string().optional().describe('The academic subject.'),
  userId: z.string().optional().describe('The ID of the user for whom the answer is being generated.'),
});

// Helper for normalizing inputs
function normalizeInput(input: InstantAnswerInput): InstantAnswerInput {
  let { language, gradeLevel } = input;

  // Normalize Language
  if (language) {
    language = LANGUAGE_CODE_MAP[language.toLowerCase() as keyof typeof LANGUAGE_CODE_MAP] || language;
  }

  // Normalize Grade
  if (gradeLevel) {
    const gradeMatch = gradeLevel.match(/(\d+)/);
    if (gradeMatch) {
      gradeLevel = `Class ${gradeMatch[1]}`;
    } else if (gradeLevel.toLowerCase().includes('nursery')) {
      gradeLevel = 'Nursery';
    } else if (gradeLevel.toLowerCase().includes('lkg')) {
      gradeLevel = 'LKG';
    } else if (gradeLevel.toLowerCase().includes('ukg')) {
      gradeLevel = 'UKG';
    }
  }

  return { ...input, language, gradeLevel };
}
export type InstantAnswerInput = z.infer<typeof InstantAnswerInputSchema>;

const InstantAnswerOutputSchema = z.object({
  answer: z.string().describe('The generated answer to the question.'),
  videoSuggestionUrl: z.string().nullable().optional().describe('A URL to a relevant YouTube video.'),
  gradeLevel: z.string().nullable().optional().describe('The target grade level.'),
  subject: z.string().nullable().optional().describe('The academic subject.'),
});
export type InstantAnswerOutput = z.infer<typeof InstantAnswerOutputSchema>;

export async function instantAnswer(input: InstantAnswerInput): Promise<InstantAnswerOutput> {
  // 1. Safety Check
  const safety = validateTopicSafety(input.question);
  if (!safety.safe) throw new Error(`Safety Violation: ${safety.reason}`);

  // 2. Rate Limit & User Profile Context
  const uid = input.userId || 'anonymous_user';
  let localizedInput = { ...input };

  if (uid !== 'anonymous_user') {
    const { checkServerRateLimit } = await import('@/lib/server-safety');
    await checkServerRateLimit(uid);

    // Fetch user's profile for context (language, grade)
    if (!input.language || !input.gradeLevel) {
      const { dbAdapter } = await import('@/lib/db/adapter');
      const profile = await dbAdapter.getUser(uid);

      if (!input.language && profile?.preferredLanguage) {
        localizedInput.language = profile.preferredLanguage;
      }
      if (!input.gradeLevel && profile?.teachingGradeLevels?.length) {
        localizedInput.gradeLevel = profile.teachingGradeLevels[0];
      }
    }
  }

  return instantAnswerFlow(localizedInput);
}

import { SAHAYAK_SOUL_PROMPT, STRUCTURED_OUTPUT_OVERRIDE } from '@/ai/soul';

const instantAnswerPrompt = ai.definePrompt({
  name: 'instantAnswerPrompt',
  input: { schema: InstantAnswerInputSchema },
  output: { schema: InstantAnswerOutputSchema },
  tools: [googleSearch],
  prompt: `${SAHAYAK_SOUL_PROMPT}${STRUCTURED_OUTPUT_OVERRIDE}

You are an expert educator and knowledge base. Your goal is to answer questions accurately and concisely.

**Instructions:**
1.  **Use Tools:** If the question requires current information or facts, use the \`googleSearch\` tool to get up-to-date information.
2.  **Tailor the Answer:** Adjust the complexity and vocabulary of your answer based on the provided \`gradeLevel\`. If no grade level is given, answer for a general audience.
3.  **Language:** Respond ONLY in the specified \`language\`.
4.  **Analogies:** For complex topics, use simple analogies, especially for younger grade levels.
5.  **Video Suggestions:** If the user's question implies they want a visual explanation (e.g., "show me," "explain how"), or if a video would be a great supplement, provide a YouTube Search URL in the \`videoSuggestionUrl\` field. The format MUST be: \`https://www.youtube.com/results?search_query=\` followed by a concise, relevant search query (e.g., "photosynthesis for class 5"). Do NOT try to guess a specific video ID (like watch?v=xyz) as it might be fake. Always use the search results URL.
6.  **Be Direct:** Provide the answer directly without conversational filler.
7.  **Metadata:** Identify the most appropriate \`subject\` (e.g., Science, Math) and \`gradeLevel\` if not explicitly provided.

**Constraints:**
- **Language Lock**: You MUST ONLY respond in {{{language}}}. The entire answer MUST be written in {{{language}}}. Do NOT fall back to English or any other language. If {{{language}}} is not English, writing in English is a critical failure.
- **No Repetition Loop**: Monitor your output for repetitive phrases or characters. If you detect a loop, break it immediately.
- **Scope Integrity**: Stay strictly within the scope of the educational task assigned.
- **Schema Compliance (CRITICAL)**: You MUST always return your response in the \`answer\` field. Even when declining a request (e.g., off-topic, inappropriate), put your polite refusal in the \`answer\` field. NEVER use field names like \`response\`, \`message\`, or \`text\` — only \`answer\`.

**User's Question:**
- **Question:** {{{question}}}
- **Grade Level:** {{{gradeLevel}}}
- **Subject:** {{{subject}}}
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
    const { v4: uuidv4 } = await import('uuid');
    const { StructuredLogger } = await import('@/lib/logger/structured-logger');
    const { FlowExecutionError, SchemaValidationError, PersistenceError } = await import('@/lib/errors');

    const startTime = Date.now();
    const requestId = uuidv4();

    // Normalize input before processing
    const normalizedInput = normalizeInput(input);

    try {
      StructuredLogger.info('Starting instant answer flow', {
        service: 'instant-answer-flow',
        operation: 'generateAnswer',
        userId: normalizedInput.userId,
        requestId,
        input: {
          questionLength: normalizedInput.question.length,
          language: normalizedInput.language,
          gradeLevel: normalizedInput.gradeLevel
        }
      });

      let output: InstantAnswerOutput | null = null;

      try {
        const result = await runResiliently(async (resilienceConfig) => {
          return await instantAnswerPrompt(normalizedInput, resilienceConfig);
        });
        output = result.output;

        // Track usage if available
        if (normalizedInput.userId) {
          const usage = (result as any).usage;
          if (usage) {
            UsageTracker.trackGemini(normalizedInput.userId, usage.totalTokens || 0, 'gemini-2.0-flash');
          }
          // Since this prompt has googleSearch tool, we count it as a grounding call
          UsageTracker.trackGrounding(normalizedInput.userId, normalizedInput.question);
        }
      } catch (genkitError: any) {
        // Genkit throws INVALID_ARGUMENT when the model returns a wrong field name
        // (e.g. "response" instead of "answer"). Recover by surfacing a graceful message.
        if (genkitError?.status === 'INVALID_ARGUMENT' || genkitError?.message?.includes('Schema validation failed')) {
          StructuredLogger.warn?.('Schema mismatch from model — recovering gracefully', {
            service: 'instant-answer-flow',
            operation: 'generateAnswer',
            requestId,
            metadata: { rawError: genkitError?.message },
          });
          return {
            answer: "I'm sorry, I can only help with educational questions. Please ask me something related to your teaching.",
            videoSuggestionUrl: null,
            gradeLevel: normalizedInput.gradeLevel ?? null,
            subject: normalizedInput.subject ?? null,
          };
        }
        throw genkitError;
      }

      if (!output) {
        throw new FlowExecutionError(
          'AI model returned null output',
          {
            modelUsed: 'gemini-2.0-flash',
            input: input.question
          }
        );
      }

      // Validate schema explicitly as a final safety net
      try {
        InstantAnswerOutputSchema.parse(output);
      } catch (validationError: any) {
        throw new SchemaValidationError(
          `Schema validation failed: ${validationError.message}`,
          {
            parseErrors: validationError.errors,
            rawOutput: output,
            expectedSchema: 'InstantAnswerOutputSchema'
          }
        );
      }

      // Sanitize output
      const sanitizedOutput: InstantAnswerOutput = {
        answer: output.answer || 'Unable to generate an answer at this time.',
        videoSuggestionUrl: output.videoSuggestionUrl || null,
        gradeLevel: output.gradeLevel,
        subject: output.subject
      };

      // Persistence with error handling
      if (input.userId) {
        try {
          const storage = await getStorageInstance();
          const now = new Date();
          const timestamp = format(now, 'yyyyMMdd_HHmmss');
          const contentId = crypto.randomUUID();
          // Re-implement safety and file naming logic from previous version
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
            gradeLevel: (sanitizedOutput.gradeLevel || input.gradeLevel || 'Class 5') as any,
            subject: (input.subject || sanitizedOutput.subject || 'General') as any,
            topic: input.question,
            language: input.language as any || 'English',
            storagePath: filePath,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: sanitizedOutput,
          });

          StructuredLogger.info('Content persisted successfully', {
            service: 'instant-answer-flow',
            operation: 'persistContent',
            userId: input.userId,
            requestId,
            metadata: { contentId }
          });
        } catch (persistenceError: any) {
          // Log but don't throw - user still gets the answer
          StructuredLogger.error(
            'Failed to persist instant answer',
            {
              service: 'instant-answer-flow',
              operation: 'persistContent',
              userId: input.userId,
              requestId
            },
            new PersistenceError('Persistence failed', 'saveContent')
          );
        }
      }

      const duration = Date.now() - startTime;

      StructuredLogger.info('Instant answer flow completed successfully', {
        service: 'instant-answer-flow',
        operation: 'generateAnswer',
        userId: input.userId,
        requestId,
        duration,
        metadata: {
          hasVideo: !!sanitizedOutput.videoSuggestionUrl
        }
      });

      return sanitizedOutput;

    } catch (flowError: any) {
      const duration = Date.now() - startTime;

      const errorId = StructuredLogger.error(
        'Instant answer flow execution failed',
        {
          service: 'instant-answer-flow',
          operation: 'generateAnswer',
          userId: input.userId,
          requestId,
          input: {
            question: input.question,
            language: input.language,
            gradeLevel: input.gradeLevel
          },
          duration,
          metadata: {
            errorType: flowError.constructor?.name,
            errorCode: flowError.errorCode
          }
        },
        flowError
      );

      // Attach error ID for tracing if it's an object
      if (typeof flowError === 'object' && flowError !== null) {
        flowError.errorId = errorId;
      }
      throw flowError;
    }
  });
