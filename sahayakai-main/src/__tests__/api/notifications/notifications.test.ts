/**
 * Contract tests for the /api/notifications/* routes (tranche 5 migration of
 * src/app/actions/notifications.ts).
 *
 * Carries forward the Wave 1 security assertions that lived in
 * src/__tests__/actions/wave-1-auth.test.ts (auth gate before any Firestore
 * touch) and the markNotificationAsRead recipientId ownership check, plus a
 * 401 no-header test per route.
 */

const store: Record<string, Record<string, any>> = {};

function getCol(path: string) {
    if (!store[path]) store[path] = {};
    return store[path];
}

let dbTouched = false;

function makeMockDb() {
    const collection = (colName: string) => ({
        doc: (id: string) => ({
            id,
            get: jest.fn(async () => {
                dbTouched = true;
                const data = getCol(colName)[id];
                return { exists: !!data, data: () => data, id };
            }),
            update: jest.fn(async (data: any) => {
                dbTouched = true;
                getCol(colName)[id] = { ...getCol(colName)[id], ...data };
            }),
        }),
        where: jest.fn(function (this: any) { return this; }),
        limit: jest.fn(function (this: any) { return this; }),
        get: jest.fn(async () => {
            dbTouched = true;
            const entries = Object.entries(getCol(colName));
            return {
                empty: entries.length === 0,
                docs: entries.map(([id, data]) => ({
                    id,
                    data: () => data,
                    ref: {
                        id,
                        update: jest.fn(async (patch: any) => {
                            getCol(colName)[id] = { ...getCol(colName)[id], ...patch };
                        }),
                    },
                })),
            };
        }),
    });

    return {
        collection,
        batch: jest.fn(() => ({
            update: jest.fn((ref: any, patch: any) => {
                getCol('notifications')[ref.id] = { ...getCol('notifications')[ref.id], ...patch };
            }),
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

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { GET as listGET } from '@/app/api/notifications/route';
import { POST as markReadPOST } from '@/app/api/notifications/mark-read/route';
import { POST as markAllPOST } from '@/app/api/notifications/mark-all-read/route';

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

describe('/api/notifications routes', () => {
    beforeEach(() => {
        Object.keys(store).forEach(k => delete store[k]);
        dbTouched = false;
    });

    describe('auth — 401 when x-user-id header missing, BEFORE Firestore is touched (Wave 1 gate)', () => {
        it('GET /api/notifications', async () => {
            const res = await listGET(get('/api/notifications'));
            expect(res.status).toBe(401);
            expect((await json(res)).error).toMatch(/Unauthorized/i);
            expect(dbTouched).toBe(false);
        });
        it('POST /api/notifications/mark-read', async () => {
            const res = await markReadPOST(post('/api/notifications/mark-read', { notificationId: 'notif-1' }));
            expect(res.status).toBe(401);
            expect(dbTouched).toBe(false);
        });
        it('POST /api/notifications/mark-all-read', async () => {
            const res = await markAllPOST(post('/api/notifications/mark-all-read', {}));
            expect(res.status).toBe(401);
            expect(dbTouched).toBe(false);
        });
    });

    describe('GET /api/notifications (getNotifications)', () => {
        it('returns the caller notifications sorted newest first', async () => {
            getCol('notifications')['n1'] = { recipientId: 'user-a', createdAt: '2026-01-01T00:00:00Z', isRead: false };
            getCol('notifications')['n2'] = { recipientId: 'user-a', createdAt: '2026-02-01T00:00:00Z', isRead: false };
            const res = await listGET(get('/api/notifications', 'user-a'));
            expect(res.status).toBe(200);
            const body = await json(res);
            expect(body.map((n: any) => n.id)).toEqual(['n2', 'n1']);
        });

        it('returns [] when there are none', async () => {
            const res = await listGET(get('/api/notifications', 'user-a'));
            expect(await json(res)).toEqual([]);
        });
    });

    describe('POST /mark-read (markNotificationAsRead)', () => {
        it('marks own notification as read', async () => {
            getCol('notifications')['notif-1'] = { recipientId: 'user-a', isRead: false };
            const res = await markReadPOST(post('/api/notifications/mark-read', { notificationId: 'notif-1' }, 'user-a'));
            expect(res.status).toBe(200);
            expect(getCol('notifications')['notif-1'].isRead).toBe(true);
        });

        it('is a no-op when the notification does not exist', async () => {
            const res = await markReadPOST(post('/api/notifications/mark-read', { notificationId: 'ghost' }, 'user-a'));
            expect(res.status).toBe(200);
        });

        // Wave 1: previously any signed-in user could mark any notification
        // (anywhere in the system) as read by passing its id.
        it('rejects Forbidden when caller is not the recipient', async () => {
            getCol('notifications')['notif-x'] = { recipientId: 'user-b', isRead: false };
            const res = await markReadPOST(post('/api/notifications/mark-read', { notificationId: 'notif-x' }, 'user-a'));
            expect(res.status).toBe(403);
            expect((await json(res)).error).toMatch(/Forbidden/i);
            expect(getCol('notifications')['notif-x'].isRead).toBe(false);
        });
    });

    describe('POST /mark-all-read (markAllAsRead)', () => {
        it('marks all of the caller notifications read (batched)', async () => {
            getCol('notifications')['n1'] = { recipientId: 'user-a', isRead: false };
            getCol('notifications')['n2'] = { recipientId: 'user-a', isRead: false };
            const res = await markAllPOST(post('/api/notifications/mark-all-read', {}, 'user-a'));
            expect(res.status).toBe(200);
            expect(mockDb.batch).toHaveBeenCalled();
            expect(getCol('notifications')['n1'].isRead).toBe(true);
            expect(getCol('notifications')['n2'].isRead).toBe(true);
        });
    });
});
