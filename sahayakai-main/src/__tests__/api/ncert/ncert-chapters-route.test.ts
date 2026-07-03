/**
 * /api/ncert/chapters — tranche 5 migration tests.
 *
 * Migrates the ncert.ts block of the Wave 1 auth-gate suite:
 * - Route: 401 without x-user-id BEFORE Firestore is touched (anonymous
 *   scraping / DOS gate).
 * - Client wrapper: preserves the action's graceful semantics — [] on any
 *   error so the chapter selector falls back to the static dataset.
 *
 * Body assertions use the repo convention of spying on NextResponse.json —
 * jsdom's Response.json() can't re-read the body.
 */

import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');
function lastJsonBody(): any {
    const calls = jsonSpy.mock.calls;
    return calls[calls.length - 1][0];
}

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => {
        throw new Error('should not reach Firestore — auth must reject first');
    },
}));

jest.mock('@/lib/firebase', () => ({
    auth: { currentUser: null },
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

function makeRequest(opts: { userId?: string | null; url?: string } = {}) {
    const headers = new Map<string, string>();
    if (opts.userId) headers.set('x-user-id', opts.userId);
    return {
        url: opts.url ?? 'http://localhost/api/ncert/chapters?grade=8',
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as import('next/server').NextRequest;
}

describe('/api/ncert/chapters — Wave 1 auth gate (migrated)', () => {
    it('GET → 401 without x-user-id', async () => {
        const { GET } = await import('@/app/api/ncert/chapters/route');
        expect((await GET(makeRequest({ userId: null }))).status).toBe(401);
    });

    it('GET → 400 on invalid grade', async () => {
        const { GET } = await import('@/app/api/ncert/chapters/route');
        const res = await GET(makeRequest({ userId: 'u1', url: 'http://localhost/api/ncert/chapters?grade=99' }));
        expect(res.status).toBe(400);
    });

    it('GET → 200 [] when the DB fails (service fails soft)', async () => {
        const { GET } = await import('@/app/api/ncert/chapters/route');
        const res = await GET(makeRequest({ userId: 'u1' }));
        expect(res.status).toBe(200);
        expect(lastJsonBody()).toEqual([]);
    });
});

describe('ncert client wrapper — graceful semantics (migrated)', () => {
    afterEach(() => {
        // @ts-expect-error cleanup
        delete global.fetch;
    });

    it('getNCERTChapters returns [] when unauthenticated (graceful)', async () => {
        global.fetch = jest.fn(async () => ({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
        })) as jest.Mock;

        const { getNCERTChapters } = await import('@/lib/api/ncert');
        const result = await getNCERTChapters(8);
        expect(result).toEqual([]);
    });
});
