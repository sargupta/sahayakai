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

const VisualAidInputSchema = z.object({
  prompt: z.string().describe('A description of the visual aid to generate.'),
  language: z.string().optional().describe('The language for any text in the visual aid.'),
  gradeLevel: z.string().optional().describe('The grade level for which the visual aid is intended.'),
  userId: z.string().optional().describe('The ID of the user for whom the visual aid is being generated.'),
});
export type VisualAidInput = z.infer<typeof VisualAidInputSchema>;

const VisualAidOutputSchema = z.object({
  imageDataUri: z.string().describe("The generated image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type VisualAidOutput = z.infer<typeof VisualAidOutputSchema>;

export async function generateVisualAid(input: VisualAidInput): Promise<VisualAidOutput> {
  return visualAidFlow(input);
}

const visualAidFlow = ai.defineFlow(
  {
    name: 'visualAidFlow',
    inputSchema: VisualAidInputSchema,
    outputSchema: VisualAidOutputSchema,
  },
  async (input) => {
    const { prompt, gradeLevel, language, userId } = input;
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `
        You are a talented chalk artist who creates beautiful and clear educational illustrations on a blackboard.
        Your task is to design a visual aid based on the user's request.

        **Style Guide:**
        - **Format:** White chalk-style drawing on a clean, dark, uniform blackboard background.
        - **Line Quality:** The lines should be elegant, clear, and have a hand-drawn chalk texture. Avoid perfectly straight, computer-generated lines.
        - **Simplicity:** The drawing must be minimalist and easy for a teacher to replicate. Focus on the core concept.
        - **Composition:** Think carefully about the layout. The final image should be well-composed, balanced, and have a wonderful, clean finish.
        - **NO COLOR:** Strictly use white lines on a black background.

        **Context:**
        - **Grade Level:** ${gradeLevel || 'any'}
        - **Language for labels (if any):** ${language || 'English'}
        - **Task:** Generate a visual aid for the following description, keeping the grade level in mind for complexity.
        "${prompt}"
      `,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 0.4,
      },
    });

    if (!media) {
      throw new Error('Image generation failed to produce an image.');
    }

    if (userId) {
      const storage = await getStorageInstance();
      const db = await getDb();
      const now = new Date();
      const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
      const contentId = uuidv4();
      const fileName = `${timestamp}-${contentId}.png`;
      const filePath = `users/${userId}/visual-aids/${fileName}`;
      const file = storage.bucket().file(filePath);

      // Convert data URI to buffer
      const buffer = Buffer.from(media.url.split(',')[1], 'base64');

      await file.save(buffer, {
        metadata: {
          contentType: 'image/png',
        },
      });

      await db.collection('users').doc(userId).collection('content').doc(contentId).set({
        type: 'visual-aid',
        topic: prompt,
        gradeLevels: [gradeLevel],
        language: language,
        storagePath: filePath,
        createdAt: now,
        isPublic: false,
      });
    }

    return { imageDataUri: media.url };
  }
);
