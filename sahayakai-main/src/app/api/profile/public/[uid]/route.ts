/**
 * GET /api/profile/public/[uid] — another teacher's PUBLIC profile
 * (tranche 5 migration of src/app/actions/profile.ts::getPublicProfileAction).
 *
 * Whitelisted fields only; email gated to self / admin / accepted connection
 * (F10-02). Caller must be signed in.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPublicProfileAction } from '@/server/profile';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ uid: string }> },
) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    try {
        const { uid } = await params;
        const data = await getPublicProfileAction(uid);
        return NextResponse.json(data);
    } catch (error) {
        return errorResponse(error, 'PROFILE');
    }
}
