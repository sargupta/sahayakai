/**
 * /api/attendance/classes/[classId]/performance
 *
 * GET — per-student recent-assessment rollups for the triage banner
 *       (was getClassPerformanceSummariesAction)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getClassPerformanceSummaries, attendanceErrorStatus } from '@/server/attendance';

interface Ctx { params: Promise<{ classId: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId } = await ctx.params;

    try {
        return NextResponse.json(await getClassPerformanceSummaries(userId, classId));
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
