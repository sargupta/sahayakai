/**
 * /api/attendance/classes/[classId]/students
 *
 * GET  — list students in the class            (was getStudentsAction)
 *        ?projection=roster → masked RosterStudent[] (no full parentPhone)
 * POST — add a student (pro plan; 40-cap txn)  (was addStudentAction, F9-006)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { addStudent, getStudents, getStudentRoster, attendanceErrorStatus } from '@/server/attendance';

interface Ctx { params: Promise<{ classId: string }> }

// Opt-in projections. Omitting `projection` MUST keep the legacy full-document
// shape byte-identical — the web student-manager depends on it (it needs the
// full parentPhone to render the edit form). `roster` is the masked projection
// for clients that must never hold a parent's phone number; the masking is
// enforced server-side in getStudentRoster, not by trusting the caller.
const QuerySchema = z.object({
    projection: z.enum(['roster']).optional(),
});

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

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
        projection: searchParams.get('projection') ?? undefined,
    });
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    try {
        return NextResponse.json(
            parsed.data.projection === 'roster'
                ? await getStudentRoster(userId, classId)
                : await getStudents(userId, classId),
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
