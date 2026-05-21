/**
 * PATCH /api/assessment-scanner/[id]
 *
 * Persist teacher edits onto a previously-graded assessment.
 *
 * Body:
 *   {
 *     questions: GradedQuestion[]   // each may carry a `teacherOverrides` block
 *   }
 *
 * The route:
 *   1. Verifies the caller owns the assessment (middleware-injected x-user-id).
 *   2. Validates the body against the GradedQuestion schema.
 *   3. Merges each incoming question onto the saved AI version, **only**
 *      replacing `teacherOverrides`. The AI fields (marksAwarded, feedback,
 *      studentFacingFeedback, studentAnswer, confidence, …) stay untouched so
 *      we can compare AI vs human judgement later and improve the prompt.
 *   4. Recomputes totals (totalAwardedMarks, scorePct, letterGrade,
 *      needsReviewCount) server-side. Never trusts client totals.
 *   5. Writes back via dbAdapter.saveContent (Firestore merge:true).
 *
 * No new AI calls — this is a pure update endpoint.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { dbAdapter } from '@/lib/db/adapter';
import { logger } from '@/lib/logger';
import { recomputeTotals } from '@/ai/schemas/assessment-scanner-utils';
import {
    GradedQuestionSchema,
    type AssessmentScannerOutput,
    type GradedQuestion,
} from '@/ai/schemas/assessment-scanner-schemas';

const PatchBodySchema = z.object({
    questions: z.array(GradedQuestionSchema).min(1),
});

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json(
            { error: 'Unauthorized: Missing User Identity' },
            { status: 401 },
        );
    }

    const params = await context.params;
    const assessmentId = params.id;
    if (!assessmentId) {
        return NextResponse.json({ error: 'Missing assessment id' }, { status: 400 });
    }

    let parsedBody: z.infer<typeof PatchBodySchema>;
    try {
        const raw = await request.json();
        const result = PatchBodySchema.safeParse(raw);
        if (!result.success) {
            return NextResponse.json(
                {
                    error: 'Schema Validation Failed',
                    details: result.error.format(),
                },
                { status: 400 },
            );
        }
        parsedBody = result.data;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
        const existing = await dbAdapter.getContent(userId, assessmentId);
        if (!existing) {
            return NextResponse.json(
                { error: 'Assessment not found' },
                { status: 404 },
            );
        }
        if (existing.type !== 'assessment-submission') {
            return NextResponse.json(
                { error: 'Content type does not support assessment edits' },
                { status: 400 },
            );
        }

        const existingData = (existing.data ?? null) as AssessmentScannerOutput | null;
        if (!existingData || !Array.isArray(existingData.questions)) {
            return NextResponse.json(
                { error: 'Assessment payload is missing or malformed' },
                { status: 422 },
            );
        }

        // Build a lookup by questionId so the client can send a partial update
        // (only changed questions) without losing the others.
        const incomingById = new Map<string, GradedQuestion>(
            parsedBody.questions.map((q) => [q.questionId, q]),
        );

        const editedAt = new Date().toISOString();
        const mergedQuestions: GradedQuestion[] = existingData.questions.map((aiQ) => {
            const incoming = incomingById.get(aiQ.questionId);
            if (!incoming) return aiQ;

            // Only the overrides block is teacher-controlled. Never mutate AI
            // fields — preserves the audit trail and lets us compare AI vs.
            // teacher decisions later for prompt improvements.
            const overrides = incoming.teacherOverrides ?? {};
            const hasAnyOverride =
                overrides.marksAwarded !== undefined ||
                overrides.feedback !== undefined ||
                overrides.studentFacingFeedback !== undefined ||
                overrides.studentAnswer !== undefined;

            if (!hasAnyOverride) {
                // Teacher cleared their edits — drop the block entirely so the
                // UI reverts to the AI value.
                const { teacherOverrides: _drop, ...rest } = aiQ;
                void _drop;
                return rest;
            }

            return {
                ...aiQ,
                teacherOverrides: {
                    ...overrides,
                    editedAt,
                },
            };
        });

        const totals = recomputeTotals(mergedQuestions, existingData.totalMaxMarks);

        const nextData: AssessmentScannerOutput = {
            ...existingData,
            questions: mergedQuestions,
            ...totals,
            teacherEditedAt: editedAt,
        };

        await dbAdapter.saveContent(userId, {
            id: assessmentId,
            type: 'assessment-submission' as any,
            title: existing.title,
            gradeLevel: existing.gradeLevel,
            subject: existing.subject,
            topic: existing.topic,
            language: existing.language,
            isPublic: existing.isPublic ?? false,
            isDraft: existing.isDraft ?? false,
            // dbAdapter merges on Firestore — `data` is replaced wholesale.
            data: nextData,
        } as any);

        return NextResponse.json({ ok: true, data: nextData });
    } catch (err) {
        logger.error(
            'Assessment scanner PATCH failed',
            err,
            'ASSESSMENT_SCANNER',
            { userId, assessmentId },
        );
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
