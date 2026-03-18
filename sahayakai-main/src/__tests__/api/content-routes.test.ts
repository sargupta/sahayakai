/**
 * Tests for content API routes: save, get, list, delete
 */

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        saveContent: jest.fn(async () => {}),
        getContent: jest.fn(async (userId: string, id: string) => ({
            id, type: 'lesson-plan', title: 'Test', userId,
        })),
    },
}));

jest.mock('@/lib/firebase-admin', () => ({
    getStorageInstance: jest.fn(async () => ({
        bucket: () => ({
            file: (path: string) => ({
                save: jest.fn(async () => {}),
                delete: jest.fn(async () => {}),
                exists: jest.fn(async () => [true]),
                download: jest.fn(async () => [Buffer.from('content')]),
            }),
            name: 'test-bucket',
        }),
    })),
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/ai/schemas/content-schemas', () => ({
    SaveContentSchema: {
        safeParse: (data: any) => {
            if (!data.type || !data.title) return { success: false, error: { format: () => 'missing fields' } };
            return { success: true, data };
        },
    },
}));

jest.mock('date-fns', () => ({ format: () => '20260318_120000' }));
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

function makeRequest(body: any, userId: string | null = 'test-uid') {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        json: async () => body,
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as Request;
}

describe('Content API Routes', () => {
    describe('POST /api/content/save', () => {
        let POST: (req: Request) => Promise<Response>;

        beforeAll(async () => {
            const mod = await import('@/app/api/content/save/route');
            POST = mod.POST;
        });

        beforeEach(() => jest.clearAllMocks());

        it('returns 401 without x-user-id', async () => {
            const res = await POST(makeRequest({}, null));
            expect(res.status).toBe(401);
        });

        it('returns 400 on validation failure', async () => {
            const res = await POST(makeRequest({ invalid: true }));
            expect(res.status).toBe(400);
        });

        it('saves content successfully', async () => {
            const res = await POST(makeRequest({
                type: 'lesson-plan',
                title: 'Photosynthesis Lesson',
                data: { content: 'lesson content' },
            }));
            expect(res.status).toBe(200);
        });
    });
});
