/**
 * Contract tests for the /api/messages/* routes (tranche 5 migration of
 * src/app/actions/messages.ts — every assertion from
 * src/__tests__/actions/messages.test.ts is preserved, retargeted at the
 * route handlers, plus a 401 no-header test per route).
 */

// ── Mock: firebase-admin (in-memory store) ──────────────────────────────────

const store: Record<string, Record<string, any>> = {};

function getCol(path: string) {
    if (!store[path]) store[path] = {};
    return store[path];
}

const mockFieldValue = {
    serverTimestamp: () => 'SERVER_TS',
    increment: (n: number) => ({ __increment: n }),
    arrayUnion: (...vals: any[]) => ({ __arrayUnion: vals }),
};

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: mockFieldValue,
}));

let autoDocId = 0;
function makeMockDb() {
    const collection = (colName: string) => ({
        doc: (id?: string) => {
            const docId = id || `auto_${++autoDocId}`;
            return {
                id: docId,
                get: jest.fn(async () => {
                    const data = getCol(colName)[docId];
                    return { exists: !!data, data: () => data, id: docId, ref: { id: docId } };
                }),
                set: jest.fn(async (data: any) => { getCol(colName)[docId] = data; }),
                update: jest.fn(async (data: any) => {
                    getCol(colName)[docId] = { ...getCol(colName)[docId], ...data };
                }),
                delete: jest.fn(async () => { delete getCol(colName)[docId]; }),
                collection: (subCol: string) => collection(`${colName}/${docId}/${subCol}`),
            };
        },
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(async () => {
            const entries = Object.entries(getCol(colName));
            return {
                empty: entries.length === 0,
                docs: entries.map(([id, data]) => ({
                    id,
                    data: () => data,
                    ref: { id, update: jest.fn() },
                })),
            };
        }),
    });

    return {
        collection,
        runTransaction: jest.fn(async (fn: any) => {
            const tx = {
                get: jest.fn(async (ref: any) => ref.get()),
                set: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            };
            await fn(tx);
            return tx;
        }),
        batch: jest.fn(() => ({
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            commit: jest.fn(async () => {}),
        })),
    };
}

const mockDb = makeMockDb();
jest.mock('@/lib/firebase-admin', () => ({
    getDb: () => Promise.resolve(mockDb),
}));

// ── Mock: db adapter ────────────────────────────────────────────────────────

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: jest.fn(async (uid: string) => ({
            uid,
            displayName: uid === 'user-a' ? 'Test User' : 'Other User',
            photoURL: null,
            preferredLanguage: 'en',
        })),
        getUsers: jest.fn(async (uids: string[]) =>
            uids.map(uid => ({ uid, displayName: `User ${uid}`, photoURL: null, preferredLanguage: 'en' }))
        ),
        serialize: jest.fn((data: any) => data),
    },
}));

// ── Mock: notifications + push ──────────────────────────────────────────────

jest.mock('@/lib/notifications/create', () => ({
    createNotification: jest.fn(async () => {}),
    createTypedNotification: jest.fn(async () => {}),
}));

jest.mock('@/lib/fcm-server', () => ({
    sendPushToUser: jest.fn(async () => {}),
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ── Import route handlers under test ────────────────────────────────────────

import { POST as directPOST } from '@/app/api/messages/conversations/direct/route';
import { POST as groupPOST } from '@/app/api/messages/conversations/group/route';
import { POST as sendPOST } from '@/app/api/messages/send/route';
import { POST as markReadPOST } from '@/app/api/messages/mark-read/route';
import { GET as unreadGET } from '@/app/api/messages/unread-count/route';
import { POST as ackPOST } from '@/app/api/messages/ack-delivery/route';

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

describe('/api/messages routes', () => {
    beforeEach(() => {
        Object.keys(store).forEach(k => delete store[k]);
        autoDocId = 0;
    });

    describe('auth — 401 when x-user-id header missing (per route)', () => {
        it('POST /conversations/direct', async () => {
            const res = await directPOST(post('/api/messages/conversations/direct', { myUid: 'user-a', otherUid: 'user-b' }));
            expect(res.status).toBe(401);
            expect((await json(res)).error).toMatch(/Unauthorized/);
        });
        it('POST /conversations/group', async () => {
            const res = await groupPOST(post('/api/messages/conversations/group', { creatorUid: 'user-a', participantUids: ['user-a', 'user-b'], name: 'G' }));
            expect(res.status).toBe(401);
        });
        it('POST /send', async () => {
            const res = await sendPOST(post('/api/messages/send', { conversationId: 'conv-1', text: 'Hi' }));
            expect(res.status).toBe(401);
        });
        it('POST /mark-read', async () => {
            const res = await markReadPOST(post('/api/messages/mark-read', { conversationId: 'conv-1', userId: 'user-a' }));
            expect(res.status).toBe(401);
        });
        it('GET /unread-count', async () => {
            const res = await unreadGET(get('/api/messages/unread-count?userId=user-a'));
            expect(res.status).toBe(401);
        });
        it('POST /ack-delivery', async () => {
            const res = await ackPOST(post('/api/messages/ack-delivery', { conversationId: 'conv-1', messageIds: ['m1'] }));
            expect(res.status).toBe(401);
        });
    });

    describe('POST /conversations/direct (getOrCreateDirectConversation)', () => {
        it('rejects Unauthorized when caller !== myUid', async () => {
            const res = await directPOST(post('/api/messages/conversations/direct', { myUid: 'user-a', otherUid: 'user-b' }, 'user-x'));
            expect(res.status).toBe(403);
            expect((await json(res)).error).toMatch(/Unauthorized/);
        });

        it('creates new conversation when none exists', async () => {
            const res = await directPOST(post('/api/messages/conversations/direct', { myUid: 'user-a', otherUid: 'user-b' }, 'user-a'));
            expect(res.status).toBe(200);
            expect((await json(res)).conversationId).toBe('user-a_user-b');
            expect(getCol('conversations')['user-a_user-b']).toBeDefined();
        });

        it('returns existing conversation without recreating', async () => {
            getCol('conversations')['user-a_user-b'] = { type: 'direct', existing: true };
            const res = await directPOST(post('/api/messages/conversations/direct', { myUid: 'user-a', otherUid: 'user-b' }, 'user-a'));
            expect((await json(res)).conversationId).toBe('user-a_user-b');
            expect(getCol('conversations')['user-a_user-b'].existing).toBe(true);
        });

        it('rejects messaging yourself', async () => {
            const res = await directPOST(post('/api/messages/conversations/direct', { myUid: 'user-a', otherUid: 'user-a' }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await json(res)).error).toMatch(/Cannot message yourself/);
        });

        it('produces deterministic ID regardless of argument order', async () => {
            const r1 = await json(await directPOST(post('/api/messages/conversations/direct', { myUid: 'user-a', otherUid: 'user-b' }, 'user-a')));
            const r2 = await json(await directPOST(post('/api/messages/conversations/direct', { myUid: 'user-b', otherUid: 'user-a' }, 'user-b')));
            expect(r1.conversationId).toBe(r2.conversationId);
        });
    });

    describe('POST /send (sendMessage)', () => {
        beforeEach(() => {
            getCol('conversations')['conv-1'] = {
                participantIds: ['user-a', 'user-b'],
                participants: {
                    'user-a': { displayName: 'Test User', photoURL: null },
                    'user-b': { displayName: 'Other User', photoURL: null },
                },
                type: 'direct',
            };
        });

        it('sends a text message', async () => {
            const res = await sendPOST(post('/api/messages/send', { conversationId: 'conv-1', text: 'Hello!' }, 'user-a'));
            expect(res.status).toBe(200);
            expect((await json(res)).messageId).toBeDefined();
            expect(mockDb.runTransaction).toHaveBeenCalled();
        });

        it('rejects empty text messages', async () => {
            const res = await sendPOST(post('/api/messages/send', { conversationId: 'conv-1', text: '' }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await json(res)).error).toMatch(/Message cannot be empty/);
        });

        it('rejects messages over 1000 chars', async () => {
            const res = await sendPOST(post('/api/messages/send', { conversationId: 'conv-1', text: 'x'.repeat(1001) }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await json(res)).error).toMatch(/Message too long/);
        });

        it('requires audioUrl for audio messages', async () => {
            const res = await sendPOST(post('/api/messages/send', { conversationId: 'conv-1', text: '', type: 'audio' }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await json(res)).error).toMatch(/Audio URL is required/);
        });

        it('sends audio message with url', async () => {
            const res = await sendPOST(post('/api/messages/send', {
                conversationId: 'conv-1', text: '', type: 'audio',
                // Wave 3 added validation requiring Firebase Storage host
                audioUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/voice.webm',
                audioDuration: 5,
            }, 'user-a'));
            expect(res.status).toBe(200);
            expect((await json(res)).messageId).toBeDefined();
        });

        it('rejects audio URL from a non-Storage host (Wave 3)', async () => {
            const res = await sendPOST(post('/api/messages/send', {
                conversationId: 'conv-1', text: '', type: 'audio',
                audioUrl: 'https://attacker.example.com/payload.mp3',
                audioDuration: 5,
            }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await json(res)).error).toMatch(/Firebase Storage/i);
        });

        it('rejects audio duration outside 0-600s (Wave 3)', async () => {
            const res = await sendPOST(post('/api/messages/send', {
                conversationId: 'conv-1', text: '', type: 'audio',
                audioUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/voice.webm',
                audioDuration: 9999,
            }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await json(res)).error).toMatch(/duration/i);
        });

        it('rejects when conversation not found', async () => {
            const res = await sendPOST(post('/api/messages/send', { conversationId: 'nonexistent', text: 'Hi' }, 'user-a'));
            expect(res.status).toBe(404);
            expect((await json(res)).error).toMatch(/Conversation not found/);
        });

        it('rejects when user is not a participant', async () => {
            getCol('conversations')['conv-2'] = { participantIds: ['user-x', 'user-y'], participants: {}, type: 'direct' };
            const res = await sendPOST(post('/api/messages/send', { conversationId: 'conv-2', text: 'Hi' }, 'user-a'));
            expect(res.status).toBe(403);
            expect((await json(res)).error).toMatch(/Not a participant/);
        });
    });

    describe('POST /mark-read (markConversationRead)', () => {
        it('completes without error when caller is a participant', async () => {
            getCol('conversations')['conv-1'] = {
                participantIds: ['user-a', 'user-b'],
                unreadCount: { 'user-a': 5 },
            };
            const res = await markReadPOST(post('/api/messages/mark-read', { conversationId: 'conv-1', userId: 'user-a' }, 'user-a'));
            expect(res.status).toBe(200);
        });

        it('rejects when caller !== userId', async () => {
            getCol('conversations')['conv-1'] = {
                participantIds: ['user-a', 'user-b'],
                unreadCount: { 'user-a': 5 },
            };
            const res = await markReadPOST(post('/api/messages/mark-read', { conversationId: 'conv-1', userId: 'user-b' }, 'user-a'));
            expect(res.status).toBe(403);
            expect((await json(res)).error).toMatch(/Unauthorized/);
        });

        // F2-02 (P1): IDOR. Previously any signed-in caller could mark read on
        // any conversation whose id they could guess.
        it('rejects Forbidden when caller is not a participant', async () => {
            getCol('conversations')['conv-strangers'] = {
                participantIds: ['user-x', 'user-y'],
                unreadCount: { 'user-x': 1, 'user-y': 2 },
            };
            const res = await markReadPOST(post('/api/messages/mark-read', { conversationId: 'conv-strangers', userId: 'user-a' }, 'user-a'));
            expect(res.status).toBe(403);
            expect((await json(res)).error).toMatch(/Forbidden|not a participant/);
        });

        it('404 Conversation not found when conversation does not exist', async () => {
            const res = await markReadPOST(post('/api/messages/mark-read', { conversationId: 'conv-missing', userId: 'user-a' }, 'user-a'));
            expect(res.status).toBe(404);
            expect((await json(res)).error).toMatch(/Conversation not found/);
        });
    });

    describe('GET /unread-count (getTotalUnreadCount)', () => {
        it('sums unread counts across conversations', async () => {
            getCol('conversations')['c1'] = { participantIds: ['user-a'], unreadCount: { 'user-a': 3 } };
            getCol('conversations')['c2'] = { participantIds: ['user-a'], unreadCount: { 'user-a': 7 } };
            const res = await unreadGET(get('/api/messages/unread-count?userId=user-a', 'user-a'));
            expect(res.status).toBe(200);
            expect((await json(res)).total).toBe(10);
        });

        it('returns 0 when no conversations', async () => {
            const res = await unreadGET(get('/api/messages/unread-count?userId=user-a', 'user-a'));
            expect((await json(res)).total).toBe(0);
        });

        it('rejects when caller !== userId', async () => {
            const res = await unreadGET(get('/api/messages/unread-count?userId=user-b', 'user-a'));
            expect(res.status).toBe(403);
            expect((await json(res)).error).toMatch(/Unauthorized/);
        });
    });

    describe('POST /ack-delivery (acknowledgeDelivery)', () => {
        it('writes deliveredTo when caller is a participant', async () => {
            getCol('conversations')['conv-1'] = {
                participantIds: ['user-a', 'user-b'],
            };
            const res = await ackPOST(post('/api/messages/ack-delivery', { conversationId: 'conv-1', messageIds: ['m1', 'm2'] }, 'user-a'));
            expect(res.status).toBe(200);
        });

        // F2-03 (P2): IDOR — previously no participant check at all.
        it('rejects Forbidden when caller is not a participant', async () => {
            getCol('conversations')['conv-strangers'] = {
                participantIds: ['user-x', 'user-y'],
            };
            // record batch creations so we can assert none happened
            const batchSpy = jest.spyOn(mockDb, 'batch');
            const callsBefore = batchSpy.mock.calls.length;
            const res = await ackPOST(post('/api/messages/ack-delivery', { conversationId: 'conv-strangers', messageIds: ['m1'] }, 'user-a'));
            expect(res.status).toBe(403);
            expect((await json(res)).error).toMatch(/Forbidden|not a participant/);
            // no batch should have been committed
            expect(batchSpy.mock.calls.length).toBe(callsBefore);
            batchSpy.mockRestore();
        });

        it('404 Conversation not found when conversation does not exist', async () => {
            const res = await ackPOST(post('/api/messages/ack-delivery', { conversationId: 'conv-missing', messageIds: ['m1'] }, 'user-a'));
            expect(res.status).toBe(404);
            expect((await json(res)).error).toMatch(/Conversation not found/);
        });
    });

    describe('POST /conversations/group (createGroupConversation)', () => {
        it('creates a group conversation', async () => {
            const res = await groupPOST(post('/api/messages/conversations/group', { creatorUid: 'user-a', participantUids: ['user-a', 'user-b', 'user-c'], name: 'Math Teachers' }, 'user-a'));
            expect(res.status).toBe(200);
            expect((await json(res)).conversationId).toBeDefined();
        });

        it('rejects Unauthorized when caller !== creatorUid', async () => {
            const res = await groupPOST(post('/api/messages/conversations/group', { creatorUid: 'user-b', participantUids: ['user-b', 'user-c'], name: 'G' }, 'user-a'));
            expect(res.status).toBe(403);
            expect((await json(res)).error).toMatch(/Unauthorized/);
        });

        it('rejects group with less than 2 members', async () => {
            const res = await groupPOST(post('/api/messages/conversations/group', { creatorUid: 'user-a', participantUids: ['user-a'], name: 'Solo' }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await json(res)).error).toMatch(/at least 2 members/);
        });

        it('rejects group with more than 50 members', async () => {
            const uids = Array.from({ length: 51 }, (_, i) => `user-${i}`);
            const res = await groupPOST(post('/api/messages/conversations/group', { creatorUid: 'user-a', participantUids: uids, name: 'Huge' }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await json(res)).error).toMatch(/cannot exceed 50/);
        });

        it('rejects empty group name', async () => {
            const res = await groupPOST(post('/api/messages/conversations/group', { creatorUid: 'user-a', participantUids: ['user-a', 'user-b'], name: '  ' }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await json(res)).error).toMatch(/Group name is required/);
        });
    });
});
