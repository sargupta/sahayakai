/**
 * fanoutNewTeacherJoinedNotification — unit tests.
 *
 * We mock @/lib/firebase-admin's getDb() with a fluent fake that records:
 *  - the candidate query (state/district/subjects + orderBy createdAt desc + limit)
 *  - per-recipient dedup queries (recipientId + type + createdAt >= cutoff)
 *  - the final batch writes (notification doc shape)
 *
 * Asserts:
 *  - query shape is correct
 *  - recipient cap = 50
 *  - 24h dedup skips recipients with a recent NEW_TEACHER_JOINED
 */

type AnyDoc = { id: string; data: Record<string, any> };

interface MockState {
    newTeacher: AnyDoc | null;
    candidates: AnyDoc[];                          // candidate users returned by the query
    dedupRecentByUid: Record<string, boolean>;     // uid -> has recent notification?
    capturedQuery: any;                            // assertions read this
    batchWrites: any[];                            // recorded notification docs
    batchCommitted: boolean;
}

const state: MockState = {
    newTeacher: null,
    candidates: [],
    dedupRecentByUid: {},
    capturedQuery: null,
    batchWrites: [],
    batchCommitted: false,
};

function resetState() {
    state.newTeacher = null;
    state.candidates = [];
    state.dedupRecentByUid = {};
    state.capturedQuery = null;
    state.batchWrites = [];
    state.batchCommitted = false;
}

// Fluent fake. Each .where() / .orderBy() / .limit() chains on a query object
// that captures its filters. .get() reads from state.
function makeUsersQuery() {
    const q: any = { filters: [] as any[], orderBy: null as any, limit: null as any };
    const chain = {
        where(field: string, op: string, value: any) {
            q.filters.push({ field, op, value });
            return chain;
        },
        orderBy(field: string, dir: string) {
            q.orderBy = { field, dir };
            return chain;
        },
        limit(n: number) {
            q.limit = n;
            return chain;
        },
        async get() {
            state.capturedQuery = q;
            // Return up to `limit` candidates.
            const docs = state.candidates.slice(0, q.limit ?? state.candidates.length).map(c => ({
                id: c.id,
                data: () => c.data,
            }));
            return { docs };
        },
    };
    return chain;
}

function makeNotificationsQuery(recipientId: string) {
    const q: any = { recipientId, filters: [] as any[], limit: null as any };
    const chain = {
        where(field: string, op: string, value: any) {
            q.filters.push({ field, op, value });
            return chain;
        },
        limit(n: number) {
            q.limit = n;
            return chain;
        },
        async get() {
            const hasRecent = !!state.dedupRecentByUid[recipientId];
            return { empty: !hasRecent };
        },
    };
    return chain;
}

const fakeDb: any = {
    collection(name: string) {
        if (name === 'users') {
            const usersChain: any = {
                doc(uid: string) {
                    return {
                        async get() {
                            if (state.newTeacher && state.newTeacher.id === uid) {
                                return { exists: true, data: () => state.newTeacher!.data };
                            }
                            return { exists: false, data: () => undefined };
                        },
                    };
                },
                where(field: string, op: string, value: any) {
                    return makeUsersQuery().where(field, op, value);
                },
            };
            return usersChain;
        }
        if (name === 'notifications') {
            return {
                doc(_id?: string) {
                    void _id;
                    return { __isNotificationRef: true };
                },
                where(field: string, op: string, value: any) {
                    // The fanout query always starts with recipientId == X
                    if (field === 'recipientId' && op === '==') {
                        return makeNotificationsQuery(value);
                    }
                    // Fallback (shouldn't be hit)
                    return makeNotificationsQuery('');
                },
            };
        }
        throw new Error('Unexpected collection: ' + name);
    },
    batch() {
        return {
            set(_ref: any, doc: any) { state.batchWrites.push(doc); },
            async commit() { state.batchCommitted = true; },
        };
    },
};

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => fakeDb,
}));

import { fanoutNewTeacherJoinedNotification } from '@/lib/notifications/fanout';

beforeEach(resetState);

function makeTeacher(uid: string, overrides: Partial<Record<string, any>> = {}): AnyDoc {
    return {
        id: uid,
        data: {
            displayName: `Teacher ${uid}`,
            schoolName: 'Govt High School',
            district: 'Bengaluru Urban',
            state: 'Karnataka',
            subjects: ['Mathematics'],
            preferredLanguage: 'English',
            ...overrides,
        },
    };
}

describe('fanoutNewTeacherJoinedNotification', () => {
    it('exits early when the new teacher profile is missing', async () => {
        const result = await fanoutNewTeacherJoinedNotification('nope');
        expect(result.reason).toBe('missing_profile');
        expect(result.sent).toBe(0);
        expect(state.batchCommitted).toBe(false);
    });

    it('exits early when the new teacher has no district', async () => {
        state.newTeacher = makeTeacher('new-1', { district: '' });
        const result = await fanoutNewTeacherJoinedNotification('new-1');
        expect(result.reason).toBe('missing_district');
        expect(result.sent).toBe(0);
    });

    it('exits early when the new teacher has no primary subject', async () => {
        state.newTeacher = makeTeacher('new-1', { subjects: [] });
        const result = await fanoutNewTeacherJoinedNotification('new-1');
        expect(result.reason).toBe('missing_subject');
        expect(result.sent).toBe(0);
    });

    it('skips test-pattern display names entirely', async () => {
        state.newTeacher = makeTeacher('dev-1', { displayName: 'Dev Test User' });
        const result = await fanoutNewTeacherJoinedNotification('dev-1');
        expect(result.reason).toBe('test_account');
    });

    it('queries users by state + district + subjects with createdAt desc', async () => {
        state.newTeacher = makeTeacher('new-1');
        // No candidates returned.
        await fanoutNewTeacherJoinedNotification('new-1');
        const q = state.capturedQuery;
        expect(q).not.toBeNull();
        const fields = q.filters.map((f: any) => `${f.field}${f.op}`);
        expect(fields).toEqual(expect.arrayContaining([
            'district==',
            'subjectsarray-contains',
            'state==',
        ]));
        // Verify operator on subjects is the array-contains variant
        const subjectsFilter = q.filters.find((f: any) => f.field === 'subjects');
        expect(subjectsFilter.op).toBe('array-contains');
        expect(subjectsFilter.value).toBe('Mathematics');
        expect(q.orderBy).toEqual({ field: 'createdAt', dir: 'desc' });
        // RECIPIENT_CAP * 2 = 100 over-fetch
        expect(q.limit).toBe(100);
    });

    it('caps recipients at 50 and writes one notification per recipient', async () => {
        state.newTeacher = makeTeacher('new-1');
        // 80 candidates — fanout should cap at 50
        state.candidates = Array.from({ length: 80 }, (_, i) =>
            makeTeacher(`peer-${i}`, { preferredLanguage: 'English' }),
        );
        const result = await fanoutNewTeacherJoinedNotification('new-1');
        expect(result.capped).toBe(true);
        expect(result.sent).toBe(50);
        expect(state.batchWrites).toHaveLength(50);
        // Every doc has the right type + deep-link + isRead=false
        for (const doc of state.batchWrites) {
            expect(doc.type).toBe('NEW_TEACHER_JOINED');
            expect(doc.link).toBe('/community?tab=connect&highlight=new-1');
            expect(doc.isRead).toBe(false);
            expect(doc.recipientId).toMatch(/^peer-\d+$/);
            expect(doc.message).toContain('joined SahayakAI');
        }
        expect(state.batchCommitted).toBe(true);
    });

    it('skips recipients who got a NEW_TEACHER_JOINED in the last 24h', async () => {
        state.newTeacher = makeTeacher('new-1');
        state.candidates = [
            makeTeacher('peer-a'),
            makeTeacher('peer-b'),
            makeTeacher('peer-c'),
        ];
        // peer-b already got one — should be skipped
        state.dedupRecentByUid['peer-b'] = true;

        const result = await fanoutNewTeacherJoinedNotification('new-1');
        expect(result.sent).toBe(2);
        expect(result.skippedDedup).toBe(1);
        expect(state.batchWrites.map(d => d.recipientId).sort()).toEqual(['peer-a', 'peer-c']);
    });

    it('excludes the new teacher themselves from candidates', async () => {
        state.newTeacher = makeTeacher('new-1');
        state.candidates = [
            makeTeacher('new-1'), // self — must be filtered
            makeTeacher('peer-a'),
        ];
        const result = await fanoutNewTeacherJoinedNotification('new-1');
        expect(result.sent).toBe(1);
        expect(state.batchWrites[0].recipientId).toBe('peer-a');
    });

    it('renders the message in the recipient preferredLanguage', async () => {
        state.newTeacher = makeTeacher('new-1', { displayName: 'Asha', schoolName: 'GHS Mandya' });
        state.candidates = [
            makeTeacher('peer-en', { preferredLanguage: 'English' }),
            makeTeacher('peer-hi', { preferredLanguage: 'Hindi' }),
            makeTeacher('peer-kn', { preferredLanguage: 'Kannada' }),
        ];
        await fanoutNewTeacherJoinedNotification('new-1');
        const byUid: Record<string, string> = {};
        for (const doc of state.batchWrites) byUid[doc.recipientId] = doc.message;
        expect(byUid['peer-en']).toBe('Asha joined SahayakAI from GHS Mandya');
        expect(byUid['peer-hi']).toContain('Asha');
        expect(byUid['peer-hi']).toContain('GHS Mandya');
        expect(byUid['peer-hi']).toContain('जॉइन');
        expect(byUid['peer-kn']).toContain('Asha');
    });
});
