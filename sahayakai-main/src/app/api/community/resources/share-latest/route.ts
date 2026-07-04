/**
 * POST /api/community/resources/share-latest — publish the caller's most
 * recent content of a given type to the community library.
 * Body: { contentType }. Returns { resourceId }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { shareLatestContent } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ contentType: z.string().min(1).max(64) });

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const result = await shareLatestContent(userId, parsed.data.contentType);
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err);
    }
}
