'use server';

/**
 * @fileOverview Generates simple, decent, and stable avatars for teachers.
 *
 * - generateAvatar - A function that takes a name and returns a stable avatar image.
 * - AvatarGeneratorInput - The input type for the generateAvatar function.
 * - AvatarGeneratorOutput - The return type for the generateAvatar function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getStorageInstance, getDb } from '@/lib/firebase-admin';
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

/**
 * Generates a consistent, professional avatar using initials.
 * This ensures the avatar is "simple and decent" and remains stable for the user.
 */
export async function generateAvatar(input: AvatarGeneratorInput): Promise<AvatarGeneratorOutput> {
  const { runResiliently } = await import('@/ai/genkit');
  const { StructuredLogger } = await import('@/lib/logger/structured-logger');
  const { v4: uuidv4 } = await import('uuid');
  const { format } = await import('date-fns');
  const { getStorageInstance, getDb } = await import('@/lib/firebase-admin');

  const { name, userId } = input;

  try {
    const { media } = await runResiliently(async (overrideConfig) => {
      return await ai.generate({
        model: 'googleai/gemini-2.5-flash-image',
        ...overrideConfig,
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
          ...overrideConfig.config,
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 0.8,
        },
      });
    });

    if (!media) {
      throw new Error('Image generation failed to produce an avatar.');
    }

    if (userId) {
      const now = new Date();
      const timestamp = format(now, 'yyyyMMdd_HHmmss');
      const contentId = uuidv4();
      const fileName = `${timestamp}_${contentId}.png`;
      const filePath = `users/${userId}/avatars/${fileName}`;

      const storage = await getStorageInstance();
      const file = storage.bucket().file(filePath);

      const buffer = Buffer.from(media.url.split(',')[1], 'base64');
      await file.save(buffer, {
        resumable: false,
        metadata: { contentType: 'image/png' },
      });

      const db = await getDb();
      await db.collection('users').doc(userId).set({
        avatarUrl: filePath,
      }, { merge: true });
    }

    return { imageDataUri: media.url };
  } catch (error) {
    StructuredLogger.error('Avatar generation flow failed', {
      service: 'avatar-generator',
      operation: 'generateAvatar',
      userId,
      metadata: { name }
    }, error as Error);
    throw error;
  }
}
