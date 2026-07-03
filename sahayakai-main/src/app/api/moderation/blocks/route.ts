/**
 * GET /api/moderation/blocks — list the caller's blocked users
 * (moderation v1), hydrated with public display name/photo for the
 * blocked-users management UI.
 *
 * Owner-only by construction: the uid comes from the middleware-verified
 * x-user-id header and there is no parameter to read anyone else's list.
 */
import { NextResponse } from 'next/server';
import { listBlocks } from '@/server/moderation';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    try {
        const blocks = await listBlocks(userId);
        return NextResponse.json({ blocks });
    } catch (err) {
        return errorResponse(err, 'MODERATION');
    }
}
