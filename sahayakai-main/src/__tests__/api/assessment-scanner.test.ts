/**
 * Wire-contract tests for `POST /api/ai/assessment-scanner`.
 *
 * Covers the Phase-2 surface area:
 *   - Subject allow-list (Mathematics + 5 more, plus "Other") vs unknowns
 *   - Page count guard (1..ASSESSMENT_DEMO_PAGE_CAP, currently 3)
 *   - Backwards-compat: legacy `{ pageUrl: string }` is accepted as one page
 *   - Auth header is required
 *
 * The grading flow itself (`gradeAssessment`) is mocked — we only test the
 * route handler's input validation + response shape.
 *
 * We spy on `NextResponse.json` (mirroring `assistant-planned-actions.test.ts`)
 * because the project's jsdom test env doesn't preserve `NextResponse.json`
 * bodies through `await res.json()`.
 */

const mockGradeAssessment = jest.fn();

jest.mock('@/ai/flows/assessment-scanner', () => ({
    gradeAssessment: (...args: unknown[]) => mockGradeAssessment(...args),
}));

// Bypass plan-guard entirely — quota gating is tested elsewhere.
jest.mock('@/lib/plan-guard', () => ({
    withPlanCheck: () => (handler: (req: Request) => Promise<Response>) => handler,
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Capture every NextResponse.json invocation so we can assert on the actual
// wire payload regardless of the test-env Response polyfill.
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
import { ASSESSMENT_DEMO_PAGE_CAP } from '@/ai/schemas/assessment-scanner-schemas';

/** Minimal Request shim that supports `headers.get(...)` and `json()`. */
function makeRequest(body: unknown, userId: string | null = 'test-uid'): Request {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        json: async () => body,
        headers: { get: (k: string) => headers.get(k) ?? null },
    } as unknown as Request;
}

/** A valid UUIDv4 the schema's `.uuid()` validator accepts. */
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_PAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/test/o/page1.jpg';

function lastWireBody<T = Record<string, unknown>>(): T {
    if (jsonSpy.mock.calls.length === 0) {
        throw new Error('Expected NextResponse.json to have been called at least once');
    }
    return jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][0] as T;
}

const successPayload = {
    assessmentId: VALID_UUID,
    status: 'graded' as const,
    pageCount: 1,
    totalAwardedMarks: 8,
    totalMaxMarks: 10,
    scorePct: 80,
    letterGrade: 'A',
    questions: [],
    classAverageAtScan: null,
    conceptMastery: [],
    recommendedNextSteps: [],
    studentRecommendations: [],
    needsReviewCount: 0,
    imageQualityWarnings: [],
};

describe('POST /api/ai/assessment-scanner', () => {
    beforeEach(() => {
        mockGradeAssessment.mockReset();
        jsonSpy.mockReset();
    });

    // ── Auth ────────────────────────────────────────────────────────────────

    it('returns 401 without x-user-id', async () => {
        const res = await POST(
            makeRequest(
                {
                    assessmentId: VALID_UUID,
                    subject: 'Mathematics',
                    gradeLevel: 'Class 10',
                    language: 'English',
                    pageUrls: [VALID_PAGE_URL],
                },
                null,
            ),
        );
        expect(res.status).toBe(401);
    });

    // ── Subject guard ──────────────────────────────────────────────────────

    it('returns 200 for Mathematics + valid image', async () => {
        mockGradeAssessment.mockResolvedValue(successPayload);
        const res = await POST(
            makeRequest({
                assessmentId: VALID_UUID,
                subject: 'Mathematics',
                gradeLevel: 'Class 10',
                language: 'English',
                pageUrls: [VALID_PAGE_URL],
            }),
        );
        expect(res.status).toBe(200);
        expect(mockGradeAssessment).toHaveBeenCalledWith(
            expect.objectContaining({ subject: 'Mathematics', userId: 'test-uid' }),
        );
    });

    it('returns 200 for Science (no longer Math-only)', async () => {
        mockGradeAssessment.mockResolvedValue({ ...successPayload, pageCount: 1 });
        const res = await POST(
            makeRequest({
                assessmentId: VALID_UUID,
                subject: 'Science',
                gradeLevel: 'Class 7',
                language: 'Hindi',
                pageUrls: [VALID_PAGE_URL],
            }),
        );
        expect(res.status).toBe(200);
        expect(mockGradeAssessment).toHaveBeenCalledWith(
            expect.objectContaining({ subject: 'Science' }),
        );
    });

    it.each([
        'Environmental Studies (EVS)',
        'Social Science',
        'History',
        'Geography',
        'Civics',
        'Hindi',
        'English',
        'Other',
    ])('accepts subject %s', async (subject) => {
        mockGradeAssessment.mockResolvedValue(successPayload);
        const res = await POST(
            makeRequest({
                assessmentId: VALID_UUID,
                subject,
                gradeLevel: 'Class 5',
                language: 'English',
                pageUrls: [VALID_PAGE_URL],
            }),
        );
        expect(res.status).toBe(200);
    });

    it('returns 400 for unknown subject "Astrology" with a clear message', async () => {
        const res = await POST(
            makeRequest({
                assessmentId: VALID_UUID,
                subject: 'Astrology',
                gradeLevel: 'Class 10',
                language: 'English',
                pageUrls: [VALID_PAGE_URL],
            }),
        );
        expect(res.status).toBe(400);
        const body = lastWireBody<{ error: string; message: string; allowedSubjects: string[] }>();
        expect(body.error).toBe('UNSUPPORTED_SUBJECT');
        expect(body.message).toContain('Astrology');
        expect(body.allowedSubjects).toEqual(expect.arrayContaining(['Mathematics', 'Science', 'Other']));
        expect(mockGradeAssessment).not.toHaveBeenCalled();
    });

    it('returns 400 when subject is missing', async () => {
        const res = await POST(
            makeRequest({
                assessmentId: VALID_UUID,
                gradeLevel: 'Class 10',
                language: 'English',
                pageUrls: [VALID_PAGE_URL],
            }),
        );
        expect(res.status).toBe(400);
        const body = lastWireBody<{ code: string }>();
        expect(body.code).toBe('SUBJECT_REQUIRED');
    });

    // ── Page-count guard ───────────────────────────────────────────────────

    it(`returns 400 when more than ${ASSESSMENT_DEMO_PAGE_CAP} pages are sent`, async () => {
        const pages = Array.from({ length: ASSESSMENT_DEMO_PAGE_CAP + 1 }, (_, i) =>
            `${VALID_PAGE_URL}?p=${i}`,
        );
        const res = await POST(
            makeRequest({
                assessmentId: VALID_UUID,
                subject: 'Mathematics',
                gradeLevel: 'Class 10',
                language: 'English',
                pageUrls: pages,
            }),
        );
        expect(res.status).toBe(400);
        const body = lastWireBody<{ error: string; message: string; maxPages: number }>();
        expect(body.error).toBe('PAGE_LIMIT_EXCEEDED');
        expect(body.maxPages).toBe(ASSESSMENT_DEMO_PAGE_CAP);
        expect(body.message).toContain(String(ASSESSMENT_DEMO_PAGE_CAP));
        expect(mockGradeAssessment).not.toHaveBeenCalled();
    });

    it('returns 400 when zero pages are sent', async () => {
        const res = await POST(
            makeRequest({
                assessmentId: VALID_UUID,
                subject: 'Mathematics',
                gradeLevel: 'Class 10',
                language: 'English',
                pageUrls: [],
            }),
        );
        expect(res.status).toBe(400);
        const body = lastWireBody<{ code: string }>();
        expect(body.code).toBe('NO_PAGES');
        expect(mockGradeAssessment).not.toHaveBeenCalled();
    });

    it(`returns 200 with exactly ${ASSESSMENT_DEMO_PAGE_CAP} pages (boundary case)`, async () => {
        mockGradeAssessment.mockResolvedValue({
            ...successPayload,
            pageCount: ASSESSMENT_DEMO_PAGE_CAP,
        });
        const pages = Array.from(
            { length: ASSESSMENT_DEMO_PAGE_CAP },
            (_, i) => `${VALID_PAGE_URL}?p=${i}`,
        );
        const res = await POST(
            makeRequest({
                assessmentId: VALID_UUID,
                subject: 'Mathematics',
                gradeLevel: 'Class 10',
                language: 'English',
                pageUrls: pages,
            }),
        );
        expect(res.status).toBe(200);
        expect(mockGradeAssessment).toHaveBeenCalledWith(
            expect.objectContaining({ pageUrls: pages }),
        );
    });

    // ── Backwards compatibility ────────────────────────────────────────────

    it('accepts legacy `pageUrl` (singular string) and normalises to a one-element pageUrls', async () => {
        mockGradeAssessment.mockResolvedValue(successPayload);
        const res = await POST(
            makeRequest({
                assessmentId: VALID_UUID,
                subject: 'Mathematics',
                gradeLevel: 'Class 10',
                language: 'English',
                pageUrl: VALID_PAGE_URL,
            }),
        );
        expect(res.status).toBe(200);
        expect(mockGradeAssessment).toHaveBeenCalledWith(
            expect.objectContaining({ pageUrls: [VALID_PAGE_URL] }),
        );
    });
});
