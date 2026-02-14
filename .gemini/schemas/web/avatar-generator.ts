'use server';

/**
 * @fileOverview Generates unique, professional avatars for teachers.
 *
 * - generateAvatar - A function that takes a name and returns a generated avatar image.
 * - AvatarGeneratorInput - The input type for the generateAvatar function.
 * - AvatarGeneratorOutput - The return type for the generateAvatar function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getStorageInstance, getDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { logger, logError } from '@/lib/cloud-logging';

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
  const userId = input.userId;
  const startTime = Date.now();

  try {
    await logger.info({
      event: 'avatar_generation_started',
      userId,
      metadata: { name: input.name }
    });

    const output = await avatarGeneratorFlow(input);

    const latencyMs = Date.now() - startTime;
    await logger.info({
      event: 'avatar_generation_completed',
      userId,
      latencyMs,
      metadata: { name: input.name }
    });

    return output;
  } catch (error: any) {
    await logError({
      event: 'avatar_generation_failed',
      error,
      userId,
      metadata: { name: input.name }
    });
    throw error;
  }
}

const avatarGeneratorFlow = ai.defineFlow(
  {
    name: 'avatarGeneratorFlow',
    inputSchema: AvatarGeneratorInputSchema,
    outputSchema: AvatarGeneratorOutputSchema,
  },
  async (input) => {
    const { name, userId } = input;
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
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
        responseModalities: ['IMAGE'],
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

      const storage = await getStorageInstance();
      const file = storage.bucket().file(filePath);

      // Convert data URI to buffer
      // Some media URLs might not have 'data:' prefix if they are direct URLs, 
      // but usually Genkit returns data URIs for newly generated images.
      const base64Data = media.url.includes(',') ? media.url.split(',')[1] : media.url;
      const buffer = Buffer.from(base64Data, 'base64');

      await file.save(buffer, {
        metadata: {
          contentType: 'image/png',
        },
      });

      // Save the path to the user's profile
      const db = await getDb();
      await db.collection('users').doc(userId).set({
        avatarUrl: filePath,
      }, { merge: true });
    }

    return { imageDataUri: media.url };
  }
);

