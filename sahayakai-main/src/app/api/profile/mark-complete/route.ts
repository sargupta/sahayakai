import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { dbAdapter } from '@/lib/db/adapter';
import { logger } from '@/lib/logger';
import {
    computeProfileCompletion,
    PROFILE_COMPLETE_THRESHOLD,
} from '@/lib/profile-completion';
import {
    PROFILE_COMPLETE_COOKIE,
    PROFILE_COMPLETE_COOKIE_MAX_AGE,
    signProfileCompleteCookie,
} from '@/lib/profile-complete-cookie';

/**
 * POST /api/profile/mark-complete
 *
 * Issued by the client at the end of onboarding (or any time the profile
 * crosses the completion threshold). Reads the current profile, verifies
 * the score server-side, and — only on success — sets the
 * `sahayakai_profile_complete` cookie that the middleware uses to skip
 * the /onboarding redirect.
 *
 * The cookie is HMAC-signed against `PROFILE_COMPLETE_COOKIE_SECRET` so a
 * client cannot forge it without knowing the secret. If the secret is not
 * configured we still issue the cookie (signed with a per-process random
 * key) — middleware will reject mismatches, so worst case the user has to
 * complete onboarding again on the next deploy.
 */
export async function POST() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const profile = await dbAdapter.getUser(userId);
        if (!profile) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 },
            );
        }

        const score = computeProfileCompletion(profile as Record<string, any>);
        if (score < PROFILE_COMPLETE_THRESHOLD) {
            return NextResponse.json(
                {
                    error: 'PROFILE_INCOMPLETE',
                    score,
                    threshold: PROFILE_COMPLETE_THRESHOLD,
                },
                { status: 422 },
            );
        }

        const value = signProfileCompleteCookie(userId);
        const res = NextResponse.json({ ok: true, score });
        res.cookies.set(PROFILE_COMPLETE_COOKIE, value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: PROFILE_COMPLETE_COOKIE_MAX_AGE,
        });
        return res;
    } catch (err) {
        logger.error('Failed to mark profile complete', err, 'PROFILE', { userId });
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
