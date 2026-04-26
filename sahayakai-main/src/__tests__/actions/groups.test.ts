/**
 * Server action contract tests for src/app/actions/groups.ts
 * Focuses on ensureUserGroupsAction: short-circuit, privacy fix, auto-join behavior.
 */

// ── Mock: next/headers ──────────────────────────────────────────────────────

const mockHeadersMap = new Map<string, string>([['x-user-id', 'test-uid']]);
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
    arrayRemove: (...vals: any[]) => ({ __arrayRemove: vals }),
};

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: mockFieldValue,
}));

/** Track all create() calls to verify member doc creation */
const createCalls: { path: string; docId: string; data: any }[] = [];

function makeMockDb() {
    const collection = (colName: string) => ({
        doc: (id: string) => ({
            id,
            // Store path info on the ref so transaction stubs can route writes.
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
                createCalls.push({ path: colName, docId: id, data });
            }),
            collection: (subCol: string) => collection(`${colName}/${id}/${subCol}`),
        }),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(async () => {
            const entries = Object.entries(getCol(colName));
            return {
                empty: entries.length === 0,
                docs: entries.map(([docId, data]) => ({
                    id: docId,
                    data: () => data,
                })),
            };
        }),
    });

    return {
        collection,
        // Wave 2b enhancement: transaction stubs now mirror writes into the
        // in-memory store so existing assertions on store state still work
        // after server actions migrated from sequential writes to transactions.
        runTransaction: jest.fn(async (fn: any) => {
            const tx = {
                get: jest.fn(async (ref: any) => {
                    const colPath = ref.__colPath;
                    const data = colPath ? getCol(colPath)[ref.__docId] : undefined;
                    return { exists: !!data, data: () => data };
                }),
                set: jest.fn((ref: any, data: any) => {
                    const colPath = ref.__colPath;
                    if (colPath) {
                        getCol(colPath)[ref.__docId] = data;
                        createCalls.push({ path: colPath, docId: ref.__docId, data });
                    }
                }),
                update: jest.fn((ref: any, data: any) => {
                    const colPath = ref.__colPath;
                    if (colPath) {
                        getCol(colPath)[ref.__docId] = { ...getCol(colPath)[ref.__docId], ...data };
                    }
                }),
                delete: jest.fn((ref: any) => {
                    const colPath = ref.__colPath;
                    if (colPath) delete getCol(colPath)[ref.__docId];
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

// ── Mock: db adapter ────────────────────────────────────────────────────────

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        serialize: jest.fn((data: any) => data),
        getUser: jest.fn(async (uid: string) => ({
            uid,
            displayName: 'Test Teacher',
            photoURL: null,
        })),
    },
}));

// ── Mock: logger ────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── Import under test ───────────────────────────────────────────────────────

import { ensureUserGroupsAction } from '@/app/actions/groups';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ensureUserGroupsAction', () => {
    beforeEach(() => {
        Object.keys(store).forEach(k => delete store[k]);
        createCalls.length = 0;
        mockHeadersMap.set('x-user-id', 'test-uid');
    });

    describe('short-circuit when groupsInitialized === true', () => {
        it('returns existing groupIds immediately without creating any groups', async () => {
            getCol('users')['test-uid'] = {
                groupsInitialized: true,
                groupIds: ['math_grade10_cbse', 'state_karnataka'],
                subjects: ['Mathematics'],
                gradeLevels: ['Grade 10'],
                educationBoard: 'CBSE',
                state: 'Karnataka',
            };

            const result = await ensureUserGroupsAction();

            expect(result).toEqual(['math_grade10_cbse', 'state_karnataka']);
            // No group docs should have been created
            expect(createCalls).toHaveLength(0);
            // No group docs should have been written
            expect(getCol('groups')).toEqual({});
        });

        it('returns empty array when groupsInitialized is true but groupIds is missing', async () => {
            getCol('users')['test-uid'] = {
                groupsInitialized: true,
                // no groupIds field
            };

            const result = await ensureUserGroupsAction();
            expect(result).toEqual([]);
            expect(createCalls).toHaveLength(0);
        });
    });

    describe('group creation when groupsInitialized is false/missing', () => {
        it('proceeds with group creation when groupsInitialized is false', async () => {
            getCol('users')['test-uid'] = {
                groupsInitialized: false,
                groupIds: [],
                subjects: ['Science'],
                gradeLevels: ['Grade 8'],
                educationBoard: 'CBSE',
                state: 'Karnataka',
                schoolName: '',
            };

            const result = await ensureUserGroupsAction();

            // Should have created subject+grade group, state group, edu updates, community general
            expect(result.length).toBeGreaterThan(0);
            expect(result).toContain('science_grade_8_cbse');
            expect(result).toContain('state_karnataka');
            expect(result).toContain('daily_briefing');
            expect(result).toContain('community_general');
        });

        it('proceeds with group creation when groupsInitialized is missing', async () => {
            getCol('users')['test-uid'] = {
                groupIds: [],
                subjects: ['English'],
                gradeLevels: ['Grade 5'],
                educationBoard: '',
                state: '',
                schoolName: '',
            };

            const result = await ensureUserGroupsAction();

            expect(result).toContain('english_grade_5_general');
            expect(result).toContain('daily_briefing');
            expect(result).toContain('community_general');
        });
    });

    describe('school group privacy fix — no auto-join', () => {
        it('creates school group doc but does NOT create a member doc for the user', async () => {
            getCol('users')['test-uid'] = {
                groupIds: [],
                subjects: [],
                gradeLevels: [],
                educationBoard: '',
                state: '',
                schoolName: 'Delhi Public School',
            };

            await ensureUserGroupsAction();

            const schoolGroupId = 'school_delhi_public_school';

            // School group doc should exist
            expect(getCol('groups')[schoolGroupId]).toBeDefined();
            expect(getCol('groups')[schoolGroupId].name).toBe('Delhi Public School');
            expect(getCol('groups')[schoolGroupId].type).toBe('school');

            // No member doc should be created for school group
            const schoolMemberPath = `groups/${schoolGroupId}/members`;
            const schoolMemberCalls = createCalls.filter(c => c.path === schoolMemberPath);
            expect(schoolMemberCalls).toHaveLength(0);

            // School group should NOT be in the returned groupIds
            const result = await ensureUserGroupsAction();
            // After first call, groupsInitialized is true, so it short-circuits
            // Let's check the first run's user doc update
            const userDoc = getCol('users')['test-uid'];
            // The groupIds stored should NOT include the school group
            // (arrayUnion mock stores __arrayUnion)
            if (userDoc.groupIds?.__arrayUnion) {
                expect(userDoc.groupIds.__arrayUnion).not.toContain(schoolGroupId);
            }
        });
    });

    describe('state group auto-join', () => {
        it('creates state group AND adds member doc (auto-join)', async () => {
            getCol('users')['test-uid'] = {
                groupIds: [],
                subjects: [],
                gradeLevels: [],
                educationBoard: '',
                state: 'Tamil Nadu',
                schoolName: '',
            };

            const result = await ensureUserGroupsAction();

            const stateGroupId = 'state_tamil_nadu';

            // State group should exist
            expect(getCol('groups')[stateGroupId]).toBeDefined();
            expect(getCol('groups')[stateGroupId].name).toBe('Tamil Nadu Teachers');

            // Member doc SHOULD be created for state group
            const stateMemberPath = `groups/${stateGroupId}/members`;
            const stateMemberCalls = createCalls.filter(c => c.path === stateMemberPath && c.docId === 'test-uid');
            expect(stateMemberCalls).toHaveLength(1);
            expect(stateMemberCalls[0].data.role).toBe('member');

            // State group should be in the returned groupIds
            expect(result).toContain(stateGroupId);
        });
    });

    describe('groupsInitialized flag is set after completion', () => {
        it('sets groupsInitialized: true on the user doc', async () => {
            getCol('users')['test-uid'] = {
                groupIds: [],
                subjects: [],
                gradeLevels: [],
                educationBoard: '',
                state: '',
                schoolName: '',
            };

            await ensureUserGroupsAction();

            const userDoc = getCol('users')['test-uid'];
            expect(userDoc.groupsInitialized).toBe(true);
        });
    });

    describe('auth', () => {
        it('throws Unauthorized when x-user-id header is missing', async () => {
            mockHeadersMap.delete('x-user-id');
            await expect(ensureUserGroupsAction()).rejects.toThrow('Unauthorized');
        });

        it('throws when user profile not found', async () => {
            // No user doc in store
            await expect(ensureUserGroupsAction()).rejects.toThrow('User profile not found');
        });
    });
});

// ── Phase 1 security regression: getGroupPostsAction membership check ───────

import { getGroupPostsAction } from '@/app/actions/groups';

describe('getGroupPostsAction — Phase 1 membership gate', () => {
    beforeEach(() => {
        Object.keys(store).forEach(k => delete store[k]);
        createCalls.length = 0;
        mockHeadersMap.set('x-user-id', 'test-uid');
    });

    it('throws Forbidden when caller is not a member of the group', async () => {
        // No member doc exists for test-uid in the group's members subcollection
        await expect(getGroupPostsAction('private-group-id'))
            .rejects.toThrow(/Forbidden|Not a member/i);
    });

    it('throws Unauthorized when x-user-id header is missing', async () => {
        mockHeadersMap.delete('x-user-id');
        await expect(getGroupPostsAction('any-group'))
            .rejects.toThrow('Unauthorized');
    });

    it('returns posts when caller IS a member', async () => {
        // Seed membership
        getCol('groups/test-group/members')['test-uid'] = { joinedAt: 'now', role: 'member' };
        // Seed one post (the in-memory store doesn't fully model orderBy/limit but
        // returns docs from the matched subcollection, which is enough for this gate test)
        getCol('groups/test-group/posts')['post-1'] = {
            authorUid: 'someone', content: 'hi', createdAt: '2026-01-01T00:00:00Z',
        };

        const posts = await getGroupPostsAction('test-group');
        expect(Array.isArray(posts)).toBe(true);
    });
});

// ── Phase 2: joinGroupAction surfaces real errors instead of silently succeeding

import { joinGroupAction } from '@/app/actions/groups';

describe('joinGroupAction — Phase 2 error handling', () => {
    beforeEach(() => {
        Object.keys(store).forEach(k => delete store[k]);
        createCalls.length = 0;
        mockHeadersMap.set('x-user-id', 'test-uid');
        // Seed group so the "Group not found" guard passes
        getCol('groups')['existing-grp'] = { name: 'Test Group', memberCount: 0 };
    });

    it('returns { joined: true } when the caller becomes a new member', async () => {
        const result = await joinGroupAction('existing-grp');
        expect(result).toEqual({ joined: true });
        // Member doc was created
        expect(createCalls.find(c => c.path === 'groups/existing-grp/members' && c.docId === 'test-uid'))
            .toBeDefined();
    });

    it('returns { joined: false } when the caller is already a member (idempotent)', async () => {
        // Pre-seed membership
        getCol('groups/existing-grp/members')['test-uid'] = { joinedAt: 'old', role: 'member' };
        const result = await joinGroupAction('existing-grp');
        expect(result).toEqual({ joined: false });
    });

    it('throws "Group not found" when the group does not exist', async () => {
        await expect(joinGroupAction('nonexistent-grp'))
            .rejects.toThrow('Group not found');
    });
});
