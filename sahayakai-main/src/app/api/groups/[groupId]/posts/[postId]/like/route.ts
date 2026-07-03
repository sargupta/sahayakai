/**
 * POST /api/groups/[groupId]/posts/[postId]/like — toggle a like on a group
 * post (members only; transactional toggle, F5-002; author notification with
 * dedup — see src/server/groups.ts). Returns { isLiked, newCount }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { likeGroupPost } from '@/server/groups';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: Promise<{ groupId: string; postId: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { groupId, postId } = await ctx.params;

    try {
        const result = await likeGroupPost(userId, groupId, postId);
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err);
    }
}
