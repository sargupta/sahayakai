/**
 * F3-001 regression — POST /api/feedback
 *
 * Verifies the route now validates the body with Zod and forwards only
 * allow-listed fields to the dbAdapter. The pre-fix route spread `...body`
 * straight into Firestore, letting a caller smuggle arbitrary fields.
 */

const mockSaveFeedback = jest.fn();

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { saveFeedback: (...args: any[]) => mockSaveFeedback(...args) },
}));
jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

function makeRequest(body: any, userId: string | null = 'test-uid', { invalidJson = false } = {}) {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        json: async () => {
            if (invalidJson) throw new SyntaxError('bad json');
            return body;
        },
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as any;
}

describe('POST /api/feedback (F3-001)', () => {
    let POST: (req: any) => Promise<Response>;

    beforeAll(async () => {
        const mod = await import('@/app/api/feedback/route');
        POST = mod.POST as any;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockSaveFeedback.mockResolvedValue(undefined);
    });

    it('returns 401 without x-user-id', async () => {
        const res = await POST(makeRequest({ rating: 5 }, null));
        expect(res.status).toBe(401);
        expect(mockSaveFeedback).not.toHaveBeenCalled();
    });

    it('returns 400 on malformed JSON', async () => {
        const res = await POST(makeRequest(null, 'test-uid', { invalidJson: true }));
        expect(res.status).toBe(400);
        expect(mockSaveFeedback).not.toHaveBeenCalled();
    });

    it('returns 400 when rating is out of range (>5)', async () => {
        const res = await POST(makeRequest({ rating: 99 }));
        expect(res.status).toBe(400);
        expect(mockSaveFeedback).not.toHaveBeenCalled();
    });

    it('returns 400 when comment exceeds max length', async () => {
        const res = await POST(makeRequest({ comment: 'x'.repeat(2001) }));
        expect(res.status).toBe(400);
        expect(mockSaveFeedback).not.toHaveBeenCalled();
    });

    it('strips unknown fields (strict schema) instead of writing them', async () => {
        const res = await POST(makeRequest({
            rating: 4,
            // Unknown / hostile fields:
            isAdmin: true,
            uid: 'attacker',
            __proto__: { polluted: true },
        }));
        // Strict Zod rejects unknown keys with 400 — this is the safer outcome
        // than silently stripping, and matches the fix's intent.
        expect(res.status).toBe(400);
        expect(mockSaveFeedback).not.toHaveBeenCalled();
    });

    it('accepts a valid payload and persists only allow-listed fields', async () => {
        const res = await POST(makeRequest({
            feedbackType: 'quiz',
            rating: 5,
            comment: 'Worked great',
            difficulty: 'easy',
            questionIndex: 3,
        }));
        expect(res.status).toBe(200);
        expect(mockSaveFeedback).toHaveBeenCalledTimes(1);
        const [uid, payload] = mockSaveFeedback.mock.calls[0];
        expect(uid).toBe('test-uid');
        expect(payload).toMatchObject({
            feedbackType: 'quiz',
            rating: 5,
            comment: 'Worked great',
            difficulty: 'easy',
            questionIndex: 3,
        });
        expect(payload.timestamp).toEqual(expect.any(String));
        // No injected fields:
        expect(payload).not.toHaveProperty('isAdmin');
        expect(payload).not.toHaveProperty('uid');
    });
});
