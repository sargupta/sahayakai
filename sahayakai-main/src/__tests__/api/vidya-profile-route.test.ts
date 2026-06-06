/**
 * F3-002 regression — POST /api/vidya/profile
 *
 * Verifies the route now validates the `profile` sub-object with an
 * explicit Zod schema and rejects unknown keys. Pre-fix, an attacker could
 * write arbitrary fields into `users/{uid}.jarvis`.
 */

const mockSet = jest.fn();
const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGet, set: mockSet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));
const mockGetDb = jest.fn(async () => ({ collection: mockCollection }));

jest.mock('@/lib/firebase-admin', () => ({ getDb: () => mockGetDb() }));
jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

function makeRequest(body: any, uid: string | null = 'test-uid', { invalidJson = false } = {}) {
    const headers = new Map<string, string>();
    if (uid) headers.set('x-user-id', uid);
    return {
        json: async () => {
            if (invalidJson) throw new SyntaxError('bad json');
            return body;
        },
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as any;
}

describe('POST /api/vidya/profile (F3-002)', () => {
    let POST: (req: any) => Promise<Response>;

    beforeAll(async () => {
        const mod = await import('@/app/api/vidya/profile/route');
        POST = mod.POST as any;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet.mockResolvedValue(undefined);
        mockGet.mockResolvedValue({ exists: false, data: () => ({}) });
    });

    it('returns 401 without x-user-id', async () => {
        const res = await POST(makeRequest({ profile: { preferredLanguage: 'Hindi' } }, null));
        expect(res.status).toBe(401);
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('returns 400 on malformed JSON', async () => {
        const res = await POST(makeRequest(null, 'test-uid', { invalidJson: true }));
        expect(res.status).toBe(400);
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('returns 400 when profile is missing', async () => {
        const res = await POST(makeRequest({}));
        expect(res.status).toBe(400);
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('returns 400 when profile contains unknown keys (strict schema)', async () => {
        const res = await POST(makeRequest({
            profile: {
                preferredLanguage: 'Hindi',
                role: 'admin',           // <- attacker injection
                sarkarVerified: true,    // <- attacker injection
            },
        }));
        expect(res.status).toBe(400);
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('returns 400 when a known field has the wrong type', async () => {
        const res = await POST(makeRequest({
            profile: { preferredLanguage: 12345 },
        }));
        expect(res.status).toBe(400);
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('accepts a valid profile and writes only allow-listed fields under jarvis', async () => {
        const res = await POST(makeRequest({
            profile: {
                preferredGrade: '7',
                preferredSubject: 'Science',
                preferredLanguage: 'Hindi',
                preferredBoard: 'CBSE',
                schoolContext: 'village school',
                lastActiveAt: 1717_000_000_000,
            },
        }));
        expect(res.status).toBe(200);
        expect(mockSet).toHaveBeenCalledTimes(1);
        const [payload, opts] = mockSet.mock.calls[0];
        expect(opts).toEqual({ merge: true });
        expect(payload).toEqual({
            jarvis: {
                preferredGrade: '7',
                preferredSubject: 'Science',
                preferredLanguage: 'Hindi',
                preferredBoard: 'CBSE',
                schoolContext: 'village school',
                lastActiveAt: 1717_000_000_000,
            },
        });
    });
});
