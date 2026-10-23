/**
 * GET /api/sampark/[orgId]/teacher-calls?limit= — calls the school's teachers placed from
 * the attendance app, for the one calls view (integration brief Step 1B). Read-only.
 *
 * Input:  limit 1–500 (default 100).
 * Output: { calls: TeacherCallEntry[] } newest first — time, class, reason, outcome,
 *         duration and the last four digits only. Never the number or the message.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 members read + ⌈teachers/30⌉ indexed queries (teacherUid in, createdAt desc).
 * Done:   a teacher's Contact call appears in the school's Calls screen, labelled Teacher.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, guardOrgRoute, invalidRequest } from '@/server/sampark/http';
import { listTeacherCalls, TeacherCallQuerySchema } from '@/server/sampark/teacher-calls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const query = TeacherCallQuerySchema.safeParse({ limit: req.nextUrl.searchParams.get('limit') || undefined });
    if (!query.success) return invalidRequest(query.error);
    try {
        return NextResponse.json({ calls: await listTeacherCalls(guard.orgId, query.data) });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_TEACHER_CALLS');
    }
}
