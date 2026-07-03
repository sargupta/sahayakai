/**
 * POST /api/community/posts/like — toggle a like on a public post.
 * Body: { postId }. Self-like forbidden (F10-05); toggle is transactional
 * (F5-002) — both enforced in src/server/community.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { toggleLike } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ postId: z.string().min(1).max(128) });

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await toggleLike(userId, parsed.data.postId);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return errorResponse(err);
    }
}
