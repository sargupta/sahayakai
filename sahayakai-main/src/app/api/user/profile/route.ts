
import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';
import { UserProfileSchema } from '@/ai/schemas/content-schemas';
import { UserProfile, ADMINISTRATIVE_ROLES, QUALIFICATIONS, EDUCATION_BOARDS } from '@/types';
import { logger } from '@/lib/logger';
import { fanoutNewTeacherJoinedNotification } from '@/lib/notifications/fanout';

/**
 * The ONLY keys of `UserProfileSchema` a client may write through this route.
 *
 * Everything else the schema carries — `uid`, `email`, `planType`,
 * `impactScore`, `contentSharedCount`, `createdAt`, `lastLogin` — is
 * server-controlled and appears in `protectedUserFields()` in firestore.rules.
 * Those are written only by dedicated server flows (Razorpay webhook →
 * planType, aggregator → impactScore, auth → email/uid).
 *
 * Why this list exists even though `dbAdapter.updateUser` already filters
 * through `CLIENT_EDITABLE_USER_FIELDS`: the new-user branch below writes via
 * `createUser`, which is an UNFILTERED `set(merge:true)` (it must be — it seeds
 * the very server-controlled fields the allowlist rejects). This list is what
 * keeps client input out of that seed. The adapter allowlist remains the second
 * layer on the update branch.
 */
const CLIENT_WRITABLE_PROFILE_KEYS = [
    'displayName',
    'photoURL',
    'phoneNumber',
    'schoolName',
    'teachingGradeLevels',
    'subjects',
    'preferredLanguage',
] as const;

/**
 * Pick the client-writable slice of a validated profile payload.
 *
 * `sentKeys === null` (new user) takes schema defaults, which is exactly what a
 * fresh document wants. For an EXISTING user `sentKeys` is the set of keys the
 * client actually put on the wire, so Zod's defaults can never be resurrected
 * over stored values: omitting `subjects` used to write `[]` and wipe them.
 */
function pickClientWritable(
    validated: Record<string, unknown>,
    sentKeys: Set<string> | null,
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of CLIENT_WRITABLE_PROFILE_KEYS) {
        if (sentKeys && !sentKeys.has(key)) continue;
        if (validated[key] === undefined) continue;
        out[key] = validated[key];
    }
    // Wire field `teachingGradeLevels` is stored as `gradeLevels`.
    if ('teachingGradeLevels' in out) {
        out.gradeLevels = out.teachingGradeLevels;
        delete out.teachingGradeLevels;
    }
    return out;
}

function sortedJson(v: unknown): string {
    return JSON.stringify([...((v as unknown[]) ?? [])].sort());
}

/**
 * @swagger
 * /api/user/profile:
 *   post:
 *     summary: Create or Update User Profile
 *     description: >
 *       Upserts a user profile. Useful for simulating Onboarding completion.
 *       Server-controlled fields (planType, impactScore, contentSharedCount,
 *       email, uid, createdAt, badges, follower counts, verifiedStatus) are
 *       IGNORED if present in the body — they are written only by the billing
 *       webhook / aggregators / auth. On update, omitted fields keep their
 *       stored value; they are not reset to schema defaults.
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

        const validated = validationResult.data as Record<string, unknown>;

        // Keys the client actually put on the wire. Zod fills the rest in with
        // schema defaults, and those defaults must never reach an update.
        const sentKeys = new Set(
            body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : [],
        );

        // Check if profile already exists — only seed server-controlled values for new users
        const existingProfile = await dbAdapter.getUser(requestingUserId);
        const isNewUser = !existingProfile;

        if (isNewUser) {
            // New document: schema defaults are appropriate here, but every
            // server-controlled field is stamped by the server, NOT by the
            // client. A brand-new profile is always a free plan with zeroed
            // aggregates no matter what the request body asked for.
            const now = { seconds: Date.now() / 1000, nanoseconds: 0, toDate: () => new Date() };
            const profile = {
                ...pickClientWritable(validated, null),
                uid: requestingUserId, // never body.uid
                email: validated.email,
                planType: 'free' as const,
                impactScore: 0,
                contentSharedCount: 0,
                badges: [],
                followersCount: 0,
                followingCount: 0,
                verifiedStatus: 'none' as const,
                createdAt: now,
                lastLogin: now,
            } as unknown as UserProfile;

            // createUser uses set(merge:true), safe for upsert
            await dbAdapter.createUser(profile);

            // Fan-out: notify nearby teachers (same district + primary subject)
            // when a new teacher completes their first profile save. Fire-and-
            // forget — never block the response and never throw on failure.
            void fanoutNewTeacherJoinedNotification(requestingUserId).catch((err) => {
                logger.error('fanoutNewTeacherJoined dispatch failed', err, 'PROFILE', { uid: requestingUserId });
            });

            return NextResponse.json({ success: true, uid: requestingUserId });
        }

        // Existing document: write ONLY what the client sent, and only the
        // client-writable slice of it. Anything omitted keeps its stored value.
        const updateData = pickClientWritable(validated, sentKeys);

        // If the teacher changed a group-affecting field, reset groupsInitialized
        // so groups re-sync. Only fields actually sent can count as "changed".
        const schoolChanged =
            'schoolName' in updateData && updateData.schoolName !== existingProfile.schoolName;
        const subjectsChanged =
            'subjects' in updateData && sortedJson(updateData.subjects) !== sortedJson(existingProfile.subjects);
        const gradesChanged =
            'gradeLevels' in updateData && sortedJson(updateData.gradeLevels) !== sortedJson(existingProfile.gradeLevels);
        if (schoolChanged || subjectsChanged || gradesChanged) {
            updateData.groupsInitialized = false;
        }

        // updateUser filters through CLIENT_EDITABLE_USER_FIELDS and stamps
        // uid + lastLogin server-side — the second layer behind the
        // route-level allowlist above.
        await dbAdapter.updateUser(requestingUserId, updateData as Partial<UserProfile>);

        return NextResponse.json({ success: true, uid: requestingUserId });

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
            preferredBoard?: unknown;
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

        if (body.preferredBoard !== undefined) {
            if (!(EDUCATION_BOARDS as readonly string[]).includes(body.preferredBoard as string)) {
                return NextResponse.json(
                    { error: `preferredBoard must be one of: ${EDUCATION_BOARDS.join(', ')}` },
                    { status: 400 }
                );
            }
            partialData.preferredBoard = body.preferredBoard as typeof EDUCATION_BOARDS[number];
            // Keep the legacy free-string field in sync so existing consumers
            // (teacher directory, onboarding resume) stay consistent.
            partialData.educationBoard = body.preferredBoard as string;
        }

        await dbAdapter.updateUser(userId, partialData);

        return NextResponse.json({ success: true });

    } catch (error) {
        logger.error('Profile PATCH API Failed', error, 'PROFILE');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
