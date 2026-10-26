/**
 * Test-data cleanup for ONE teacher: deletes that teacher's conversations,
 * hides only their auto-saved chat rows, keeps every real resource, and can
 * never reach another teacher.
 */
import {
    applyLibraryTestCleanup,
    assertSingleUid,
    planLibraryTestCleanup,
} from '@/lib/library-test-cleanup';

type Doc = Record<string, any>;
let store: Map<string, Doc>;

function docRef(p: string): any {
    return {
        id: p.split('/').pop(),
        path: p,
        get: async () => ({ id: p.split('/').pop(), exists: store.has(p), data: () => store.get(p) }),
        collection: (c: string) => colRef(`${p}/${c}`),
    };
}
function colRef(p: string): any {
    const children = (filter?: (d: Doc) => boolean) =>
        [...store.entries()]
            .filter(([k]) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes('/'))
            .filter(([, d]) => (filter ? filter(d) : true))
            .map(([k, d]) => ({ id: k.split('/').pop(), data: () => d, ref: docRef(k) }));
    return {
        doc: (id: string) => docRef(`${p}/${id}`),
        get: async () => ({ docs: children() }),
        where: (f: string, _op: string, v: unknown) => ({ get: async () => ({ docs: children((d) => d[f] === v) }) }),
    };
}
const db: any = {
    collection: (c: string) => colRef(c),
    batch: () => {
        const ops: Array<() => void> = [];
        return {
            delete: (ref: any) => ops.push(() => store.delete(ref.path)),
            update: (ref: any, data: Doc) => ops.push(() => store.set(ref.path, { ...store.get(ref.path), ...data })),
            commit: async () => ops.forEach((op) => op()),
        };
    },
};

const AUTO = (q: string, uid: string, n: number) => ({
    type: 'instant-answer', title: q, topic: q, gradeLevel: 'Class 5', subject: 'General', language: 'en',
    storagePath: `users/${uid}/instant-answers/20261001_10000${n}_${q.replace(/\W+/g, '-')}.json`,
    data: { answer: 'a', videoSuggestionUrl: null, gradeLevel: 'Class 5', subject: 'General', grounded: false },
});
const SAVED_ANSWER = { type: 'instant-answer', title: 'Explain photosynthesis', data: { answer: 'a', language: 'en' } };

function seed() {
    store = new Map();
    for (const uid of ['teacher-a', 'teacher-b']) {
        store.set(`users/${uid}`, { email: `${uid}@x` });
        store.set(`users/${uid}/vidya_sessions/s1`, { messages: [{ role: 'user', parts: [{ text: 'hello' }] }] });
        store.set(`users/${uid}/vidya_sessions/s2`, { messages: [], saved: true });
        store.set(`users/${uid}/content/auto1`, AUTO('hello', uid, 1));
        store.set(`users/${uid}/content/auto2`, AUTO('who are you', uid, 2));
        store.set(`users/${uid}/content/saved1`, SAVED_ANSWER);
        store.set(`users/${uid}/content/quiz1`, { type: 'quiz', title: 'Fractions quiz' });
        store.set(`users/${uid}/content/lp1`, { type: 'lesson-plan', title: 'Photosynthesis' });
    }
}

beforeEach(seed);

describe('library test-data cleanup', () => {
    it('plans exactly: all of A\'s conversations, only A\'s auto chat rows; real resources kept', async () => {
        const plan = await planLibraryTestCleanup(db, 'teacher-a');
        expect(plan.sessionIds.sort()).toEqual(['s1', 's2']);
        expect(plan.savedSessionIds).toEqual(['s2']);
        expect(plan.hideContentIds.sort()).toEqual(['auto1', 'auto2']);
        expect(plan.keptInstantAnswers.saved).toBe(1);
        expect(plan.otherContentByType).toEqual({ quiz: 1, 'lesson-plan': 1 });
    });

    it('a plan changes nothing until applied (dry-run is read-only)', async () => {
        const before = JSON.stringify([...store.entries()]);
        await planLibraryTestCleanup(db, 'teacher-a');
        expect(JSON.stringify([...store.entries()])).toBe(before);
    });

    it('apply deletes A\'s conversations, hides (not deletes) A\'s chat rows, keeps A\'s resources', async () => {
        const result = await applyLibraryTestCleanup(db, await planLibraryTestCleanup(db, 'teacher-a'), new Date('2026-10-02T00:00:00Z'));
        expect(result).toEqual({ sessionsDeleted: 2, generationsHidden: 2 });
        expect(store.has('users/teacher-a/vidya_sessions/s1')).toBe(false);
        expect(store.has('users/teacher-a/vidya_sessions/s2')).toBe(false);
        expect(store.get('users/teacher-a/content/auto1')).toMatchObject({ hiddenFromLibrary: true, libraryMigration: { id: 'instant-answer-reclassification-2026-10' } });
        expect(store.get('users/teacher-a/content/saved1')!.hiddenFromLibrary).toBeUndefined();
        expect(store.get('users/teacher-a/content/quiz1')).toEqual({ type: 'quiz', title: 'Fractions quiz' });
        expect(store.get('users/teacher-a/content/lp1')).toEqual({ type: 'lesson-plan', title: 'Photosynthesis' });
    });

    it('cleaning teacher A leaves every byte of teacher B untouched', async () => {
        const bBefore = JSON.stringify([...store.entries()].filter(([k]) => k.startsWith('users/teacher-b')));
        await applyLibraryTestCleanup(db, await planLibraryTestCleanup(db, 'teacher-a'));
        expect(JSON.stringify([...store.entries()].filter(([k]) => k.startsWith('users/teacher-b')))).toBe(bBefore);
    });

    it('never hides a chat row another record points at', async () => {
        store.set('users/teacher-a', { firstGenerationContentId: 'auto1' });
        const plan = await planLibraryTestCleanup(db, 'teacher-a');
        expect(plan.hideContentIds).toEqual(['auto2']);
        expect(plan.keptInstantAnswers.protectedRefs).toBe(1);
    });

    it.each([undefined, '', '*', 'a', 'teacher-a,teacher-b', '../teacher-b', 'users/teacher-b'])('refuses a non-exact uid %p', (uid) => {
        expect(() => assertSingleUid(uid)).toThrow(/single, exact --uid/);
    });
});
