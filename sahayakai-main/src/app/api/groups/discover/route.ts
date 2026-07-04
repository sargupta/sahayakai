/**
 * GET /api/groups/discover — relevance-ranked groups the caller hasn't joined.
 */
import { NextRequest, NextResponse } from 'next/server';
import { discoverGroups } from '@/server/groups';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const groups = await discoverGroups(userId);
        return NextResponse.json(groups);
    } catch (err) {
        return errorResponse(err);
    }
}
