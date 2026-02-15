'use server';

/**
 * @fileOverview A visual aid designer agent that creates simple black-and-white line drawings.
 *
 * - generateVisualAid - A function that takes a prompt and returns a generated image.
 * - VisualAidInput - The input type for the generateVisualAid function.
 * - VisualAidOutput - The return type for the generateVisualAid function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getStorageInstance, getDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

import { validateTopicSafety } from '@/lib/safety';

const VisualAidInputSchema = z.object({
  prompt: z.string().describe('A description of the visual aid to generate.'),
  language: z.string().optional().describe('The language for any text in the visual aid.'),
  gradeLevel: z.string().optional().describe('The grade level for which the visual aid is intended.'),
  userId: z.string().optional().describe('The ID of the user for whom the visual aid is being generated.'),
  subject: z.string().optional().describe('The academic subject.'),
});

function normalizeInput(input: VisualAidInput): VisualAidInput {
  let { language, gradeLevel } = input;

  if (language) {
    const langMap: Record<string, string> = {
      'en': 'English', 'hi': 'Hindi', 'kn': 'Kannada',
      'ta': 'Tamil', 'te': 'Telugu', 'mr': 'Marathi', 'bn': 'Bengali'
    };
    language = langMap[language.toLowerCase()] || language;
  }

  if (gradeLevel) {
    const match = gradeLevel.match(/(\d+)/);
    if (match) {
      gradeLevel = `Class ${match[1]}`;
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
export type VisualAidInput = z.infer<typeof VisualAidInputSchema>;

const VisualAidOutputSchema = z.object({
  imageDataUri: z.string().describe("The generated image as a data URI."),
  pedagogicalContext: z.string().describe('How a teacher should use this specific drawing to explain the topic.'),
  discussionSpark: z.string().describe('A focus question to ask students while showing this visual aid.'),
  subject: z.string().nullable().optional().describe('The academic subject.'),
});
export type VisualAidOutput = z.infer<typeof VisualAidOutputSchema>;

// Helper to create stable seed
function stringToSeed(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash >>> 0; // Ensure positive integer
}

export async function generateVisualAid(input: VisualAidInput): Promise<VisualAidOutput> {
  // 1. Safety Check
  const safety = validateTopicSafety(input.prompt);
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

  return visualAidFlow(localizedInput);
}

const visualAidFlow = ai.defineFlow(
  {
    name: 'visualAidFlow',
    inputSchema: VisualAidInputSchema,
    outputSchema: VisualAidOutputSchema,
  },
  async (input) => {
    const { runResiliently } = await import('@/ai/genkit');
    const { StructuredLogger } = await import('@/lib/logger/structured-logger');
    const { FlowExecutionError, SchemaValidationError, PersistenceError } = await import('@/lib/errors');

    const requestId = uuidv4();
    const startTime = Date.now();
    const normalizedInput = normalizeInput(input);
    const { prompt, gradeLevel, language, userId } = normalizedInput;

    try {
      StructuredLogger.info('Starting visual aid generation flow', {
        service: 'visual-aid-designer',
        operation: 'generateVisualAid',
        userId,
        requestId,
        input: { prompt, gradeLevel, language }
      });

      // Step 1: Generate the Image using the Prod Model
      const { media } = await runResiliently(async (overrideConfig) => {
        return await ai.generate({
          model: 'googleai/gemini-3-pro-image-preview',
          ...overrideConfig,
          prompt: `
            Create a blackboard chalk-style educational illustration.
            Task: Draw a "${prompt}" for a ${gradeLevel || 'general'} classroom.
            
            Style: 
            - High-fidelity white chalk lines on a dark black background.
            - Professional, textbook-quality diagram.
            
            Labels:
            - Accurately label the key parts of the diagram. 
            - Text must be legible, correctly spelled, and spatially correct (e.g., arrow pointing to roots labeled "Roots").
            - Use simple block letters.
          `,
          config: {
            ...overrideConfig.config,
            responseModalities: ['IMAGE'],
            temperature: 0.4,
          },
        });
      });

      if (!media) {
        throw new FlowExecutionError('Image generation failed to produce an image.', { step: 'image-generation' });
      }

      // Step 2: Generate the Metadata (Text)
      const MetadataSchema = z.object({
        pedagogicalContext: z.string().describe('How a teacher should use this specific drawing to explain the topic.'),
        discussionSpark: z.string().describe('A focus question to ask students while showing this visual aid.'),
        subject: z.string().describe('The academic subject.'),
      });

      const textResult = await runResiliently(async (overrideConfig) => {
        return await ai.generate({
          model: 'googleai/gemini-2.5-flash',
          ...overrideConfig,
          output: { schema: MetadataSchema },
          prompt: `
            You are a master teacher.
            Topic: "${prompt}"
            Grade: ${gradeLevel || 'any'}
            Language: ${language || 'English'}

            Provide:
            1. Context: How to use a blackboard drawing of this topic to teach.
            2. Spark: A question to ask students about the drawing.
            3. Subject: The academic subject area.
          `,
        });
      });

      if (!textResult.output) {
        throw new FlowExecutionError('Metadata generation failed.', { step: 'metadata-generation' });
      }

      const finalOutput: VisualAidOutput = {
        imageDataUri: media.url,
        pedagogicalContext: textResult.output.pedagogicalContext,
        discussionSpark: textResult.output.discussionSpark,
        subject: textResult.output.subject
      };

      // Persistence
      if (userId) {
        try {
          const storage = await getStorageInstance();
          const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
          const contentId = uuidv4();
          const safeTitle = prompt.substring(0, 30).replace(/[^a-z0-9]+/gi, '_').toLowerCase().replace(/^_|_$/g, '');
          const fileName = `${timestamp}_${safeTitle}.png`;
          const filePath = `users/${userId}/visual-aids/${fileName}`;
          const file = storage.bucket().file(filePath);

          const buffer = Buffer.from(finalOutput.imageDataUri.split(',')[1], 'base64');
          await file.save(buffer, {
            resumable: false,
            metadata: { contentType: 'image/png' },
          });

          const { dbAdapter } = await import('@/lib/db/adapter');
          const { Timestamp } = await import('firebase-admin/firestore');
          await dbAdapter.saveContent(userId, {
            id: contentId,
            type: 'visual-aid',
            title: prompt,
            gradeLevel: (gradeLevel || 'Class 5') as any,
            subject: (finalOutput.subject || 'Science') as any,
            topic: prompt,
            language: (language || 'English') as any,
            storagePath: filePath,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(new Date()),
            updatedAt: Timestamp.fromDate(new Date()),
            data: { ...finalOutput, imageDataUri: undefined, storageRef: filePath },
          });
        } catch (e) {
          StructuredLogger.error('Persistence failed', { userId, requestId }, e as Error);
        }
      }

      StructuredLogger.info('Visual aid generated successfully', { requestId, duration: Date.now() - startTime });
      return finalOutput;

    } catch (flowError: any) {
      StructuredLogger.error('Visual aid flow failed', { requestId, duration: Date.now() - startTime }, flowError);
      throw flowError;
    }
  }
);
