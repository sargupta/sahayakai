/**
 * Phase 3 — getLikedItemIdsAction hydration test.
 *
 * Verifies the collectionGroup query returns post IDs vs. resource IDs based
 * on the parent collection name (the only thing that distinguishes a group
 * post like from a library_resource like, since both use `likes/{uid}` docs).
 */

const mockHeadersMap = new Map<string, string>([['x-user-id', 'test-uid']]);
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

// Build mock like docs with the parent.parent.parent.id chain that the action inspects.
function makeLikeDoc(parentCollectionName: string, parentDocId: string) {
    return {
        ref: {
            parent: {
                parent: {
                    id: parentDocId,
                    parent: { id: parentCollectionName },
                },
            },
        },
    };
}

const mockSnapDocs: any[] = [];

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collectionGroup: () => ({
            where: () => ({
                limit: () => ({
                    get: async () => ({ docs: mockSnapDocs }),
                }),
            }),
        }),
    }),
}));

import { getLikedItemIdsAction } from '@/app/actions/community';

beforeEach(() => {
    mockSnapDocs.length = 0;
    mockHeadersMap.set('x-user-id', 'test-uid');
});

describe('getLikedItemIdsAction', () => {
    it('returns empty arrays when the user has liked nothing', async () => {
        const result = await getLikedItemIdsAction();
        expect(result).toEqual({ groupPostIds: [], resourceIds: [] });
    });

    it('classifies group post likes via parent collection name "posts"', async () => {
        mockSnapDocs.push(
            makeLikeDoc('posts', 'post-1'),
            makeLikeDoc('posts', 'post-2'),
        );
        const { groupPostIds, resourceIds } = await getLikedItemIdsAction();
        expect(groupPostIds).toEqual(['post-1', 'post-2']);
        expect(resourceIds).toEqual([]);
    });

    it('classifies resource likes via parent collection name "library_resources"', async () => {
        mockSnapDocs.push(
            makeLikeDoc('library_resources', 'res-1'),
            makeLikeDoc('library_resources', 'res-2'),
        );
        const { groupPostIds, resourceIds } = await getLikedItemIdsAction();
        expect(groupPostIds).toEqual([]);
        expect(resourceIds).toEqual(['res-1', 'res-2']);
    });

    it('handles a mix of post + resource likes', async () => {
        mockSnapDocs.push(
            makeLikeDoc('posts', 'post-A'),
            makeLikeDoc('library_resources', 'res-A'),
            makeLikeDoc('posts', 'post-B'),
        );
        const { groupPostIds, resourceIds } = await getLikedItemIdsAction();
        expect(groupPostIds).toEqual(['post-A', 'post-B']);
        expect(resourceIds).toEqual(['res-A']);
    });

    it('skips like docs from unknown parent collections', async () => {
        mockSnapDocs.push(makeLikeDoc('mystery_collection', 'x-1'));
        const { groupPostIds, resourceIds } = await getLikedItemIdsAction();
        expect(groupPostIds).toEqual([]);
        expect(resourceIds).toEqual([]);
    });

    it('throws Unauthorized when the caller is not signed in', async () => {
        mockHeadersMap.delete('x-user-id');
        await expect(getLikedItemIdsAction()).rejects.toThrow('Unauthorized');
    });
});
