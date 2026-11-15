/**
 * Regression (P0): a library item could point at ANY bucket object.
 *
 * POST /api/content/save accepted a client `storagePath`; GET /api/content/download
 * then signed it and POST /api/export downloaded it into the ZIP. Any signed-in
 * user could read another user's files (voice DMs, exports, ...). Every
 * server-written path is `users/<uid>/...`, so anything else is dropped at save
 * and refused at download/export.
 */
import { isOwnedStoragePath } from '@/lib/storage/owned-path';

const mockGetSignedUrl = jest.fn(async () => ['https://signed.example/x']);
const mockFileCalls: string[] = [];
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { saveContent: jest.fn(async () => {}), getContent: jest.fn() },
}));
jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(async () => ({ collection: () => ({ doc: () => ({ update: jest.fn(async () => {}) }) }) })),
    getStorageInstance: jest.fn(async () => ({
        bucket: () => ({
            name: 'b',
            file: (p: string) => {
                mockFileCalls.push(p);
                return { save: jest.fn(async () => {}), delete: jest.fn(async () => {}), getSignedUrl: mockGetSignedUrl, exists: jest.fn(async () => [true]) };
            },
        }),
    })),
}));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));
jest.mock('@/ai/schemas/content-schemas', () => ({
    SaveContentSchema: { safeParse: (data: any) => ({ success: true, data: { ...data } }) },
}));

const { dbAdapter } = jest.requireMock('@/lib/db/adapter') as { dbAdapter: { saveContent: jest.Mock; getContent: jest.Mock } };

function req(body: any, url = 'https://app.test/api/content/save', uid = 'attacker') {
    return { url, json: async () => body, headers: { get: (k: string) => (k === 'x-user-id' ? uid : null) } } as unknown as Request;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockFileCalls.length = 0;
});

describe('isOwnedStoragePath', () => {
    it.each([
        ['users/u1/lesson-plans/a.json', true],
        ['users/u1/visual-aids/x.png', true],
        ['users/u2/lesson-plans/a.json', false],
        ['voice-messages/u2/c/1.webm', false],
        ['users/u1/../u2/a.json', false],
        ['users/u1/', false],
        ['users/u1//a', false],
        ['users/u1/%2e%2e/a', false],
        ['/users/u1/a', false],
        [42, false],
    ])('%s → %s', (path, ok) => expect(isOwnedStoragePath('u1', path)).toBe(ok));

    it('refuses a uid containing a slash', () => expect(isOwnedStoragePath('u1/x', 'users/u1/x/a')).toBe(false));
});

describe('POST /api/content/save', () => {
    let POST: (r: Request) => Promise<Response>;
    beforeAll(async () => ({ POST } = await import('@/app/api/content/save/route')));

    it('drops a storagePath that points at another user’s object', async () => {
        dbAdapter.getContent.mockResolvedValueOnce(null);
        const res = await POST(req({ id: 'c1', type: 'lesson-plan', title: 'x', storagePath: 'voice-messages/victim/c/1.webm' }));
        expect(res.status).toBe(200);
        expect(dbAdapter.saveContent.mock.calls[0][1].storagePath).toBeUndefined();
    });

    it('keeps the caller’s own storagePath', async () => {
        dbAdapter.getContent.mockResolvedValueOnce(null);
        await POST(req({ id: 'c2', type: 'quiz', title: 'x', storagePath: 'users/attacker/quizzes/q.json' }));
        expect(dbAdapter.saveContent.mock.calls[0][1].storagePath).toBe('users/attacker/quizzes/q.json');
    });
});

describe('GET /api/content/download', () => {
    let GET: (r: Request) => Promise<Response>;
    beforeAll(async () => ({ GET } = await import('@/app/api/content/download/route')));
    const dl = () => GET(req(undefined, 'https://app.test/api/content/download?id=c1'));

    it('refuses to sign a foreign path already stored on a doc (404, nothing signed)', async () => {
        dbAdapter.getContent.mockResolvedValueOnce({ id: 'c1', storagePath: 'users/victim/exports/e.zip' });
        const res = await dl();
        expect(res.status).toBe(404);
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
        expect(mockFileCalls).toEqual([]);
    });

    it('signs the caller’s own file', async () => {
        dbAdapter.getContent.mockResolvedValueOnce({ id: 'c1', storagePath: 'users/attacker/quizzes/q.json' });
        const res = await dl();
        expect(res.status).toBe(200);
        expect(mockFileCalls).toEqual(['users/attacker/quizzes/q.json']);
    });
});
