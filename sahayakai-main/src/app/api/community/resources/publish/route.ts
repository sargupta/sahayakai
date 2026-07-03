/**
 * POST /api/community/resources/publish — promote a personal content item to
 * the public community library. Body: { contentId }. The caller can only
 * publish their OWN content — dbAdapter.getContent is uid-scoped, so a
 * foreign contentId fails with "Content not found" (see src/server/community.ts).
 * Returns { resourceId }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { publishContentToLibrary } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ contentId: z.string().min(1).max(256) });

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const result = await publishContentToLibrary(userId, parsed.data.contentId);
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err);
    }
}
