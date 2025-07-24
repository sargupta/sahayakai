'use server';

/**
 * @fileOverview A visual aid designer agent that creates simple black-and-white line drawings.
 *
 * - generateVisualAid - A function that takes a prompt and returns a generated image.
 * - VisualAidInput - The input type for the generateVisualAid function.
 * - VisualAidOutput - The return type for the generateVisualAid function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VisualAidInputSchema = z.object({
  prompt: z.string().describe('A description of the visual aid to generate.'),
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
  async ({ prompt }) => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `
        You are an expert illustrator who specializes in creating simple, clear, black-and-white line drawings suitable for a teacher to copy onto a blackboard. 
        The drawings must be minimalist, using only essential black lines on a solid white background to convey the concept.
        Do not use any color, shading, or complex textures. The final image should be a clean, simple line drawing.

        Generate the following visual aid:
        "${prompt}"
      `,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media) {
      throw new Error('Image generation failed to produce an image.');
    }

    return { imageDataUri: media.url };
  }
);
