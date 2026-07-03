/**
 * /api/attendance/outreach-records
 *
 * GET  ?classId=&studentId=  — outreach history          (was getOutreachHistoryAction)
 * POST                       — save an outreach record   (was saveOutreachRecordAction;
 *                              H2 ownership + student-membership checks live in
 *                              the service, verbatim)
 *
 * NOTE: distinct from /api/attendance/outreach, which is the telephony-path
 * endpoint that also *initiates* the Twilio/Exotel call (F9-001/F9-003 fixes).
 * This resource is the plain CRUD surface the class page uses.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { saveOutreachRecord, getOutreachHistory, attendanceErrorStatus } from '@/server/attendance';

const SaveOutreachSchema = z.object({
    classId: z.string(),
    className: z.string(),
    studentId: z.string(),
    studentName: z.string(),
    parentPhone: z.string(),
    parentLanguage: z.string(),
    reason: z.string(),
    teacherNote: z.string().optional(),
    generatedMessage: z.string(),
    deliveryMethod: z.enum(['twilio_call', 'whatsapp_copy']),
    performanceContext: z.any().optional(),
});

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');
    const studentId = searchParams.get('studentId') ?? undefined;
    if (!classId) {
        return NextResponse.json({ error: 'classId is required' }, { status: 400 });
    }

    try {
        return NextResponse.json(await getOutreachHistory(userId, classId, studentId));
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = SaveOutreachSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        return NextResponse.json(await saveOutreachRecord(userId, parsed.data as any));
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
