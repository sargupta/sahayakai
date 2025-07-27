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
import { storage, db } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const AvatarGeneratorInputSchema = z.object({
  name: z.string().describe("The name of the teacher for whom to generate an avatar."),
  userId: z.string().optional().describe('The ID of the user for whom the avatar is being generated.'),
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
  async (input) => {
    const { name, userId } = input;
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `
        You are an expert portrait photographer who creates high-quality, professional, and friendly profile pictures for educators.

        **Style Guide:**
        - **Subject:** A head and shoulders portrait of a teacher. The person should appear to be of Indian ethnicity, reflecting the diversity of regions across India.
        - **Style:** Photorealistic, high-quality, professional headshot.
        - **Composition:** The person should be looking towards the viewer or slightly off-camera with a friendly, warm, and approachable expression. They should look like a real person.
        - **Background:** A simple, neutral, out-of-focus studio background (light gray, beige, or soft blue).
        - **Uniqueness & Diversity:** Generate a unique individual based on the name provided. People with different names should look like different people. Ensure a mix of genders. For a name like "Priya Singh", generate a female-presenting person. For a name like "Ravi Kumar", generate a male-presenting person. For neutral names, you can choose.

        **Task:**
        Generate a unique, photorealistic avatar for a teacher named "${name}".
      `,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 0.8,
      },
    });

    if (!media) {
      throw new Error('Image generation failed to produce an avatar.');
    }

    if (userId) {
      const now = new Date();
      const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
      const contentId = uuidv4();
      const fileName = `${timestamp}-${contentId}.png`;
      const filePath = `users/${userId}/avatars/${fileName}`;
      const file = storage.bucket().file(filePath);

      // Convert data URI to buffer
      const buffer = Buffer.from(media.url.split(',')[1], 'base64');

      await file.save(buffer, {
        metadata: {
          contentType: 'image/png',
        },
      });

      // Save the path to the user's profile
      await db.collection('users').doc(userId).set({
        avatarUrl: filePath,
      }, { merge: true });
    }

    return { imageDataUri: media.url };
  }
);
