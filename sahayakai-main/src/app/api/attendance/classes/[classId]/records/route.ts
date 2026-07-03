/**
 * /api/attendance/classes/[classId]/records
 *
 * GET  ?date=YYYY-MM-DD       — one day's record        (was getAttendanceForDateAction)
 * GET  ?year=YYYY&month=1-12  — full month's records    (was getMonthlyAttendanceAction)
 * POST { date, records }      — save a day's attendance (was saveAttendanceAction;
 *                               F9-004 IST + H9 records-map validation live in
 *                               the service, verbatim)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
    saveAttendance, getAttendanceForDate, getMonthlyAttendance, attendanceErrorStatus,
} from '@/server/attendance';

interface Ctx { params: Promise<{ classId: string }> }

const SaveSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // Status enum + student-id membership are validated by the H9 block in
    // the service — do NOT loosen this to trust the client map.
    records: z.record(z.string(), z.string()),
});

const MonthQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
});

export async function GET(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId } = await ctx.params;

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    try {
        if (date) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
            }
            return NextResponse.json(await getAttendanceForDate(userId, classId, date));
        }

        const parsed = MonthQuerySchema.safeParse({
            year: searchParams.get('year'),
            month: searchParams.get('month'),
        });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Provide either ?date= or ?year=&month=' }, { status: 400 });
        }
        return NextResponse.json(
            await getMonthlyAttendance(userId, classId, parsed.data.year, parsed.data.month),
        );
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId } = await ctx.params;

    const parsed = SaveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await saveAttendance(userId, classId, parsed.data.date, parsed.data.records as any);
        return NextResponse.json({ success: true });
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
