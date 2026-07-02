/**
 * F10 — Community + Social P0/P1/P2 fixes.
 *
 * Covers:
 *  - F10-02 getPublicProfileAction email gating (self / admin / connected only)
 *  - F10-03 sendChatMessageAction audioUrl host/protocol/length validation
 *  - F10-04 followTeacherAction self-follow rejection
 *  - F10-05 toggleLikeAction + likeResourceAction self-like rejection
 *
 * Forensic ref: qa/forensics/F10-community.md
 */

const mockHeadersMap = new Map<string, string>([['x-user-id', 'viewer-uid']]);
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

// ── shared firestore mock plumbing ───────────────────────────────────────────

// Per-collection doc-store; tests can prime it.
const docStore = new Map<string, any>(); // key: `${collection}/${docId}`

function makeDocRef(collection: string, docId: string) {
    const key = `${collection}/${docId}`;
    return {
        get: async () => {
            const data = docStore.get(key);
            return {
                exists: data !== undefined,
                data: () => data,
                id: docId,
            };
        },
        set: async (data: any) => { docStore.set(key, data); },
        update: async (_data: any) => { /* not asserted here */ },
        delete: async () => { docStore.delete(key); },
        collection: (sub: string) => ({
            doc: (subId: string) => makeDocRef(`${collection}/${docId}/${sub}`, subId),
        }),
    };
}

const addedChatMessages: any[] = [];

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (name: string) => ({
            doc: (id: string) => makeDocRef(name, id),
            add: async (data: any) => {
                if (name === 'community_chat') addedChatMessages.push(data);
                return { id: 'new-msg-id' };
            },
        }),
    }),
}));

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => 'SERVER_TS',
        increment: (n: number) => ({ __increment: n }),
        arrayUnion: (...args: any[]) => ({ __arrayUnion: args }),
    },
}));

const mockGetUser = jest.fn();
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: (uid: string) => mockGetUser(uid),
        serialize: (x: any) => x,
    },
}));

const mockGetCerts = jest.fn(async () => []);
jest.mock('@/lib/services/certification-service', () => ({
    certificationService: {
        getCertificationsByUser: (uid: string) => mockGetCerts(uid),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockIsAdmin = jest.fn(async () => false);
jest.mock('@/lib/auth-utils', () => ({
    validateAdmin: jest.fn(),
    isAdmin: (uid: string) => mockIsAdmin(uid),
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(async () => {}),
}));

jest.mock('@/lib/ai-reactive-trigger', () => ({
    triggerAIReactiveReply: jest.fn(),
}));

jest.mock('@/lib/aggregator', () => ({
    aggregateUserMetrics: jest.fn(async () => {}),
}));

jest.mock('@/lib/notifications/create', () => ({
    createNotification: jest.fn(async () => {}),
    createTypedNotification: jest.fn(async () => {}),
}));

jest.mock('@/lib/server-cache', () => ({
    cachedPerUser: jest.fn((_k: any, fn: any) => fn),
    invalidateUserCache: jest.fn(),
}));

jest.mock('@/lib/pubsub', () => ({
    publishEvent: jest.fn(async () => {}),
}));

jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

import { getPublicProfileAction } from '@/app/actions/profile';
import {
    sendChatMessageAction,
    followTeacherAction,
    toggleLikeAction,
    likeResourceAction,
} from '@/app/actions/community';

beforeEach(() => {
    jest.clearAllMocks();
    docStore.clear();
    addedChatMessages.length = 0;
    mockHeadersMap.set('x-user-id', 'viewer-uid');
    mockIsAdmin.mockResolvedValue(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// F10-02 — public profile email gating
// ─────────────────────────────────────────────────────────────────────────────

describe('F10-02 getPublicProfileAction email gating', () => {
    const target = {
        id: 'target-uid',
        displayName: 'Anjali',
        email: 'anjali@example.com',
        state: 'Karnataka',
    };

    it('non-connected viewer does NOT receive email', async () => {
        mockHeadersMap.set('x-user-id', 'viewer-uid');
        mockGetUser.mockResolvedValue(target);
        const result = await getPublicProfileAction('target-uid');
        expect(result.profile).not.toHaveProperty('email');
        expect(result.profile).toMatchObject({ id: 'target-uid', displayName: 'Anjali' });
    });

    it('connected viewer DOES receive email', async () => {
        mockHeadersMap.set('x-user-id', 'viewer-uid');
        // Pair id is sorted([viewer-uid, target-uid]).join('_')
        const pairId = ['viewer-uid', 'target-uid'].sort().join('_');
        docStore.set(`connections/${pairId}`, { acceptedAt: 'x' });
        mockGetUser.mockResolvedValue(target);
        const result = await getPublicProfileAction('target-uid');
        expect(result.profile).toHaveProperty('email', 'anjali@example.com');
    });

    it('self viewer DOES receive email', async () => {
        mockHeadersMap.set('x-user-id', 'target-uid');
        mockGetUser.mockResolvedValue(target);
        const result = await getPublicProfileAction('target-uid');
        expect(result.profile).toHaveProperty('email', 'anjali@example.com');
    });

    it('admin viewer DOES receive email', async () => {
        mockHeadersMap.set('x-user-id', 'admin-uid');
        mockIsAdmin.mockResolvedValue(true);
        mockGetUser.mockResolvedValue(target);
        const result = await getPublicProfileAction('target-uid');
        expect(result.profile).toHaveProperty('email', 'anjali@example.com');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// F10-03 — community chat audioUrl validation
// ─────────────────────────────────────────────────────────────────────────────

describe('F10-03 sendChatMessageAction audioUrl validation', () => {
    beforeEach(() => {
        mockHeadersMap.set('x-user-id', 'author-uid');
        docStore.set('users/author-uid', { displayName: 'Author', photoURL: null });
    });

    it('rejects tracking-pixel http URL', async () => {
        await expect(
            sendChatMessageAction('hi', 'http://evil.com/track.mp3?u=victim'),
        ).rejects.toThrow(/Invalid audio URL/);
    });

    it('rejects non-firebasestorage https host', async () => {
        await expect(
            sendChatMessageAction('hi', 'https://evil.com/track.mp3'),
        ).rejects.toThrow(/Invalid audio URL/);
    });

    it('rejects audioUrl longer than 1024 chars', async () => {
        const long = 'https://firebasestorage.googleapis.com/' + 'a'.repeat(1100);
        await expect(sendChatMessageAction('hi', long)).rejects.toThrow(/Invalid audio URL/);
    });

    it('accepts a valid firebasestorage https URL', async () => {
        await expect(
            sendChatMessageAction(
                '',
                'https://firebasestorage.googleapis.com/v0/b/x/o/y.webm?alt=media',
            ),
        ).resolves.toBeUndefined();
        expect(addedChatMessages).toHaveLength(1);
        expect(addedChatMessages[0].audioUrl).toMatch(/^https:\/\/firebasestorage\.googleapis\.com/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// F10-04 — self-follow rejection
// ─────────────────────────────────────────────────────────────────────────────

describe('F10-04 followTeacherAction self-follow', () => {
    it('rejects when followingId === callerUid', async () => {
        mockHeadersMap.set('x-user-id', 'me-uid');
        await expect(followTeacherAction('me-uid')).rejects.toThrow(/Cannot follow yourself/);
    });

    it('allows following another teacher', async () => {
        mockHeadersMap.set('x-user-id', 'me-uid');
        docStore.set('users/me-uid', { displayName: 'Me' });
        await expect(followTeacherAction('other-uid')).resolves.toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// F10-05 — self-like rejection
// ─────────────────────────────────────────────────────────────────────────────

describe('F10-05 toggleLikeAction self-like (posts)', () => {
    it('rejects when post.authorId === callerUid', async () => {
        mockHeadersMap.set('x-user-id', 'me-uid');
        docStore.set('posts/my-post', { authorId: 'me-uid', text: 'hi' });
        await expect(toggleLikeAction('my-post')).rejects.toThrow(/Cannot like your own post/);
    });

    it('allows liking another teacher’s post', async () => {
        mockHeadersMap.set('x-user-id', 'me-uid');
        docStore.set('posts/other-post', { authorId: 'other-uid', text: 'hi' });
        await expect(toggleLikeAction('other-post')).resolves.toBeUndefined();
    });
});

describe('F10-05 likeResourceAction self-like (resources)', () => {
    it('rejects when resource.authorId === callerUid', async () => {
        mockHeadersMap.set('x-user-id', 'me-uid');
        docStore.set('library_resources/my-res', { authorId: 'me-uid', title: 'mine' });
        await expect(likeResourceAction('my-res')).rejects.toThrow(/Cannot like your own resource/);
    });
});
