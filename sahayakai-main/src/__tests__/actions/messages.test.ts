/**
 * Server action contract tests for src/app/actions/messages.ts
 */

// ── Mock: next/headers ──────────────────────────────────────────────────────

const mockHeadersMap = new Map<string, string>([['x-user-id', 'user-a']]);
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

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

// ── Mock: notifications ─────────────────────────────────────────────────────

jest.mock('@/app/actions/notifications', () => ({
    createNotification: jest.fn(async () => {}),
}));

// ── Import actions under test ───────────────────────────────────────────────

import {
    getOrCreateDirectConversationAction,
    sendMessageAction,
    markConversationReadAction,
    getTotalUnreadCountAction,
    createGroupConversationAction,
} from '@/app/actions/messages';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('messages server actions', () => {
    beforeEach(() => {
        Object.keys(store).forEach(k => delete store[k]);
        autoDocId = 0;
        mockHeadersMap.set('x-user-id', 'user-a');
    });

    describe('auth', () => {
        it('throws Unauthorized when x-user-id header missing', async () => {
            mockHeadersMap.delete('x-user-id');
            await expect(getOrCreateDirectConversationAction('user-a', 'user-b')).rejects.toThrow('Unauthorized');
        });

        it('throws Unauthorized when caller !== myUid', async () => {
            mockHeadersMap.set('x-user-id', 'user-x');
            await expect(getOrCreateDirectConversationAction('user-a', 'user-b')).rejects.toThrow('Unauthorized');
        });
    });

    describe('getOrCreateDirectConversationAction', () => {
        it('creates new conversation when none exists', async () => {
            const result = await getOrCreateDirectConversationAction('user-a', 'user-b');
            expect(result.conversationId).toBe('user-a_user-b');
            expect(getCol('conversations')['user-a_user-b']).toBeDefined();
        });

        it('returns existing conversation without recreating', async () => {
            getCol('conversations')['user-a_user-b'] = { type: 'direct', existing: true };
            const result = await getOrCreateDirectConversationAction('user-a', 'user-b');
            expect(result.conversationId).toBe('user-a_user-b');
            expect(getCol('conversations')['user-a_user-b'].existing).toBe(true);
        });

        it('throws when messaging yourself', async () => {
            await expect(getOrCreateDirectConversationAction('user-a', 'user-a')).rejects.toThrow('Cannot message yourself');
        });

        it('produces deterministic ID regardless of argument order', async () => {
            const r1 = await getOrCreateDirectConversationAction('user-a', 'user-b');
            mockHeadersMap.set('x-user-id', 'user-b');
            const r2 = await getOrCreateDirectConversationAction('user-b', 'user-a');
            expect(r1.conversationId).toBe(r2.conversationId);
        });
    });

    describe('sendMessageAction', () => {
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
            const result = await sendMessageAction({ conversationId: 'conv-1', text: 'Hello!' });
            expect(result.messageId).toBeDefined();
            expect(mockDb.runTransaction).toHaveBeenCalled();
        });

        it('rejects empty text messages', async () => {
            await expect(sendMessageAction({ conversationId: 'conv-1', text: '' })).rejects.toThrow('Message cannot be empty');
        });

        it('rejects messages over 1000 chars', async () => {
            await expect(sendMessageAction({ conversationId: 'conv-1', text: 'x'.repeat(1001) })).rejects.toThrow('Message too long');
        });

        it('requires audioUrl for audio messages', async () => {
            await expect(sendMessageAction({ conversationId: 'conv-1', text: '', type: 'audio' })).rejects.toThrow('Audio URL is required');
        });

        it('sends audio message with url', async () => {
            const result = await sendMessageAction({
                conversationId: 'conv-1', text: '', type: 'audio',
                // Wave 3 added validation requiring Firebase Storage host
                audioUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/voice.webm',
                audioDuration: 5,
            });
            expect(result.messageId).toBeDefined();
        });

        it('rejects audio URL from a non-Storage host (Wave 3)', async () => {
            await expect(sendMessageAction({
                conversationId: 'conv-1', text: '', type: 'audio',
                audioUrl: 'https://attacker.example.com/payload.mp3',
                audioDuration: 5,
            })).rejects.toThrow(/Firebase Storage/i);
        });

        it('rejects audio duration outside 0-600s (Wave 3)', async () => {
            await expect(sendMessageAction({
                conversationId: 'conv-1', text: '', type: 'audio',
                audioUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/voice.webm',
                audioDuration: 9999,
            })).rejects.toThrow(/duration/i);
        });

        it('rejects when conversation not found', async () => {
            await expect(sendMessageAction({ conversationId: 'nonexistent', text: 'Hi' })).rejects.toThrow('Conversation not found');
        });

        it('rejects when user is not a participant', async () => {
            getCol('conversations')['conv-2'] = { participantIds: ['user-x', 'user-y'], participants: {}, type: 'direct' };
            await expect(sendMessageAction({ conversationId: 'conv-2', text: 'Hi' })).rejects.toThrow('Not a participant');
        });
    });

    describe('markConversationReadAction', () => {
        it('completes without error', async () => {
            getCol('conversations')['conv-1'] = { unreadCount: { 'user-a': 5 } };
            await expect(markConversationReadAction('conv-1', 'user-a')).resolves.toBeUndefined();
        });

        it('throws when caller !== userId', async () => {
            await expect(markConversationReadAction('conv-1', 'user-b')).rejects.toThrow('Unauthorized');
        });
    });

    describe('getTotalUnreadCountAction', () => {
        it('sums unread counts across conversations', async () => {
            getCol('conversations')['c1'] = { participantIds: ['user-a'], unreadCount: { 'user-a': 3 } };
            getCol('conversations')['c2'] = { participantIds: ['user-a'], unreadCount: { 'user-a': 7 } };
            const total = await getTotalUnreadCountAction('user-a');
            expect(total).toBe(10);
        });

        it('returns 0 when no conversations', async () => {
            const total = await getTotalUnreadCountAction('user-a');
            expect(total).toBe(0);
        });

        it('throws when caller !== userId', async () => {
            await expect(getTotalUnreadCountAction('user-b')).rejects.toThrow('Unauthorized');
        });
    });

    describe('createGroupConversationAction', () => {
        it('creates a group conversation', async () => {
            const result = await createGroupConversationAction('user-a', ['user-a', 'user-b', 'user-c'], 'Math Teachers');
            expect(result.conversationId).toBeDefined();
        });

        it('rejects group with less than 2 members', async () => {
            await expect(createGroupConversationAction('user-a', ['user-a'], 'Solo')).rejects.toThrow('at least 2 members');
        });

        it('rejects group with more than 50 members', async () => {
            const uids = Array.from({ length: 51 }, (_, i) => `user-${i}`);
            await expect(createGroupConversationAction('user-a', uids, 'Huge')).rejects.toThrow('cannot exceed 50');
        });

        it('rejects empty group name', async () => {
            await expect(createGroupConversationAction('user-a', ['user-a', 'user-b'], '  ')).rejects.toThrow('Group name is required');
        });
    });
});
