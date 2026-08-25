/**
 * Class gate: a scan that graded nothing must never become a grade.
 *
 * WHAT HAPPENED
 * `aggregate()` labels a scan `status: 'failed'` when the grading pass returns
 * zero gradable questions. It still fills in the arithmetic: 0 awarded of 0
 * max marks is 0%, and `letterGradeFor(0)` is 'E'. The flow only threw
 * `AssessmentEmptyExtractionError` when zero questions coincided with EVERY
 * page being flagged unreadable, so a legible page that yielded nothing (a
 * cover sheet, a blank question paper, the wrong page photographed) fell
 * through and the route returned that object with HTTP 200.
 *
 * Downstream, three things followed from the 200. `withPlanCheck` refunds the
 * reserved quota only on a non-2xx, so the teacher's plan was charged for a
 * scan that read nothing. The result card left "Copy summary" and "Send to
 * parent" enabled, and `formatParentSummary` rendered "Score: 0% (E)" — a real
 * failing grade for a child, one tap from WhatsApp, from a scan that never
 * read the paper. And persistence was fire-and-forget with a swallowed error
 * while the card asserted "Saved to My Library".
 *
 * WHAT THIS GATE CATCHES
 * Not "the allPagesUnreadable conjunct was wrong" — that is the instance. The
 * class is: no ungraded scan may leave the API as a 2xx, be billed, or be
 * turned into shareable text. Whatever future path produces a result with no
 * graded questions (a new sidecar, a new page type, a model that returns an
 * empty array) is covered without touching this file.
 */

// plan-guard is `import 'server-only'`; under jsdom that module throws.
jest.mock('server-only', () => ({}));

const mockDispatch = jest.fn();
jest.mock('@/lib/sidecar/assessment-scanner-dispatch', () => ({
    dispatchAssessmentScanner: (...args: unknown[]) => mockDispatch(...args),
}));

jest.mock('@/lib/feature-flags', () => ({
    isFeatureEnabled: jest.fn(async () => ({ enabled: true })),
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { getUser: jest.fn(async () => null) },
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Real plan-guard, faked counters: this test asserts the refund the HOF
// performs on a non-2xx, so withPlanCheck itself must not be stubbed out.
let mockUsed = 0;
const mockRollback = jest.fn(async () => {
    mockUsed = Math.max(0, mockUsed - 1);
});
jest.mock('@/lib/usage-counters', () => ({
    reserveQuota: jest.fn(
        async (_userId: string, _feature: string, monthlyLimit: number) => {
            if (monthlyLimit !== -1 && mockUsed >= monthlyLimit) {
                return { ok: false, reason: 'monthly', used: mockUsed, limit: monthlyLimit };
            }
            mockUsed += 1;
            return { ok: true };
        },
    ),
    rollbackQuota: (...args: unknown[]) => mockRollback(...args),
}));

// Subscription gating ON, so the quota path actually runs.
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: () => ({
            doc: () => ({
                get: async () => ({ exists: true, data: () => ({ subscriptionEnabled: true }) }),
            }),
        }),
    }),
}));

// NextResponse.json bodies don't survive `await res.json()` under this repo's
// jsdom env — capture what the route handed it (repo convention).
const jsonSpy = jest.fn();
jest.mock('next/server', () => ({
    NextResponse: {
        json: (data: unknown, init?: { status?: number }) => {
            jsonSpy(data, init);
            return {
                status: init?.status ?? 200,
                ok: (init?.status ?? 200) < 400,
                json: async () => data,
                text: async () => JSON.stringify(data),
                headers: new Map(),
            };
        },
    },
}));

// Imports must come AFTER all jest.mock calls.
import { POST } from '@/app/api/ai/assessment-scanner/route';
import {
    AssessmentNotGradedError,
    formatParentSummary,
    formatStudentHandout,
} from '@/lib/assessment-formatters';
import {
    isGradedResult,
    letterGradeFor,
} from '@/ai/schemas/assessment-scanner-utils';
import type { AssessmentScannerOutput } from '@/ai/schemas/assessment-scanner-schemas';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_PAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/test/o/page1.jpg';

function makeRequest(body: unknown, plan = 'free'): Request {
    const headers = new Map<string, string>([
        ['x-user-id', 'teacher-uid'],
        ['x-user-plan', plan],
    ]);
    return {
        json: async () => body,
        headers: { get: (k: string) => headers.get(k) ?? null },
    } as unknown as Request;
}

const SCAN_BODY = {
    assessmentId: VALID_UUID,
    subject: 'Mathematics',
    gradeLevel: 'Class 10',
    language: 'English',
    pageUrls: [VALID_PAGE_URL],
};

/**
 * Exactly what `aggregate()` builds when the grading pass returns no
 * questions: the zeroes are arithmetic on an empty set, not a judgement.
 */
const UNGRADED_RESULT = {
    assessmentId: VALID_UUID,
    status: 'failed' as const,
    pageCount: 1,
    totalAwardedMarks: 0,
    totalMaxMarks: 0,
    scorePct: 0,
    letterGrade: letterGradeFor(0),
    questions: [],
    classAverageAtScan: null,
    conceptMastery: [],
    recommendedNextSteps: [],
    studentRecommendations: [],
    needsReviewCount: 0,
    imageQualityWarnings: [],
};

const GRADED_QUESTION = {
    questionId: 'p0-q1',
    pageIndex: 0,
    questionText: 'Solve 12 x 4',
    studentAnswer: '48',
    expectedAnswer: '48',
    marksAwarded: 2,
    marksMax: 2,
    partialCreditBreakdown: [],
    feedback: 'Correct.',
    studentFacingFeedback: 'Well done.',
    conceptTested: 'Multiplication',
    ncertChapterId: null,
    mistakePattern: null,
    needsTeacherReview: false,
    confidence: 0.95,
};

const GRADED_RESULT = {
    ...UNGRADED_RESULT,
    status: 'graded' as const,
    totalAwardedMarks: 2,
    totalMaxMarks: 2,
    scorePct: 100,
    letterGrade: letterGradeFor(100),
    questions: [GRADED_QUESTION],
};

function lastWireBody<T = Record<string, unknown>>(): T {
    const calls = jsonSpy.mock.calls;
    if (calls.length === 0) throw new Error('NextResponse.json was never called');
    return calls[calls.length - 1][0] as T;
}

beforeEach(() => {
    mockUsed = 0;
    mockRollback.mockClear();
    mockDispatch.mockReset();
    jsonSpy.mockReset();
});

describe('a scan that graded nothing is not a result', () => {
    it('shows why the zeroes are dangerous: they read as a real failing grade', () => {
        // 0 of 0 marks lands in the bottom band. Nothing in the numbers says
        // "we did not read the paper" — which is the whole problem.
        expect(UNGRADED_RESULT.scorePct).toBe(0);
        expect(UNGRADED_RESULT.letterGrade).toBe('E');
        expect(isGradedResult(UNGRADED_RESULT)).toBe(false);
        expect(isGradedResult(GRADED_RESULT)).toBe(true);
    });

    it('returns 422, never 2xx, when the scan reports status failed', async () => {
        mockDispatch.mockResolvedValue(UNGRADED_RESULT);

        const res = await POST(makeRequest(SCAN_BODY));

        expect(res.status).toBe(422);
        expect(res.ok).toBe(false);
        const body = lastWireBody<{ code: string; message: string }>();
        expect(body.code).toBe('EMPTY_EXTRACTION');
        expect(body.message).toMatch(/re-upload clearer photos/i);
        // The client must not receive anything it can render as a score.
        expect(body).not.toHaveProperty('scorePct');
        expect(body).not.toHaveProperty('letterGrade');
        expect(body).not.toHaveProperty('totalAwardedMarks');
    });

    it('returns 422 when no questions came back even if the backend labelled it graded', async () => {
        // The Python sidecar sets its own status. An empty question array is
        // the ground truth whatever label rides along with it.
        mockDispatch.mockResolvedValue({ ...UNGRADED_RESULT, status: 'graded' });

        const res = await POST(makeRequest(SCAN_BODY));

        expect(res.status).toBe(422);
        expect(lastWireBody<{ code: string }>().code).toBe('EMPTY_EXTRACTION');
    });

    it('refunds the plan quota — a scan that read nothing is not billable', async () => {
        mockDispatch.mockResolvedValue(UNGRADED_RESULT);

        const res = await POST(makeRequest(SCAN_BODY));

        expect(res.status).toBe(422);
        expect(mockRollback).toHaveBeenCalledWith('teacher-uid', 'assessment-scanner');
        expect(mockUsed).toBe(0);
    });

    it('still charges a scan that actually graded something', async () => {
        mockDispatch.mockResolvedValue(GRADED_RESULT);

        const res = await POST(makeRequest(SCAN_BODY));

        expect(res.status).toBe(200);
        expect(mockRollback).not.toHaveBeenCalled();
        expect(mockUsed).toBe(1);
    });
});

describe('shareable text cannot be built from an ungraded scan', () => {
    it('formatParentSummary refuses instead of emitting "Score: 0% (E)"', () => {
        expect(() =>
            formatParentSummary(UNGRADED_RESULT as AssessmentScannerOutput, {
                subject: 'Mathematics',
                gradeLevel: 'Class 10',
                studentName: 'Riya',
            }),
        ).toThrow(AssessmentNotGradedError);
    });

    it('formatStudentHandout refuses too', () => {
        expect(() =>
            formatStudentHandout(UNGRADED_RESULT as AssessmentScannerOutput, {
                studentName: 'Riya',
            }),
        ).toThrow(AssessmentNotGradedError);
    });

    it('a real graded scan still formats, score and all', () => {
        const text = formatParentSummary(GRADED_RESULT as AssessmentScannerOutput, {
            subject: 'Mathematics',
            studentName: 'Riya',
        });
        expect(text).toContain('Score: 100% (A+)');
        expect(text).toContain('Solve 12 x 4');
    });
});
