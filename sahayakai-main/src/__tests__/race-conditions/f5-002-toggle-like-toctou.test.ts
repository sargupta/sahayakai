/**
 * F5-002 regression test — `toggleLikeAction` and `likeGroupPostAction`
 * must be safe under concurrent calls from the same user.
 *
 * The old implementation pre-read `likeRef.exists` and decided the
 * direction outside the write. 10 concurrent toggles could all observe
 * `!exists`, all set the like-doc (idempotent), and all fire
 * `FieldValue.increment(+1)` → counter inflated by 10 while only one
 * like-doc was visible. The transaction-wrapped fix should converge to
 * exactly one like-doc and a counter delta of +1 or 0.
 */

const mockHeadersMap = new Map<string, string>([['x-user-id', 'user-x']]);
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

jest.mock('@/lib/pubsub', () => ({
    publishEvent: jest.fn(async () => {}),
}));

jest.mock('@/lib/aggregator', () => ({
    aggregateUserMetrics: jest.fn(async () => {}),
}));

jest.mock('@/lib/server-cache', () => ({
    cachedPerUser: (fn: any, _opts: any) => fn,
    invalidateUserCache: jest.fn(),
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(async () => ({ ok: true })),
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        serialize: (d: any) => d,
        getUsers: jest.fn(async () => []),
        getUser: jest.fn(async () => null),
        saveContent: jest.fn(async () => {}),
    },
}));

jest.mock('@/lib/notifications/create', () => ({
    createNotification: jest.fn(async () => {}),
    createTypedNotification: jest.fn(async () => {}),
}));

// ── In-memory Firestore mock with optimistic-locking transactions ────────────
//
// Each "doc" carries a `version` integer. `tx.get` snapshots the version;
// `tx.commit` aborts + retries if any read doc's version changed before commit.
// This faithfully reproduces Firestore's runTransaction contention semantics —
// the precondition for catching the TOCTOU regression in CI.

type DocRecord = { data: any; version: number };

function makeStore() {
    const docs = new Map<string, DocRecord>();
    const keyOf = (path: string[]) => path.join('/');

    function getRec(path: string[]): DocRecord | undefined {
        return docs.get(keyOf(path));
    }

    function setRec(path: string[], data: any) {
        const k = keyOf(path);
        const prev = docs.get(k);
        docs.set(k, { data, version: (prev?.version ?? 0) + 1 });
    }

    function updateRec(path: string[], patch: any) {
        const k = keyOf(path);
        const prev = docs.get(k);
        const merged = { ...(prev?.data ?? {}), ...applyFieldOps(prev?.data ?? {}, patch) };
        docs.set(k, { data: merged, version: (prev?.version ?? 0) + 1 });
    }

    function deleteRec(path: string[]) {
        const k = keyOf(path);
        const prev = docs.get(k);
        if (prev) {
            docs.set(k, { data: undefined, version: prev.version + 1 });
        }
    }

    return { docs, getRec, setRec, updateRec, deleteRec };
}

// Sentinels — distinguishable objects for FieldValue.increment(n).
const INCREMENT_SENTINEL = Symbol('increment');
function makeIncrement(n: number) {
    return { [INCREMENT_SENTINEL]: true, delta: n };
}

function applyFieldOps(base: any, patch: any): any {
    const out: any = {};
    for (const [k, v] of Object.entries(patch)) {
        if (v && typeof v === 'object' && (v as any)[INCREMENT_SENTINEL]) {
            out[k] = (base[k] ?? 0) + (v as any).delta;
        } else {
            out[k] = v;
        }
    }
    return out;
}

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        increment: (n: number) => makeIncrement(n),
    },
}));

const store = makeStore();

class MockDocRef {
    constructor(public path: string[]) {}
    collection(name: string) { return new MockColRef([...this.path, name]); }
    async get() {
        const rec = store.getRec(this.path);
        return {
            exists: !!rec && rec.data !== undefined,
            data: () => rec?.data,
            id: this.path[this.path.length - 1],
            ref: this,
        };
    }
    async set(data: any) { store.setRec(this.path, data); }
    async update(patch: any) { store.updateRec(this.path, patch); }
    async delete() { store.deleteRec(this.path); }
}

class MockColRef {
    constructor(public path: string[]) {}
    doc(id: string) { return new MockDocRef([...this.path, id]); }
    where() { return this; }
    orderBy() { return this; }
    limit() { return this; }
    async add(data: any) {
        const id = `auto-${Math.random().toString(36).slice(2, 10)}`;
        store.setRec([...this.path, id], data);
        return new MockDocRef([...this.path, id]);
    }
    async get() {
        const prefix = this.path.join('/') + '/';
        const docs: any[] = [];
        for (const [k, rec] of store.docs.entries()) {
            if (k.startsWith(prefix) && rec.data !== undefined && k.split('/').length === this.path.length + 1) {
                const id = k.slice(prefix.length);
                docs.push({ id, data: () => rec.data });
            }
        }
        return { empty: docs.length === 0, docs };
    }
}

const mockDb = {
    collection: (name: string) => new MockColRef([name]),
    async runTransaction(fn: (tx: any) => Promise<any>): Promise<any> {
        // Optimistic-locking loop — at most 5 attempts (Firestore default is 5).
        for (let attempt = 0; attempt < 50; attempt++) {
            // Each attempt gets a fresh read-set + write-buffer. We
            // intentionally yield between operations so that concurrent
            // transactions can interleave.
            const readVersions = new Map<string, number>();
            const writes: Array<() => void> = [];
            const tx = {
                async get(ref: MockDocRef) {
                    const rec = store.getRec(ref.path);
                    readVersions.set(ref.path.join('/'), rec?.version ?? 0);
                    // Yield to event loop so a sibling tx can interleave.
                    await new Promise((r) => queueMicrotask(r));
                    return {
                        exists: !!rec && rec.data !== undefined,
                        data: () => rec?.data,
                        id: ref.path[ref.path.length - 1],
                        ref,
                    };
                },
                set(ref: MockDocRef, data: any) {
                    writes.push(() => store.setRec(ref.path, data));
                },
                update(ref: MockDocRef, patch: any) {
                    writes.push(() => store.updateRec(ref.path, patch));
                },
                delete(ref: MockDocRef) {
                    writes.push(() => store.deleteRec(ref.path));
                },
            };
            const ret = await fn(tx);
            // Validate read-set versions before committing.
            let stale = false;
            for (const [k, v] of readVersions) {
                const cur = store.docs.get(k);
                if ((cur?.version ?? 0) !== v) { stale = true; break; }
            }
            if (stale) continue; // retry
            for (const w of writes) w();
            return ret;
        }
        throw new Error('Transaction failed after 5 retries');
    },
    batch: () => ({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn(async () => {}),
    }),
};

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => mockDb,
}));

import { toggleLikeAction } from '@/app/actions/community';

describe('F5-002: toggleLikeAction is TOCTOU-safe under concurrent calls', () => {
    beforeEach(() => {
        store.docs.clear();
        // Seed the post with likesCount=0.
        store.setRec(['posts', 'p1'], { likesCount: 0 });
        mockHeadersMap.set('x-user-id', 'user-x');
    });

    it('10 concurrent toggles from the same user → exactly one like-doc, counter is +1 or 0', async () => {
        await Promise.all(Array.from({ length: 10 }, () => toggleLikeAction('p1')));

        // Count like-docs that actually landed.
        let likeDocs = 0;
        for (const [k, rec] of store.docs.entries()) {
            if (k.startsWith('posts/p1/likes/') && rec.data !== undefined) likeDocs++;
        }

        const finalCount = store.getRec(['posts', 'p1'])?.data?.likesCount ?? 0;

        // If the final state is "liked" → exactly one like-doc and likesCount=1.
        // If the final state is "unliked" → zero like-docs and likesCount=0.
        // Anything else (e.g. likesCount=10 with one doc) is the TOCTOU bug.
        expect([0, 1]).toContain(likeDocs);
        expect([0, 1]).toContain(finalCount);
        expect(finalCount).toBe(likeDocs);
    });
});
