/**
 * /api/attendance/classes/[classId]/summaries
 *
 * GET ?year=YYYY&month=1-12 — per-student monthly attendance rollups
 *     (was getStudentSummariesAction)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getStudentSummaries, attendanceErrorStatus } from '@/server/attendance';
import type { StudentAttendanceSummary } from '@/types/attendance';

interface Ctx { params: Promise<{ classId: string }> }

const QuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
});

/**
 * The JSON one summary row is published as.
 *
 * Renaming `consecutiveAbsences` to `currentAbsenceStreak` fixed the meaning
 * but also changed the wire shape, and the Flutter client in this same repo
 * reads the old key — nullably, so it did not crash, it silently decoded 0 for
 * every student. That is worse than a crash: the month screen's absence banner
 * stopped rendering and the attendance lane of the notifications feed went
 * permanently empty, with no error anywhere to say so.
 *
 * So the old key stays on the wire as an alias until every shipped client reads
 * the new one. It is a serialization concern only: the field does not exist on
 * `StudentAttendanceSummary`, nothing server-side computes with it, and the type
 * below is the only place in the app the name still appears.
 */
type StudentAttendanceSummaryWire = StudentAttendanceSummary & {
    /**
     * @deprecated Alias of `currentAbsenceStreak` — the run the student is on
     * NOW. It is deliberately NOT `longestAbsenceStreak`: every surface that
     * reads this key phrases it in the present tense ("absent N days in a row",
     * the outreach threshold, the notification count), which is exactly the
     * confusion the rename was for. Repointing it at the month's high-water mark
     * would reinstate the original bug on mobile while the web app looked fixed.
     */
    consecutiveAbsences: number;
};

const toWire = (summary: StudentAttendanceSummary): StudentAttendanceSummaryWire => ({
    ...summary,
    consecutiveAbsences: summary.currentAbsenceStreak,
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
        const summaries = await getStudentSummaries(userId, classId, parsed.data.year, parsed.data.month);
        return NextResponse.json(summaries.map(toWire));
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
