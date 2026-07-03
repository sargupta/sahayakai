/**
 * POST /api/community/resources/like — toggle a like on a library resource.
 * Body: { resourceId }. Self-like forbidden (F10-05); transactional toggle
 * (F5) — enforced in src/server/community.ts. Returns { isLiked, newCount }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { likeResource } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ resourceId: z.string().min(1).max(128) });

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const result = await likeResource(userId, parsed.data.resourceId);
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err);
    }
}
