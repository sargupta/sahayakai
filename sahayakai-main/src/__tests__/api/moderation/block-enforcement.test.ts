/**
 * Block-enforcement tests (moderation v1).
 *
 * Verifies the two enforcement layers:
 *   1. Messaging write path — sendMessage and getOrCreateDirectConversation
 *      reject with the direction-neutral 'Cannot message this user' when
 *      EITHER side has blocked the other (never reveals who blocked whom).
 *      Group conversations stay unaffected.
 *   2. Community read path — getPosts / getFollowingPosts /
 *      getLibraryResources hide content authored by users the CALLER blocked.
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
    const collection = (colName: string): any => ({
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
                docs: entries.map(([id, data]) => ({ id, data: () => data, ref: { id, update: jest.fn() } })),
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
            return fn(tx);
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

// ── Mocks: collaborators of messages.ts / community.ts ─────────────────────

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: jest.fn(async (uid: string) => ({ uid, displayName: `User ${uid}`, photoURL: null, preferredLanguage: 'en' })),
        getUsers: jest.fn(async (uids: string[]) =>
            uids.map((uid) => ({ uid, displayName: `User ${uid}`, photoURL: null, preferredLanguage: 'en' }))),
        serialize: jest.fn((data: any) => data),
    },
}));

jest.mock('@/lib/notifications/create', () => ({
    createTypedNotification: jest.fn(async () => {}),
}));
jest.mock('@/lib/fcm-server', () => ({
    sendPushToUser: jest.fn(async () => {}),
}));
jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock('@/lib/pubsub', () => ({
    publishEvent: jest.fn(async () => {}),
}));
jest.mock('@/lib/aggregator', () => ({
    aggregateUserMetrics: jest.fn(async () => {}),
}));
jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(async () => {}),
}));
jest.mock('@/lib/server-cache', () => ({
    cachedPerUser: (fn: any) => fn,
    invalidateUserCache: jest.fn(),
}));

// ── Under test ──────────────────────────────────────────────────────────────

import { sendMessage, getOrCreateDirectConversation } from '@/server/messages';
import { getPosts, getFollowingPosts, getLibraryResources } from '@/server/community';
import { POST as sendPOST } from '@/app/api/messages/send/route';

import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');

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

async function lastJson(): Promise<any> {
    const calls = jsonSpy.mock.calls;
    return calls[calls.length - 1][0];
}

function seedDirectConversation(id: string, a: string, b: string) {
    getCol('conversations')[id] = {
        type: 'direct',
        participantIds: [a, b],
        participants: {
            [a]: { displayName: `User ${a}`, photoURL: null },
            [b]: { displayName: `User ${b}`, photoURL: null },
        },
        unreadCount: { [a]: 0, [b]: 0 },
    };
}

function block(blocker: string, blocked: string) {
    getCol(`users/${blocker}/blocks`)[blocked] = { blockedUid: blocked, createdAt: '2026-07-03T00:00:00.000Z' };
}

describe('block enforcement', () => {
    beforeEach(() => {
        Object.keys(store).forEach((k) => delete store[k]);
        autoDocId = 0;
    });

    describe('messaging write path', () => {
        it('sendMessage rejects when the RECIPIENT blocked the sender', async () => {
            seedDirectConversation('conv-1', 'user-a', 'user-b');
            block('user-b', 'user-a');
            await expect(sendMessage('user-a', { conversationId: 'conv-1', text: 'hi' }))
                .rejects.toThrow('Cannot message this user');
        });

        it('sendMessage rejects when the SENDER blocked the recipient', async () => {
            seedDirectConversation('conv-1', 'user-a', 'user-b');
            block('user-a', 'user-b');
            await expect(sendMessage('user-a', { conversationId: 'conv-1', text: 'hi' }))
                .rejects.toThrow('Cannot message this user');
            // …and the blocked side gets the SAME generic error (no direction leak).
            await expect(sendMessage('user-b', { conversationId: 'conv-1', text: 'hi' }))
                .rejects.toThrow('Cannot message this user');
        });

        it('route maps the block rejection to a generic 400', async () => {
            seedDirectConversation('conv-1', 'user-a', 'user-b');
            block('user-b', 'user-a');
            const res = await sendPOST(post('/api/messages/send', { conversationId: 'conv-1', text: 'hi' }, 'user-a'));
            expect(res.status).toBe(400);
            expect((await lastJson()).error).toBe('Cannot message this user');
        });

        it('sendMessage still works when no block exists', async () => {
            seedDirectConversation('conv-1', 'user-a', 'user-b');
            const result = await sendMessage('user-a', { conversationId: 'conv-1', text: 'hi' });
            expect(result.messageId).toBeTruthy();
        });

        it('group conversations are NOT gated by 1:1 blocks', async () => {
            getCol('conversations')['grp-1'] = {
                type: 'group',
                name: 'Staff room',
                participantIds: ['user-a', 'user-b', 'user-c'],
                participants: {},
                unreadCount: { 'user-a': 0, 'user-b': 0, 'user-c': 0 },
            };
            block('user-b', 'user-a');
            const result = await sendMessage('user-a', { conversationId: 'grp-1', text: 'hello all' });
            expect(result.messageId).toBeTruthy();
        });

        it('getOrCreateDirectConversation rejects in both directions', async () => {
            block('user-b', 'user-a');
            await expect(getOrCreateDirectConversation('user-a', 'user-a', 'user-b'))
                .rejects.toThrow('Cannot message this user');
            await expect(getOrCreateDirectConversation('user-b', 'user-b', 'user-a'))
                .rejects.toThrow('Cannot message this user');
        });
    });

    describe('community read-time filter', () => {
        it('getPosts hides posts authored by users the caller blocked', async () => {
            getCol('posts')['p1'] = { authorId: 'bully', content: 'one' };
            getCol('posts')['p2'] = { authorId: 'friend', content: 'two' };
            block('user-a', 'bully');

            const posts = await getPosts('user-a');
            expect(posts.map((p: any) => p.id)).toEqual(['p2']);
        });

        it('the filter is caller-scoped (other users still see the posts)', async () => {
            getCol('posts')['p1'] = { authorId: 'bully', content: 'one' };
            block('user-a', 'bully');

            const posts = await getPosts('user-z');
            expect(posts.map((p: any) => p.id)).toEqual(['p1']);
        });

        it('getFollowingPosts applies the same filter', async () => {
            getCol('connections')['user-a_bully'] = { followerId: 'user-a', followingId: 'bully' };
            getCol('posts')['p1'] = { authorId: 'bully', content: 'one' };
            block('user-a', 'bully');

            const posts = await getFollowingPosts('user-a');
            expect(posts).toEqual([]);
        });

        it('getLibraryResources hides resources authored by blocked users', async () => {
            getCol('library_resources')['r1'] = { authorId: 'bully', title: 'Quiz', stats: { likes: 3 } };
            getCol('library_resources')['r2'] = { authorId: 'friend', title: 'Plan', stats: { likes: 1 } };
            block('user-a', 'bully');

            const resources = await getLibraryResources('user-a');
            expect(resources.map((r: any) => r.id)).toEqual(['r2']);
        });
    });
});
