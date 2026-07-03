/**
 * Contract tests for /api/moderation/* (moderation v1 — block/report).
 *
 * Covers:
 *   - 401 when the middleware-verified x-user-id header is missing (per route)
 *   - block/unblock/list flow (owner-scoped by construction)
 *   - self-block rejection
 *   - report validation (reason enum, freeText cap) + rate limit (10/day → 429)
 */

// ── Mock: firebase-admin (in-memory store) ──────────────────────────────────

const store: Record<string, Record<string, any>> = {};

function getCol(path: string) {
    if (!store[path]) store[path] = {};
    return store[path];
}

let autoDocId = 0;
function makeMockDb() {
    const collection = (colName: string): any => ({
        doc: (id?: string) => {
            const docId = id || `auto_${++autoDocId}`;
            return {
                id: docId,
                get: jest.fn(async () => {
                    const data = getCol(colName)[docId];
                    return { exists: !!data, data: () => data, id: docId };
                }),
                set: jest.fn(async (data: any) => { getCol(colName)[docId] = data; }),
                update: jest.fn(async (data: any) => {
                    getCol(colName)[docId] = { ...getCol(colName)[docId], ...data };
                }),
                delete: jest.fn(async () => { delete getCol(colName)[docId]; }),
                collection: (subCol: string) => collection(`${colName}/${docId}/${subCol}`),
            };
        },
        add: jest.fn(async (data: any) => {
            const docId = `auto_${++autoDocId}`;
            getCol(colName)[docId] = data;
            return { id: docId };
        }),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(async () => {
            const entries = Object.entries(getCol(colName));
            return {
                empty: entries.length === 0,
                size: entries.length,
                docs: entries.map(([id, data]) => ({ id, data: () => data })),
            };
        }),
    });
    return { collection };
}

const mockDb = makeMockDb();
jest.mock('@/lib/firebase-admin', () => ({
    getDb: () => Promise.resolve(mockDb),
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUsers: jest.fn(async (uids: string[]) =>
            uids.map((uid) => ({ uid, displayName: `Name of ${uid}`, photoURL: null })),
        ),
        serialize: jest.fn((data: any) => data),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ── Import route handlers under test ────────────────────────────────────────

import { POST as blockPOST, DELETE as blockDELETE } from '@/app/api/moderation/block/route';
import { GET as blocksGET } from '@/app/api/moderation/blocks/route';
import { POST as reportPOST } from '@/app/api/moderation/report/route';

// ── Helpers (same conventions as src/__tests__/api/messages/messages.test.ts) ─

function post(path: string, body: unknown, uid?: string | null, method = 'POST'): Request {
    const headers = new Map<string, string>();
    if (uid) headers.set('x-user-id', uid);
    return {
        url: `http://localhost:3000${path}`,
        method,
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

import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');

async function json(_res: Response): Promise<any> {
    const calls = jsonSpy.mock.calls;
    return calls[calls.length - 1][0];
}

const REPORT_BODY = {
    targetType: 'post',
    targetId: 'post-1',
    reason: 'spam',
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('/api/moderation routes', () => {
    beforeEach(() => {
        Object.keys(store).forEach((k) => delete store[k]);
        autoDocId = 0;
    });

    describe('auth — 401 when x-user-id header missing (per route)', () => {
        it('POST /block', async () => {
            const res = await blockPOST(post('/api/moderation/block', { blockedUid: 'user-b' }));
            expect(res.status).toBe(401);
            expect((await json(res)).error).toMatch(/Unauthorized/);
        });
        it('DELETE /block', async () => {
            const res = await blockDELETE(post('/api/moderation/block', { blockedUid: 'user-b' }, null, 'DELETE'));
            expect(res.status).toBe(401);
        });
        it('GET /blocks', async () => {
            const res = await blocksGET(get('/api/moderation/blocks'));
            expect(res.status).toBe(401);
        });
        it('POST /report', async () => {
            const res = await reportPOST(post('/api/moderation/report', REPORT_BODY));
            expect(res.status).toBe(401);
        });
    });

    describe('block / unblock / list', () => {
        it('rejects blocking yourself with 400', async () => {
            const res = await blockPOST(post('/api/moderation/block', { blockedUid: 'user-a' }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await json(res)).error).toBe('Cannot block yourself');
        });

        it('rejects an invalid body with 400', async () => {
            const res = await blockPOST(post('/api/moderation/block', { nope: true }, 'user-a'));
            expect(res.status).toBe(400);
        });

        it('block persists under users/{caller}/blocks/{blockedUid}', async () => {
            const res = await blockPOST(post('/api/moderation/block', { blockedUid: 'user-b' }, 'user-a'));
            expect(res.status).toBe(200);
            expect(store['users/user-a/blocks']['user-b']).toMatchObject({ blockedUid: 'user-b' });
        });

        it('GET /blocks returns the hydrated block list (owner-scoped)', async () => {
            await blockPOST(post('/api/moderation/block', { blockedUid: 'user-b' }, 'user-a'));
            const res = await blocksGET(get('/api/moderation/blocks', 'user-a'));
            expect(res.status).toBe(200);
            const body = await json(res);
            expect(body.blocks).toHaveLength(1);
            expect(body.blocks[0]).toMatchObject({
                blockedUid: 'user-b',
                displayName: 'Name of user-b',
            });
        });

        it('DELETE /block removes the block', async () => {
            await blockPOST(post('/api/moderation/block', { blockedUid: 'user-b' }, 'user-a'));
            const res = await blockDELETE(post('/api/moderation/block', { blockedUid: 'user-b' }, 'user-a', 'DELETE'));
            expect(res.status).toBe(200);
            expect(store['users/user-a/blocks']['user-b']).toBeUndefined();

            const listRes = await blocksGET(get('/api/moderation/blocks', 'user-a'));
            expect((await json(listRes)).blocks).toHaveLength(0);
        });
    });

    describe('report', () => {
        it('creates an open report attributed to the caller', async () => {
            const res = await reportPOST(post('/api/moderation/report', {
                ...REPORT_BODY,
                freeText: 'Repeated promotional messages.',
            }, 'user-a'));
            expect(res.status).toBe(200);
            expect((await json(res)).reportId).toBeTruthy();

            const reports = Object.values(store['reports'] ?? {});
            expect(reports).toHaveLength(1);
            expect(reports[0]).toMatchObject({
                reporterId: 'user-a',
                targetType: 'post',
                targetId: 'post-1',
                reason: 'spam',
                status: 'open',
                freeText: 'Repeated promotional messages.',
            });
        });

        it('rejects an unknown reason with 400', async () => {
            const res = await reportPOST(post('/api/moderation/report', {
                ...REPORT_BODY,
                reason: 'dislike',
            }, 'user-a'));
            expect(res.status).toBe(400);
        });

        it('rejects an unknown targetType with 400', async () => {
            const res = await reportPOST(post('/api/moderation/report', {
                ...REPORT_BODY,
                targetType: 'everything',
            }, 'user-a'));
            expect(res.status).toBe(400);
        });

        it('rejects freeText over 500 chars with 400', async () => {
            const res = await reportPOST(post('/api/moderation/report', {
                ...REPORT_BODY,
                freeText: 'x'.repeat(501),
            }, 'user-a'));
            expect(res.status).toBe(400);
        });

        it('rate-limits at 10 reports per day (11th → 429)', async () => {
            for (let i = 0; i < 10; i++) {
                const res = await reportPOST(post('/api/moderation/report', {
                    ...REPORT_BODY,
                    targetId: `post-${i}`,
                }, 'user-a'));
                expect(res.status).toBe(200);
            }
            const res = await reportPOST(post('/api/moderation/report', {
                ...REPORT_BODY,
                targetId: 'post-eleventh',
            }, 'user-a'));
            expect(res.status).toBe(429);
            expect((await json(res)).error).toMatch(/^Rate limit exceeded/);
            // The 11th report must NOT be stored.
            expect(Object.values(store['reports'] ?? {})).toHaveLength(10);
        });

        it('rate limit is per-user (another user can still report)', async () => {
            store['rate_limits'] = {
                'user-a_report': {
                    date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
                    count: 10,
                },
            };
            const blocked = await reportPOST(post('/api/moderation/report', REPORT_BODY, 'user-a'));
            expect(blocked.status).toBe(429);

            const ok = await reportPOST(post('/api/moderation/report', REPORT_BODY, 'user-z'));
            expect(ok.status).toBe(200);
        });
    });
});
