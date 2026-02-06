'use server';

/**
 * @fileOverview Plans virtual field trips using Google Earth.
 *
 * - planVirtualFieldTrip - A function that takes a topic and returns a planned virtual field trip.
 * - VirtualFieldTripInput - The input type for the planVirtualFieldTrip function.
 * - VirtualFieldTripOutput - The return type for the planVirtualFieldTrip function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getStorageInstance, getDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const VirtualFieldTripInputSchema = z.object({
  topic: z.string().describe('The topic or theme for the virtual field trip.'),
  language: z.string().optional().describe('The language for the trip descriptions.'),
  gradeLevel: z.string().optional().describe('The grade level the trip should be tailored for.'),
  userId: z.string().optional().describe('The ID of the user for whom the trip is being generated.'),
});
export type VirtualFieldTripInput = z.infer<typeof VirtualFieldTripInputSchema>;

const VirtualFieldTripOutputSchema = z.object({
  title: z.string().describe('An engaging title for the virtual field trip.'),
  stops: z.array(z.object({
    name: z.string().describe('The name of the location.'),
    description: z.string().describe('A brief, engaging description of the stop.'),
    educationalFact: z.string().describe('A "wow-factor" educational fact about this location.'),
    reflectionPrompt: z.string().describe('A critical thinking question for students to answer at this stop.'),
    googleEarthUrl: z.string().describe('A valid Google Earth search URL.'),
  })).describe('An array of stops.'),
});
export type VirtualFieldTripOutput = z.infer<typeof VirtualFieldTripOutputSchema>;

export async function planVirtualFieldTrip(input: VirtualFieldTripInput): Promise<VirtualFieldTripOutput> {
  const uid = input.userId;
  let localizedInput = { ...input };

  if (uid) {
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

  return virtualFieldTripFlow(localizedInput);
}

const virtualFieldTripPrompt = ai.definePrompt({
  name: 'virtualFieldTripPrompt',
  input: { schema: VirtualFieldTripInputSchema },
  output: { schema: VirtualFieldTripOutputSchema },
  prompt: `You are an expert geography teacher and curriculum designer. Create an immersive virtual field trip using Google Earth.

**Instructions:**
1.  **Title**: Create an adventurous and educational title.
2.  **Curated Stops**: Identify 3-5 locations that perfectly illustrate the topic.
3.  **Content per Stop**:
    - **Description**: Age-appropriate narrative of what students are seeing.
    - **Educational Fact**: A specific, high-value fact that isn't common knowledge.
    - **Reflection Prompt**: A question that forces students to observe and think critically about the landscape or site.
4.  **Google Earth URLs**: Format as \`https://earth.google.com/web/search/LOCATION+NAME\`.
5.  **Language**: Respond in \`{{{language}}}\`.

**Context:**
- **Topic**: {{{topic}}}
- **Grade**: {{{gradeLevel}}}

**Constraints:**
- **Language Lock**: You MUST ONLY respond in the language(s) provided in the input ({{{language}}}). Do NOT shift into other languages (like Chinese, Spanish, etc.) unless explicitly requested.
- **No Repetition Loop**: Monitor your output for repetitive phrases or characters. If you detect a loop, break it immediately.
- **Scope Integrity**: Stay strictly within the scope of the educational task assigned.
`,
});

const virtualFieldTripFlow = ai.defineFlow(
  {
    name: 'virtualFieldTripFlow',
    inputSchema: VirtualFieldTripInputSchema,
    outputSchema: VirtualFieldTripOutputSchema,
  },
  async input => {
    const { runResiliently } = await import('@/ai/genkit');
    const { StructuredLogger } = await import('@/lib/logger/structured-logger');
    const { FlowExecutionError, SchemaValidationError, PersistenceError } = await import('@/lib/errors');

    // Persistence imports
    const { getStorageInstance } = await import('@/lib/firebase-admin');
    const { format } = await import('date-fns');
    const { v4: uuidv4 } = await import('uuid');

    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      StructuredLogger.info('Starting virtual field trip generation flow', {
        service: 'virtual-field-trip-flow',
        operation: 'planVirtualFieldTrip',
        userId: input.userId,
        requestId,
        input: {
          topic: input.topic,
          language: input.language,
          gradeLevel: input.gradeLevel
        }
      });

      const { output } = await runResiliently(async (resilienceConfig) => {
        return await virtualFieldTripPrompt(input, resilienceConfig);
      });

      if (!output) {
        throw new FlowExecutionError(
          'AI model returned null output',
          {
            modelUsed: 'gemini-2.0-flash',
            input: input.topic
          }
        );
      }

      // Validate schema explicitly
      try {
        VirtualFieldTripOutputSchema.parse(output);
      } catch (validationError: any) {
        throw new SchemaValidationError(
          `Schema validation failed: ${validationError.message}`,
          {
            parseErrors: validationError.errors,
            rawOutput: output,
            expectedSchema: 'VirtualFieldTripOutputSchema'
          }
        );
      }

      if (input.userId) {
        try {
          const now = new Date();
          const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
          const contentId = uuidv4();
          const fileName = `${timestamp}-${contentId}.json`;
          const filePath = `users/${input.userId}/virtual-field-trips/${fileName}`;

          const storage = await getStorageInstance();
          const file = storage.bucket().file(filePath);

          await file.save(JSON.stringify(output), {
            contentType: 'application/json',
          });

          // Use getDb for consistency with original file but wrap in try/catch 
          const { dbAdapter } = await import('@/lib/db/adapter');
          const { Timestamp } = await import('firebase-admin/firestore');

          await dbAdapter.saveContent(input.userId, {
            id: contentId,
            type: 'virtual-field-trip',
            title: output.title || `Trip: ${input.topic}`,
            gradeLevel: input.gradeLevel as any || 'Class 5',
            subject: 'Geography' as any,
            topic: input.topic,
            language: input.language as any || 'English',
            storagePath: filePath,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: output,
          });

          StructuredLogger.info('Content persisted successfully', {
            service: 'virtual-field-trip-flow',
            operation: 'persistContent',
            userId: input.userId,
            requestId,
            metadata: { contentId }
          });

        } catch (persistenceError: any) {
          StructuredLogger.error(
            'Failed to persist virtual field trip',
            {
              service: 'virtual-field-trip-flow',
              operation: 'persistContent',
              userId: input.userId,
              requestId
            },
            new PersistenceError('Persistence failed', 'saveContent')
          );
        }
      }

      const duration = Date.now() - startTime;
      StructuredLogger.info('Virtual field trip flow completed successfully', {
        service: 'virtual-field-trip-flow',
        operation: 'planVirtualFieldTrip',
        requestId,
        duration,
        metadata: {
          stopsCount: output.stops.length
        }
      });

      return output;

    } catch (flowError: any) {
      const duration = Date.now() - startTime;

      const errorId = StructuredLogger.error(
        'Virtual field trip flow execution failed',
        {
          service: 'virtual-field-trip-flow',
          operation: 'planVirtualFieldTrip',
          requestId,
          input: {
            topic: input.topic
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
