/**
 * @jest-environment node
 *
 * F12-P1-02: ai-reactive-reply must fail-closed when AI_INTERNAL_SECRET unset.
 */
import { NextResponse } from 'next/server';

jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/ai-reactive-trigger', () => ({
    isAllowedChatPath: () => true,
}));
jest.mock('@/lib/ai-teacher-personas', () => ({
    pickRandomPersonas: () => [],
    buildPersonaSystemPrompt: () => '',
    buildMemoryContext: () => '',
    loadPersonaMemory: async () => ({}),
    savePersonaMemory: async () => undefined,
}));

const jsonSpy = jest.spyOn(NextResponse, 'json');

function makeReq(body: any, headers: Record<string, string> = {}) {
    const low: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) low[k.toLowerCase()] = v;
    return {
        url: 'https://example.test/api/jobs/ai-reactive-reply',
        method: 'POST',
        headers: { get: (k: string) => low[k.toLowerCase()] ?? null },
        json: async () => body,
    } as any;
}
function lastJson(): { status: number } {
    const calls = jsonSpy.mock.calls;
    if (calls.length === 0) throw new Error('NextResponse.json never called');
    const last = calls[calls.length - 1];
    return { status: (last[1] as any)?.status ?? 200 };
}

describe('POST /api/jobs/ai-reactive-reply auth', () => {
    const ORIGINAL = { ...process.env };
    let POST: (req: any) => Promise<Response>;

    beforeAll(async () => {
        const mod = await import('@/app/api/jobs/ai-reactive-reply/route');
        POST = mod.POST;
    });

    beforeEach(() => {
        jsonSpy.mockClear();
        process.env = { ...ORIGINAL };
    });
    afterAll(() => { process.env = ORIGINAL; });

    it('returns 503 when AI_INTERNAL_SECRET unset (fail-closed)', async () => {
        delete process.env.AI_INTERNAL_SECRET;
        await POST(makeReq({ collectionPath: 'community_chat', messageText: 'hi', authorName: 'X' }));
        expect(lastJson().status).toBe(503);
    });

    it('returns 401 when secret mismatched', async () => {
        process.env.AI_INTERNAL_SECRET = 'right';
        await POST(makeReq(
            { collectionPath: 'community_chat', messageText: 'hi', authorName: 'X' },
            { 'x-internal-secret': 'wrong' },
        ));
        expect(lastJson().status).toBe(401);
    });
});
