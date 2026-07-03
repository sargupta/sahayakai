/**
 * Phase-1 security regression test — tranche 5 route boundary.
 *
 * Every /api/community/** route handler must reject requests that carry no
 * x-user-id header with 401 BEFORE touching Firestore. This catches the
 * class of bug where a future commit forgets the auth check.
 * (Migrated from src/__tests__/actions/community-auth.test.ts — the same
 * per-function assertions, now expressed at the API-route boundary.)
 *
 * Note: tests don't exercise full Firestore behaviour — only the auth gate.
 */

// Stub out everything below the auth gate so the tests don't need a real Firestore.
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => {
        throw new Error('should not reach Firestore — auth must reject first');
    },
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUsers: jest.fn(async () => { throw new Error('should not reach adapter — auth must reject first'); }),
        getUser:  jest.fn(async () => { throw new Error('should not reach adapter — auth must reject first'); }),
        getContent: jest.fn(async () => { throw new Error('should not reach adapter'); }),
        listContent: jest.fn(async () => { throw new Error('should not reach adapter'); }),
        saveContent: jest.fn(async () => {}),
        serialize: (x: any) => x,
    },
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(async () => {}),
}));

jest.mock('@/lib/pubsub', () => ({
    publishEvent: jest.fn(async () => {}),
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
    cachedPerUser: (fn: any, _opts: any) => fn,
    invalidateUserCache: jest.fn(),
}));

function makeRequest(opts: { userId?: string | null; body?: any; url?: string } = {}) {
    const headers = new Map<string, string>();
    if (opts.userId) headers.set('x-user-id', opts.userId);
    const url = new URL(opts.url ?? 'http://localhost/api/test');
    return {
        json: async () => opts.body ?? {},
        headers: { get: (key: string) => headers.get(key) ?? null },
        nextUrl: url,
    } as any;
}

// jest.setup.ts's Response polyfill can't surface NextResponse bodies, so we
// assert on status codes (the middleware/client contract) only.
const expect401 = async (res: Response) => {
    expect(res.status).toBe(401);
};

describe('/api/community/** — every route rejects when x-user-id is absent', () => {
    it('POST /api/community/profiles (getProfiles)', async () => {
        const { POST } = await import('@/app/api/community/profiles/route');
        await expect401(await POST(makeRequest({ body: { uids: ['x'] } })));
    });

    it('POST /api/community/posts (createPost)', async () => {
        const { POST } = await import('@/app/api/community/posts/route');
        await expect401(await POST(makeRequest({ body: { content: 'hello' } })));
    });

    it('GET /api/community/posts (getPosts)', async () => {
        const { GET } = await import('@/app/api/community/posts/route');
        await expect401(await GET(makeRequest()));
    });

    it('POST /api/community/posts/like (toggleLike)', async () => {
        const { POST } = await import('@/app/api/community/posts/like/route');
        await expect401(await POST(makeRequest({ body: { postId: 'post-1' } })));
    });

    it('POST /api/community/follows (followTeacher)', async () => {
        const { POST } = await import('@/app/api/community/follows/route');
        await expect401(await POST(makeRequest({ body: { followingId: 'target-uid' } })));
    });

    it('GET /api/community/follows (getFollowingIds)', async () => {
        const { GET } = await import('@/app/api/community/follows/route');
        await expect401(await GET(makeRequest()));
    });

    it('GET /api/community/follows/posts (getFollowingPosts)', async () => {
        const { GET } = await import('@/app/api/community/follows/posts/route');
        await expect401(await GET(makeRequest()));
    });

    it('GET /api/community/resources (getLibraryResources)', async () => {
        const { GET } = await import('@/app/api/community/resources/route');
        await expect401(await GET(makeRequest()));
    });

    it('POST /api/community/resources/download (trackDownload)', async () => {
        const { POST } = await import('@/app/api/community/resources/download/route');
        await expect401(await POST(makeRequest({ body: { resourceId: 'res-1' } })));
    });

    it('GET /api/community/teachers/recommended (getRecommendedTeachers)', async () => {
        const { GET } = await import('@/app/api/community/teachers/recommended/route');
        await expect401(await GET(makeRequest()));
    });

    it('GET /api/community/teachers (getAllTeachers)', async () => {
        const { GET } = await import('@/app/api/community/teachers/route');
        await expect401(await GET(makeRequest()));
    });

    it('POST /api/community/resources/like (likeResource)', async () => {
        const { POST } = await import('@/app/api/community/resources/like/route');
        await expect401(await POST(makeRequest({ body: { resourceId: 'res-1' } })));
    });

    it('POST /api/community/resources/save (saveResourceToLibrary)', async () => {
        const { POST } = await import('@/app/api/community/resources/save/route');
        await expect401(await POST(makeRequest({
            body: { resource: { id: 'r1', title: 't', type: 'lesson-plan', authorId: 'a1', language: 'en' } },
        })));
    });

    it('POST /api/community/resources/publish (publishContentToLibrary)', async () => {
        const { POST } = await import('@/app/api/community/resources/publish/route');
        await expect401(await POST(makeRequest({ body: { contentId: 'content-1' } })));
    });

    it('POST /api/community/resources/share-latest (shareLatestContent)', async () => {
        const { POST } = await import('@/app/api/community/resources/share-latest/route');
        await expect401(await POST(makeRequest({ body: { contentType: 'lesson-plan' } })));
    });

    it('POST /api/community/chat (sendChatMessage)', async () => {
        const { POST } = await import('@/app/api/community/chat/route');
        await expect401(await POST(makeRequest({ body: { text: 'hello' } })));
    });

    it('GET /api/community/likes (getLikedItemIds)', async () => {
        const { GET } = await import('@/app/api/community/likes/route');
        await expect401(await GET(makeRequest()));
    });
});

describe('GET /api/community/teachers/recommended — cross-user lookup is forbidden', () => {
    it('rejects with 403 when caller asks for another user\'s recommendations', async () => {
        const { GET } = await import('@/app/api/community/teachers/recommended/route');
        const res = await GET(makeRequest({
            userId: 'caller-uid',
            url: 'http://localhost/api/community/teachers/recommended?userId=different-uid',
        }));
        expect(res.status).toBe(403);
    });
});
