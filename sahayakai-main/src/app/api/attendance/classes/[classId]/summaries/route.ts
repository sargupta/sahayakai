/**
 * /api/attendance/classes/[classId]/summaries
 *
 * GET ?year=YYYY&month=1-12 — per-student monthly attendance rollups
 *     (was getStudentSummariesAction)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getStudentSummaries, attendanceErrorStatus } from '@/server/attendance';

interface Ctx { params: Promise<{ classId: string }> }

const QuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
});

export async function GET(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId } = await ctx.params;

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
        year: searchParams.get('year'),
        month: searchParams.get('month'),
    });
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    try {
        return NextResponse.json(
            await getStudentSummaries(userId, classId, parsed.data.year, parsed.data.month),
        );
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
