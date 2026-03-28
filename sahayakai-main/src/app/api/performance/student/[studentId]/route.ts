import { NextResponse } from 'next/server';
import { performanceAdapter } from '@/lib/db/performance-adapter';
import { logger } from '@/lib/logger';

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
        const term = searchParams.get('term') || undefined;
        const academicYear = searchParams.get('academicYear') || undefined;

        if (!classId) {
            return NextResponse.json({ error: 'Missing classId parameter' }, { status: 400 });
        }

        const [assessments, trend] = await Promise.all([
            performanceAdapter.getStudentAssessments(classId, studentId, { subject, term, academicYear }),
            performanceAdapter.getStudentPerformanceTrend(classId, studentId),
        ]);

        return NextResponse.json({
            studentId,
            assessments,
            trend,
        });
    } catch (error: any) {
        logger.error('[performance] Failed to get student assessments', error);
        return NextResponse.json({ error: 'Failed to load student data' }, { status: 500 });
    }
}
