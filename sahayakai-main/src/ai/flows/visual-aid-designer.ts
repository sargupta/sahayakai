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
import { GRADE_LEVELS, LANGUAGES } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

import { validateTopicSafety } from '@/lib/safety';

const VisualAidInputSchema = z.object({
  prompt: z.string().describe('A description of the visual aid to generate.'),
  language: z.string().optional().describe('The language for any text in the visual aid.'),
  gradeLevel: z.string().optional().describe('The grade level for which the visual aid is intended.'),
  userId: z.string().optional().describe('The ID of the user for whom the visual aid is being generated.'),
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

    // Persistence imports
    const { getStorageInstance } = await import('@/lib/firebase-admin');
    const { format } = await import('date-fns');
    const { v4: uuidv4 } = await import('uuid');

    const requestId = uuidv4();
    const startTime = Date.now();
    const normalizedInput = normalizeInput(input);
    const { prompt, gradeLevel, language, userId } = normalizedInput;

    // Generate a stable seed from the prompt to ensure deterministic results for the same request
    const stableSeed = stringToSeed(prompt);

    try {
      StructuredLogger.info('Starting visual aid generation flow', {
        service: 'visual-aid-designer',
        operation: 'generateVisualAid',
        userId,
        requestId,
        input: { prompt, gradeLevel, language }
      });



      // Step 1: Generate a Detailed Image Prompt & Text Plan (Structured Mode)
      // We use Gemini to create a high-quality prompt and explicitly plan the text annotations.
      const promptRefinement = await runResiliently(async () => {
        const { SAHAYAK_SOUL_PROMPT } = await import('@/ai/soul');
        const result = await ai.generate({
          model: 'googleai/gemini-2.0-flash',
          prompt: `${SAHAYAK_SOUL_PROMPT}

            You are an expert visual designer for educational materials.
            Create a blackboard chalk-style educational illustration.
            Task: Draw a "${prompt}" for a ${gradeLevel || 'general'} classroom.

            
            Style: 
            - High-fidelity white chalk lines on a dark black background.
            - Professional, textbook-quality diagram.

            You must output a JSON object with three fields:
            1. "visualDescription": A detailed description of the image.
               CRITICAL: Use a "High-Fidelity Chalkboard Art" style.
            2. "spatialMap": An array of objects mapping labels to relative positions.
               CRITICAL: Text labels must be SPELLED CORRECTLY.
               Example: { "label": "Left Atrium", "location": "Top Right of image", "anatomicalReference": "Anatomical Left" }
               CRITICAL ANATOMY RULE: Anatomical Left = Image Right. Anatomical Right = Image Left.
               - "Left Atrium" must be "Right side of image"
               - "Right Atrium" must be "Left side of image"
            3. "textLabels": An array of strings representing the EXACT text annotations. CHECK SPELLING CAREFULLY.

            Constraint: Output ONLY the raw JSON object. No markdown.

            Constraints:
            - Language Lock: You MUST ONLY respond in the language(s) provided in the input ({{{language}}}). Do NOT shift into other languages (like Chinese, Spanish, etc.) unless explicitly requested.
            - No Repetition Loop: Monitor your output for repetitive phrases or characters. If you detect a loop, break it immediately.
            - Scope Integrity: Stay strictly within the scope of the educational task assigned.
          `,
          config: {
            temperature: 0, // Deterministic text generation
            responseMimeType: 'application/json',
          },
        });
        return result.output ? result.output : JSON.parse(result.text);
      });

      // Step 2: Annotation Reviewer Removed per user request (Direct Handoff)
      // We rely on the initial high-quality prompt and the image model's capabilities.

      const spatialMap = promptRefinement.spatialMap || [];
      const labelsString = spatialMap.length > 0
        ? `\n\nLabels to include:\n${spatialMap.map((m: any) => {
          const ref = m.anatomicalReference && !['n/a', 'none', 'null'].includes(m.anatomicalReference.toLowerCase())
            ? ` (${m.anatomicalReference})`
            : '';
          return `- "${m.label}" near ${m.location}${ref}`;
        }).join('\n')}`
        : '';

      const styleInstruction = 'Style: Photorealistic white chalk on clean black slate, high contrast, elegant lines, educational textbook quality.';

      const optimizedPrompt = `
      Create a high-fidelity educational chalkboard illustration.
      
      Scene Description:
      ${promptRefinement.visualDescription}
      
      ${labelsString}
      
      Important Guidelines:
      - Orientation: For anatomical diagrams, "Left" refers to the subject's left (viewer's right).
      - Text: Ensure all spelling matches the labels list exactly.
      - ${styleInstruction}
      `;

      // Step 2: Generate the Image (Image Mode)
      // We use a dedicated image model with fallback logic
      const imageResult = await runResiliently(async () => {
        try {
          // Tier 1: Imagen 4.0 (High Quality)
          // Model confirmed available via list-models

          // CRITICAL FIX: Image models struggle with Indic text (Kannada, Hindi, etc.)
          // If the language is Indic, we SKIP image models and force SVG (Tier 4)
          const isIndic = ['Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi', 'Bengali'].includes(language || '');

          if (isIndic) {
            throw new Error('Skipping Image Models for Indic Language to ensure text correctness via SVG.');
          }

          return await ai.generate({
            model: 'googleai/imagen-4.0-generate-001',
            prompt: optimizedPrompt
          });
        } catch (tier1Error: any) {
          StructuredLogger.warn('Tier 1 (Imagen 4.0) failed', {
            service: 'visual-aid-designer',
            operation: 'generateVisualAid',
            metadata: { model: 'googleai/imagen-4.0-generate-001', error: tier1Error.message }
          });

          try {
            // Tier 2: Gemini 3 Pro (High-End Multimodal Fallback)
            return await ai.generate({
              model: 'googleai/gemini-3-pro-image-preview',
              prompt: optimizedPrompt
            });
          } catch (tier2Error: any) {
            StructuredLogger.warn('Tier 2 (Gemini 3 Pro) failed', {
              service: 'visual-aid-designer',
              operation: 'generateVisualAid',
              metadata: { model: 'googleai/gemini-3-pro-image-preview', error: tier2Error.message }
            });

            try {
              // Tier 3: Gemini 2.5 Flash (Fast Multimodal Fallback)
              return await ai.generate({
                model: 'googleai/gemini-2.5-flash-image',
                prompt: optimizedPrompt
              });
            } catch (tier3Error: any) {
              StructuredLogger.warn('Tier 3 (Gemini 2.5 Flash Image) failed, attempting Tier 4 (SVG Fallback)', {
                service: 'visual-aid-designer',
                operation: 'generateVisualAid',
                metadata: { model: 'googleai/gemini-2.5-flash-image', error: tier3Error.message }
              });

              // Tier 4: SVG Generation (Gemini Flash Text Model)
              // If image models fail, we ask the text model to draw us a diagram in code.
              try {
                const svgResult = await ai.generate({
                  model: 'googleai/gemini-2.0-flash',
                  prompt: `
            You are an expert visual designer for educational materials.
            Create a blackboard chalk-style educational illustration.
            Task: Draw a "${prompt}" for a ${gradeLevel || 'general'} classroom.
            
            Style: 
            - High-fidelity white chalk lines on a dark black background.
            - Professional, textbook-quality diagram.

            You must output a JSON object with two fields:
            1. "visualDescription": A detailed description of the image.
               CRITICAL: Use a "High-Fidelity Chalkboard Art" style.
               - IF PROCESS/CYCLE: Specify "Clockwise circular layout" and SPATIAL POSITIONS (Top - Center, Right - Middle, etc).
               - IF MAP: Specify "Accurate map outline drawn in chalk".
            2. "textLabels": An array of strings representing the EXACT text annotations. CHECK SPELLING CAREFULLY.

            Constraint: Output ONLY the raw JSON object. No markdown.
          `,
                  config: {
                    temperature: 0,
                  }
                });

                let svgCode = svgResult.text.trim();
                if (svgCode.startsWith('```')) {
                  svgCode = svgCode.replace(/^```(svg)?/, '').replace(/```$/, '').trim();
                }

                const base64Svg = Buffer.from(svgCode).toString('base64');
                const dataUri = `data:image/svg+xml;base64,${base64Svg}`;

                return {
                  media: { url: dataUri }
                };

              } catch (tier4Error: any) {
                StructuredLogger.error('Tier 4 (SVG) failed', {
                  service: 'visual-aid-designer',
                  operation: 'generateVisualAid',
                  metadata: { error: tier4Error.message }
                });
                // Only throw if even the SVG fallback fails
                throw new FlowExecutionError('Visual aid generation failed across all strategies (Imagen, Gemini Image, & SVG)', { step: 'tier-4-fallback' });
              }
            }
          }
        }
      });

      if (!imageResult.media) {
        // Should be unreachable due to placeholder, but safe guard
        throw new FlowExecutionError('Image generation failed completely', { step: 'image-generation' });
      }

      const MetadataSchema = z.object({
        pedagogicalContext: z.string().describe('How a teacher should use this specific drawing to explain the topic.'),
        discussionSpark: z.string().describe('A focus question to ask students while showing this visual aid.'),
        subject: z.string().describe('The academic subject (e.g., Biology, Geometry).'),
      });

      const textResult = await runResiliently(async () => {
        return await ai.generate({
          model: 'googleai/gemini-2.0-flash',
          output: { schema: MetadataSchema },
          prompt: `
            You are an expert educator and visual designer.
            Provide pedagogical context and a discussion spark for a visual aid about "${prompt}" intended for a ${gradeLevel || 'general'} classroom.
            
            The visual aid is a blackboard-style chalk drawing.
            
            1. Pedagogical Context: Explain exactly how a teacher should use this diagram to explain the concepts.
            2. Discussion Spark: Provide one thought-provoking question to ask students.
            3. Subject: Identify the most appropriate school subject (e.g. Science, Math, Geography).
          `,
          config: {
            temperature: 0, // Deterministic pedagogical context
          }
        });
      });

      if (!textResult.output) {
        throw new FlowExecutionError('Metadata generation failed.', { step: 'metadata-generation' });
      }

      // Combine results
      const finalOutput: VisualAidOutput = {
        imageDataUri: imageResult.media.url,
        pedagogicalContext: textResult.output.pedagogicalContext,
        discussionSpark: textResult.output.discussionSpark,
        subject: textResult.output.subject
      };

      // Validate outgoing schema
      try {
        VisualAidOutputSchema.parse(finalOutput);
      } catch (validationError: any) {
        throw new SchemaValidationError(
          `Schema validation failed: ${validationError.message}`,
          {
            parseErrors: validationError.errors,
            rawOutput: finalOutput,
            expectedSchema: 'VisualAidOutputSchema'
          }
        );
      }

      if (userId) {
        try {
          const storage = await getStorageInstance();
          const now = new Date();
          const timestamp = format(now, 'yyyyMMdd_HHmmss');
          const contentId = uuidv4();
          const safeTitle = prompt.substring(0, 30).replace(/[^a-z0-9]+/gi, '_').toLowerCase().replace(/^_|_$/g, '');
          const fileName = `${timestamp}_${safeTitle}.png`;
          const filePath = `users/${userId}/visual-aids/${fileName}`;
          const file = storage.bucket().file(filePath);

          // Convert data URI to buffer
          const buffer = Buffer.from(finalOutput.imageDataUri.split(',')[1], 'base64');

          const downloadToken = uuidv4();
          await file.save(buffer, {
            resumable: false,
            metadata: {
              contentType: 'image/png',
              metadata: {
                firebaseStorageDownloadTokens: downloadToken,
              }
            },
          });

          const dbPayload = {
            ...finalOutput,
            imageDataUri: undefined, // Don't save Base64 to Firestore (too big)
            storageRef: filePath    // Save reference instead
          };

          const { dbAdapter } = await import('@/lib/db/adapter');
          const { Timestamp } = await import('firebase-admin/firestore');

          await dbAdapter.saveContent(userId, {
            id: contentId,
            type: 'visual-aid',
            title: prompt,
            gradeLevel: gradeLevel as any || 'Class 5',
            subject: (finalOutput.subject || 'Science') as any, // dynamic subject
            topic: prompt,
            language: language as any || 'English',
            storagePath: filePath,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: dbPayload,
          });

          StructuredLogger.info('Content persisted successfully', {
            service: 'visual-aid-designer',
            operation: 'persistContent',
            userId,
            requestId,
            metadata: { contentId }
          });

        } catch (persistenceError: any) {
          StructuredLogger.error(
            'Failed to persist visual aid',
            {
              service: 'visual-aid-designer',
              operation: 'persistContent',
              userId,
              requestId
            },
            new PersistenceError('Persistence failed', 'saveContent')
          );
        }
      }

      const duration = Date.now() - startTime;
      StructuredLogger.info('Visual aid generation completed successfully', {
        service: 'visual-aid-designer',
        operation: 'generateVisualAid',
        requestId,
        duration
      });

      return finalOutput;

    } catch (flowError: any) {
      const duration = Date.now() - startTime;

      const errorId = StructuredLogger.error(
        'Visual aid generation flow execution failed',
        {
          service: 'visual-aid-designer',
          operation: 'generateVisualAid',
          requestId,
          input: {
            prompt: prompt
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
