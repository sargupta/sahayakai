/**
 * /api/content/library
 *
 * GET  — the caller's own content, limit 100  (was getUserContent action)
 * POST — save generated content to library    (was saveToLibrary action)
 *
 * NOTE: distinct from /api/content/save (schema-validated save used by the
 * generation flows) and /api/content/list (paginated/filterable listing).
 * This resource mirrors the exact semantics of the migrated server actions
 * so components keep their behavior 1:1.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserContent, saveToLibrary } from '@/server/content';
import { logger } from '@/lib/logger';

const SaveToLibrarySchema = z.object({
    type: z.string(),
    title: z.string(),
    data: z.any(),
});

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Service already fails soft ([]) on DB errors, matching the action.
        return NextResponse.json(await getUserContent(userId));
    } catch (err) {
        logger.error('GET /api/content/library failed', err, 'CONTENT', { userId });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = SaveToLibrarySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        // Service returns { success, id?, error? } with a scrubbed error
        // message (Wave 2b) — pass it through verbatim, 200 either way, so
        // the client wrapper preserves the action's result-object contract.
        const result = await saveToLibrary(userId, parsed.data.type as any, parsed.data.title, parsed.data.data);
        return NextResponse.json(result);
    } catch (err) {
        logger.error('POST /api/content/library failed', err, 'CONTENT', { userId });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
