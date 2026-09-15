/**
 * Wire-contract tests for `PUT /api/ai/exam-paper` (the Save handler).
 *
 * Covers the Cluster 5 fixes:
 *   - H2: Save is NOT wrapped in the plan-check gate (saving an already-
 *     generated, already-charged paper must not decrement the usage counter).
 *   - H3: the client-echoed `contentId` is used as the persisted doc id so
 *     saveContent upserts the existing row instead of writing a duplicate;
 *     falls back to a fresh uuid for legacy clients.
 *   - L10: the `paper` field is validated (reject array / missing title /
 *     missing sections → 400) and the body-size guard returns 413.
 *
 * Follows the spy-on-NextResponse.json pattern used by the assessment-scanner
 * route tests — the jsdom env doesn't preserve NextResponse bodies.
 */

const mockSaveContent = jest.fn();
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { saveContent: (...args: unknown[]) => mockSaveContent(...args) },
}));

jest.mock('firebase-admin/firestore', () => ({
    Timestamp: { fromDate: (d: Date) => ({ __ts: d.getTime() }) },
}));

jest.mock('uuid', () => ({ v4: () => 'generated-uuid' }));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// H2 harness: if the Save handler were (wrongly) wrapped by withPlanCheck, this
// spy would fire. PUT must be the bare handler, so it stays at zero calls.
const mockGateWrapperInvoked = jest.fn();
jest.mock('@/lib/plan-guard', () => ({
    withPlanCheck:
        () =>
        <T,>(handler: (req: T) => Promise<unknown>) =>
        async (req: T) => {
            mockGateWrapperInvoked();
            return handler(req);
        },
    reservePlanQuota: jest.fn(),
}));

// Keep the dispatcher chain out of the import graph.
jest.mock('@/lib/sidecar/exam-paper-dispatch', () => ({
    dispatchExamPaper: jest.fn(),
    ExamPaperGenerationInProgressError: class extends Error {},
}));

jest.mock('@/lib/ai-error-response', () => ({
    handleAIError: (_e: unknown) => ({ status: 500, ok: false }),
    logAIError: jest.fn(),
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
                headers: new Map(),
            };
        },
    },
}));

// Imports AFTER mocks.
import { PUT } from '@/app/api/ai/exam-paper/route';

const VALID_PAPER = {
    title: 'CBSE Class 10 Mathematics',
    sections: [{ name: 'A', questions: [] }],
};

function makeRequest(
    body: unknown,
    opts: { userId?: string | null; contentLength?: string } = {},
): Request {
    const { userId = 'teacher-uid', contentLength } = opts;
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    if (contentLength) headers.set('content-length', contentLength);
    return {
        json: async () => body,
        headers: { get: (k: string) => headers.get(k) ?? null },
    } as unknown as Request;
}

beforeEach(() => jest.clearAllMocks());

describe('PUT /api/ai/exam-paper — Save handler', () => {
    it('H2: does NOT run the plan-check gate (no quota decrement on save)', async () => {
        const res = await PUT(makeRequest({ paper: VALID_PAPER }) as any);
        expect(res.status).toBe(200);
        expect(mockGateWrapperInvoked).not.toHaveBeenCalled();
        expect(mockSaveContent).toHaveBeenCalledTimes(1);
    });

    it('H3: upserts by the client-echoed contentId', async () => {
        await PUT(makeRequest({ paper: VALID_PAPER, contentId: 'client-cid' }) as any);
        expect(mockSaveContent).toHaveBeenCalledTimes(1);
        const [, doc] = mockSaveContent.mock.calls[0];
        expect(doc.id).toBe('client-cid');
    });

    it('H3: falls back to a fresh uuid when the client omits contentId', async () => {
        await PUT(makeRequest({ paper: VALID_PAPER }) as any);
        const [, doc] = mockSaveContent.mock.calls[0];
        expect(doc.id).toBe('generated-uuid');
    });

    it('401 when x-user-id is missing', async () => {
        const res = await PUT(makeRequest({ paper: VALID_PAPER }, { userId: null }) as any);
        expect(res.status).toBe(401);
        expect(mockSaveContent).not.toHaveBeenCalled();
    });

    it('L10: rejects paper:[] (array) with 400', async () => {
        const res = await PUT(makeRequest({ paper: [] }) as any);
        expect(res.status).toBe(400);
        expect(mockSaveContent).not.toHaveBeenCalled();
    });

    it('L10: rejects a paper missing sections with 400', async () => {
        const res = await PUT(makeRequest({ paper: { title: 'x' } }) as any);
        expect(res.status).toBe(400);
    });

    it('L10: rejects a paper missing title with 400', async () => {
        const res = await PUT(makeRequest({ paper: { sections: [] } }) as any);
        expect(res.status).toBe(400);
    });

    it('L10: rejects an oversized body with 413', async () => {
        const res = await PUT(
            makeRequest({ paper: VALID_PAPER }, { contentLength: '2000000' }) as any,
        );
        expect(res.status).toBe(413);
        expect(mockSaveContent).not.toHaveBeenCalled();
    });

    it('falls through to handleAIError when saveContent throws', async () => {
        mockSaveContent.mockRejectedValue(new Error('db down'));

        const res = await PUT(makeRequest({ paper: VALID_PAPER }) as any);

        expect(res.status).toBe(500);
    });
});
