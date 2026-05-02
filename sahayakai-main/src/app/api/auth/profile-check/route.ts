
import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';
import { logger } from '@/lib/logger';

/**
 * @swagger
 * /api/auth/profile-check:
 *   get:
 *     summary: Check if user profile exists
 *     description: Returns true if the user has a completed profile (school name set).
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: uid
 *         required: true
 *         description: Firebase UID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *       400:
 *         description: Missing UID
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
        return NextResponse.json({ error: 'UID required' }, { status: 400 });
    }

    try {
        const profile = await dbAdapter.getUser(uid);
        // Bug fix (auth pipeline review, 2026-04-30):
        // Previously this returned `exists: !!(profile && profile.schoolName)`.
        // That conflated TWO concepts: (a) user has a profile doc, and
        // (b) user has completed full onboarding including school name.
        // Conflating them meant any returning teacher whose `schoolName`
        // happened to be empty (signed up before the field existed,
        // bailed mid-onboarding, or had it cleared by a profile edit)
        // got bounced to /onboarding on EVERY login, never reaching the
        // dashboard — matching the symptom the user reported in prod.
        //
        // Correct semantic: `exists` means "user doc is in Firestore".
        // Onboarding-completeness is a SEPARATE check the dashboard
        // surfaces via a banner / nudge if needed. New users (no doc
        // at all) still land on /onboarding because `profile === null`.
        return NextResponse.json({
            exists: !!profile,
            // Surface onboarding completeness as a separate flag so the
            // client can decide UX (e.g., a nudge banner) without losing
            // navigation to the dashboard.
            onboardingComplete: !!(profile && profile.schoolName),
        });
    } catch (error) {
        logger.error("Profile check error", error, 'AUTH', { uid });
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
