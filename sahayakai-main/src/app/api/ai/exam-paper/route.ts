
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { handleAIError, logAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import {
    dispatchExamPaper,
    ExamPaperGenerationInProgressError,
} from '@/lib/sidecar/exam-paper-dispatch';

/**
 * @swagger
 * /api/ai/exam-paper:
 *   post:
 *     summary: Generate a Board-Pattern Exam Paper
 *     description: Uses AI to generate a complete exam paper following official board blueprints with answer keys and marking schemes.
 *     tags:
 *       - AI Generation
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - board
 *               - gradeLevel
 *               - subject
 *               - chapters
 *             properties:
 *               board:
 *                 type: string
 *                 example: "CBSE"
 *               gradeLevel:
 *                 type: string
 *                 example: "Class 10"
 *               subject:
 *                 type: string
 *                 example: "Mathematics"
 *               chapters:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Quadratic Equations", "Triangles"]
 *               difficulty:
 *                 type: string
 *                 enum: [easy, moderate, hard, mixed]
 *                 example: "mixed"
 *               language:
 *                 type: string
 *                 example: "English"
 *               includeAnswerKey:
 *                 type: boolean
 *                 example: true
 *               includeMarkingScheme:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Generated Exam Paper
 *       400:
 *         description: Invalid input
 *       500:
 *         description: AI Generation failed
 */
const VALID_DIFFICULTIES = ['easy', 'moderate', 'hard', 'mixed'] as const;

async function _handler(request: Request) {
    let paperDesc = 'Unknown Paper';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
        }

        paperDesc = `${body.board || ''} ${body.gradeLevel || ''} ${body.subject || ''}`.trim() || 'Unknown Paper';

        if (!body.board || !body.gradeLevel || !body.subject) {
            return NextResponse.json(
                { error: 'Missing required fields: board, gradeLevel, subject' },
                { status: 400 }
            );
        }

        // Default chapters to [] if missing/null. The Genkit schema marks
        // `chapters` as required (z.array(z.string())) but the field
        // description explicitly says "Empty array means cover all chapters
        // for the subject" — so an absent body field should not 500. UI
        // doesn't enforce a chapter pick (button stays enabled when blank).
        if (!Array.isArray(body.chapters)) {
            body.chapters = [];
        }

        // NCERT demo hot-fix (2026-05-19): when there is NO official
        // blueprint for the chosen board/grade/subject AND no chapters were
        // selected, Gemini gets two open-ended constraints at once
        // ("invent the structure" + "invent the syllabus") and routinely
        // exceeds the 75s budget — surfacing as a 202 in-progress payload
        // that the UI used to render as "undefined undefined undefined".
        // Require at least one chapter for the unblueprinted path so the
        // generator has SOMETHING to anchor on.
        if ((body.chapters as string[]).length === 0) {
            const { findBlueprint } = await import('@/ai/data/board-blueprints');
            const blueprint = findBlueprint(
                String(body.board),
                String(body.gradeLevel),
                String(body.subject),
            );
            if (!blueprint) {
                return NextResponse.json(
                    {
                        error: 'chapters_required_for_unblueprinted_subject',
                        message: `Please add at least one chapter for ${body.board} ${body.gradeLevel} ${body.subject}. We only have official blueprints for CBSE Class 9 and Class 10 Mathematics and Science — for everything else, the AI needs a chapter list to anchor the paper.`,
                    },
                    { status: 400 },
                );
            }
        }

        if (body.difficulty && !VALID_DIFFICULTIES.includes(body.difficulty as typeof VALID_DIFFICULTIES[number])) {
            return NextResponse.json(
                { error: `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(', ')}` },
                { status: 400 }
            );
        }

        // Phase E.2: dispatcher routes Genkit vs ADK sidecar based on
        // SAHAYAKAI_EXAM_PAPER_MODE env (default: off → Genkit only).
        const dispatched = await dispatchExamPaper({
            ...body,
            userId,
        } as Parameters<typeof dispatchExamPaper>[0]);
        return NextResponse.json({
            title: dispatched.title,
            board: dispatched.board,
            subject: dispatched.subject,
            gradeLevel: dispatched.gradeLevel,
            duration: dispatched.duration,
            maxMarks: dispatched.maxMarks,
            generalInstructions: dispatched.generalInstructions,
            sections: dispatched.sections,
            blueprintSummary: dispatched.blueprintSummary,
            pyqSources: dispatched.pyqSources,
        });

    } catch (error) {
        // NCERT demo hot-fix (2026-05-19): when the Genkit fallback exceeds
        // budget, surface a friendly "still generating" payload instead of
        // a generic 500. The underlying Gemini call keeps running in the
        // background; if it eventually persists to the user's library, the
        // teacher will see it under "My Library" on next refresh.
        if (error instanceof ExamPaperGenerationInProgressError) {
            logger.warn(
                'Exam paper generation exceeded timeout budget',
                'EXAM_PAPER',
                { budgetMs: error.budgetMs, elapsedMs: error.elapsedMs, paperDesc },
            );
            return NextResponse.json(
                {
                    error: 'generation_in_progress',
                    message: 'Exam paper still generating. Check My Library in 1 minute.',
                    budgetMs: error.budgetMs,
                    elapsedMs: error.elapsedMs,
                },
                { status: 202 },
            );
        }

        // BUG #2 hardening: when the model's output fails Zod validation even
        // after the schema's safe-fill defaults (e.g. a malformed `sections`
        // array, or a per-question `marks` that came back non-numeric), the
        // flow throws a `SchemaValidationError`. Surface this as a 422 with a
        // clear, actionable message instead of a bare 500 "Internal Server
        // Error" — and log the raw model output + parse errors at ERROR so the
        // failure is diagnosable from Cloud Logging without a repro.
        const errName = (error as { name?: string } | null)?.name;
        const errCode = (error as { errorCode?: string } | null)?.errorCode;
        const isSchemaValidation =
            errName === 'SchemaValidationError' || errCode === 'AI-SCHEMA-001';

        if (isSchemaValidation) {
            const ctx = (error as { context?: { validationErrors?: unknown } } | null)?.context;
            const inner = (ctx?.validationErrors ?? {}) as {
                rawOutput?: unknown;
                parseErrors?: unknown;
                expectedSchema?: unknown;
            };
            logger.error(
                `Exam Paper schema validation failed for: "${paperDesc}"`,
                error,
                'EXAM_PAPER',
                {
                    userId: request.headers.get('x-user-id'),
                    reason: 'schema_validation',
                    expectedSchema: inner.expectedSchema,
                    parseErrors: inner.parseErrors,
                    // Stringify so the raw model output lands as a single
                    // searchable field in Cloud Logging rather than being
                    // dropped by the structured-logging serializer.
                    rawModelOutput:
                        typeof inner.rawOutput === 'string'
                            ? inner.rawOutput
                            : JSON.stringify(inner.rawOutput ?? null),
                },
            );

            return NextResponse.json(
                {
                    error: 'exam_paper_unstructured',
                    code: 'SCHEMA_VALIDATION_FAILED',
                    message:
                        "We couldn't structure the exam paper — try fewer chapters or regenerate.",
                },
                { status: 422 },
            );
        }

        // BUG #21 hardening: route every remaining failure category through
        // `handleAIError` so we map quota exhaustion (503 + Retry-After),
        // safety violations (400), and ZodError input failures (400 with
        // field issues) to specific responses instead of returning a bare
        // 500 "Internal Server Error" for everything. Generic catch-alls
        // were why QA kept seeing "Internal Server Error" on Gemini timeouts
        // and safety blocks.
        return handleAIError(error, 'EXAM_PAPER', {
            message: `Exam Paper API Failed for: "${paperDesc}"`,
            userId: request.headers.get('x-user-id'),
            extra: {
                board: paperDesc,
                errorType: (error as { name?: string } | null)?.name,
                errorCode: (error as { errorCode?: string } | null)?.errorCode,
            },
        });
    }
}

export const POST = withPlanCheck('exam-paper')(_handler);

/**
 * PUT /api/ai/exam-paper
 * Save a previously generated exam paper to the user's content library.
 * The paper JSON is passed in the request body; this handler persists it
 * to Firestore + Firebase Storage under the authenticated user's path.
 */
async function _saveHandler(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();
        if (!body.paper || typeof body.paper !== 'object') {
            return NextResponse.json({ error: 'Missing required field: paper' }, { status: 400 });
        }

        const { dbAdapter } = await import('@/lib/db/adapter');
        const { getStorageInstance } = await import('@/lib/firebase-admin');
        const { Timestamp } = await import('firebase-admin/firestore');
        const { v4: uuidv4 } = await import('uuid');
        const { format } = await import('date-fns');

        const paper = body.paper;
        const contentId = uuidv4();
        const now = new Date();
        const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
        const fileName = `${timestamp}-${contentId}.json`;
        const filePath = `users/${userId}/exam-papers/${fileName}`;

        const storage = await getStorageInstance();
        const file = storage.bucket().file(filePath);
        await file.save(JSON.stringify(paper), { contentType: 'application/json' });

        await dbAdapter.saveContent(userId, {
            id: contentId,
            type: 'exam-paper' as const,
            title: paper.title || `${paper.board || ''} ${paper.gradeLevel || ''} ${paper.subject || ''} Exam Paper`.trim(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            gradeLevel: (paper.gradeLevel || 'Class 10') as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            subject: (paper.subject || 'General') as any,
            topic: Array.isArray(paper.chapters) ? paper.chapters.join(', ') : (paper.subject || ''),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            language: (paper.language ?? 'English') as any,
            storagePath: filePath,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: paper,
        });

        return NextResponse.json({ success: true, contentId });
    } catch (error) {
        logger.error('Exam Paper Save Failed', error, 'EXAM_PAPER_SAVE', { userId: request.headers.get('x-user-id') });
        return NextResponse.json({ error: 'Failed to save exam paper' }, { status: 500 });
    }
}

export const PUT = withPlanCheck('exam-paper')(_saveHandler);
