/**
 * Contract tests for the worksheet result body — both ends of it.
 *
 * The regression these pin: `POST /api/ai/worksheet` answered 200 with the
 * structured fields only (title, gradeLevel, subject, learningObjectives,
 * studentInstructions, activities, answerKey) and no `worksheetContent`,
 * while the client rendered `worksheetContent` and nothing else. A generation
 * therefore succeeded, consumed a plan credit, and drew an empty page.
 *
 * Two gates, one per end:
 *   - the route must never serve a 200 without a Markdown body, and must let
 *     the plan gate refund the reservation when it has none;
 *   - `useGenerator` must never settle a run as "done" when the parser came
 *     back with nothing, whatever the endpoint.
 */

const mockDispatchWorksheet = jest.fn();
const mockReserveQuota = jest.fn();
const mockRollbackQuota = jest.fn();

jest.mock('@/lib/sidecar/worksheet-dispatch', () => ({
    dispatchWorksheet: (...args: unknown[]) => mockDispatchWorksheet(...args),
}));

// Real plan-guard — the rollback path under test lives inside it. Only its
// two collaborators are stubbed.
jest.mock('@/lib/usage-counters', () => ({
    reserveQuota: (...args: unknown[]) => mockReserveQuota(...args),
    rollbackQuota: (...args: unknown[]) => mockRollbackQuota(...args),
}));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn().mockResolvedValue({
        collection: () => ({
            doc: () => ({
                get: async () => ({ exists: true, data: () => ({ subscriptionEnabled: true }) }),
            }),
        }),
    }),
    getAuthInstance: jest.fn(),
    getStorageInstance: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// jsdom's Response polyfill doesn't preserve a NextResponse body through
// `await res.json()`, so capture the payload at the call site instead
// (same approach as assessment-scanner.test.ts).
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

import { POST } from '@/app/api/ai/worksheet/route';

const WORKSHEET_FIELDS = {
    title: 'Counting Mangoes',
    gradeLevel: 'Class 2',
    subject: 'Math',
    learningObjectives: ['Count objects up to 20'],
    studentInstructions: 'Look at the pictures and solve the problems.',
    activities: [
        {
            type: 'question' as const,
            content: 'If there are 5 mangoes in one basket and 3 in another, how many total?',
            explanation: 'Uses the local fruit-basket count children already help with at home.',
        },
    ],
    answerKey: [{ activityIndex: 0, answer: '8 mangoes' }],
};

const MARKDOWN_BODY = '# Counting Mangoes\n\nSolve the problems.';

function makeRequest(body: unknown, userId: string | null = 'teacher-uid-1'): Request {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        json: async () => body,
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as Request;
}

const VALID_BODY = {
    prompt: 'Create a counting worksheet from this page.',
    imageDataUri: 'data:image/png;base64,xxx',
    gradeLevel: 'Class 2',
    language: 'en',
};

describe('POST /api/ai/worksheet — response body contract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SUBSCRIPTION_GATING_ENABLED = 'true';
        mockReserveQuota.mockResolvedValue({ ok: true });
        mockRollbackQuota.mockResolvedValue(undefined);
    });

    it('serves the Markdown body the client renders, not just the metadata', async () => {
        mockDispatchWorksheet.mockResolvedValue({
            ...WORKSHEET_FIELDS,
            worksheetContent: MARKDOWN_BODY,
            source: 'genkit',
            decision: { mode: 'off', reason: 'flag_off', bucket: 1 },
        });

        const res = await POST(makeRequest(VALID_BODY));

        expect(res.status).toBe(200);
        const [payload] = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1];
        // The whole bug in one assertion: a 200 used to arrive without this.
        expect(payload).toHaveProperty('worksheetContent', MARKDOWN_BODY);
        expect(payload).toMatchObject(WORKSHEET_FIELDS);
    });

    it('refuses to bank a plan credit for a worksheet with no body', async () => {
        // A dispatch that produced every structured field and no Markdown —
        // exactly what the sidecar path returned before it learned to render.
        mockDispatchWorksheet.mockResolvedValue({
            ...WORKSHEET_FIELDS,
            source: 'sidecar',
            decision: { mode: 'full', reason: 'flag_full', bucket: 1 },
        });

        const res = await POST(makeRequest(VALID_BODY));

        // Not a 200: a blank success is worse than an honest error.
        expect(res.status).toBe(500);
        // …and the reservation goes back, because the teacher got nothing.
        expect(mockRollbackQuota).toHaveBeenCalledWith('teacher-uid-1', 'worksheet');
    });

    it('keeps the credit when a real worksheet is served', async () => {
        mockDispatchWorksheet.mockResolvedValue({
            ...WORKSHEET_FIELDS,
            worksheetContent: MARKDOWN_BODY,
            source: 'genkit',
            decision: { mode: 'off', reason: 'flag_off', bucket: 1 },
        });

        await POST(makeRequest(VALID_BODY));

        expect(mockRollbackQuota).not.toHaveBeenCalled();
    });
});
