/**
 * Contract tests for the /api/connections/* routes (tranche 5 migration of
 * src/app/actions/connections.ts — every assertion from
 * src/__tests__/actions/connections.test.ts is preserved, retargeted at the
 * route handlers, plus a 401 no-header test per route).
 */

const store: Record<string, Record<string, any>> = {};

function getCol(path: string) {
    if (!store[path]) store[path] = {};
    return store[path];
}

function makeMockDb() {
    const collection = (colName: string) => ({
        doc: (id: string) => ({
            id,
            get: jest.fn(async () => {
                const data = getCol(colName)[id];
                return { exists: !!data, data: () => data, id };
            }),
            set: jest.fn(async (data: any) => { getCol(colName)[id] = data; }),
            update: jest.fn(async (data: any) => {
                getCol(colName)[id] = { ...getCol(colName)[id], ...data };
            }),
            delete: jest.fn(async () => { delete getCol(colName)[id]; }),
        }),
        where: jest.fn(function (this: any) { return this; }),
        get: jest.fn(async () => {
            const entries = Object.entries(getCol(colName));
            return {
                empty: entries.length === 0,
                docs: entries.map(([id, data]) => ({
                    id,
                    data: () => data,
                })),
            };
        }),
    });

    return {
        collection,
        batch: jest.fn(() => ({
            set: jest.fn(),
            delete: jest.fn(),
            commit: jest.fn(async () => {}),
        })),
    };
}

const mockDb = makeMockDb();
jest.mock('@/lib/firebase-admin', () => ({
    getDb: () => Promise.resolve(mockDb),
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { serialize: jest.fn((data: any) => data) },
}));

jest.mock('@/lib/notifications/create', () => ({
    createNotification: jest.fn(async () => {}),
    createTypedNotification: jest.fn(async () => {}),
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { POST as requestPOST } from '@/app/api/connections/request/route';
import { POST as acceptPOST } from '@/app/api/connections/request/accept/route';
import { POST as declinePOST } from '@/app/api/connections/request/decline/route';
import { POST as disconnectPOST } from '@/app/api/connections/disconnect/route';
import { GET as mineGET } from '@/app/api/connections/mine/route';

// ── Helpers ─────────────────────────────────────────────────────────────────

// jest.setup.ts polyfills `Request` without header/body support, so route
// tests use plain mock request objects (same convention as the other suites
// in src/__tests__/api/).
function post(path: string, body: unknown, uid?: string | null): Request {
    const headers = new Map<string, string>();
    if (uid) headers.set('x-user-id', uid);
    return {
        url: `http://localhost:3000${path}`,
        method: 'POST',
        json: async () => body,
        headers: { get: (k: string) => headers.get(k) ?? null },
    } as unknown as Request;
}

function get(path: string, uid?: string | null): Request {
    const headers = new Map<string, string>();
    if (uid) headers.set('x-user-id', uid);
    return {
        url: `http://localhost:3000${path}`,
        method: 'GET',
        headers: { get: (k: string) => headers.get(k) ?? null },
    } as unknown as Request;
}

// The Response polyfill in jest.setup.ts does not carry the body through
// next/server's NextResponse.json, so we capture bodies via a spy (same
// convention as src/__tests__/api/profile-check.test.ts). `json()` returns
// the body of the most recent NextResponse.json call.
import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');

async function json(_res: Response): Promise<any> {
    const calls = jsonSpy.mock.calls;
    return calls[calls.length - 1][0];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('/api/connections routes', () => {
    beforeEach(() => {
        Object.keys(store).forEach(k => delete store[k]);
    });

    describe('auth — 401 when x-user-id header missing (per route)', () => {
        it('POST /request', async () => {
            const res = await requestPOST(post('/api/connections/request', { toUid: 'user-b' }));
            expect(res.status).toBe(401);
            expect((await json(res)).error).toMatch(/Unauthorized/);
        });
        it('POST /request/accept', async () => {
            const res = await acceptPOST(post('/api/connections/request/accept', { requestId: 'r1' }));
            expect(res.status).toBe(401);
        });
        it('POST /request/decline', async () => {
            const res = await declinePOST(post('/api/connections/request/decline', { requestId: 'r1' }));
            expect(res.status).toBe(401);
        });
        it('POST /disconnect', async () => {
            const res = await disconnectPOST(post('/api/connections/disconnect', { otherUid: 'user-b' }));
            expect(res.status).toBe(401);
        });
        it('GET /mine', async () => {
            const res = await mineGET(get('/api/connections/mine'));
            expect(res.status).toBe(401);
        });
    });

    describe('POST /request (sendConnectionRequest)', () => {
        it('creates a connection request', async () => {
            getCol('users')['user-a'] = { displayName: 'Test User', photoURL: null };
            const res = await requestPOST(post('/api/connections/request', { toUid: 'user-b' }, 'user-a'));
            expect(res.status).toBe(200);
            expect((await json(res)).status).toBe('sent');
            expect(getCol('connection_requests')['user-a_user-b']).toBeDefined();
        });

        it('returns already_connected when connection exists', async () => {
            getCol('connections')['user-a_user-b'] = { uids: ['user-a', 'user-b'] };
            const res = await requestPOST(post('/api/connections/request', { toUid: 'user-b' }, 'user-a'));
            expect((await json(res)).status).toBe('already_connected');
        });

        it('returns already_pending when request exists', async () => {
            getCol('connection_requests')['user-a_user-b'] = { fromUid: 'user-a', toUid: 'user-b' };
            const res = await requestPOST(post('/api/connections/request', { toUid: 'user-b' }, 'user-a'));
            expect((await json(res)).status).toBe('already_pending');
        });

        it('rejects connecting with yourself', async () => {
            const res = await requestPOST(post('/api/connections/request', { toUid: 'user-a' }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await json(res)).error).toMatch(/Cannot connect with yourself/);
        });
    });

    describe('POST /request/accept (acceptConnectionRequest)', () => {
        it('404 when request not found', async () => {
            const res = await acceptPOST(post('/api/connections/request/accept', { requestId: 'nonexistent' }, 'user-a'));
            expect(res.status).toBe(404);
            expect((await json(res)).error).toMatch(/Request not found/);
        });

        it('rejects when caller is not recipient', async () => {
            getCol('connection_requests')['user-a_user-b'] = { fromUid: 'user-b', toUid: 'user-c' };
            const res = await acceptPOST(post('/api/connections/request/accept', { requestId: 'user-a_user-b' }, 'user-a'));
            expect(res.status).toBe(403);
            expect((await json(res)).error).toMatch(/Unauthorized/);
        });

        it('accepts when caller is recipient', async () => {
            getCol('connection_requests')['user-a_user-b'] = { fromUid: 'user-b', toUid: 'user-a' };
            getCol('users')['user-a'] = { displayName: 'Test User' };
            const res = await acceptPOST(post('/api/connections/request/accept', { requestId: 'user-a_user-b' }, 'user-a'));
            expect(res.status).toBe(200);
            expect(mockDb.batch).toHaveBeenCalled();
        });
    });

    describe('POST /request/decline (declineConnectionRequest)', () => {
        it('deletes request when caller is recipient', async () => {
            getCol('connection_requests')['user-a_user-b'] = { fromUid: 'user-b', toUid: 'user-a' };
            const res = await declinePOST(post('/api/connections/request/decline', { requestId: 'user-a_user-b' }, 'user-a'));
            expect(res.status).toBe(200);
            expect(getCol('connection_requests')['user-a_user-b']).toBeUndefined();
        });

        it('deletes request when caller is sender (withdraw)', async () => {
            getCol('connection_requests')['user-a_user-b'] = { fromUid: 'user-a', toUid: 'user-b' };
            const res = await declinePOST(post('/api/connections/request/decline', { requestId: 'user-a_user-b' }, 'user-a'));
            expect(res.status).toBe(200);
            expect(getCol('connection_requests')['user-a_user-b']).toBeUndefined();
        });

        it('is idempotent when request not found', async () => {
            const res = await declinePOST(post('/api/connections/request/decline', { requestId: 'nonexistent' }, 'user-a'));
            expect(res.status).toBe(200);
        });

        it('rejects when caller is neither party', async () => {
            getCol('connection_requests')['user-x_user-y'] = { fromUid: 'user-x', toUid: 'user-y' };
            const res = await declinePOST(post('/api/connections/request/decline', { requestId: 'user-x_user-y' }, 'user-a'));
            expect(res.status).toBe(403);
            expect((await json(res)).error).toMatch(/Unauthorized/);
        });
    });

    describe('POST /disconnect (disconnect)', () => {
        it('deletes the connection', async () => {
            getCol('connections')['user-a_user-b'] = { uids: ['user-a', 'user-b'] };
            const res = await disconnectPOST(post('/api/connections/disconnect', { otherUid: 'user-b' }, 'user-a'));
            expect(res.status).toBe(200);
            expect(getCol('connections')['user-a_user-b']).toBeUndefined();
        });

        it('is idempotent when not found', async () => {
            const res = await disconnectPOST(post('/api/connections/disconnect', { otherUid: 'user-b' }, 'user-a'));
            expect(res.status).toBe(200);
        });

        it('rejects when caller not in connection', async () => {
            getCol('connections')['user-a_user-b'] = { uids: ['user-x', 'user-y'] };
            const res = await disconnectPOST(post('/api/connections/disconnect', { otherUid: 'user-b' }, 'user-a'));
            expect(res.status).toBe(403);
            expect((await json(res)).error).toMatch(/Unauthorized/);
        });
    });

    describe('GET /mine (getMyConnectionData)', () => {
        it('returns empty data when no connections', async () => {
            const res = await mineGET(get('/api/connections/mine', 'user-a'));
            expect(res.status).toBe(200);
            expect(await json(res)).toEqual({ connectedUids: [], sentRequestUids: [], receivedRequests: [] });
        });

        it('returns connected uids', async () => {
            getCol('connections')['user-a_user-b'] = { uids: ['user-a', 'user-b'] };
            const res = await mineGET(get('/api/connections/mine', 'user-a'));
            expect((await json(res)).connectedUids).toContain('user-b');
        });
    });
});
