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

        // Stable-id upsert: a Save after the generation's auto-save updates
        // the SAME row (one artifact = one Library record).
        describe('stable-id upsert', () => {
            const { dbAdapter } = jest.requireMock('@/lib/db/adapter') as {
                dbAdapter: { saveContent: jest.Mock; getContent: jest.Mock };
            };
            const savedDoc = () => dbAdapter.saveContent.mock.calls.at(-1)?.[1] as Record<string, unknown>;
            const body = { id: '6f1c2d3e-4b5a-4c6d-8e7f-0123456789ab', type: 'quiz', title: 'Q', data: { q: 1 } };

            it("keeps the existing row's creation time and writes to the same id", async () => {
                const originalCreatedAt = { seconds: 1700000000, nanoseconds: 0 };
                dbAdapter.getContent.mockResolvedValueOnce({ id: body.id, createdAt: originalCreatedAt });

                await POST(makeRequest(body));

                expect(savedDoc().id).toBe(body.id);
                expect(savedDoc().createdAt).toBe(originalCreatedAt);
                expect(savedDoc().status).toBe('ready');
            });

            it('gives a brand-new row a createdAt (listContent orders by it — without one the row is invisible)', async () => {
                dbAdapter.getContent.mockResolvedValueOnce(null);

                await POST(makeRequest(body));

                expect(savedDoc().createdAt).toBeTruthy();
            });

            it('an explicit Save un-deletes a soft-deleted row', async () => {
                dbAdapter.getContent.mockResolvedValueOnce({ id: body.id, createdAt: { seconds: 1 }, deletedAt: { seconds: 2 } });

                await POST(makeRequest(body));

                expect(savedDoc().deletedAt).toBeNull();
                expect(savedDoc().expiresAt).toBeNull();
            });
        });
    });
});
