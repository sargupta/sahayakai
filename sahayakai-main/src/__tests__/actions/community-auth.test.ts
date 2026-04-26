/**
 * Phase-1 security regression test.
 *
 * Every exported action in src/app/actions/community.ts must reject calls
 * that have no x-user-id header. This catches the class of bug where a future
 * commit forgets the requireAuth() call.
 *
 * Note: tests don't exercise full Firestore behaviour — only the auth gate.
 */

const mockHeadersMap = new Map<string, string>();
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

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

jest.mock('@/app/actions/aggregator', () => ({
    aggregateUserMetrics: jest.fn(async () => {}),
}));

jest.mock('@/app/actions/notifications', () => ({
    createNotification: jest.fn(async () => {}),
}));

import * as community from '@/app/actions/community';

beforeEach(() => {
    mockHeadersMap.clear();
});

const expectUnauthorized = (call: () => Promise<unknown>) =>
    expect(call()).rejects.toThrow(/Unauthorized/i);

describe('community.ts — every action rejects when x-user-id is absent', () => {
    it('getProfilesAction', () => expectUnauthorized(() => community.getProfilesAction(['x'])));

    it('createPostAction', () => expectUnauthorized(() => community.createPostAction('hello')));

    it('toggleLikeAction', () => expectUnauthorized(() => community.toggleLikeAction('post-1')));

    it('getPosts', () => expectUnauthorized(() => community.getPosts({})));

    it('followTeacherAction', () => expectUnauthorized(() => community.followTeacherAction('target-uid')));

    it('getFollowingIdsAction', () => expectUnauthorized(() => community.getFollowingIdsAction()));

    it('getFollowingPosts', () => expectUnauthorized(() => community.getFollowingPosts()));

    it('getLibraryResources', () => expectUnauthorized(() => community.getLibraryResources()));

    it('trackDownloadAction', () => expectUnauthorized(() => community.trackDownloadAction('res-1')));

    it('getRecommendedTeachersAction', () => expectUnauthorized(() => community.getRecommendedTeachersAction()));

    it('getAllTeachersAction', () => expectUnauthorized(() => community.getAllTeachersAction()));

    it('likeResourceAction', () => expectUnauthorized(() => community.likeResourceAction('res-1')));

    it('saveResourceToLibraryAction', () =>
        expectUnauthorized(() => community.saveResourceToLibraryAction({
            id: 'r1', title: 't', type: 'lesson-plan', authorId: 'a1', language: 'en',
        })));

    it('publishContentToLibraryAction', () =>
        expectUnauthorized(() => community.publishContentToLibraryAction('content-1')));

    it('shareLatestContentAction', () =>
        expectUnauthorized(() => community.shareLatestContentAction('lesson-plan')));

    it('sendChatMessageAction', () =>
        expectUnauthorized(() => community.sendChatMessageAction('hello')));
});

describe('getRecommendedTeachersAction — cross-user lookup is forbidden', () => {
    it('rejects when caller asks for another user\'s recommendations', async () => {
        mockHeadersMap.set('x-user-id', 'caller-uid');
        await expect(community.getRecommendedTeachersAction('different-uid'))
            .rejects.toThrow(/Forbidden/i);
    });
});
