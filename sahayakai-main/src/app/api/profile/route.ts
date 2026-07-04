/**
 * /api/profile — the caller's own full profile (tranche 5 migration of
 * src/app/actions/profile.ts::getProfileData / updateProfileAction).
 *
 * GET  → { profile, certifications }   (self-only; full profile)
 * PUT  → { profileCompletionLevel }    (allowlisted patch of own profile)
 *
 * Auth: middleware-verified `x-user-id` header; missing → 401. The optional
 * `uid` compat parameter is forwarded to the service, which rejects loudly on
 * mismatch (rollout tripwire — never used for authorization).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfileData, updateProfileAction } from '@/server/profile';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    try {
        const uidParam = req.nextUrl.searchParams.get('uid') ?? undefined;
        const data = await getProfileData(uidParam);
        return NextResponse.json(data);
    } catch (error) {
        return errorResponse(error, 'PROFILE');
    }
}

const UpdateProfileSchema = z.object({
    // Compat: legacy positional `_userId` — checked against the session by
    // the service (Forbidden on mismatch), never trusted for authorization.
    uid: z.string().min(1),
    data: z.record(z.unknown()),
});

export async function PUT(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = UpdateProfileSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid profile update payload' }, { status: 400 });
    }

    try {
        const result = await updateProfileAction(parsed.data.uid, parsed.data.data);
        return NextResponse.json(result);
    } catch (error) {
        // Deliberate service-level validation message not covered by the
        // shared 400 allowlist — keep the exact string (clients show it).
        if (error instanceof Error && error.message === 'No writable fields in update payload') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return errorResponse(error, 'PROFILE');
    }
}
