/**
 * GET /api/community/resources — browse the community library.
 * Filters: type, language, authorId, authorIds (repeat), excludeTypes (repeat).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLibraryResources } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
    type: z.string().max(64).optional(),
    language: z.string().max(64).optional(),
    authorId: z.string().max(128).optional(),
    authorIds: z.array(z.string().max(128)).max(10).optional(),
    excludeTypes: z.array(z.string().max(64)).max(10).optional(),
});

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const parsed = QuerySchema.safeParse({
        type: sp.get('type') ?? undefined,
        language: sp.get('language') ?? undefined,
        authorId: sp.get('authorId') ?? undefined,
        authorIds: sp.getAll('authorIds').length ? sp.getAll('authorIds') : undefined,
        excludeTypes: sp.getAll('excludeTypes').length ? sp.getAll('excludeTypes') : undefined,
    });
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    try {
        const resources = await getLibraryResources(userId, parsed.data);
        return NextResponse.json(resources);
    } catch (err) {
        return errorResponse(err);
    }
}
