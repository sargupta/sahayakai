/**
 * Regression gate: account deletion must purge the teacher's VIDYA
 * conversation history.
 *
 * Sessions live in the SUBCOLLECTION `users/{uid}/vidya_sessions`
 * (written by /api/vidya/session). The route used to query a top-level
 * `vidya_sessions` collection by `userId`, which nothing writes and which
 * the session docs have no field for — so transcripts survived deletion.
 * Firestore does not cascade parent-doc deletes to subcollections.
 */

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ── Minimal in-memory Firestore: path-keyed docs, recorded deletes ─────────
type DocData = Record<string, unknown>;
const store = new Map<string, Map<string, DocData>>(); // collectionPath -> id -> data
const deletedPaths: string[] = [];
const queriedTopLevel: string[] = [];

function collectionRef(path: string): any {
    const docsOf = () => [...(store.get(path) ?? new Map()).entries()];
    const snapshot = (limit?: number) => {
        const entries = docsOf().slice(0, limit ?? Infinity);
        return {
            empty: entries.length === 0,
            size: entries.length,
            docs: entries.map(([id, data]) => ({ id, data: () => data, ref: docRef(`${path}/${id}`) })),
        };
    };
    const query = (limit?: number): any => ({
        where: () => query(limit),
        limit: (n: number) => query(n),
        get: async () => snapshot(limit),
    });
    return {
        doc: (id: string) => docRef(`${path}/${id}`),
        where: (...args: unknown[]) => {
            if (!path.includes('/')) queriedTopLevel.push(`${path}:${JSON.stringify(args)}`);
            return query();
        },
        limit: (n: number) => query(n),
        get: async () => snapshot(),
    };
}

function docRef(path: string): any {
    const cut = path.lastIndexOf('/');
    const col = path.slice(0, cut);
    const id = path.slice(cut + 1);
    return {
        path,
        get: async () => {
            const data = store.get(col)?.get(id);
            return { exists: !!data, data: () => data ?? {} };
        },
        update: async () => undefined,
        delete: async () => {
            store.get(col)?.delete(id);
            deletedPaths.push(path);
        },
        collection: (sub: string) => collectionRef(`${path}/${sub}`),
    };
}

const fakeDb = {
    collection: (name: string) => collectionRef(name),
    batch: () => {
        const pending: any[] = [];
        return {
            delete: (ref: any) => pending.push(ref),
            commit: async () => {
                for (const ref of pending) await ref.delete();
            },
        };
    },
};

jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => fakeDb }));

const mockVerifyIdToken = jest.fn();
jest.mock('firebase-admin/auth', () => ({
    getAuth: () => ({ verifyIdToken: mockVerifyIdToken, deleteUser: jest.fn() }),
}));

function seed(collectionPath: string, docs: Record<string, DocData>) {
    store.set(collectionPath, new Map(Object.entries(docs)));
}

function makeRequest(userId: string, body: unknown) {
    return {
        headers: { get: (k: string) => (k === 'x-user-id' ? userId : null) },
        json: async () => body,
    } as any;
}

beforeEach(() => {
    store.clear();
    deletedPaths.length = 0;
    queriedTopLevel.length = 0;
    mockVerifyIdToken.mockResolvedValue({ uid: 'teacher-1', auth_time: Math.floor(Date.now() / 1000) });
});

describe('POST /api/user/delete-account — VIDYA sessions', () => {
    let POST: (req: any) => Promise<Response>;
    beforeAll(async () => {
        ({ POST } = await import('@/app/api/user/delete-account/route'));
    });

    it('deletes every doc in users/{uid}/vidya_sessions', async () => {
        seed('users', { 'teacher-1': { displayName: 'T' } });
        seed('users/teacher-1/vidya_sessions', {
            sess_a: { messages: [{ role: 'user', parts: [{ text: 'Hi Vidya' }] }] },
            sess_b: { messages: [] },
        });

        await POST(makeRequest('teacher-1', { confirm: true, idToken: 'fresh-token' }));

        expect(deletedPaths).toEqual(
            expect.arrayContaining([
                'users/teacher-1/vidya_sessions/sess_a',
                'users/teacher-1/vidya_sessions/sess_b',
            ]),
        );
        expect(store.get('users/teacher-1/vidya_sessions')?.size ?? 0).toBe(0);
    });

    it('never touches another teacher\'s sessions', async () => {
        seed('users', { 'teacher-1': {}, 'teacher-2': {} });
        seed('users/teacher-1/vidya_sessions', { sess_a: {} });
        seed('users/teacher-2/vidya_sessions', { sess_other: {} });

        await POST(makeRequest('teacher-1', { confirm: true, idToken: 'fresh-token' }));

        expect(store.get('users/teacher-2/vidya_sessions')?.has('sess_other')).toBe(true);
        expect(deletedPaths.some((p) => p.includes('teacher-2'))).toBe(false);
    });

    it('no longer queries the non-existent top-level vidya_sessions collection', async () => {
        seed('users', { 'teacher-1': {} });

        await POST(makeRequest('teacher-1', { confirm: true, idToken: 'fresh-token' }));

        expect(queriedTopLevel.some((q) => q.startsWith('vidya_sessions:'))).toBe(false);
    });
});
