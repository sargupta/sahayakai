/**
 * API route handler tests for AI endpoints.
 * Tests the HTTP contract: auth, validation, error handling.
 * AI flow functions are mocked — we only test the route handler logic.
 */

// ── Mock dispatcher entry-points ───────────────────────────────────────────
//
// Phases D–U replaced direct AI-flow imports inside `/api/ai/<flow>/route.ts`
// with `dispatch<Flow>()` from `@/lib/sidecar/<flow>-dispatch`. The route
// handlers now never call the Genkit flow function directly — they go through
// the dispatcher, which decides Genkit vs Sidecar based on the feature flag.
// Tests must mock the dispatcher, not the underlying flow.

const mockDispatchRubric = jest.fn();
const mockDispatchTeacherTraining = jest.fn();
const mockDispatchInstantAnswer = jest.fn();
const mockDispatchWorksheet = jest.fn();
const mockDispatchFieldTrip = jest.fn();
const mockDispatchVideoStory = jest.fn();
const mockDispatchParentMessage = jest.fn();

jest.mock('@/lib/sidecar/rubric-dispatch', () => ({ dispatchRubric: (...args: any[]) => mockDispatchRubric(...args) }));
jest.mock('@/lib/sidecar/teacher-training-dispatch', () => ({ dispatchTeacherTraining: (...args: any[]) => mockDispatchTeacherTraining(...args) }));
jest.mock('@/lib/sidecar/instant-answer-dispatch', () => ({ dispatchInstantAnswer: (...args: any[]) => mockDispatchInstantAnswer(...args) }));
jest.mock('@/lib/sidecar/worksheet-dispatch', () => ({ dispatchWorksheet: (...args: any[]) => mockDispatchWorksheet(...args) }));
jest.mock('@/lib/sidecar/virtual-field-trip-dispatch', () => ({ dispatchVirtualFieldTrip: (...args: any[]) => mockDispatchFieldTrip(...args) }));
jest.mock('@/lib/sidecar/video-storyteller-dispatch', () => ({ dispatchVideoStoryteller: (...args: any[]) => mockDispatchVideoStory(...args) }));
jest.mock('@/lib/sidecar/parent-message-dispatch', () => ({ dispatchParentMessage: (...args: any[]) => mockDispatchParentMessage(...args) }));
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
            mockDispatchRubric.mockResolvedValue({
                title: 'Test Rubric',
                description: 'desc',
                criteria: [],
                gradeLevel: 'Class 5',
                subject: 'Science',
            });
            const res = await POST(makeRequest({ assignmentDescription: 'A grade 5 project' }));
            expect(res.status).toBe(200);
        });

        it('returns 500 on AI flow error', async () => {
            mockDispatchRubric.mockRejectedValue(new Error('AI failed'));
            const res = await POST(makeRequest({ assignmentDescription: 'test' }));
            expect(res.status).toBe(500);
        });

        it('passes userId to AI flow', async () => {
            mockDispatchRubric.mockResolvedValue({
                title: '',
                description: '',
                criteria: [],
            });
            await POST(makeRequest({ assignmentDescription: 'test' }, 'uid-123'));
            expect(mockDispatchRubric).toHaveBeenCalledWith(expect.objectContaining({ userId: 'uid-123' }));
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
            mockDispatchTeacherTraining.mockResolvedValue({
                introduction: 'intro',
                advice: [{ title: 'a', description: 'd' }],
                conclusion: 'concl',
            });
            const res = await POST(makeRequest({ question: 'How to manage 40 students?' }));
            expect(res.status).toBe(200);
        });

        it('returns 500 on error', async () => {
            mockDispatchTeacherTraining.mockRejectedValue(new Error('fail'));
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
            mockDispatchInstantAnswer.mockResolvedValue({
                answer: 'Photosynthesis is...',
                videoSuggestionUrl: 'https://example.com',
                gradeLevel: 'Class 5',
                subject: 'Science',
            });
            const res = await POST(makeRequest({ question: 'What is photosynthesis?' }));
            expect(res.status).toBe(200);
        });

        it('returns 500 on AI flow error', async () => {
            mockDispatchInstantAnswer.mockRejectedValue(new Error('quota exceeded'));
            const res = await POST(makeRequest({ question: 'test' }));
            expect(res.status).toBe(500);
        });
    });
});
