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
  imageDataUri: z.string().describe("The generated image as a data URI."),
  pedagogicalContext: z.string().describe('How a teacher should use this specific drawing to explain the topic.'),
  discussionSpark: z.string().describe('A focus question to ask students while showing this visual aid.'),
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
    const { output } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      output: { schema: VisualAidOutputSchema },
      prompt: `
        You are a talented chalk artist and master teacher. You create beautiful educational illustrations on blackboards.

        **1. The Image (Blackboard Chalk Style):**
        - White chalk-style drawing on a clean, dark blackboard background.
        - Elegant, clear, hand-drawn lines. Minimalist and easy to replicate.
        - NO COLOR. Only white on black.

        **2. Teacher Metadata (Crucial):**
        - **pedagogicalContext**: Explain *why* this specific illustration works for teaching this topic.
        - **discussionSpark**: Provide one powerful "Look at this... what do you think?" question.

        **Task Context:**
        - **Grade**: ${gradeLevel || 'any'}
        - **Topic**: "${prompt}"
        - **Language**: ${language || 'English'}
      `,
      config: {
        temperature: 0.4,
      },
    });

    if (!output || !output.imageDataUri) {
      throw new Error('Image generation failed to produce an image.');
    }

    const mediaUrl = output.imageDataUri;

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
      const buffer = Buffer.from(mediaUrl.split(',')[1], 'base64');

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
        pedagogicalContext: output.pedagogicalContext,
        discussionSpark: output.discussionSpark,
        createdAt: now,
        isPublic: false,
      });
    }

    return output;
  }
);
