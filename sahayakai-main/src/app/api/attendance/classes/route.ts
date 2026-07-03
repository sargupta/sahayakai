/**
 * /api/attendance/classes
 *
 * GET  — list the caller's classes           (was getClassesAction)
 * POST — create a class (pro plan required)  (was createClassAction)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClass, getClasses, attendanceErrorStatus } from '@/server/attendance';

const CreateClassSchema = z.object({
    name: z.string(),
    subject: z.string(),
    gradeLevel: z.string(),
    section: z.string().optional(),
    academicYear: z.string(),
});

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        return NextResponse.json(await getClasses(userId));
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = CreateClassSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        return NextResponse.json(await createClass(userId, parsed.data as any));
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
