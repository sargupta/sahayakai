
import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';
import { UserProfileSchema } from '@/ai/schemas/content-schemas';
import { UserProfile, ADMINISTRATIVE_ROLES, QUALIFICATIONS } from '@/types';
import { logger } from '@/lib/logger';

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
        // Auth check — middleware injects x-user-id from verified Firebase token
        const requestingUserId = request.headers.get('x-user-id');
        if (!requestingUserId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();

        // Ownership check — body.uid must match the authenticated user
        if (body.uid && body.uid !== requestingUserId) {
            logger.error('Profile ownership violation', new Error('uid mismatch'), 'PROFILE', { requestingUserId, bodyUid: body.uid });
            return NextResponse.json({ error: 'Forbidden: Cannot modify another user\'s profile' }, { status: 403 });
        }

        // Zod Validation
        const validationResult = UserProfileSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Schema Validation Failed', details: validationResult.error.format() },
                { status: 400 }
            );
        }

        const { teachingGradeLevels: _tgl, ...restData } = validationResult.data as any;

        // Check if profile already exists — only set social defaults for new users
        const existingProfile = await dbAdapter.getUser(requestingUserId);
        const isNewUser = !existingProfile;

        const profile: UserProfile = {
            ...restData,
            // Normalize field: accept both old and new field names
            gradeLevels: (restData.gradeLevels ?? _tgl ?? []) as any,
            subjects: restData.subjects as any,
            preferredLanguage: validationResult.data.preferredLanguage as any,
            // Only set social/badge defaults for new profiles — never overwrite existing values
            ...(isNewUser ? {
                badges: [],
                followersCount: 0,
                followingCount: 0,
                verifiedStatus: 'none' as const,
                createdAt: { seconds: Date.now() / 1000, nanoseconds: 0, toDate: () => new Date() },
            } : {}),
            lastLogin: { seconds: Date.now() / 1000, nanoseconds: 0, toDate: () => new Date() }
        };

        // If existing user changed group-affecting fields, reset groupsInitialized so groups re-sync
        if (!isNewUser && existingProfile) {
            const schoolChanged = profile.schoolName !== existingProfile.schoolName;
            const newSubjects = [...(profile.subjects ?? [])].sort();
            const oldSubjects = [...(existingProfile.subjects ?? [])].sort();
            const subjectsChanged = JSON.stringify(newSubjects) !== JSON.stringify(oldSubjects);
            const newGrades = [...(profile.gradeLevels ?? [])].sort();
            const oldGrades = [...(existingProfile.gradeLevels ?? [])].sort();
            const gradesChanged = JSON.stringify(newGrades) !== JSON.stringify(oldGrades);
            if (schoolChanged || subjectsChanged || gradesChanged) {
                (profile as any).groupsInitialized = false;
            }
        }

        // createUser uses set(merge:true), safe for upsert
        await dbAdapter.createUser(profile);

        return NextResponse.json({ success: true, uid: profile.uid });

    } catch (error) {
        logger.error('Profile Save API Failed', error, 'PROFILE');
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json() as {
            yearsOfExperience?: unknown;
            administrativeRole?: unknown;
            qualifications?: unknown;
        };

        const partialData: Partial<UserProfile> = {};

        if (body.yearsOfExperience !== undefined) {
            const years = Number(body.yearsOfExperience);
            if (!Number.isFinite(years) || years < 0 || years > 60) {
                return NextResponse.json({ error: 'yearsOfExperience must be between 0 and 60' }, { status: 400 });
            }
            partialData.yearsOfExperience = years;
        }

        if (body.administrativeRole !== undefined) {
            if (!ADMINISTRATIVE_ROLES.includes(body.administrativeRole as typeof ADMINISTRATIVE_ROLES[number])) {
                return NextResponse.json(
                    { error: `administrativeRole must be one of: ${ADMINISTRATIVE_ROLES.join(', ')}` },
                    { status: 400 }
                );
            }
            partialData.administrativeRole = body.administrativeRole as typeof ADMINISTRATIVE_ROLES[number];
        }

        if (body.qualifications !== undefined) {
            if (!Array.isArray(body.qualifications)) {
                return NextResponse.json({ error: 'qualifications must be an array' }, { status: 400 });
            }
            const validQuals = QUALIFICATIONS as readonly string[];
            const invalid = (body.qualifications as unknown[]).find((q) => !validQuals.includes(q as string));
            if (invalid) {
                return NextResponse.json(
                    { error: `Invalid qualification: ${invalid}. Must be one of: ${QUALIFICATIONS.join(', ')}` },
                    { status: 400 }
                );
            }
            partialData.qualifications = body.qualifications as typeof QUALIFICATIONS[number][];
        }

        await dbAdapter.updateUser(userId, partialData);

        return NextResponse.json({ success: true });

    } catch (error) {
        logger.error('Profile PATCH API Failed', error, 'PROFILE');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
