import { NextResponse } from 'next/server';
import { performanceAdapter, verifyClassOwnership } from '@/lib/db/performance-adapter';
import { logger } from '@/lib/logger';
import type { BatchMarksInput } from '@/types/performance';
import { ASSESSMENT_TYPES, TERMS } from '@/types/performance';

// POST — Save a batch of student marks
export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: BatchMarksInput = await request.json();

        if (!body.classId || !body.name || !body.type || !body.subject || body.maxMarks == null || !body.marks?.length) {
            return NextResponse.json({ error: 'Missing required fields: classId, name, type, subject, maxMarks, marks' }, { status: 400 });
        }

        // Explicit positive-number guard (negative maxMarks passes !body.maxMarks falsy check)
        if (body.maxMarks <= 0) {
            return NextResponse.json({ error: 'maxMarks must be greater than 0' }, { status: 400 });
        }

        // Validate enum fields
        if (!ASSESSMENT_TYPES.includes(body.type)) {
            return NextResponse.json({ error: `Invalid type. Must be one of: ${ASSESSMENT_TYPES.join(', ')}` }, { status: 400 });
        }
        if (!TERMS.includes(body.term)) {
            return NextResponse.json({ error: `Invalid term. Must be one of: ${TERMS.join(', ')}` }, { status: 400 });
        }

        // Verify the requesting user is the teacher for this class
        const isOwner = await verifyClassOwnership(body.classId, userId);
        if (!isOwner) {
            return NextResponse.json({ error: 'Forbidden: You do not have access to this class' }, { status: 403 });
        }

        // Validate marks entries
        for (const entry of body.marks) {
            if (!entry.studentId) {
                return NextResponse.json({ error: 'Each marks entry must include a non-empty studentId' }, { status: 400 });
            }
            if (entry.marksObtained < 0 || entry.marksObtained > body.maxMarks) {
                return NextResponse.json({
                    error: `Invalid marks for student ${entry.studentName || entry.studentId}: ${entry.marksObtained} (max: ${body.maxMarks})`
                }, { status: 400 });
            }
        }

        const batchId = await performanceAdapter.saveAssessmentBatch(body, userId);

        logger.info(`[performance] User ${userId} saved batch ${batchId} for class ${body.classId} (${body.marks.length} students)`);

        return NextResponse.json({
            success: true,
            batchId,
            studentCount: body.marks.length,
        });
    } catch (error: unknown) {
        logger.error('[performance] Failed to save assessment batch', error);
        return NextResponse.json({ error: 'Failed to save marks' }, { status: 500 });
    }
}

// GET — List assessment batches for a class
export async function GET(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const classId = searchParams.get('classId');

        if (!classId) {
            return NextResponse.json({ error: 'Missing classId parameter' }, { status: 400 });
        }

        // Verify the requesting user is the teacher for this class
        const isOwner = await verifyClassOwnership(classId, userId);
        if (!isOwner) {
            return NextResponse.json({ error: 'Forbidden: You do not have access to this class' }, { status: 403 });
        }

        const batches = await performanceAdapter.listAssessmentBatches(classId);

        return NextResponse.json({ batches });
    } catch (error: unknown) {
        logger.error('[performance] Failed to list assessment batches', error);
        return NextResponse.json({ error: 'Failed to load batches' }, { status: 500 });
    }
}
