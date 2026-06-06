/**
 * F5-003 regression test — `saveResourceToLibraryAction` must be
 * idempotent on `stats.saves`. Concurrent calls from the same user must
 * not inflate the counter.
 */

const mockHeadersMap = new Map<string, string>([['x-user-id', 'saver-1']]);
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/pubsub', () => ({ publishEvent: jest.fn(async () => {}) }));
jest.mock('@/lib/aggregator', () => ({ aggregateUserMetrics: jest.fn(async () => {}) }));
jest.mock('@/lib/server-cache', () => ({
    cachedPerUser: (fn: any, _opts: any) => fn,
    invalidateUserCache: jest.fn(),
}));
jest.mock('@/lib/server-safety', () => ({ checkServerRateLimit: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        serialize: (d: any) => d,
        getUser: jest.fn(async () => null),
        getUsers: jest.fn(async () => []),
        saveContent: jest.fn(async () => {}),
    },
}));
jest.mock('@/app/actions/notifications', () => ({
    createNotification: jest.fn(async () => {}),
    createTypedNotification: jest.fn(async () => {}),
}));

const INCREMENT_SENTINEL = Symbol('increment');
function makeIncrement(n: number) { return { [INCREMENT_SENTINEL]: true, delta: n }; }

function applyFieldOps(base: any, patch: any): any {
    const out: any = {};
    for (const [k, v] of Object.entries(patch)) {
        if (k.includes('.') && v && typeof v === 'object' && (v as any)[INCREMENT_SENTINEL]) {
            // Handle dotted-path increment ("stats.saves": increment(1))
            const [topKey, subKey] = k.split('.');
            const topVal = base[topKey] ?? {};
            const newSub = (topVal[subKey] ?? 0) + (v as any).delta;
            out[topKey] = { ...topVal, [subKey]: newSub };
        } else if (v && typeof v === 'object' && (v as any)[INCREMENT_SENTINEL]) {
            out[k] = (base[k] ?? 0) + (v as any).delta;
        } else {
            out[k] = v;
        }
    }
    return out;
}

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { increment: (n: number) => makeIncrement(n) },
}));

type DocRecord = { data: any; version: number };
const store = new Map<string, DocRecord>();
const k = (p: string[]) => p.join('/');
function rec(p: string[]) { return store.get(k(p)); }
function setRec(p: string[], d: any) {
    const prev = store.get(k(p));
    store.set(k(p), { data: d, version: (prev?.version ?? 0) + 1 });
}
function updateRec(p: string[], patch: any) {
    const prev = store.get(k(p));
    const base = prev?.data ?? {};
    store.set(k(p), { data: { ...base, ...applyFieldOps(base, patch) }, version: (prev?.version ?? 0) + 1 });
}
function delRec(p: string[]) {
    const prev = store.get(k(p));
    if (prev) store.set(k(p), { data: undefined, version: prev.version + 1 });
}

class MockDocRef {
    constructor(public path: string[]) {}
    collection(name: string) { return new MockColRef([...this.path, name]); }
    async get() {
        const r = rec(this.path);
        return { exists: !!r && r.data !== undefined, data: () => r?.data, id: this.path[this.path.length - 1] };
    }
    async set(data: any) { setRec(this.path, data); }
    async update(patch: any) { updateRec(this.path, patch); }
    async delete() { delRec(this.path); }
}
class MockColRef {
    constructor(public path: string[]) {}
    doc(id: string) { return new MockDocRef([...this.path, id]); }
    where() { return this; }
    orderBy() { return this; }
    limit() { return this; }
    async get() { return { empty: true, docs: [] }; }
    async add(data: any) {
        const id = `auto-${Math.random().toString(36).slice(2)}`;
        setRec([...this.path, id], data);
        return new MockDocRef([...this.path, id]);
    }
}

const mockDb = {
    collection: (name: string) => new MockColRef([name]),
    async runTransaction(fn: (tx: any) => Promise<any>) {
        for (let attempt = 0; attempt < 5; attempt++) {
            const readVersions = new Map<string, number>();
            const writes: Array<() => void> = [];
            const tx = {
                async get(ref: MockDocRef) {
                    const r = rec(ref.path);
                    readVersions.set(ref.path.join('/'), r?.version ?? 0);
                    await new Promise((r) => queueMicrotask(r));
                    return { exists: !!r && r.data !== undefined, data: () => r?.data, id: ref.path[ref.path.length - 1] };
                },
                set(ref: MockDocRef, data: any) { writes.push(() => setRec(ref.path, data)); },
                update(ref: MockDocRef, patch: any) { writes.push(() => updateRec(ref.path, patch)); },
                delete(ref: MockDocRef) { writes.push(() => delRec(ref.path)); },
            };
            const ret = await fn(tx);
            let stale = false;
            for (const [kk, v] of readVersions) {
                if ((store.get(kk)?.version ?? 0) !== v) { stale = true; break; }
            }
            if (stale) continue;
            for (const w of writes) w();
            return ret;
        }
        throw new Error('Transaction failed after retries');
    },
    batch: () => ({ set: jest.fn(), commit: jest.fn(async () => {}) }),
};

jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => mockDb }));

import { saveResourceToLibraryAction } from '@/app/actions/community';

describe('F5-003: saveResourceToLibraryAction does not inflate stats.saves', () => {
    beforeEach(() => {
        store.clear();
        setRec(['library_resources', 'res-1'], { authorId: 'other-author', stats: { saves: 0 } });
        mockHeadersMap.set('x-user-id', 'saver-1');
    });

    it('10 concurrent saves from same user → stats.saves is +1, save-doc exists once', async () => {
        const resource = {
            id: 'res-1',
            title: 'Topic',
            type: 'lesson-plan',
            authorId: 'other-author',
            language: 'English',
        };
        await Promise.all(Array.from({ length: 10 }, () => saveResourceToLibraryAction(resource)));

        const finalSaves = rec(['library_resources', 'res-1'])?.data?.stats?.saves ?? 0;
        expect(finalSaves).toBe(1);

        let saveDocs = 0;
        for (const [path, r] of store.entries()) {
            if (path.startsWith('library_resources/res-1/saves/') && r.data !== undefined) saveDocs++;
        }
        expect(saveDocs).toBe(1);
    });
});
