/**
 * /api/attendance/classes/[classId]/behavioral-outreach
 *
 * GET ?lookbackDays=30 — studentIds with a recent behavioral-concern outreach
 *     (was getStudentsWithRecentBehavioralOutreachAction)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getStudentsWithRecentBehavioralOutreach, attendanceErrorStatus } from '@/server/attendance';

interface Ctx { params: Promise<{ classId: string }> }

const QuerySchema = z.object({
    lookbackDays: z.coerce.number().int().min(1).max(365).default(30),
});

export async function GET(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId } = await ctx.params;

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
        lookbackDays: searchParams.get('lookbackDays') ?? undefined,
    });
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    try {
        return NextResponse.json(
            await getStudentsWithRecentBehavioralOutreach(userId, classId, parsed.data.lookbackDays),
        );
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
