
import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';
import { UserProfileSchema } from '@/ai/schemas/content-schemas';
import { UserProfile } from '@/types';

/**
 * @swagger
 * /api/user/profile:
 *   post:
 *     summary: Create or Update User Profile
 *     description: Upserts a user profile. Useful for simulating Onboarding completion.
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - uid
 *               - email
 *               - displayName
 *             properties:
 *               uid:
 *                 type: string
 *               email:
 *                 type: string
 *               displayName:
 *                 type: string
 *               schoolName:
 *                 type: string
 *               teachingGradeLevels:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [Class 5, Class 6, Class 7, Class 8, Class 9, Class 10, Class 11, Class 12]
 *               subjects:
 *                 type: array
 *                 items:
 *                   type: string
 *               preferredLanguage:
 *                 type: string
 *                 enum: [English, Hindi, Kannada, Tamil, Telugu, Marathi, Bengali]
 *     responses:
 *       200:
 *         description: Profile saved successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Database error
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Zod Validation
        const validationResult = UserProfileSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Schema Validation Failed', details: validationResult.error.format() },
                { status: 400 }
            );
        }

        const profile: UserProfile = {
            ...validationResult.data,
            badges: [],
            followersCount: 0,
            followingCount: 0,
            // Cast specialized types that Zod parsed as strings
            teachingGradeLevels: validationResult.data.teachingGradeLevels as any,
            subjects: validationResult.data.subjects as any,
            preferredLanguage: validationResult.data.preferredLanguage as any,
            verifiedStatus: 'none',
            createdAt: { seconds: Date.now() / 1000, nanoseconds: 0, toDate: () => new Date() },
            lastLogin: { seconds: Date.now() / 1000, nanoseconds: 0, toDate: () => new Date() }
        };

        // Using createUser/updateUser from adapter
        // Currently adapter has createUser which calls set(merge:true), so it works for upsert.
        await dbAdapter.createUser(profile);

        return NextResponse.json({ success: true, uid: profile.uid });

    } catch (error) {
        console.error('Profile Save API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
