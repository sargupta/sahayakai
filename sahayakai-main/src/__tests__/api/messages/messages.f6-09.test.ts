/**
 * F6-09 verification (migrated from src/__tests__/actions/messages.f6-09.test.ts,
 * now targeting POST /api/messages/mark-read): marking a conversation read must
 * clear ALL unread message-notifications for the conversation, even when the
 * user has >200 unread notifications in their inbox.
 *
 * Previously: a hard `.limit(200)` without orderBy meant the relevant doc
 * might never appear in the scan, so the Bell badge stayed pinned forever.
 * Fix: cursor-based pagination over (recipientId + isRead==false).
 */

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { arrayUnion: (...vals: any[]) => ({ __arrayUnion: vals }) },
}));

// ── In-memory notifications collection with proper paging ───────────────────
// Each notification is { recipientId, isRead, metadata?, link? }.
type NotifDoc = {
    id: string;
    recipientId: string;
    isRead: boolean;
    metadata?: Record<string, any>;
    link?: string;
};
const notifs: NotifDoc[] = [];
const updates: { id: string; patch: any }[] = [];

function notificationsQuery() {
    const state: { recipientId?: string; isReadEq?: boolean; ordered?: boolean; startAfterId?: string; lim?: number } = {};
    const chain: any = {
        where(field: string, op: string, value: any) {
            if (field === 'recipientId' && op === '==') state.recipientId = value;
            if (field === 'isRead' && op === '==') state.isReadEq = value;
            return chain;
        },
        orderBy(_field: string) { state.ordered = true; return chain; },
        limit(n: number) { state.lim = n; return chain; },
        startAfter(cursor: any) { state.startAfterId = cursor?.id; return chain; },
        async get() {
            let filtered = notifs.filter(n =>
                (state.recipientId == null || n.recipientId === state.recipientId) &&
                (state.isReadEq == null || n.isRead === state.isReadEq),
            );
            if (state.ordered) filtered = [...filtered].sort((a, b) => a.id.localeCompare(b.id));
            if (state.startAfterId) {
                const i = filtered.findIndex(d => d.id === state.startAfterId);
                if (i >= 0) filtered = filtered.slice(i + 1);
            }
            if (state.lim != null) filtered = filtered.slice(0, state.lim);
            return {
                empty: filtered.length === 0,
                size: filtered.length,
                docs: filtered.map(d => ({
                    id: d.id,
                    data: () => ({ ...d }),
                    ref: { id: d.id },
                })),
            };
        },
    };
    return chain;
}

const fakeDb: any = {
    collection(name: string) {
        if (name === 'notifications') {
            return {
                ...notificationsQuery(),
                doc: () => ({ id: 'unused' }),
            };
        }
        // Stubs for conversations / messages — markConversationRead
        // also updates the conv unreadCount and stamps readBy on messages.
        if (name === 'conversations') {
            return {
                doc: (_id: string) => ({
                    // F2-02: participant check reads the conversation doc first.
                    get: async () => ({
                        exists: true,
                        data: () => ({ participantIds: ['user-a', 'user-b'] }),
                    }),
                    update: async () => {},
                    collection: () => ({
                        orderBy: () => ({
                            limit: () => ({
                                get: async () => ({ empty: true, docs: [] }),
                            }),
                        }),
                    }),
                }),
            };
        }
        throw new Error('Unexpected collection: ' + name);
    },
    batch: () => ({
        update: (ref: any, patch: any) => updates.push({ id: ref.id, patch }),
        commit: async () => {},
    }),
};

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => fakeDb,
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { serialize: (x: any) => x },
}));

jest.mock('@/lib/notifications/create', () => ({
    createNotification: async () => {},
    createTypedNotification: async () => {},
}));

jest.mock('@/lib/fcm-server', () => ({
    sendPushToUser: async () => {},
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { POST as markReadPOST } from '@/app/api/messages/mark-read/route';

// jest.setup.ts polyfills `Request` without header/body support, so route
// tests use plain mock request objects (same convention as the other suites
// in src/__tests__/api/).
function markReadRequest(conversationId: string, userId: string, headerUid: string | null = 'user-a'): Request {
    const headers = new Map<string, string>();
    if (headerUid) headers.set('x-user-id', headerUid);
    return {
        url: 'http://localhost:3000/api/messages/mark-read',
        method: 'POST',
        json: async () => ({ conversationId, userId }),
        headers: { get: (k: string) => headers.get(k) ?? null },
    } as unknown as Request;
}

describe('POST /api/messages/mark-read F6-09: clears badge with >200 unread', () => {
    beforeEach(() => {
        notifs.length = 0;
        updates.length = 0;
    });

    it('clears a matching notification even when it is the 600th unread doc', async () => {
        // 599 unread that do NOT match the conversation.
        for (let i = 0; i < 599; i++) {
            notifs.push({
                id: `noise-${String(i).padStart(4, '0')}`,
                recipientId: 'user-a',
                isRead: false,
            });
        }
        // The relevant message notification — placed at the END of the id
        // sort order so the previous `.limit(200)` definitely missed it.
        notifs.push({
            id: 'zzz-target',
            recipientId: 'user-a',
            isRead: false,
            metadata: { conversationId: 'conv-X' },
        });

        const res = await markReadPOST(markReadRequest('conv-X', 'user-a'));
        expect(res.status).toBe(200);

        // Exactly one update — the target notification got marked read.
        expect(updates).toHaveLength(1);
        expect(updates[0].id).toBe('zzz-target');
        expect(updates[0].patch).toEqual({ isRead: true });
    });

    it('clears via link-needle match (metadata.conversationId absent)', async () => {
        for (let i = 0; i < 300; i++) {
            notifs.push({
                id: `n-${String(i).padStart(4, '0')}`,
                recipientId: 'user-a',
                isRead: false,
            });
        }
        notifs.push({
            id: 'zz-link-target',
            recipientId: 'user-a',
            isRead: false,
            link: '/messages?open=conv-Y',
        });

        const res = await markReadPOST(markReadRequest('conv-Y', 'user-a'));
        expect(res.status).toBe(200);
        expect(updates.map(u => u.id)).toContain('zz-link-target');
    });

    it('is a no-op when nothing matches', async () => {
        for (let i = 0; i < 50; i++) {
            notifs.push({
                id: `n-${i}`,
                recipientId: 'user-a',
                isRead: false,
            });
        }
        const res = await markReadPOST(markReadRequest('conv-nope', 'user-a'));
        expect(res.status).toBe(200);
        expect(updates).toHaveLength(0);
    });

    it('returns 401 when x-user-id header is missing', async () => {
        const res = await markReadPOST(new Request('http://localhost:3000/api/messages/mark-read', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ conversationId: 'conv-X', userId: 'user-a' }),
        }));
        expect(res.status).toBe(401);
        expect(updates).toHaveLength(0);
    });
});
