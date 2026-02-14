'use server';

/**
 * @fileOverview Generates simple, decent, and stable avatars for teachers.
 *
 * - generateAvatar - A function that takes a name and returns a stable avatar image.
 * - AvatarGeneratorInput - The input type for the generateAvatar function.
 * - AvatarGeneratorOutput - The return type for the generateAvatar function.
 */

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
  const { name, userId } = input;

  try {
    // 1. Create a stable seed. Use userId if available, otherwise name.
    // This ensures the avatar "should not change" for a specific user identity.
    const stableSeed = userId || name.trim().toLowerCase().replace(/\s+/g, '-');

    // 2. Use DiceBear 'initials' style for a "simple and decent" professional look.
    // We encode the name (e.g. "Sandeep") so the initials (e.g. "S") are generated correctly.
    // Background colors are chosen from a professional, slightly muted palette.
    const backgroundColors = ["6366f1", "f43f5e", "10b981", "f59e0b", "8b5cf6", "06b6d4"];
    const bgColor = backgroundColors[Math.abs(stableSeed.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % backgroundColors.length];

    const avatarUrl = `https://api.dicebear.com/9.x/initials/png?seed=${stableSeed}&label=${encodeURIComponent(name)}&backgroundColor=${bgColor}`;

    const response = await fetch(avatarUrl);
    if (!response.ok) throw new Error('Failed to fetch from DiceBear');

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageDataUri = `data:image/png;base64,${buffer.toString('base64')}`;

    if (userId) {
      const now = new Date();
      const timestamp = format(now, 'yyyyMMdd_HHmmss');
      const contentId = uuidv4();
      const fileName = `${timestamp}_${contentId}.png`;
      const filePath = `users/${userId}/avatars/${fileName}`;

      const storage = await getStorageInstance();
      const file = storage.bucket().file(filePath);

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

      // Save to user profile for persistence
      const db = await getDb();
      await db.collection('users').doc(userId).set({
        avatarUrl: filePath,
        avatarDataUri: imageDataUri,
        lastAvatarUpdate: now.toISOString()
      }, { merge: true });
    }

    return { imageDataUri };
  } catch (error) {
    console.error('Error generating stable avatar:', error);
    throw new Error('Failed to generate professional avatar.');
  }
}
