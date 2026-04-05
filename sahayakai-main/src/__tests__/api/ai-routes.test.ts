/**
 * API route handler tests for AI endpoints.
 * Tests the HTTP contract: auth, validation, error handling.
 * AI flow functions are mocked — we only test the route handler logic.
 */

// ── Mock AI flows ──────────────────────────────────────────────────────────

const mockGenerateRubric = jest.fn();
const mockTeacherTraining = jest.fn();
const mockInstantAnswer = jest.fn();
const mockGenerateWorksheet = jest.fn();
const mockGenerateFieldTrip = jest.fn();
const mockGenerateVideoStory = jest.fn();
const mockGenerateParentMessage = jest.fn();

jest.mock('@/ai/flows/rubric-generator', () => ({ generateRubric: (...args: any[]) => mockGenerateRubric(...args) }));
jest.mock('@/ai/flows/teacher-training', () => ({ getTeacherTrainingAdvice: (...args: any[]) => mockTeacherTraining(...args) }));
jest.mock('@/ai/flows/instant-answer', () => ({ instantAnswer: (...args: any[]) => mockInstantAnswer(...args) }));
jest.mock('@/ai/flows/worksheet-wizard', () => ({ generateWorksheet: (...args: any[]) => mockGenerateWorksheet(...args) }));
jest.mock('@/ai/flows/virtual-field-trip', () => ({ planVirtualFieldTrip: (...args: any[]) => mockGenerateFieldTrip(...args) }));
jest.mock('@/ai/flows/video-storyteller', () => ({ getVideoRecommendations: (...args: any[]) => mockGenerateVideoStory(...args) }));
jest.mock('@/ai/flows/parent-message-generator', () => ({ generateParentMessage: (...args: any[]) => mockGenerateParentMessage(...args) }));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));
jest.mock('@/lib/utils', () => ({ logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() }, cn: jest.fn() }));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: any, userId: string | null = 'test-uid') {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        json: async () => body,
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as Request;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AI Route Handlers', () => {
    beforeEach(() => jest.clearAllMocks());

    // ── Rubric ─────────────────────────────────────────────────────────────

    describe('POST /api/ai/rubric', () => {
        let POST: (req: Request) => Promise<Response>;

        beforeAll(async () => {
            const mod = await import('@/app/api/ai/rubric/route');
            POST = mod.POST;
        });

        it('returns 401 without x-user-id', async () => {
            const res = await POST(makeRequest({}, null));
            expect(res.status).toBe(401);
        });

        it('returns 200 on success', async () => {
            mockGenerateRubric.mockResolvedValue({ rubric: 'test rubric' });
            const res = await POST(makeRequest({ assignmentDescription: 'A grade 5 project' }));
            expect(res.status).toBe(200);
        });

        it('returns 500 on AI flow error', async () => {
            mockGenerateRubric.mockRejectedValue(new Error('AI failed'));
            const res = await POST(makeRequest({ assignmentDescription: 'test' }));
            expect(res.status).toBe(500);
        });

        it('passes userId to AI flow', async () => {
            mockGenerateRubric.mockResolvedValue({});
            await POST(makeRequest({ assignmentDescription: 'test' }, 'uid-123'));
            expect(mockGenerateRubric).toHaveBeenCalledWith(expect.objectContaining({ userId: 'uid-123' }));
        });
    });

    // ── Teacher Training ───────────────────────────────────────────────────

    describe('POST /api/ai/teacher-training', () => {
        let POST: (req: Request) => Promise<Response>;

        beforeAll(async () => {
            const mod = await import('@/app/api/ai/teacher-training/route');
            POST = mod.POST;
        });

        it('returns 401 without x-user-id', async () => {
            const res = await POST(makeRequest({}, null));
            expect(res.status).toBe(401);
        });

        it('returns 200 on success', async () => {
            mockTeacherTraining.mockResolvedValue({ advice: 'use groups' });
            const res = await POST(makeRequest({ question: 'How to manage 40 students?' }));
            expect(res.status).toBe(200);
        });

        it('returns 500 on error', async () => {
            mockTeacherTraining.mockRejectedValue(new Error('fail'));
            const res = await POST(makeRequest({ question: 'test' }));
            expect(res.status).toBe(500);
        });
    });

    // ── Instant Answer ─────────────────────────────────────────────────────

    describe('POST /api/ai/instant-answer', () => {
        let POST: (req: Request) => Promise<Response>;

        beforeAll(async () => {
            const mod = await import('@/app/api/ai/instant-answer/route');
            POST = mod.POST;
        });

        it('returns 401 without x-user-id', async () => {
            const res = await POST(makeRequest({}, null));
            expect(res.status).toBe(401);
        });

        it('returns answer on success', async () => {
            mockInstantAnswer.mockResolvedValue({ answer: 'Photosynthesis is...' });
            const res = await POST(makeRequest({ question: 'What is photosynthesis?' }));
            expect(res.status).toBe(200);
        });

        it('returns 500 on AI flow error', async () => {
            mockInstantAnswer.mockRejectedValue(new Error('quota exceeded'));
            const res = await POST(makeRequest({ question: 'test' }));
            expect(res.status).toBe(500);
        });
    });
});
