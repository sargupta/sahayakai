/**
 * F3-004 regression — POST /api/jobs/ai-reactive-reply
 *
 * CRITICAL POLARITY FIX:
 * pre-fix: `if (secret) { check }` — missing env var = endpoint wide open
 * post-fix:
 *   - no secret configured → 503 (fail-closed)
 *   - secret configured but mismatched header → 401
 *   - secret matches → proceeds (we don't exercise the full pipeline here)
 */

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock('@/lib/ai-reactive-trigger', () => ({
    isAllowedChatPath: jest.fn(() => true),
}));
jest.mock('@/lib/ai-teacher-personas', () => ({
    pickRandomPersonas: jest.fn(() => []),
    buildPersonaSystemPrompt: jest.fn(() => 'sys'),
    buildMemoryContext: jest.fn(() => ''),
    loadPersonaMemory: jest.fn(),
    savePersonaMemory: jest.fn(),
}));
// firebase-admin is dynamically imported; supply a stub.
jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(async () => ({})),
}));

function makeRequest(body: any, secretHeader?: string | null) {
    const headers = new Map<string, string>();
    if (secretHeader !== undefined && secretHeader !== null) {
        headers.set('x-internal-secret', secretHeader);
    }
    return {
        json: async () => body,
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as any;
}

describe('POST /api/jobs/ai-reactive-reply (F3-004 polarity fix)', () => {
    let POST: (req: any) => Promise<Response>;
    const ORIGINAL_ENV = process.env;

    beforeAll(async () => {
        const mod = await import('@/app/api/jobs/ai-reactive-reply/route');
        POST = mod.POST as any;
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        jest.clearAllMocks();
    });

    it('returns 503 when AI_INTERNAL_SECRET is not configured (fail-closed)', async () => {
        delete process.env.AI_INTERNAL_SECRET;
        const res = await POST(makeRequest(
            { collectionPath: 'community_chat', messageText: 'hi', authorName: 'A' },
            'whatever',
        ));
        expect(res.status).toBe(503);
    });

    it('returns 503 when AI_INTERNAL_SECRET is the empty string (still unset semantics)', async () => {
        process.env.AI_INTERNAL_SECRET = '';
        const res = await POST(makeRequest(
            { collectionPath: 'community_chat', messageText: 'hi', authorName: 'A' },
            'anything',
        ));
        expect(res.status).toBe(503);
    });

    it('returns 401 when secret is set but header is missing', async () => {
        process.env.AI_INTERNAL_SECRET = 'real-secret';
        const res = await POST(makeRequest(
            { collectionPath: 'community_chat', messageText: 'hi', authorName: 'A' },
            null,
        ));
        expect(res.status).toBe(401);
    });

    it('returns 401 when secret is set and header mismatches', async () => {
        process.env.AI_INTERNAL_SECRET = 'real-secret';
        const res = await POST(makeRequest(
            { collectionPath: 'community_chat', messageText: 'hi', authorName: 'A' },
            'wrong-secret',
        ));
        expect(res.status).toBe(401);
    });

    it('passes auth when secret matches (status is not 401/403/503)', async () => {
        process.env.AI_INTERNAL_SECRET = 'real-secret';
        const res = await POST(makeRequest(
            { collectionPath: 'community_chat', messageText: 'hi', authorName: 'A' },
            'real-secret',
        ));
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(503);
    });
});
