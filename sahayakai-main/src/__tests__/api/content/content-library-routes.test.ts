/**
 * /api/content/{library,search,pdf-download,storage-test} — tranche 5
 * migration tests.
 *
 * Migrates the content.ts block of the Wave 1 auth-gate suite
 * (src/__tests__/actions/wave-1-auth.test.ts): every route must reject a
 * request with no x-user-id header BEFORE Firestore/Storage is touched —
 * the mocks below throw if reached, so a 401 (not a 500) proves the gate
 * fired first.
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
    getStorageInstance: async () => {
        throw new Error('should not reach Storage — auth must reject first');
    },
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: jest.fn(async () => { throw new Error('should not reach adapter'); }),
        listContent: jest.fn(async () => { throw new Error('should not reach adapter'); }),
        saveContent: jest.fn(async () => {}),
        serialize: (x: any) => x,
    },
}));

jest.mock('@/lib/auth-utils', () => ({
    validateAdmin: jest.fn(async () => {}),
}));

jest.mock('@/lib/teacher-activity-tracker', () => ({
    trackTeacherContent: jest.fn(),
}));

jest.mock('@/lib/aggregator', () => ({
    aggregateUserMetrics: jest.fn(async () => {}),
}));

function makeRequest(opts: { userId?: string | null; body?: any; url?: string } = {}) {
    const headers = new Map<string, string>();
    if (opts.userId) headers.set('x-user-id', opts.userId);
    return {
        url: opts.url ?? 'http://localhost/api/content/test',
        json: async () => opts.body ?? {},
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as import('next/server').NextRequest;
}

describe('content routes — Wave 1 auth gate (migrated)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('GET /api/content/library (was getUserContent) → 401', async () => {
        const { GET } = await import('@/app/api/content/library/route');
        expect((await GET(makeRequest({ userId: null }))).status).toBe(401);
    });

    it('GET /api/content/search (was searchContentAction) → 401', async () => {
        const { GET } = await import('@/app/api/content/search/route');
        const res = await GET(makeRequest({ userId: null, url: 'http://localhost/api/content/search?q=q' }));
        expect(res.status).toBe(401);
    });

    it('POST /api/content/library (was saveToLibrary) → 401', async () => {
        const { POST } = await import('@/app/api/content/library/route');
        const res = await POST(makeRequest({
            userId: null,
            body: { type: 'lesson-plan', title: 'title', data: {} },
        }));
        expect(res.status).toBe(401);
    });

    it('POST /api/content/pdf-download (was recordPdfDownload) → 401', async () => {
        const { POST } = await import('@/app/api/content/pdf-download/route');
        const res = await POST(makeRequest({
            userId: null,
            body: { title: 'title', base64Data: 'data:application/pdf;base64,YWJj' },
        }));
        expect(res.status).toBe(401);
    });

    it('POST /api/content/storage-test (was testStorageConnection) → 401', async () => {
        const { POST } = await import('@/app/api/content/storage-test/route');
        expect((await POST(makeRequest({ userId: null }))).status).toBe(401);
    });
});

describe('content routes — contract', () => {
    beforeEach(() => jest.clearAllMocks());

    it('POST /api/content/library rejects a malformed body with 400', async () => {
        const { POST } = await import('@/app/api/content/library/route');
        const res = await POST(makeRequest({ userId: 'u1', body: { title: 'no type' } }));
        expect(res.status).toBe(400);
    });

    it('POST /api/content/library preserves the scrubbed result-object contract on failure', async () => {
        // getStorageInstance throws (mock above) → the service returns the
        // Wave 2b scrubbed { success: false, error } — never raw internals.
        const { POST } = await import('@/app/api/content/library/route');
        const res = await POST(makeRequest({
            userId: 'u1',
            body: { type: 'lesson-plan', title: 'title', data: {} },
        }));
        expect(res.status).toBe(200);
        const body = lastJsonBody();
        expect(body.success).toBe(false);
        expect(body.error).toBe('Failed to save. Please try again.');
    });

    it('POST /api/content/storage-test enforces the admin gate with 403', async () => {
        const { validateAdmin } = await import('@/lib/auth-utils');
        (validateAdmin as jest.Mock).mockRejectedValueOnce(new Error('Forbidden: admin only'));
        const { POST } = await import('@/app/api/content/storage-test/route');
        const res = await POST(makeRequest({ userId: 'not-admin' }));
        expect(res.status).toBe(403);
    });
});
