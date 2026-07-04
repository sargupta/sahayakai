/**
 * /api/lesson-plan/cache — tranche 5 migration tests.
 *
 * Migrates the lesson-plan.ts block of the Wave 1 auth-gate suite:
 * - Route: both verbs reject anonymous callers with 401 BEFORE Firestore is
 *   touched (anonymous cache scraping / shared-cache poisoning).
 * - Client wrapper: preserves the action's graceful semantics —
 *   getCachedLessonPlan returns null on auth failure, saveLessonPlanToCache
 *   swallows errors (caching is best-effort).
 */

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

function makeRequest(opts: { userId?: string | null; body?: any; url?: string } = {}) {
    const headers = new Map<string, string>();
    if (opts.userId) headers.set('x-user-id', opts.userId);
    return {
        url: opts.url ?? 'http://localhost/api/lesson-plan/cache?topic=t&grade=g&language=en',
        json: async () => opts.body ?? {},
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as import('next/server').NextRequest;
}

describe('/api/lesson-plan/cache — Wave 1 auth gate (migrated)', () => {
    it('GET → 401 without x-user-id (anonymous cache scraping blocked)', async () => {
        const { GET } = await import('@/app/api/lesson-plan/cache/route');
        expect((await GET(makeRequest({ userId: null }))).status).toBe(401);
    });

    it('POST → 401 without x-user-id (anonymous shared-cache poisoning blocked)', async () => {
        const { POST } = await import('@/app/api/lesson-plan/cache/route');
        const res = await POST(makeRequest({
            userId: null,
            body: { plan: { title: 'x' }, topic: 't', grade: 'g', language: 'en' },
        }));
        expect(res.status).toBe(401);
    });

    it('GET → 400 when query params are missing', async () => {
        const { GET } = await import('@/app/api/lesson-plan/cache/route');
        const res = await GET(makeRequest({ userId: 'u1', url: 'http://localhost/api/lesson-plan/cache' }));
        expect(res.status).toBe(400);
    });

    it('POST → 400 on malformed body', async () => {
        const { POST } = await import('@/app/api/lesson-plan/cache/route');
        const res = await POST(makeRequest({ userId: 'u1', body: { topic: 't' } }));
        expect(res.status).toBe(400);
    });
});

describe('lesson-plan client wrapper — graceful semantics (migrated)', () => {
    afterEach(() => {
        // @ts-expect-error cleanup
        delete global.fetch;
    });

    it('getCachedLessonPlan returns null on auth failure (graceful)', async () => {
        global.fetch = jest.fn(async () => ({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
        })) as jest.Mock;

        const { getCachedLessonPlan } = await import('@/lib/api/lesson-plan');
        const result = await getCachedLessonPlan('topic', 'Grade 8', 'English');
        expect(result).toBeNull();
    });

    it('saveLessonPlanToCache swallows errors (caching is best-effort)', async () => {
        global.fetch = jest.fn(async () => ({
            ok: false,
            status: 500,
            json: async () => ({ error: 'boom' }),
        })) as jest.Mock;

        const { saveLessonPlanToCache } = await import('@/lib/api/lesson-plan');
        await expect(
            saveLessonPlanToCache({ title: 'x' } as any, 'topic', 'Grade 8', 'English'),
        ).resolves.toBeUndefined();
    });
});
