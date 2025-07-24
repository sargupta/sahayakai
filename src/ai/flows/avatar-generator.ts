'use server';

/**
 * @fileOverview Generates unique, professional avatars for teachers.
 *
 * - generateAvatar - A function that takes a name and returns a generated avatar image.
 * - AvatarGeneratorInput - The input type for the generateAvatar function.
 * - AvatarGeneratorOutput - The return type for the generateAvatar function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AvatarGeneratorInputSchema = z.object({
  name: z.string().describe("The name of the teacher for whom to generate an avatar."),
});
export type AvatarGeneratorInput = z.infer<typeof AvatarGeneratorInputSchema>;

const AvatarGeneratorOutputSchema = z.object({
  imageDataUri: z.string().describe("The generated avatar image as a data URI."),
});
export type AvatarGeneratorOutput = z.infer<typeof AvatarGeneratorOutputSchema>;

export async function generateAvatar(input: AvatarGeneratorInput): Promise<AvatarGeneratorOutput> {
  return avatarGeneratorFlow(input);
}

const avatarGeneratorFlow = ai.defineFlow(
  {
    name: 'avatarGeneratorFlow',
    inputSchema: AvatarGeneratorInputSchema,
    outputSchema: AvatarGeneratorOutputSchema,
  },
  async ({ name }) => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `
        You are a skilled portrait artist who creates professional, friendly avatars for educators.
        The avatars should be in the style of a high-quality, elegant chalk drawing on a blackboard.

        **Style Guide:**
        - **Subject:** A head and shoulders portrait of a teacher.
        - **Style:** White chalk-style drawing on a dark, uniform blackboard background. The lines should be elegant and clear.
        - **Composition:** The person should be looking towards the viewer or slightly off-camera with a friendly and approachable expression.
        - **NO COLOR:** Strictly use white lines on a black background. Do not include any color.
        - **Uniqueness:** Generate a unique individual based on the name provided. People with different names should look like different people.

        **Task:**
        Generate a unique avatar for a teacher named "${name}".
      `,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 0.6,
      },
    });

    if (!media) {
      throw new Error('Image generation failed to produce an avatar.');
    }

    return { imageDataUri: media.url };
  }
);
