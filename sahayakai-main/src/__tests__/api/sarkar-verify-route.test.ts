/**
 * F3-003 regression — POST /api/sarkar/verify
 *
 * Verifies the route now bounds schoolName/district/state lengths via Zod
 * and still enforces the 11-digit UDISE format check.
 */

const mockUpdate = jest.fn();
const mockSet = jest.fn();
const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));
const mockGetDb = jest.fn(async () => ({ collection: mockCollection }));

jest.mock('@/lib/firebase-admin', () => ({ getDb: () => mockGetDb() }));

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

describe('POST /api/sarkar/verify (F3-003)', () => {
    let POST: (req: any) => Promise<Response>;

    beforeAll(async () => {
        const mod = await import('@/app/api/sarkar/verify/route');
        POST = mod.POST as any;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockGet.mockResolvedValue({ exists: true, data: () => ({}) });
        mockSet.mockResolvedValue(undefined);
        mockUpdate.mockResolvedValue(undefined);
    });

    it('returns 401 without x-user-id', async () => {
        const res = await POST(makeRequest({
            udiseCode: '12345678901',
            schoolName: 'Test School',
        }, null));
        expect(res.status).toBe(401);
    });

    it('returns 400 on malformed JSON', async () => {
        const res = await POST(makeRequest(null, 'test-uid', { invalidJson: true }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when udiseCode is missing', async () => {
        const res = await POST(makeRequest({ schoolName: 'X' }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when schoolName exceeds 120 chars', async () => {
        const res = await POST(makeRequest({
            udiseCode: '12345678901',
            schoolName: 'a'.repeat(121),
        }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when district exceeds 80 chars', async () => {
        const res = await POST(makeRequest({
            udiseCode: '12345678901',
            schoolName: 'OK',
            district: 'd'.repeat(81),
        }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when state exceeds 80 chars', async () => {
        const res = await POST(makeRequest({
            udiseCode: '12345678901',
            schoolName: 'OK',
            state: 's'.repeat(81),
        }));
        expect(res.status).toBe(400);
    });

    it('returns 400 on bad UDISE format (non-numeric)', async () => {
        const res = await POST(makeRequest({
            udiseCode: 'abcdefghijk',
            schoolName: 'OK',
        }));
        expect(res.status).toBe(400);
    });

    it('accepts a valid payload with bounded fields', async () => {
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ sarkarVerified: false }) });
        const res = await POST(makeRequest({
            udiseCode: '12345678901',
            schoolName: 'Sarvodaya Vidyalaya',
            district: 'South Delhi',
            state: 'Delhi',
        }));
        expect(res.status).toBe(200);
        expect(mockSet).toHaveBeenCalledTimes(1);
        const [storedPayload] = mockSet.mock.calls[0];
        expect(storedPayload).toMatchObject({
            udiseCode: '12345678901',
            schoolName: 'Sarvodaya Vidyalaya',
            district: 'South Delhi',
            state: 'Delhi',
            status: 'pending',
        });
    });
});
