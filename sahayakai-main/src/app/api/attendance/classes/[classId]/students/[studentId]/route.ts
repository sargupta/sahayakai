/**
 * /api/attendance/classes/[classId]/students/[studentId]
 *
 * PATCH  — update student fields   (was updateStudentAction)
 * DELETE — remove student          (was deleteStudentAction)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { updateStudent, deleteStudent, attendanceErrorStatus } from '@/server/attendance';

interface Ctx { params: Promise<{ classId: string; studentId: string }> }

const UpdateStudentSchema = z.object({
    name: z.string().optional(),
    rollNumber: z.number().optional(),
    parentPhone: z.string().optional(),
    parentLanguage: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId, studentId } = await ctx.params;

    const parsed = UpdateStudentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await updateStudent(userId, classId, studentId, parsed.data as any);
        return NextResponse.json({ success: true });
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId, studentId } = await ctx.params;

    try {
        await deleteStudent(userId, classId, studentId);
        return NextResponse.json({ success: true });
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
