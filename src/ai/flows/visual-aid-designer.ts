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
        You are a talented chalk artist who creates beautiful and clear educational illustrations on a blackboard.
        Your task is to design a visual aid based on the user's request.

        **Style Guide:**
        - **Format:** White chalk-style drawing on a clean, dark, uniform blackboard background.
        - **Line Quality:** The lines should be elegant, clear, and have a hand-drawn chalk texture. Avoid perfectly straight, computer-generated lines.
        - **Simplicity:** The drawing must be minimalist and easy for a teacher to replicate. Focus on the core concept.
        - **Composition:** Think carefully about the layout. The final image should be well-composed, balanced, and have a wonderful, clean finish.
        - **NO COLOR:** Strictly use white lines on a black background.

        **Task:** Generate a visual aid for the following description:
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

    return { imageDataUri: media.url };
  }
);
