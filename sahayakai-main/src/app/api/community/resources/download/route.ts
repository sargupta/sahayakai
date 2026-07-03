/**
 * POST /api/community/resources/download — track a resource download
 * (increments stats.downloads transactionally + analytics event).
 * Body: { resourceId }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { trackDownload } from '@/server/community';
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
        await trackDownload(userId, parsed.data.resourceId);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return errorResponse(err);
    }
}
