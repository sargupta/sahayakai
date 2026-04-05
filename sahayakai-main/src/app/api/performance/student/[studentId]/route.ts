import { NextResponse } from 'next/server';
import { performanceAdapter, verifyClassOwnership } from '@/lib/db/performance-adapter';
import { logger } from '@/lib/logger';
import { TERMS } from '@/types/performance';

// GET — Get a student's assessments and performance trend
export async function GET(
    request: Request,
    { params }: { params: Promise<{ studentId: string }> }
) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { studentId } = await params;
        const { searchParams } = new URL(request.url);
        const classId = searchParams.get('classId');
        const subject = searchParams.get('subject') || undefined;
        const termParam = searchParams.get('term') || undefined;
        const academicYear = searchParams.get('academicYear') || undefined;

        if (!classId) {
            return NextResponse.json({ error: 'Missing classId parameter' }, { status: 400 });
        }

        // Validate term if provided
        if (termParam && !TERMS.includes(termParam as typeof TERMS[number])) {
            return NextResponse.json({ error: `Invalid term. Must be one of: ${TERMS.join(', ')}` }, { status: 400 });
        }
        const term = termParam as typeof TERMS[number] | undefined;

        // Verify the requesting user is the teacher for this class
        const isOwner = await verifyClassOwnership(classId, userId);
        if (!isOwner) {
            return NextResponse.json({ error: 'Forbidden: You do not have access to this class' }, { status: 403 });
        }

        const hasFilters = !!(subject || term || academicYear);

        if (hasFilters) {
            // Filtered view: fetch only the filtered assessments. Trend (which reads all
            // assessments unfiltered) is expensive and less meaningful with filters active.
            const assessments = await performanceAdapter.getStudentAssessments(
                classId, studentId, { subject, term, academicYear }
            );
            return NextResponse.json({ studentId, assessments, trend: null });
        }

        // No filters: getStudentPerformanceTrend already fetches all assessments internally,
        // so we avoid the duplicate getStudentAssessments call.
        const trend = await performanceAdapter.getStudentPerformanceTrend(classId, studentId);
        return NextResponse.json({
            studentId,
            assessments: trend?.assessments ?? [],
            trend,
        });
    } catch (error: unknown) {
        logger.error('[performance] Failed to get student assessments', error);
        return NextResponse.json({ error: 'Failed to load student data' }, { status: 500 });
    }
}
