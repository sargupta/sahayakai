/**
 * F6-09 verification: markConversationReadAction must clear ALL unread
 * message-notifications for the conversation, even when the user has >200
 * unread notifications in their inbox.
 *
 * Previously: a hard `.limit(200)` without orderBy meant the relevant doc
 * might never appear in the scan, so the Bell badge stayed pinned forever.
 * Fix: cursor-based pagination over (recipientId + isRead==false).
 */

const mockHeadersMap = new Map<string, string>([['x-user-id', 'user-a']]);
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

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
        // Stubs for conversations / messages — markConversationReadAction
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

import { markConversationReadAction } from '@/app/actions/messages';

describe('markConversationReadAction F6-09: clears badge with >200 unread', () => {
    beforeEach(() => {
        notifs.length = 0;
        updates.length = 0;
        mockHeadersMap.set('x-user-id', 'user-a');
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

        await markConversationReadAction('conv-X', 'user-a');

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

        await markConversationReadAction('conv-Y', 'user-a');
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
        await markConversationReadAction('conv-nope', 'user-a');
        expect(updates).toHaveLength(0);
    });
});
