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

    // Step 1: Generate the Image
    const { media } = await ai.generate({
      model: 'googleai/gemini-3-pro-image-preview',
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
        responseModalities: ['IMAGE'],
        temperature: 0.4,
      },
    });

    if (!media) {
      throw new Error('Image generation failed to produce an image.');
    }

    // Step 2: Generate the Metadata (Text)
    const MetadataSchema = z.object({
      pedagogicalContext: z.string().describe('How a teacher should use this specific drawing to explain the topic.'),
      discussionSpark: z.string().describe('A focus question to ask students while showing this visual aid.'),
    });

    const { output: textOutput } = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      output: { schema: MetadataSchema },
      prompt: `
        You are a master teacher.
        Topic: "${prompt}"
        Grade: ${gradeLevel || 'any'}
        Language: ${language || 'English'}

        Provide:
        1. Context: How to use a blackboard drawing of this topic to teach.
        2. Spark: A question to ask students about the drawing.
      `,
    });

    if (!textOutput) {
      throw new Error('Metadata generation failed.');
    }

    // Combine results
    const finalOutput: VisualAidOutput = {
      imageDataUri: media.url,
      pedagogicalContext: textOutput.pedagogicalContext,
      discussionSpark: textOutput.discussionSpark
    };

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
      const buffer = Buffer.from(finalOutput.imageDataUri.split(',')[1], 'base64');

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
        pedagogicalContext: finalOutput.pedagogicalContext,
        discussionSpark: finalOutput.discussionSpark,
        createdAt: now,
        isPublic: false,
      });
    }

    return finalOutput;
  }
);
