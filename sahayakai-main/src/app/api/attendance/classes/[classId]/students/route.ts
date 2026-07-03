/**
 * /api/attendance/classes/[classId]/students
 *
 * GET  — list students in the class            (was getStudentsAction)
 * POST — add a student (pro plan; 40-cap txn)  (was addStudentAction, F9-006)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { addStudent, getStudents, attendanceErrorStatus } from '@/server/attendance';

interface Ctx { params: Promise<{ classId: string }> }

const AddStudentSchema = z.object({
    name: z.string(),
    // Range/integer checks stay in the service (Wave 3 message contract);
    // zod only guards the transport type here.
    rollNumber: z.number(),
    parentPhone: z.string(),
    parentLanguage: z.string(),
});

export async function GET(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId } = await ctx.params;

    try {
        return NextResponse.json(await getStudents(userId, classId));
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId } = await ctx.params;

    const parsed = AddStudentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        return NextResponse.json(await addStudent(userId, classId, parsed.data as any));
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
