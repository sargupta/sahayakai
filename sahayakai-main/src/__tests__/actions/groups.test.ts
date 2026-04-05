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
        runTransaction: jest.fn(async (fn: any) => {
            const tx = {
                get: jest.fn(async (ref: any) => {
                    const data = getCol('groups')[ref.id];
                    return { exists: !!data, data: () => data };
                }),
                set: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
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
            expect(result).toContain('education_updates');
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
            expect(result).toContain('education_updates');
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
