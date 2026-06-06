/**
 * Notification fanout tests for createGroupPostAction and likeGroupPostAction.
 * Covers: NEW_GROUP_POST fanout, recipient cap, author-skip, like-self-skip,
 * 1-hour dedup, and per-recipient i18n via preferredLanguage.
 */

// ── Mock: next/headers ──────────────────────────────────────────────────────

const mockHeadersMap = new Map<string, string>([['x-user-id', 'author-uid']]);
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

// ── Mock: server-safety (rate-limit) ────────────────────────────────────────

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(async () => undefined),
}));

// ── Mock: firebase-admin (in-memory) ────────────────────────────────────────

const store: Record<string, Record<string, any>> = {};

function getCol(path: string) {
    if (!store[path]) store[path] = {};
    return store[path];
}

const mockFieldValue = {
    serverTimestamp: () => 'SERVER_TS',
    increment: (n: number) => ({ __increment: n }),
    arrayUnion: (...vals: any[]) => ({ __arrayUnion: vals }),
    arrayRemove: (...vals: any[]) => ({ __arrayRemove: vals }),
};

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: mockFieldValue,
}));

// Each `notifications` write tracked so we can assert recipients/messages.
interface NotifWrite {
    recipientId: string;
    type: string;
    title: string;
    message: string;
    senderId?: string;
    senderName?: string;
    metadata?: Record<string, string>;
    link?: string;
}
const notifWrites: NotifWrite[] = [];

function makeMockDb() {
    type WhereClause = { field: string; op: string; value: any };
    type QueryState = { wheres: WhereClause[]; lim?: number };
    const collection = (colName: string) => {
        const buildQuery = (state: QueryState): any => ({
            where: (field: string, op: string, value: any) =>
                buildQuery({ ...state, wheres: [...state.wheres, { field, op, value }] }),
            orderBy: () => buildQuery(state),
            limit: (n: number) => buildQuery({ ...state, lim: n }),
            startAfter: () => buildQuery(state),
            get: jest.fn(async () => {
                const entries = Object.entries(getCol(colName));
                let filtered = entries;
                for (const w of state.wheres) {
                    if (w.field === '__name__' && w.op === 'in') {
                        const ids = w.value as string[];
                        filtered = filtered.filter(([id]) => ids.includes(id));
                    } else {
                        filtered = filtered.filter(([, data]: any) => {
                            // Resolve dotted paths like 'metadata.postId' so the
                            // post-scoped GROUP_POST_LIKE dedup query works (F6-08).
                            const dv = w.field.includes('.')
                                ? w.field.split('.').reduce(
                                    (acc: any, k: string) => (acc == null ? acc : acc[k]),
                                    data,
                                )
                                : (data as any)?.[w.field];
                            switch (w.op) {
                                case '==':
                                    return dv === w.value;
                                case '<':
                                    return dv < w.value;
                                default:
                                    return true;
                            }
                        });
                    }
                }
                if (state.lim != null) filtered = filtered.slice(0, state.lim);
                return {
                    empty: filtered.length === 0,
                    docs: filtered.map(([docId, data]) => ({
                        id: docId,
                        data: () => data,
                    })),
                };
            }),
        });

        return {
            doc: (id: string) => ({
                id,
                __colPath: colName,
                __docId: id,
                get: jest.fn(async () => {
                    const data = getCol(colName)[id];
                    return { exists: !!data, data: () => data, id };
                }),
                set: jest.fn(async (data: any) => { getCol(colName)[id] = data; }),
                update: jest.fn(async (data: any) => {
                    getCol(colName)[id] = { ...getCol(colName)[id], ...data };
                }),
                delete: jest.fn(async () => { delete getCol(colName)[id]; }),
                create: jest.fn(async (data: any) => {
                    if (getCol(colName)[id]) throw new Error('Document already exists');
                    getCol(colName)[id] = data;
                }),
                collection: (subCol: string) => collection(`${colName}/${id}/${subCol}`),
            }),
            ...buildQuery({ wheres: [] }),
            add: jest.fn(async (data: any) => {
                const docId = `auto_${Object.keys(getCol(colName)).length + 1}`;
                getCol(colName)[docId] = data;
                if (colName === 'notifications') {
                    notifWrites.push({
                        recipientId: data.recipientId,
                        type: data.type,
                        title: data.title,
                        message: data.message,
                        senderId: data.senderId,
                        senderName: data.senderName,
                        metadata: data.metadata,
                        link: data.link,
                    });
                }
                return { id: docId };
            }),
        };
    };

    return {
        collection,
        runTransaction: jest.fn(async (fn: any) => {
            const tx = {
                get: jest.fn(async (ref: any) => {
                    const data = getCol(ref.__colPath)[ref.__docId];
                    return { exists: !!data, data: () => data };
                }),
                set: jest.fn((ref: any, data: any) => {
                    getCol(ref.__colPath)[ref.__docId] = data;
                }),
                update: jest.fn((ref: any, data: any) => {
                    getCol(ref.__colPath)[ref.__docId] = {
                        ...getCol(ref.__colPath)[ref.__docId],
                        ...data,
                    };
                }),
                delete: jest.fn((ref: any) => {
                    delete getCol(ref.__colPath)[ref.__docId];
                }),
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

// ── Mock: db adapter (groups.ts uses getUser for author display name) ────────

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        serialize: jest.fn((data: any) => data),
        getUser: jest.fn(async (uid: string) => ({
            uid,
            displayName: uid === 'author-uid' ? 'Anjali' : 'Other Teacher',
            photoURL: null,
        })),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── Import under test ───────────────────────────────────────────────────────

import {
    createGroupPostAction,
    likeGroupPostAction,
    fanoutGroupPostNotifications,
    notifyGroupPostLike,
} from '@/app/actions/groups';

// ── Helpers ─────────────────────────────────────────────────────────────────

function seedGroup(groupId: string, name = 'Maths Grade 10') {
    getCol('groups')[groupId] = {
        name,
        type: 'subject_grade',
        memberCount: 0,
    };
}

function seedMember(groupId: string, uid: string) {
    getCol(`groups/${groupId}/members`)[uid] = { joinedAt: '2026-01-01', role: 'member' };
}

function seedUser(uid: string, opts: { displayName?: string; preferredLanguage?: string } = {}) {
    getCol('users')[uid] = {
        uid,
        displayName: opts.displayName ?? `User ${uid}`,
        preferredLanguage: opts.preferredLanguage,
    };
}

function seedPost(groupId: string, postId: string, authorUid: string) {
    getCol(`groups/${groupId}/posts`)[postId] = {
        groupId,
        authorUid,
        authorName: 'Anjali',
        content: 'Hello',
        postType: 'share',
        attachments: [],
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
    };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('group notification fanout', () => {
    beforeEach(() => {
        Object.keys(store).forEach((k) => delete store[k]);
        notifWrites.length = 0;
        mockHeadersMap.set('x-user-id', 'author-uid');
    });

    describe('createGroupPostAction → NEW_GROUP_POST fanout', () => {
        it('writes one notification per member, skipping the author, with localized message per recipient', async () => {
            const groupId = 'maths_g10_cbse';
            seedGroup(groupId, 'Maths Grade 10');
            // Author + 3 members. Author should be excluded.
            seedMember(groupId, 'author-uid');
            seedMember(groupId, 'r1');
            seedMember(groupId, 'r2');
            seedMember(groupId, 'r3');
            seedUser('r1', { preferredLanguage: 'Hindi' });
            seedUser('r2', { preferredLanguage: 'Tamil' });
            seedUser('r3', { /* missing language → English fallback */ });

            await createGroupPostAction(groupId, 'Hello class', 'share');

            // Wait a tick for the fire-and-forget fanout to complete.
            await new Promise((r) => setTimeout(r, 0));

            const fanoutWrites = notifWrites.filter((n) => n.type === 'NEW_GROUP_POST');
            expect(fanoutWrites).toHaveLength(3);
            expect(fanoutWrites.map((n) => n.recipientId).sort()).toEqual(['r1', 'r2', 'r3']);
            // Author never receives their own fanout
            expect(fanoutWrites.find((n) => n.recipientId === 'author-uid')).toBeUndefined();

            const r1 = fanoutWrites.find((n) => n.recipientId === 'r1')!;
            const r2 = fanoutWrites.find((n) => n.recipientId === 'r2')!;
            const r3 = fanoutWrites.find((n) => n.recipientId === 'r3')!;
            // Hindi
            expect(r1.message).toContain('ने');
            expect(r1.message).toContain('Anjali');
            expect(r1.message).toContain('Maths Grade 10');
            // Tamil
            expect(r2.message).toContain('Anjali');
            expect(r2.message).toContain('இல்');
            // English fallback
            expect(r3.message).toBe('Anjali posted in Maths Grade 10');

            // metadata + link shape
            expect(r1.metadata).toMatchObject({ groupId, authorUid: 'author-uid' });
            expect(r1.link).toMatch(/^\/groups\/maths_g10_cbse\?post=/);
        });

        it('caps fanout at 200 recipients and flags `capped`', async () => {
            const groupId = 'community_general';
            seedGroup(groupId, 'Community');
            // Seed 250 non-author members first so the `limit(CAP+1=201)`
            // window contains 201 non-author IDs (cap-overflow path).
            for (let i = 0; i < 250; i++) {
                seedMember(groupId, `m${i}`);
            }
            seedMember(groupId, 'author-uid');

            const result = await fanoutGroupPostNotifications({
                groupId,
                postId: 'post-1',
                authorUid: 'author-uid',
                authorName: 'Anjali',
            });

            expect(result.capped).toBe(true);
            expect(result.recipients).toBe(200);
            expect(notifWrites.filter((n) => n.type === 'NEW_GROUP_POST')).toHaveLength(200);
        });

        it('returns zero recipients when the group is missing', async () => {
            const result = await fanoutGroupPostNotifications({
                groupId: 'nonexistent',
                postId: 'p1',
                authorUid: 'author-uid',
                authorName: 'Anjali',
            });

            expect(result).toEqual({ recipients: 0, capped: false });
            expect(notifWrites).toHaveLength(0);
        });
    });

    describe('likeGroupPostAction → GROUP_POST_LIKE notification', () => {
        it('notifies the post author when a different user likes', async () => {
            const groupId = 'g1';
            const postId = 'p1';
            seedGroup(groupId);
            seedMember(groupId, 'author-uid');
            seedMember(groupId, 'liker-uid');
            seedPost(groupId, postId, 'author-uid');
            seedUser('liker-uid', { displayName: 'Ravi', preferredLanguage: 'English' });
            seedUser('author-uid', { displayName: 'Anjali', preferredLanguage: 'Hindi' });

            mockHeadersMap.set('x-user-id', 'liker-uid');
            await likeGroupPostAction(groupId, postId);
            await new Promise((r) => setTimeout(r, 0));

            const likes = notifWrites.filter((n) => n.type === 'GROUP_POST_LIKE');
            expect(likes).toHaveLength(1);
            expect(likes[0].recipientId).toBe('author-uid');
            // Hindi message for author
            expect(likes[0].message).toContain('Ravi');
            expect(likes[0].message).toContain('पसंद');
            expect(likes[0].metadata).toMatchObject({ groupId, postId, likerUid: 'liker-uid' });
        });

        it('does NOT notify when the liker is the post author (self-like)', async () => {
            const result = await notifyGroupPostLike({
                groupId: 'g1',
                postId: 'p1',
                postAuthorUid: 'author-uid',
                likerUid: 'author-uid',
            });
            expect(result).toEqual({ sent: false, reason: 'self' });
            expect(notifWrites).toHaveLength(0);
        });

        it('dedups a second like notification on the same post within 1 hour', async () => {
            seedUser('liker-uid', { displayName: 'Ravi' });
            seedUser('author-uid', { displayName: 'Anjali' });

            const first = await notifyGroupPostLike({
                groupId: 'g1',
                postId: 'p1',
                postAuthorUid: 'author-uid',
                likerUid: 'liker-uid',
            });
            expect(first).toEqual({ sent: true });
            // Stamp recorded createdAt on the persisted doc so the dedup
            // probe sees a recent timestamp (the in-memory store doesn't run
            // server-side createdAt resolution).
            for (const [docId, data] of Object.entries(getCol('notifications'))) {
                if ((data as any).type === 'GROUP_POST_LIKE') {
                    (getCol('notifications')[docId] as any).createdAt = new Date().toISOString();
                }
            }
            // Different liker, same post — still suppressed because the
            // dedup is by recipient+postId+window (1 hour). This matches
            // the "don't pile-on the author's inbox" semantics.
            const second = await notifyGroupPostLike({
                groupId: 'g1',
                postId: 'p1',
                postAuthorUid: 'author-uid',
                likerUid: 'liker-2',
            });
            expect(second).toEqual({ sent: false, reason: 'deduped' });
            expect(notifWrites.filter((n) => n.type === 'GROUP_POST_LIKE')).toHaveLength(1);
        });
    });
});
