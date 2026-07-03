/**
 * Tranche 5 route-boundary auth gate — /api/groups/**.
 *
 * Every groups route handler must reject requests that carry no x-user-id
 * header with 401 BEFORE touching Firestore.
 */

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => {
        throw new Error('should not reach Firestore — auth must reject first');
    },
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: jest.fn(async () => { throw new Error('should not reach adapter'); }),
        serialize: (x: any) => x,
    },
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(async () => {}),
}));

jest.mock('@/lib/notifications/create', () => ({
    createNotification: jest.fn(async () => {}),
    createTypedNotification: jest.fn(async () => {}),
}));

jest.mock('@/lib/fcm-server', () => ({
    sendPushToUser: jest.fn(async () => {}),
}));

jest.mock('@/lib/ai-reactive-trigger', () => ({
    triggerAIReactiveReply: jest.fn(),
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

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as any;

// jest.setup.ts's Response polyfill can't surface NextResponse bodies, so we
// assert on status codes (the middleware/client contract) only.
const expect401 = async (res: Response) => {
    expect(res.status).toBe(401);
};

describe('/api/groups/** — every route rejects when x-user-id is absent', () => {
    it('GET /api/groups (getMyGroups)', async () => {
        const { GET } = await import('@/app/api/groups/route');
        await expect401(await GET(makeRequest()));
    });

    it('POST /api/groups/ensure (ensureUserGroups)', async () => {
        const { POST } = await import('@/app/api/groups/ensure/route');
        await expect401(await POST(makeRequest()));
    });

    it('GET /api/groups/discover (discoverGroups)', async () => {
        const { GET } = await import('@/app/api/groups/discover/route');
        await expect401(await GET(makeRequest()));
    });

    it('GET /api/groups/feed (getUnifiedFeed)', async () => {
        const { GET } = await import('@/app/api/groups/feed/route');
        await expect401(await GET(makeRequest()));
    });

    it('GET /api/groups/[groupId] (getGroup)', async () => {
        const { GET } = await import('@/app/api/groups/[groupId]/route');
        await expect401(await GET(makeRequest(), ctx({ groupId: 'g1' })));
    });

    it('POST /api/groups/[groupId]/membership (joinGroup)', async () => {
        const { POST } = await import('@/app/api/groups/[groupId]/membership/route');
        await expect401(await POST(makeRequest(), ctx({ groupId: 'g1' })));
    });

    it('DELETE /api/groups/[groupId]/membership (leaveGroup)', async () => {
        const { DELETE } = await import('@/app/api/groups/[groupId]/membership/route');
        await expect401(await DELETE(makeRequest(), ctx({ groupId: 'g1' })));
    });

    it('GET /api/groups/[groupId]/posts (getGroupPosts)', async () => {
        const { GET } = await import('@/app/api/groups/[groupId]/posts/route');
        await expect401(await GET(makeRequest(), ctx({ groupId: 'g1' })));
    });

    it('POST /api/groups/[groupId]/posts (createGroupPost)', async () => {
        const { POST } = await import('@/app/api/groups/[groupId]/posts/route');
        await expect401(await POST(
            makeRequest({ body: { content: 'hi', postType: 'share' } }),
            ctx({ groupId: 'g1' }),
        ));
    });

    it('POST /api/groups/[groupId]/posts/[postId]/like (likeGroupPost)', async () => {
        const { POST } = await import('@/app/api/groups/[groupId]/posts/[postId]/like/route');
        await expect401(await POST(makeRequest(), ctx({ groupId: 'g1', postId: 'p1' })));
    });

    it('POST /api/groups/[groupId]/chat (sendGroupChatMessage)', async () => {
        const { POST } = await import('@/app/api/groups/[groupId]/chat/route');
        await expect401(await POST(
            makeRequest({ body: { text: 'hello' } }),
            ctx({ groupId: 'g1' }),
        ));
    });
});
