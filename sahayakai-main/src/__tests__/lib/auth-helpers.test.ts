/**
 * Unit tests for src/lib/auth-helpers.ts
 *
 * Covers requireAuth, isGroupMember, requireGroupMember.
 * Mocks next/headers and firebase-admin so the helper can be exercised in isolation.
 */

// ── Mock: next/headers ──────────────────────────────────────────────────────

const mockHeadersMap = new Map<string, string>();
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

// ── Mock: firebase-admin (in-memory) ────────────────────────────────────────

const memberStore: Record<string, boolean> = {}; // key: `${groupId}/${uid}`

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (col: string) => ({
            doc: (groupId: string) => ({
                collection: (sub: string) => ({
                    doc: (uid: string) => ({
                        get: async () => {
                            const key = `${groupId}/${uid}`;
                            return { exists: !!memberStore[key] };
                        },
                    }),
                }),
            }),
        }),
    }),
}));

import {
    requireAuth,
    isGroupMember,
    requireGroupMember,
    UnauthorizedError,
    ForbiddenError,
    getAuthUserIdOrNull,
} from '@/lib/auth-helpers';

beforeEach(() => {
    mockHeadersMap.clear();
    for (const k of Object.keys(memberStore)) delete memberStore[k];
});

describe('requireAuth', () => {
    it('returns uid when x-user-id header is present', async () => {
        mockHeadersMap.set('x-user-id', 'uid-123');
        await expect(requireAuth()).resolves.toBe('uid-123');
    });

    it('throws UnauthorizedError when header is missing', async () => {
        await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws with message "Unauthorized"', async () => {
        await expect(requireAuth()).rejects.toThrow('Unauthorized');
    });
});

describe('getAuthUserIdOrNull', () => {
    it('returns uid when present', async () => {
        mockHeadersMap.set('x-user-id', 'uid-456');
        await expect(getAuthUserIdOrNull()).resolves.toBe('uid-456');
    });

    it('returns null when missing — does NOT throw', async () => {
        await expect(getAuthUserIdOrNull()).resolves.toBeNull();
    });
});

describe('isGroupMember', () => {
    it('returns false when groupId is empty', async () => {
        await expect(isGroupMember('', 'uid-1')).resolves.toBe(false);
    });

    it('returns false when uid is empty', async () => {
        await expect(isGroupMember('grp-1', '')).resolves.toBe(false);
    });

    it('returns false when no member doc exists', async () => {
        await expect(isGroupMember('grp-1', 'uid-1')).resolves.toBe(false);
    });

    it('returns true when member doc exists', async () => {
        memberStore['grp-1/uid-1'] = true;
        await expect(isGroupMember('grp-1', 'uid-1')).resolves.toBe(true);
    });
});

describe('requireGroupMember', () => {
    it('throws UnauthorizedError when no session and no uid override', async () => {
        await expect(requireGroupMember('grp-1')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws ForbiddenError when authed but not a member', async () => {
        mockHeadersMap.set('x-user-id', 'uid-stranger');
        await expect(requireGroupMember('grp-1')).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('returns uid when session matches a member', async () => {
        mockHeadersMap.set('x-user-id', 'uid-member');
        memberStore['grp-1/uid-member'] = true;
        await expect(requireGroupMember('grp-1')).resolves.toBe('uid-member');
    });

    it('respects uid override (skips header lookup)', async () => {
        memberStore['grp-1/uid-explicit'] = true;
        await expect(requireGroupMember('grp-1', 'uid-explicit')).resolves.toBe('uid-explicit');
    });

    it('throws ForbiddenError on uid override that is not a member', async () => {
        await expect(requireGroupMember('grp-1', 'uid-stranger')).rejects.toBeInstanceOf(ForbiddenError);
    });
});
