/**
 * /api/attendance/classes/[classId]/students/[studentId]/absences
 *
 * GET — recent absent dates for one student (?limitDays=30)
 *       (was getStudentAbsenceDatesAction)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getStudentAbsenceDates, attendanceErrorStatus } from '@/server/attendance';

interface Ctx { params: Promise<{ classId: string; studentId: string }> }

const QuerySchema = z.object({
    limitDays: z.coerce.number().int().min(1).max(365).default(30),
});

export async function GET(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId, studentId } = await ctx.params;

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
        limitDays: searchParams.get('limitDays') ?? undefined,
    });
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    try {
        return NextResponse.json(
            await getStudentAbsenceDates(userId, classId, studentId, parsed.data.limitDays),
        );
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
