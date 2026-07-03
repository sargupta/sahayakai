/**
 * GET /api/community/follows/posts — latest posts from teachers the caller
 * follows.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getFollowingPosts } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const posts = await getFollowingPosts(userId);
        return NextResponse.json(posts);
    } catch (err) {
        return errorResponse(err);
    }
}
