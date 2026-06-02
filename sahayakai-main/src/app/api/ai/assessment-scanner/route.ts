/**
 * POST /api/ai/assessment-scanner
 *
 * Run the AI grading flow on an uploaded student answer page (or up to
 * ASSESSMENT_DEMO_PAGE_CAP pages, currently 3).
 *
 * Phase-2 scope:
 *   - Pages: up to ASSESSMENT_DEMO_PAGE_CAP per request (schema ceiling is 15)
 *   - Subjects: ASSESSMENT_SUPPORTED_SUBJECTS — Mathematics (best-in-class),
 *     Science, EVS, Social Science (+ History / Geography / Civics), Hindi,
 *     English, plus an "Other" catch-all.
 *
 * Backwards compatibility:
 *   - `pageUrl: string` (legacy single-page) is accepted and normalised into
 *     a one-element `pageUrls` array. New callers should send `pageUrls`.
 *   - Phase-1 error codes (`PHASE_LIMIT` / `PHASE_1_PAGE_CAP` /
 *     `PHASE_1_SUBJECT`) are retired in favour of clearer codes
 *     (`PAGE_LIMIT_EXCEEDED`, `UNSUPPORTED_SUBJECT`). Old clients receive a
 *     400 with a human-readable message either way.
 *
 * Pattern mirrors `/api/ai/quiz/route.ts`:
 *   - Auth via x-user-id header (middleware-injected)
 *   - Plan + quota gating via withPlanCheck('assessment-scanner')
 *   - Zod-validated body
 *   - handleAIError for consistent error responses
 */

import { NextResponse } from 'next/server';
import {
    ASSESSMENT_DEMO_PAGE_CAP,
    ASSESSMENT_MAX_PAGES,
    ASSESSMENT_SUPPORTED_SUBJECTS,
    AssessmentScannerInputSchema,
} from '@/ai/schemas/assessment-scanner-schemas';
import { gradeAssessment } from '@/ai/flows/assessment-scanner';
import { handleAIError } from '@/lib/ai-error-response';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { withPlanCheck } from '@/lib/plan-guard';
import { dbAdapter } from '@/lib/db/adapter';

const SUPPORTED_SUBJECT_SET = new Set<string>(ASSESSMENT_SUPPORTED_SUBJECTS);

/**
 * Normalise the request body so older clients that still send `pageUrl`
 * (single string) keep working alongside new callers that send `pageUrls`
 * (string array). The schema only knows about `pageUrls`.
 */
function normalisePagePayload(raw: unknown): unknown {
    if (!raw || typeof raw !== 'object') return raw;
    const body = raw as Record<string, unknown>;

    // Already on the new shape — leave it alone.
    if (Array.isArray(body.pageUrls) && body.pageUrls.length > 0) return body;

    // Legacy single-page shape: `{ pageUrl: 'https://...' }`.
    if (typeof body.pageUrl === 'string' && body.pageUrl.length > 0) {
        return { ...body, pageUrls: [body.pageUrl] };
    }

    return body;
}

async function _handler(request: Request) {
    let assessmentId = 'unknown';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized: Missing User Identity' },
                { status: 401 },
            );
        }

        const rawJson = await request.json();
        const normalised = normalisePagePayload(rawJson);
        if (normalised && typeof normalised === 'object') {
            assessmentId =
                (normalised as Record<string, unknown>).assessmentId as string ?? 'unknown';
        }

        // Pre-schema subject + page-cap guards. Doing these BEFORE the schema
        // parse produces clearer error messages — a teacher who sends
        // "Astrology" should see "subject not supported" rather than a Zod
        // shape error about the broader request body.
        const candidate = (normalised ?? {}) as Record<string, unknown>;
        const subject = typeof candidate.subject === 'string' ? candidate.subject : '';
        const pageUrls = Array.isArray(candidate.pageUrls) ? candidate.pageUrls : [];

        if (!subject) {
            return NextResponse.json(
                {
                    error: 'INVALID_INPUT',
                    message: 'A subject is required.',
                    code: 'SUBJECT_REQUIRED',
                },
                { status: 400 },
            );
        }
        if (!SUPPORTED_SUBJECT_SET.has(subject)) {
            return NextResponse.json(
                {
                    error: 'UNSUPPORTED_SUBJECT',
                    message: `Subject "${subject}" is not supported. Pick one of: ${ASSESSMENT_SUPPORTED_SUBJECTS.join(', ')}. If your subject isn't listed, use "Other".`,
                    code: 'UNSUPPORTED_SUBJECT',
                    allowedSubjects: ASSESSMENT_SUPPORTED_SUBJECTS,
                },
                { status: 400 },
            );
        }
        if (pageUrls.length === 0) {
            return NextResponse.json(
                {
                    error: 'INVALID_INPUT',
                    message: 'At least one page is required (send `pageUrls` as a non-empty array, or `pageUrl` as a string).',
                    code: 'NO_PAGES',
                },
                { status: 400 },
            );
        }
        // Feature flag: assessmentScannerDemoMode
        //   ENABLED (default) — cap at ASSESSMENT_DEMO_PAGE_CAP (3, demo)
        //   DISABLED          — cap at ASSESSMENT_MAX_PAGES (15, schema)
        // Flip in Firestore: system_config/feature_flags.features
        //   .assessmentScannerDemoMode.enabled = false
        // Note: client UI also caps at ASSESSMENT_DEMO_PAGE_CAP today, so
        // flipping the server flag without a matching client-side change
        // only affects API callers that bypass the UI. See FEATURE_FLAGS.md
        // for client-side flag plumbing (Task 15a, separate PR).
        const demoMode = await isFeatureEnabled('assessmentScannerDemoMode', userId);
        const effectivePageCap = demoMode.enabled ? ASSESSMENT_DEMO_PAGE_CAP : ASSESSMENT_MAX_PAGES;
        if (pageUrls.length > effectivePageCap) {
            return NextResponse.json(
                {
                    error: 'PAGE_LIMIT_EXCEEDED',
                    message: `Up to ${effectivePageCap} pages per scan in the current release. You sent ${pageUrls.length}. Please split into multiple scans.`,
                    code: 'PAGE_LIMIT_EXCEEDED',
                    maxPages: effectivePageCap,
                    receivedPages: pageUrls.length,
                },
                { status: 400 },
            );
        }

        // QA #9 — default the education board to the teacher's saved board so
        // grading rubrics are board-aligned, without requiring a board field
        // in the scanner UI. Only fills the gap; an explicit client value wins.
        if (!candidate.educationBoard) {
            try {
                const profile = await dbAdapter.getUser(userId) as { preferredBoard?: string; educationBoard?: string } | null;
                const board = profile?.preferredBoard ?? profile?.educationBoard;
                if (board) candidate.educationBoard = board;
            } catch {
                // Non-fatal — proceed without a board hint.
            }
        }

        // Schema parse runs LAST so the targeted guards above own their own
        // error messages.
        const body = AssessmentScannerInputSchema.parse({ ...candidate, userId });

        const result = await gradeAssessment(body);
        return NextResponse.json(result);
    } catch (error) {
        // BUG #3 hardening: map KNOWN, user-fixable failure causes to a
        // specific 422 with an actionable message, instead of letting them
        // fall through to handleAIError's generic "AI generation failed" 500.
        // Detect by `.code` (duck-typed) so we don't couple the route bundle
        // to the flow's error classes / a possibly-divergent zod identity.
        const code = (error as { code?: string } | null)?.code;

        if (code === 'PAGE_UNREADABLE') {
            // Already logged at ERROR inside the flow with the raw fetch error.
            return NextResponse.json(
                {
                    error: 'page_unreadable',
                    code: 'PAGE_UNREADABLE',
                    message:
                        (error as { message?: string }).message ??
                        'One of the uploaded pages could not be read. Please re-upload it and try again.',
                    pageNumber: (error as { pageNumber?: number }).pageNumber,
                },
                { status: 422 },
            );
        }

        if (code === 'EMPTY_EXTRACTION') {
            return NextResponse.json(
                {
                    error: 'empty_extraction',
                    code: 'EMPTY_EXTRACTION',
                    message:
                        (error as { message?: string }).message ??
                        'We could not read any questions or answers from the uploaded pages. Please re-upload clearer photos and try again.',
                },
                { status: 422 },
            );
        }

        // BUG #23 hardening: Pass-2 frequently throws a ZodError-shaped
        // failure when the Gemini structured output doesn't satisfy the
        // graded-question schema (e.g. missing `marksAwarded`, malformed
        // `partialCreditBreakdown`). The flow logs the raw output at ERROR
        // already; here we surface a specific 422 with an actionable
        // message instead of leaking `handleAIError`'s 400 "Request body
        // failed schema validation" (which is wrong — the body was fine,
        // the *output* didn't validate) or its generic 500 "AI generation
        // failed". `ZodError.name === 'ZodError'` AND a populated `issues`
        // array is the duck-type Genkit re-throws here.
        const errName = (error as { name?: string } | null)?.name;
        const hasIssues = Array.isArray((error as { issues?: unknown } | null)?.issues);
        if (errName === 'ZodError' && hasIssues) {
            // Distinguish: input-body Zod errors come from `AssessmentScannerInputSchema.parse`
            // and have `issues[].path` rooted at request fields (subject, pageUrls, etc.).
            // Output-shape Zod errors come from Pass-2 / aggregate validation.
            const issues = (error as { issues: Array<{ path: (string | number)[] }> }).issues;
            const inputFields = new Set([
                'subject', 'pageUrls', 'pageUrl', 'gradeLevel', 'language',
                'assessmentId', 'studentId', 'classId', 'ncertChapterIds',
                'totalMaxMarks', 'teacherAnswerKeyText', 'educationBoard', 'userId',
            ]);
            const isInputError = issues.some(i => inputFields.has(String(i.path?.[0] ?? '')));
            if (!isInputError) {
                return NextResponse.json(
                    {
                        error: 'scan_unstructured',
                        code: 'SCAN_OUTPUT_MALFORMED',
                        message:
                            "We couldn't structure the scan results — please re-upload clearer photos or try again in a moment.",
                    },
                    { status: 422 },
                );
            }
        }

        return handleAIError(error, 'ASSESSMENT_SCANNER', {
            message: `Assessment Scanner API failed for assessmentId: "${assessmentId}"`,
            userId: request.headers.get('x-user-id'),
            extra: {
                assessmentId,
                errorType: errName,
            },
        });
    }
}

export const POST = withPlanCheck('assessment-scanner')(_handler);
