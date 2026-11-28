/**
 * In-memory Firestore + Firebase Auth fakes for the access-gate backend
 * tests. Small on purpose: only what the code under test uses (documents,
 * subcollections, merge sets, transactions, batches, simple where/orderBy/
 * limit queries, and the increment / arrayUnion / delete field transforms).
 *
 * Not a test file (no `.test.` in the name), so Jest does not collect it.
 */

type Data = Record<string, any>;

export const fakeFieldValue = {
    increment: (n: number) => ({ __op: 'inc', n }),
    arrayUnion: (...elements: unknown[]) => ({ __op: 'union', elements }),
    delete: () => ({ __op: 'del' }),
    serverTimestamp: () => new Date(),
};

function applyWrite(target: Data, patch: Data): Data {
    const out: Data = { ...target };
    for (const [key, value] of Object.entries(patch)) {
        if (value && typeof value === 'object' && '__op' in value) {
            if (value.__op === 'inc') out[key] = (typeof out[key] === 'number' ? out[key] : 0) + value.n;
            else if (value.__op === 'union') {
                const cur: unknown[] = Array.isArray(out[key]) ? out[key] : [];
                out[key] = [...cur, ...value.elements.filter((e: unknown) => !cur.includes(e))];
            } else if (value.__op === 'del') delete out[key];
        } else {
            out[key] = value;
        }
    }
    return out;
}

function comparable(v: unknown): number | string | null {
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number' || typeof v === 'string') return v;
    return null;
}

export class FakeFirestore {
    /** path -> data, e.g. "organizations/o1/members/u1" */
    store = new Map<string, Data>();
    private autoId = 0;

    seed(path: string, data: Data): void {
        this.store.set(path, { ...data });
    }
    read(path: string): Data | undefined {
        const d = this.store.get(path);
        return d ? { ...d } : undefined;
    }

    collection(path: string): FakeCollection {
        return new FakeCollection(this, path);
    }

    nextId(): string {
        this.autoId += 1;
        return `auto_${this.autoId}`;
    }

    async runTransaction<T>(fn: (tx: FakeTx) => Promise<T>): Promise<T> {
        const tx = new FakeTx();
        const result = await fn(tx);
        // Writes are applied only if the callback did not throw.
        for (const write of tx.writes) write();
        return result;
    }

    batch() {
        const writes: Array<() => void> = [];
        const api = {
            set: (ref: FakeDocRef, data: Data, opts?: { merge?: boolean }) => {
                writes.push(() => ref.applySet(data, opts));
                return api;
            },
            update: (ref: FakeDocRef, data: Data) => {
                writes.push(() => ref.applyUpdate(data));
                return api;
            },
            commit: async () => {
                for (const w of writes) w();
            },
        };
        return api;
    }
}

class FakeTx {
    writes: Array<() => void> = [];
    async get(target: FakeDocRef | FakeQuery): Promise<any> {
        return target.get();
    }
    set(ref: FakeDocRef, data: Data, opts?: { merge?: boolean }) {
        this.writes.push(() => ref.applySet(data, opts));
    }
    update(ref: FakeDocRef, data: Data) {
        this.writes.push(() => ref.applyUpdate(data));
    }
    delete(ref: FakeDocRef) {
        this.writes.push(() => ref.db.store.delete(ref.path));
    }
}

export class FakeDocRef {
    constructor(public db: FakeFirestore, public path: string) {}
    get id(): string {
        return this.path.split('/').pop() as string;
    }
    get ref(): FakeDocRef {
        return this;
    }
    collection(name: string): FakeCollection {
        return new FakeCollection(this.db, `${this.path}/${name}`);
    }
    snapshot() {
        const data = this.db.read(this.path);
        return { id: this.id, ref: this, exists: data !== undefined, data: () => data };
    }
    async get() {
        return this.snapshot();
    }
    applySet(data: Data, opts?: { merge?: boolean }) {
        const base = opts?.merge ? this.db.read(this.path) ?? {} : {};
        this.db.store.set(this.path, applyWrite(base, data));
    }
    applyUpdate(data: Data) {
        const base = this.db.read(this.path);
        if (base === undefined) throw new Error(`NOT_FOUND: ${this.path}`);
        this.db.store.set(this.path, applyWrite(base, data));
    }
    async set(data: Data, opts?: { merge?: boolean }) {
        this.applySet(data, opts);
    }
    async update(data: Data) {
        this.applyUpdate(data);
    }
    async delete() {
        this.db.store.delete(this.path);
    }
}

type Filter = { field: string; op: string; value: unknown };

export class FakeQuery {
    constructor(
        protected db: FakeFirestore,
        protected path: string,
        protected filters: Filter[] = [],
        protected order: { field: string; dir: 'asc' | 'desc' } | null = null,
        protected max: number | null = null,
    ) {}
    where(field: string, op: string, value: unknown): FakeQuery {
        return new FakeQuery(this.db, this.path, [...this.filters, { field, op, value }], this.order, this.max);
    }
    orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): FakeQuery {
        return new FakeQuery(this.db, this.path, this.filters, { field, dir }, this.max);
    }
    limit(n: number): FakeQuery {
        return new FakeQuery(this.db, this.path, this.filters, this.order, n);
    }
    async get() {
        const depth = this.path.split('/').length + 1;
        let docs = [...this.db.store.keys()]
            .filter((p) => p.startsWith(`${this.path}/`) && p.split('/').length === depth)
            .map((p) => new FakeDocRef(this.db, p).snapshot());
        for (const f of this.filters) {
            docs = docs.filter((d) => {
                const v = (d.data() as Data)[f.field];
                if (f.op === '==') return v === f.value;
                const a = comparable(v);
                const b = comparable(f.value);
                if (a === null || b === null || typeof a !== typeof b) return false;
                if (f.op === '<=') return a <= b;
                if (f.op === '>=') return a >= b;
                if (f.op === '<') return a < b;
                if (f.op === '>') return a > b;
                throw new Error(`unsupported op ${f.op}`);
            });
        }
        if (this.order) {
            const { field, dir } = this.order;
            // Firestore drops documents that lack the orderBy field.
            docs = docs.filter((d) => comparable((d.data() as Data)[field]) !== null);
            docs.sort((x, y) => {
                const a = comparable((x.data() as Data)[field]) as number | string;
                const b = comparable((y.data() as Data)[field]) as number | string;
                return (a < b ? -1 : a > b ? 1 : 0) * (dir === 'asc' ? 1 : -1);
            });
        }
        if (this.max !== null) docs = docs.slice(0, this.max);
        return { docs, size: docs.length, empty: docs.length === 0 };
    }
}

export class FakeCollection extends FakeQuery {
    constructor(db: FakeFirestore, path: string) {
        super(db, path);
    }
    doc(id?: string): FakeDocRef {
        return new FakeDocRef(this.db, `${this.path}/${id ?? this.db.nextId()}`);
    }
    async add(data: Data): Promise<FakeDocRef> {
        const ref = this.doc();
        await ref.set(data);
        return ref;
    }
}

export interface FakeAuthUser {
    uid: string;
    email?: string;
    displayName?: string;
    customClaims?: Record<string, unknown>;
    creationTime: string;
}

export class FakeAuth {
    users = new Map<string, FakeAuthUser>();
    setCustomUserClaims = jest.fn(async (uid: string, claims: Record<string, unknown>) => {
        const u = this.users.get(uid);
        if (!u) throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' });
        u.customClaims = { ...claims };
    });

    add(user: FakeAuthUser): void {
        this.users.set(user.uid, { ...user });
    }
    claims(uid: string): Record<string, unknown> {
        return this.users.get(uid)?.customClaims ?? {};
    }
    private record(u: FakeAuthUser) {
        return {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            customClaims: u.customClaims,
            metadata: { creationTime: u.creationTime },
        };
    }
    async getUser(uid: string) {
        const u = this.users.get(uid);
        if (!u) throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' });
        return this.record(u);
    }
    async getUserByEmail(email: string) {
        const u = [...this.users.values()].find((x) => x.email === email);
        if (!u) throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' });
        return this.record(u);
    }
}

/** A minimal Request stand-in for route handlers. */
export function makeRequest(options: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
}): Request {
    const low: Record<string, string> = {};
    for (const [k, v] of Object.entries(options.headers ?? {})) low[k.toLowerCase()] = v;
    return {
        url: options.url ?? 'https://example.test/api/x',
        method: options.method ?? 'POST',
        headers: { get: (k: string) => low[k.toLowerCase()] ?? null },
        json: async () => {
            if (options.body === undefined) throw new Error('no body');
            return options.body;
        },
    } as unknown as Request;
}
