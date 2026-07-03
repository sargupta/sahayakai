/**
 * GET /api/community/likes — hydrate the caller's liked group-post ids and
 * resource ids (heart-icon state on /community mount).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getLikedItemIds } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const result = await getLikedItemIds(userId);
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err);
    }
}
