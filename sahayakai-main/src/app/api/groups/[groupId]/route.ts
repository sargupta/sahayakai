/**
 * GET /api/groups/[groupId] — group metadata.
 *
 * F10-06 (design choice): non-members CAN read group metadata — discovery
 * needs name/description/memberCount pre-join. Member-only data lives in
 * subcollections gated by their own routes (posts/chat require membership).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getGroup } from '@/server/groups';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: Promise<{ groupId: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { groupId } = await ctx.params;

    try {
        const group = await getGroup(userId, groupId);
        return NextResponse.json(group);
    } catch (err) {
        return errorResponse(err);
    }
}
