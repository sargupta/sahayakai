
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { handleAIError, logAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import { isFeatureEnabled } from '@/lib/feature-flags';
import {
    dispatchExamPaper,
    ExamPaperGenerationInProgressError,
} from '@/lib/sidecar/exam-paper-dispatch';

// M4 (2026-07-16): the fallback path runs sidecar TIMEOUT_MS (90s) then the
// Genkit FALLBACK_TIMEOUT_MS (75s) sequentially = up to 165s. A 120s
// maxDuration made the platform 504 before the friendly 202 could map.
// Raised to 180 (Cloud Run has 300s headroom).
export const maxDuration = 180;

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
        // L11: `x-user-id` is trusted here because middleware.ts:156-157 strips
        // any client-supplied copy of this header and re-injects the verified
        // identity — that middleware is the trust boundary, not this handler.
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        // H5 (forensic EPG-2026-07-17): master kill switch for exam-paper
        // generation. Per-repair-pass flags exist, but there was no single lever
        // to pause the whole feature if core generation misbehaves — only a code
        // change. Unconfigured → enabled (zero-config; current behavior). A
        // non-2xx here refunds any reserved quota via withPlanCheck.
        const featureFlag = await isFeatureEnabled('examPaperEnabled', userId);
        if (!featureFlag.enabled) {
            return NextResponse.json(
                { error: 'Feature disabled', reason: featureFlag.reason },
                { status: 503 },
            );
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
            const blueprint = await findBlueprint(
                String(body.board),
                String(body.gradeLevel),
                String(body.subject),
            );
            // Whole-syllabus (empty chapters) is fine as long as the flow can expand []→a concrete
            // chapter list: from the blueprint's chapterWeightage, or from the NCERT seed. Only a
            // subject we can anchor NEITHER way leaves Gemini with two open-ended constraints
            // (invent-structure + invent-syllabus) → timeout. Reject just that case.
            let canAnchor = !!blueprint;
            if (!canAnchor) {
                const { canonicaliseGrade, canonicaliseSubject, getChaptersForCell } = await import('@/ai/data/ncert-chapters');
                const grade = canonicaliseGrade(String(body.gradeLevel));
                const subject = canonicaliseSubject(String(body.subject));
                canAnchor = grade != null && !!subject && getChaptersForCell(grade, subject).length > 0;
            }
            if (!canAnchor) {
                return NextResponse.json(
                    {
                        error: 'chapters_required_for_unblueprinted_subject',
                        message: `Please add at least one chapter for ${body.board} ${body.gradeLevel} ${body.subject}, or pick a subject we have a blueprint/syllabus for. The AI needs a chapter list to anchor the paper.`,
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

        if (body.pyqRatio !== undefined && (typeof body.pyqRatio !== 'number' || body.pyqRatio < 0 || body.pyqRatio > 100)) {
            return NextResponse.json(
                { error: 'Invalid pyqRatio. Must be a number between 0 and 100.' },
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
            // H3 (2026-07-16): generate is the canonical writer — surface the
            // persisted content id so the client can Save (PUT) as an upsert by
            // id instead of writing a duplicate row.
            contentId: dispatched.contentId,
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
            // Phase 1 marks-reconcile (2026-07-09): forward the drift report.
            // Also forward validationWarnings — this explicit field list had
            // been silently dropping them since the NCERT warnings shipped.
            marksReconciliation: dispatched.marksReconciliation,
            // Phase 2 (2026-07-10): forward the answer-key/marking-scheme
            // completeness report, mirroring marksReconciliation.
            answerKeyCompleteness: dispatched.answerKeyCompleteness,
            validationWarnings: dispatched.validationWarnings,
            // C7/H1: novelty report — the one report field previously dropped
            // from this allow-list, so the UI can flag relabeled "New" questions.
            newVerification: dispatched.newVerification,
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

        // L10: cheap DoS guard — reject oversized bodies before parsing.
        const contentLength = Number(request.headers.get('content-length') || 0);
        if (contentLength > 1_000_000) {
            return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
        }

        const body = await request.json();
        // L10: `typeof [] === 'object'` means the old check let an array (or a
        // shapeless object) through. Require a real paper object with the
        // fields we persist.
        const paper = body.paper;
        if (
            !paper ||
            typeof paper !== 'object' ||
            Array.isArray(paper) ||
            !paper.title ||
            !Array.isArray(paper.sections)
        ) {
            return NextResponse.json(
                { error: 'Missing or invalid required field: paper (must be an object with title and sections)' },
                { status: 400 },
            );
        }

        const { dbAdapter } = await import('@/lib/db/adapter');
        const { Timestamp } = await import('firebase-admin/firestore');
        const { v4: uuidv4 } = await import('uuid');
        const { toExamPaperContentFields } = await import('@/ai/data/exam-paper-content-fields');

        // H3 (2026-07-16): generate already persisted this paper and returned
        // its id. Reuse it so saveContent upserts the existing row instead of
        // creating a duplicate. Fall back to a fresh id for legacy clients that
        // don't echo it back.
        const contentId = body.contentId || uuidv4();
        const now = new Date();

        // Persist to Firestore `data` only — no redundant Storage JSON blob
        // (papers are viewed and downloaded straight from `data`).
        await dbAdapter.saveContent(userId, {
            id: contentId,
            type: 'exam-paper' as const,
            title: paper.title || `${paper.board || ''} ${paper.gradeLevel || ''} ${paper.subject || ''} Exam Paper`.trim(),
            ...toExamPaperContentFields({
                gradeLevel: paper.gradeLevel,
                subject: paper.subject,
                language: paper.language,
            }),
            topic: Array.isArray(paper.chapters) ? paper.chapters.join(', ') : (paper.subject || ''),
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: paper,
        });

        return NextResponse.json({ success: true, contentId });
    } catch (error) {
        // L10: route through the shared mapper so quota/safety/schema failures
        // get their specific codes instead of a blanket 500.
        return handleAIError(error, 'EXAM_PAPER_SAVE', {
            message: 'Exam Paper Save Failed',
            userId: request.headers.get('x-user-id'),
        });
    }
}

// H2 (2026-07-16): NO withPlanCheck here. Save persists an already-generated
// (and already-charged) paper — it is not a new generation, so gating it
// double-charged the user's quota. _saveHandler keeps its own 401 auth check.
export const PUT = _saveHandler;
