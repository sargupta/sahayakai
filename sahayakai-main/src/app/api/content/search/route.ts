/**
 * /api/content/search
 *
 * GET ?q= — context-aware smart search over the caller's library
 *           (was searchContentAction)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { searchContent } from '@/server/content';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') ?? '';

    try {
        // Service fails soft ([]) on DB errors, matching the action.
        return NextResponse.json(await searchContent(userId, query));
    } catch (err) {
        logger.error('GET /api/content/search failed', err, 'CONTENT', { userId });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
