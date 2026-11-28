/**
 * @jest-environment node
 *
 * /api/access/mode, /status and /sync: contract shapes and auth.
 */
jest.mock('server-only', () => ({}), { virtual: true });

const syncMock = jest.fn();
const resolveMock = jest.fn();
let requestDoc: Record<string, unknown> | undefined;

jest.mock('@/lib/access/access-admin', () => ({
    syncAccessClaim: (uid: string) => syncMock(uid),
    resolveAccess: (uid: string) => resolveMock(uid),
}));
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: () => ({
            doc: () => ({ get: async () => ({ exists: requestDoc !== undefined, data: () => requestDoc }) }),
        }),
    }),
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

// jest.setup.ts stubs the global Response; NextResponse needs the real one.
// Restore it from Next's edge primitives before the routes load next/server.
/* eslint-disable @typescript-eslint/no-require-imports */
const edge = require('next/dist/compiled/@edge-runtime/primitives');
Object.assign(globalThis, { Headers: edge.Headers, Request: edge.Request, Response: edge.Response });
const { GET: modeGET } = require('@/app/api/access/mode/route') as typeof import('@/app/api/access/mode/route');
const { GET: statusGET } = require('@/app/api/access/status/route') as typeof import('@/app/api/access/status/route');
const { POST: syncPOST } = require('@/app/api/access/sync/route') as typeof import('@/app/api/access/sync/route');
/* eslint-enable @typescript-eslint/no-require-imports */

function req(uid?: string): Request {
    const headers = new Map<string, string>();
    if (uid) headers.set('x-user-id', uid);
    return { headers: { get: (k: string) => headers.get(k) ?? null } } as unknown as Request;
}

beforeEach(() => {
    syncMock.mockReset();
    resolveMock.mockReset();
    requestDoc = undefined;
    delete process.env.ACCESS_GATE_MODE;
});

describe('GET /api/access/mode', () => {
    it('reports off by default and the configured mode otherwise', async () => {
        expect(await (await modeGET()).json()).toEqual({ mode: 'off' });
        // Reports what the middleware actually does: enforce without a valid
        // cutoff runs as log.
        process.env.ACCESS_GATE_MODE = 'enforce';
        delete process.env.ACCESS_LEGACY_CUTOFF;
        expect(await (await modeGET()).json()).toEqual({ mode: 'log' });
        process.env.ACCESS_LEGACY_CUTOFF = '2026-12-08T00:00:00+05:30';
        expect(await (await modeGET()).json()).toEqual({ mode: 'enforce' });
        delete process.env.ACCESS_LEGACY_CUTOFF;
    });
});

describe('POST /api/access/sync', () => {
    it('rejects a request with no verified user', async () => {
        const res = await syncPOST(req());
        expect(res.status).toBe(401);
        expect(syncMock).not.toHaveBeenCalled();
    });

    it('syncs only the caller and returns the contract shape', async () => {
        const exp = new Date('2027-01-01T00:00:00Z');
        syncMock.mockResolvedValue({ state: 'pilot', expiresAt: exp, claimChanged: true, decision: { entitled: true } });
        const res = await syncPOST(req('uid_1'));
        expect(syncMock).toHaveBeenCalledWith('uid_1');
        expect(await res.json()).toEqual({ state: 'pilot', entitled: true, expiresAt: exp.toISOString(), claimChanged: true });
    });

    it('answers 500 without leaking the cause', async () => {
        syncMock.mockRejectedValue(new Error('auth/internal: secret detail'));
        const res = await syncPOST(req('uid_1'));
        expect(res.status).toBe(500);
        expect(JSON.stringify(await res.json())).not.toContain('secret detail');
    });
});

describe('GET /api/access/status', () => {
    it('requires a verified user', async () => {
        expect((await statusGET(req())).status).toBe(401);
    });

    it('reports a pending account with its request', async () => {
        resolveMock.mockResolvedValue({ state: 'pending', expiresAt: null, source: 'stored' });
        requestDoc = { status: 'pending', createdAt: new Date('2026-12-02T00:00:00Z'), phone: '+91 99999 99999' };
        const body = await (await statusGET(req('uid_1'))).json();
        expect(body).toEqual({
            mode: 'off',
            state: 'pending',
            verdict: 'pending',
            entitled: false,
            expiresAt: null,
            request: { status: 'pending', createdAt: '2026-12-02T00:00:00.000Z' },
        });
    });

    it('reports an expired pilot as not entitled', async () => {
        resolveMock.mockResolvedValue({ state: 'pilot', expiresAt: new Date(Date.now() - 1000), source: 'stored' });
        const body = await (await statusGET(req('uid_1'))).json();
        expect(body).toMatchObject({ state: 'pilot', verdict: 'expired', entitled: false, request: null });
    });

    it('reports a legacy account as entitled', async () => {
        resolveMock.mockResolvedValue({ state: 'legacy', expiresAt: null, source: 'default-legacy' });
        expect(await (await statusGET(req('uid_1'))).json()).toMatchObject({ state: 'legacy', entitled: true });
    });
});
