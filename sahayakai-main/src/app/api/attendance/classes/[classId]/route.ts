/**
 * /api/attendance/classes/[classId]
 *
 * GET    — fetch one class (owner only)   (was getClassAction)
 * PATCH  — update class fields            (was updateClassAction)
 * DELETE — delete class + subcollections  (was deleteClassAction)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getClass, updateClass, deleteClass, attendanceErrorStatus } from '@/server/attendance';

interface Ctx { params: Promise<{ classId: string }> }

const UpdateClassSchema = z.object({
    name: z.string().optional(),
    subject: z.string().optional(),
    gradeLevel: z.string().optional(),
    section: z.string().optional(),
});

export async function GET(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId } = await ctx.params;

    try {
        return NextResponse.json(await getClass(userId, classId));
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId } = await ctx.params;

    const parsed = UpdateClassSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await updateClass(userId, classId, parsed.data as any);
        return NextResponse.json({ success: true });
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId } = await ctx.params;

    try {
        await deleteClass(userId, classId);
        return NextResponse.json({ success: true });
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
