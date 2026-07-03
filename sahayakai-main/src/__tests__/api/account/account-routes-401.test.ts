/**
 * Tranche 5 route-shell tests for /api/account/** (migrated from
 * src/app/actions/auth.ts — placed under /api/account because the
 * middleware public list contains the `/api/auth/` prefix and these
 * endpoints MUST stay authenticated).
 *
 * The F1-06 / F11-5 forensic logic itself is covered in
 * auth-email-spoof-f1-06.test.ts and sync-user-no-clobber.test.ts against
 * src/server/auth.ts; these tests pin the route shell: 401 without the
 * middleware header, 400 on malformed payloads, pass-through otherwise.
 */

const serviceMocks = {
    syncUserAction: jest.fn(),
    getUserProfileAction: jest.fn(),
};
jest.mock('@/server/auth', () => serviceMocks);
jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Repo convention (see profile-check.test.ts): spy on NextResponse.json to
// capture response bodies — the jest Response polyfill drops them.
import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');
function lastJsonBody(): any {
    return jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][0];
}

function makeRequest({
    userId = 'test-uid',
    body = undefined as unknown,
    search = '',
    invalidJson = false,
} = {}) {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        headers: { get: (k: string) => headers.get(k) ?? null },
        nextUrl: { searchParams: new URLSearchParams(search) },
        json: async () => {
            if (invalidJson) throw new SyntaxError('bad json');
            return body;
        },
    } as any;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('POST /api/account/sync', () => {
    let POST: any;
    beforeAll(async () => {
        ({ POST } = await import('@/app/api/account/sync/route'));
    });

    const validBody = { uid: 'u1', email: 'a@b.com', displayName: 'A', photoURL: null };

    it('returns 401 without x-user-id and never calls the service', async () => {
        const res = await POST(makeRequest({ userId: '', body: validBody }));
        expect(res.status).toBe(401);
        expect(serviceMocks.syncUserAction).not.toHaveBeenCalled();
    });

    it('returns 400 on malformed JSON', async () => {
        const res = await POST(makeRequest({ invalidJson: true }));
        expect(res.status).toBe(400);
        expect(serviceMocks.syncUserAction).not.toHaveBeenCalled();
    });

    it('returns 400 when uid is missing from the payload', async () => {
        const res = await POST(makeRequest({ body: { email: 'a@b.com' } }));
        expect(res.status).toBe(400);
        expect(serviceMocks.syncUserAction).not.toHaveBeenCalled();
    });

    it('passes the payload to the service and returns its result contract', async () => {
        serviceMocks.syncUserAction.mockResolvedValue({ success: true });
        const res = await POST(makeRequest({ body: validBody }));
        expect(res.status).toBe(200);
        expect(serviceMocks.syncUserAction).toHaveBeenCalledWith(validBody);
        expect(lastJsonBody()).toEqual({ success: true });
    });

    it('surfaces the service uid-mismatch rejection unchanged (spoof tripwire)', async () => {
        serviceMocks.syncUserAction.mockResolvedValue({ success: false, error: 'Forbidden: uid mismatch' });
        await POST(makeRequest({ body: { ...validBody, uid: 'someone-else' } }));
        const data = lastJsonBody();
        expect(data.success).toBe(false);
        expect(data.error).toMatch(/Forbidden/i);
    });
});

describe('GET /api/account/profile', () => {
    let GET: any;
    beforeAll(async () => {
        ({ GET } = await import('@/app/api/account/profile/route'));
    });

    it('returns 401 without x-user-id and never calls the service', async () => {
        const res = await GET(makeRequest({ userId: '' }));
        expect(res.status).toBe(401);
        expect(serviceMocks.getUserProfileAction).not.toHaveBeenCalled();
    });

    it('forwards the compat uid param and returns the service contract', async () => {
        serviceMocks.getUserProfileAction.mockResolvedValue({ success: true, profile: { uid: 'u1' } });
        const res = await GET(makeRequest({ search: 'uid=u1' }));
        expect(res.status).toBe(200);
        expect(serviceMocks.getUserProfileAction).toHaveBeenCalledWith('u1');
        expect(lastJsonBody()).toEqual({ success: true, profile: { uid: 'u1' } });
    });
});
