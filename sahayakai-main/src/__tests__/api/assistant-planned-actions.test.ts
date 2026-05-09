/**
 * Wire-contract test for `POST /api/assistant`.
 *
 * Phase N.1 + P5: the route now returns `plannedActions: VidyaAction[]`
 * alongside the legacy `{response, action}` shape. OmniOrb renders one
 * chip per planned action when there are 2+, instead of auto-navigating
 * via `action`. This test pins the wire shape so a future dispatcher
 * refactor can't silently strip the field again.
 *
 * Why we spy on `NextResponse.json` instead of reading `res.json()`:
 * the project's jest setup polyfills `Response` minimally and does NOT
 * preserve bodies through `NextResponse.json(...)`. Existing API tests
 * (`ai-routes.test.ts`, etc.) only assert on `res.status` for the same
 * reason. A `NextResponse.json` spy gives us the actual payload the
 * route would send to the wire without depending on the body polyfill.
 */

const mockDispatchVidya = jest.fn();

jest.mock('@/lib/sidecar/vidya-dispatch', () => ({
    dispatchVidya: (...args: unknown[]) => mockDispatchVidya(...args),
}));

jest.mock('@/lib/plan-guard', () => ({
    withPlanCheck: () => (handler: (req: Request) => Promise<Response>) => handler,
}));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(),
}));

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { increment: jest.fn() },
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

import { POST } from '@/app/api/assistant/route';

function makeRequest(body: Record<string, unknown>, userId = 'test-uid'): Request {
    const headers = new Map<string, string>([['x-user-id', userId]]);
    return {
        json: async () => body,
        headers: { get: (k: string) => headers.get(k) ?? null },
    } as unknown as Request;
}

const baseRequestBody = {
    message: 'Make a quiz and a worksheet on photosynthesis',
    chatHistory: [{ role: 'user', parts: [{ text: 'Make a quiz and a worksheet on photosynthesis' }] }], // non-empty so cache is bypassed
    currentScreenContext: { path: '/dashboard', uiState: {} },
    teacherProfile: { preferredGrade: 'Class 5', preferredSubject: 'Science' },
    detectedLanguage: 'en',
};

describe('POST /api/assistant — plannedActions wire contract', () => {
    beforeEach(() => {
        mockDispatchVidya.mockReset();
        jsonSpy.mockReset();
    });

    it('exposes plannedActions[] on the wire when the dispatcher returns 2+ actions', async () => {
        mockDispatchVidya.mockResolvedValue({
            response: 'Sure — generating a quiz and a worksheet.',
            action: { type: 'NAVIGATE_AND_FILL', flow: 'quiz-generator', params: { topic: 'photosynthesis', gradeLevel: 'Class 5' } },
            plannedActions: [
                { type: 'NAVIGATE_AND_FILL', flow: 'quiz-generator', params: { topic: 'photosynthesis', gradeLevel: 'Class 5' } },
                { type: 'NAVIGATE_AND_FILL', flow: 'worksheet-wizard', params: { topic: 'photosynthesis', gradeLevel: 'Class 5' } },
            ],
            intent: 'compound',
        });

        const res = await POST(makeRequest(baseRequestBody));
        expect(res.status).toBe(200);

        // Last NextResponse.json call captures the wire payload sent to the client.
        const wireBody = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][0] as {
            plannedActions?: { flow: string }[];
            action?: { flow: string };
            response?: string;
        };
        expect(wireBody.plannedActions).toBeDefined();
        expect(wireBody.plannedActions).toHaveLength(2);
        expect(wireBody.plannedActions?.[0]?.flow).toBe('quiz-generator');
        expect(wireBody.plannedActions?.[1]?.flow).toBe('worksheet-wizard');
        // Backward-compat: `action` (singular) MUST stay set so older clients
        // that ignore plannedActions still auto-navigate.
        expect(wireBody.action?.flow).toBe('quiz-generator');
    });

    it('omits plannedActions for single-action / conversational turns', async () => {
        mockDispatchVidya.mockResolvedValue({
            response: 'Generating a lesson plan on photosynthesis.',
            action: { type: 'NAVIGATE_AND_FILL', flow: 'lesson-plan', params: { topic: 'photosynthesis' } },
            // dispatcher does not author a plannedActions list for single-action turns
            intent: 'lesson_plan',
        });

        const res = await POST(makeRequest(baseRequestBody));
        expect(res.status).toBe(200);

        const wireBody = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][0] as {
            action?: { flow: string };
            plannedActions?: unknown;
        };
        expect(wireBody.action?.flow).toBe('lesson-plan');
        expect(wireBody.plannedActions).toBeUndefined();
    });

    it('passes plannedActions through unchanged when supervisor emits only 1 action', async () => {
        // Edge case: Phase N.1 supervisor may return plannedActions with
        // exactly one item for conceptual consistency. The wire MUST surface
        // it as-is — OmniOrb's chip-render decision uses `length > 1`, not
        // the field's presence.
        mockDispatchVidya.mockResolvedValue({
            response: 'Generating a quiz.',
            action: { type: 'NAVIGATE_AND_FILL', flow: 'quiz-generator', params: { topic: 'photosynthesis' } },
            plannedActions: [{ type: 'NAVIGATE_AND_FILL', flow: 'quiz-generator', params: { topic: 'photosynthesis' } }],
            intent: 'quiz',
        });

        await POST(makeRequest(baseRequestBody));

        const wireBody = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][0] as {
            plannedActions?: { flow: string }[];
        };
        expect(wireBody.plannedActions).toHaveLength(1);
    });
});
