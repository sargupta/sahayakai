/**
 * GET /api/groups/feed — unified feed across the caller's groups.
 * Query: limit (default 20), startAfter (ISO timestamp cursor).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUnifiedFeed } from '@/server/groups';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    startAfter: z.string().max(64).optional(),
});

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const parsed = QuerySchema.safeParse({
        limit: sp.get('limit') ?? undefined,
        startAfter: sp.get('startAfter') ?? undefined,
    });
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    try {
        const feed = await getUnifiedFeed(userId, parsed.data.limit ?? 20, parsed.data.startAfter);
        return NextResponse.json(feed);
    } catch (err) {
        return errorResponse(err);
    }
}
