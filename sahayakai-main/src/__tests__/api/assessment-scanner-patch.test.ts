/**
 * Wire-contract tests for `PATCH /api/assessment-scanner/[id]`.
 *
 * Covers Phase 1 of the teacher-edit feature:
 *   - Auth header is required.
 *   - Body is schema-validated.
 *   - Missing / wrong-type Firestore docs return 404 / 400 / 422.
 *   - Edits applied via `teacherOverrides` are persisted; AI fields are
 *     never overwritten in place.
 *   - Totals (totalAwardedMarks, scorePct, letterGrade, needsReviewCount)
 *     are ALWAYS recomputed server-side from the merged questions —
 *     never trusted from the client.
 *
 * Follows the spy-on-NextResponse.json pattern from
 * `src/__tests__/api/assessment-scanner.test.ts` because the jsdom test
 * env doesn't preserve `NextResponse.json` bodies through `await res.json()`.
 */

const mockGetContent = jest.fn();
const mockSaveContent = jest.fn();

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getContent: (...args: unknown[]) => mockGetContent(...args),
        saveContent: (...args: unknown[]) => mockSaveContent(...args),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

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
import { PATCH } from '@/app/api/assessment-scanner/[id]/route';
import type { GradedQuestion, AssessmentScannerOutput } from '@/ai/schemas/assessment-scanner-schemas';

function makeRequest(body: unknown, userId: string | null = 'test-uid'): Request {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        json: async () => body,
        headers: { get: (k: string) => headers.get(k) ?? null },
    } as unknown as Request;
}

function makeContext(id: string) {
    return { params: Promise.resolve({ id }) };
}

function lastWireBody<T = Record<string, unknown>>(): T {
    if (jsonSpy.mock.calls.length === 0) {
        throw new Error('Expected NextResponse.json to have been called at least once');
    }
    return jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][0] as T;
}

const ASSESSMENT_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeQuestion(overrides: Partial<GradedQuestion> = {}): GradedQuestion {
    return {
        questionId: 'p0-q1',
        pageIndex: 0,
        questionText: 'What is 2 + 2?',
        studentAnswer: '4',
        expectedAnswer: '4',
        marksAwarded: 2,
        marksMax: 2,
        partialCreditBreakdown: [],
        feedback: 'Correct.',
        studentFacingFeedback: 'Great job!',
        conceptTested: 'Addition',
        ncertChapterId: null,
        mistakePattern: null,
        needsTeacherReview: false,
        confidence: 0.95,
        ...overrides,
    };
}

function makeStoredAssessment(questions: GradedQuestion[]): { type: string; data: AssessmentScannerOutput; title: string; gradeLevel: string; subject: string; topic: string; language: string; isPublic: boolean; isDraft: boolean } {
    const totalMax = questions.reduce((s, q) => s + q.marksMax, 0);
    const totalAwarded = questions.reduce((s, q) => s + q.marksAwarded, 0);
    return {
        type: 'assessment-submission',
        title: 'Assessment: Mathematics Class 10 (100%)',
        gradeLevel: 'Class 10',
        subject: 'Mathematics',
        topic: 'Mathematics',
        language: 'English',
        isPublic: false,
        isDraft: false,
        data: {
            assessmentId: ASSESSMENT_ID,
            status: 'graded',
            pageCount: 1,
            totalAwardedMarks: totalAwarded,
            totalMaxMarks: totalMax,
            scorePct: totalMax > 0 ? (totalAwarded / totalMax) * 100 : 0,
            letterGrade: 'A+',
            questions,
            classAverageAtScan: null,
            conceptMastery: [],
            recommendedNextSteps: [],
            studentRecommendations: [],
            needsReviewCount: questions.filter((q) => q.needsTeacherReview).length,
            imageQualityWarnings: [],
        },
    };
}

describe('PATCH /api/assessment-scanner/[id]', () => {
    beforeEach(() => {
        mockGetContent.mockReset();
        mockSaveContent.mockReset();
        jsonSpy.mockReset();
    });

    it('returns 401 without x-user-id', async () => {
        const res = await PATCH(
            makeRequest({ questions: [makeQuestion()] }, null) as any,
            makeContext(ASSESSMENT_ID),
        );
        expect(res.status).toBe(401);
        expect(mockGetContent).not.toHaveBeenCalled();
    });

    it('returns 400 when the body is not valid JSON', async () => {
        const badReq = {
            json: async () => {
                throw new Error('not json');
            },
            headers: { get: () => 'test-uid' },
        } as unknown as Request;
        const res = await PATCH(badReq as any, makeContext(ASSESSMENT_ID));
        expect(res.status).toBe(400);
    });

    it('returns 400 when the body fails schema validation', async () => {
        const res = await PATCH(
            makeRequest({ questions: [] }) as any,
            makeContext(ASSESSMENT_ID),
        );
        expect(res.status).toBe(400);
        const body = lastWireBody<{ error: string }>();
        expect(body.error).toBe('Schema Validation Failed');
    });

    it('returns 404 when the assessment does not exist', async () => {
        mockGetContent.mockResolvedValue(null);
        const res = await PATCH(
            makeRequest({ questions: [makeQuestion()] }) as any,
            makeContext(ASSESSMENT_ID),
        );
        expect(res.status).toBe(404);
        expect(mockSaveContent).not.toHaveBeenCalled();
    });

    it('returns 400 when the content type is wrong (caller hit the wrong endpoint)', async () => {
        mockGetContent.mockResolvedValue({
            type: 'lesson-plan',
            data: {},
        });
        const res = await PATCH(
            makeRequest({ questions: [makeQuestion()] }) as any,
            makeContext(ASSESSMENT_ID),
        );
        expect(res.status).toBe(400);
        const body = lastWireBody<{ error: string }>();
        expect(body.error).toContain('Content type');
        expect(mockSaveContent).not.toHaveBeenCalled();
    });

    it('returns 422 when the stored payload is malformed', async () => {
        mockGetContent.mockResolvedValue({
            type: 'assessment-submission',
            data: null,
        });
        const res = await PATCH(
            makeRequest({ questions: [makeQuestion()] }) as any,
            makeContext(ASSESSMENT_ID),
        );
        expect(res.status).toBe(422);
    });

    it('persists teacher overrides without mutating AI fields', async () => {
        const original = makeQuestion({
            marksAwarded: 0,
            feedback: 'AI was wrong here.',
            studentFacingFeedback: 'AI message',
        });
        mockGetContent.mockResolvedValue(makeStoredAssessment([original]));

        // Client sends the question with a teacherOverrides block.
        const edited: GradedQuestion = {
            ...original,
            teacherOverrides: {
                marksAwarded: 2,
                feedback: 'Actually fully correct.',
                studentFacingFeedback: 'Well done!',
            },
        };

        const res = await PATCH(
            makeRequest({ questions: [edited] }) as any,
            makeContext(ASSESSMENT_ID),
        );
        expect(res.status).toBe(200);

        // saveContent was called once
        expect(mockSaveContent).toHaveBeenCalledTimes(1);
        const [, savedDoc] = mockSaveContent.mock.calls[0];

        // AI fields preserved
        const savedQ = savedDoc.data.questions[0];
        expect(savedQ.marksAwarded).toBe(0);
        expect(savedQ.feedback).toBe('AI was wrong here.');
        expect(savedQ.studentFacingFeedback).toBe('AI message');

        // Overrides recorded
        expect(savedQ.teacherOverrides.marksAwarded).toBe(2);
        expect(savedQ.teacherOverrides.feedback).toBe('Actually fully correct.');
        expect(savedQ.teacherOverrides.studentFacingFeedback).toBe('Well done!');
        expect(typeof savedQ.teacherOverrides.editedAt).toBe('string');

        // Top-level audit timestamp
        expect(typeof savedDoc.data.teacherEditedAt).toBe('string');
    });

    it('recomputes totals server-side from the effective (overridden) values', async () => {
        const q1 = makeQuestion({
            questionId: 'p0-q1',
            marksAwarded: 0,
            marksMax: 2,
        });
        const q2 = makeQuestion({
            questionId: 'p0-q2',
            marksAwarded: 0,
            marksMax: 3,
        });
        mockGetContent.mockResolvedValue(makeStoredAssessment([q1, q2]));

        const editedQ1 = {
            ...q1,
            teacherOverrides: { marksAwarded: 2 },
        };

        // Client also tries to lie about the score — server should ignore.
        const res = await PATCH(
            makeRequest({
                questions: [editedQ1, q2],
            }) as any,
            makeContext(ASSESSMENT_ID),
        );
        expect(res.status).toBe(200);

        const [, savedDoc] = mockSaveContent.mock.calls[0];
        const data = savedDoc.data;
        expect(data.totalAwardedMarks).toBe(2); // 2 (override) + 0
        expect(data.totalMaxMarks).toBe(5);
        expect(data.scorePct).toBeCloseTo(40);
        expect(data.letterGrade).toBe('D'); // 40% → D
    });

    it('drops the teacherOverrides block when the teacher reverts all edits', async () => {
        const original = makeQuestion({
            marksAwarded: 2,
            teacherOverrides: {
                marksAwarded: 1,
                editedAt: '2026-05-19T00:00:00.000Z',
            },
        });
        mockGetContent.mockResolvedValue(makeStoredAssessment([original]));

        // Client sends back a question with an empty teacherOverrides — the
        // teacher hit "Revert to AI values" in the UI.
        const reverted = {
            ...original,
            teacherOverrides: {},
        };

        const res = await PATCH(
            makeRequest({ questions: [reverted] }) as any,
            makeContext(ASSESSMENT_ID),
        );
        expect(res.status).toBe(200);

        const [, savedDoc] = mockSaveContent.mock.calls[0];
        expect(savedDoc.data.questions[0].teacherOverrides).toBeUndefined();
        // Totals reflect the AI value again
        expect(savedDoc.data.totalAwardedMarks).toBe(2);
    });

    it('returns the recomputed payload in the response so the UI can refresh without a re-fetch', async () => {
        const q = makeQuestion({ marksAwarded: 0, marksMax: 2 });
        mockGetContent.mockResolvedValue(makeStoredAssessment([q]));

        const edited = { ...q, teacherOverrides: { marksAwarded: 2 } };
        const res = await PATCH(
            makeRequest({ questions: [edited] }) as any,
            makeContext(ASSESSMENT_ID),
        );
        expect(res.status).toBe(200);
        const body = lastWireBody<{ ok: boolean; data: AssessmentScannerOutput }>();
        expect(body.ok).toBe(true);
        expect(body.data.totalAwardedMarks).toBe(2);
        expect(body.data.scorePct).toBe(100);
        expect(body.data.letterGrade).toBe('A+');
        expect(body.data.teacherEditedAt).toBeDefined();
    });
});
