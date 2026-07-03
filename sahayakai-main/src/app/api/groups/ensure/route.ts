/**
 * POST /api/groups/ensure — idempotent auto-provisioning of the caller's
 * groups (subject/grade, state, daily briefing, community general; school
 * groups are created but NEVER auto-joined — privacy opt-in). Returns the
 * caller's group ids.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ensureUserGroups } from '@/server/groups';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const groupIds = await ensureUserGroups(userId);
        return NextResponse.json(groupIds);
    } catch (err) {
        return errorResponse(err);
    }
}
