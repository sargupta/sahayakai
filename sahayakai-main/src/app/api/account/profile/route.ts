/**
 * GET /api/account/profile — the caller's own profile, `{ success, profile }`
 * contract (tranche 5 migration of src/app/actions/auth.ts::getUserProfileAction).
 *
 * Lives under /api/account/** — NOT /api/auth/** — because middleware's
 * public-route list contains the `/api/auth/` prefix; this endpoint must stay
 * behind token verification.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserProfileAction } from '@/server/auth';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    try {
        const uidParam = req.nextUrl.searchParams.get('uid') ?? undefined;
        const result = await getUserProfileAction(uidParam);
        return NextResponse.json(result);
    } catch (error) {
        return errorResponse(error, 'AUTH');
    }
}
