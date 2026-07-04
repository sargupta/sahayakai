/**
 * /api/community/follows
 *   GET  — ids of teachers the caller follows.
 *   POST — toggle follow/unfollow. Body: { followingId }. Follower is ALWAYS
 *          the authenticated uid; self-follow forbidden (F10-04, enforced in
 *          src/server/community.ts).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { followTeacher, getFollowingIds } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const followingIds = await getFollowingIds(userId);
        return NextResponse.json(followingIds);
    } catch (err) {
        return errorResponse(err);
    }
}

const BodySchema = z.object({ followingId: z.string().min(1).max(128) });

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await followTeacher(userId, parsed.data.followingId);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return errorResponse(err);
    }
}
