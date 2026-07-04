/**
 * /api/ncert/chapters
 *
 * GET ?grade=&subject= — NCERT chapters for a grade (was getNCERTChapters
 * action). Wave 1 gate preserved: authenticated callers only (curriculum
 * data is public domain, but the gate prevents anonymous scraping / DOS).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getNCERTChapters } from '@/server/ncert';

const QuerySchema = z.object({
    grade: z.coerce.number().int().min(1).max(12),
    subject: z.string().optional(),
});

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
        grade: searchParams.get('grade'),
        subject: searchParams.get('subject') ?? undefined,
    });
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    // Service fails soft ([]) on DB errors — client falls back to static data.
    return NextResponse.json(await getNCERTChapters(parsed.data.grade, parsed.data.subject));
}
