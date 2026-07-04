/**
 * /api/content/pdf-download
 *
 * POST { title, base64Data, type? } — persist an exported PDF to Storage +
 * a tracking doc (was recordPdfDownload action).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { recordPdfDownload } from '@/server/content';
import { logger } from '@/lib/logger';

const PdfDownloadSchema = z.object({
    title: z.string(),
    base64Data: z.string(),
    type: z.string().optional(),
});

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = PdfDownloadSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        // Service returns { success, path?, error? } with a scrubbed error
        // message (Wave 2b) — pass through verbatim.
        const result = await recordPdfDownload(
            userId,
            parsed.data.title,
            parsed.data.base64Data,
            (parsed.data.type as any) ?? 'lesson-plan',
        );
        return NextResponse.json(result);
    } catch (err) {
        logger.error('POST /api/content/pdf-download failed', err, 'CONTENT', { userId });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
