/**
 * /api/content/storage-test
 *
 * POST — admin-only diagnostic write to the Storage bucket
 *        (was testStorageConnection action; Wave 1 admin gate preserved
 *        via validateAdmin inside the service).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { testStorageConnection } from '@/server/content';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        return NextResponse.json(await testStorageConnection(userId));
    } catch (err) {
        // validateAdmin throws for non-admins — surface as 403, not 500.
        const message = err instanceof Error ? err.message : '';
        if (/forbidden|admin/i.test(message)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        logger.error('POST /api/content/storage-test failed', err, 'STORAGE_TEST', { userId });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
