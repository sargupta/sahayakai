/**
 * Minimal in-memory Firestore for attendance route tests: doc get/set/update,
 * and chained `where(==|>=)` + `limit` queries. Enough for the call and outreach
 * routes, nothing more.
 */

export type Store = Record<string, Record<string, Record<string, any>>>;

export function createFakeDb(store: Store) {
    let seq = 0;
    const coll = (path: string) => {
        store[path] ??= {};
        return {
            doc: (id?: string) => docRef(path, id ?? `auto_${++seq}`),
            where: (field: string, op: string, value: unknown) => query(path, [[field, op, value]]),
        };
    };
    const docRef = (path: string, id: string): any => ({
        id,
        get: async () => {
            const data = store[path]?.[id];
            return { exists: data !== undefined, id, data: () => data };
        },
        set: async (rec: Record<string, any>) => {
            (store[path] ??= {})[id] = { ...rec };
        },
        update: async (patch: Record<string, any>) => {
            if (!store[path]?.[id]) throw new Error(`NOT_FOUND ${path}/${id}`);
            store[path][id] = { ...store[path][id], ...patch };
        },
        collection: (sub: string) => coll(`${path}/${id}/${sub}`),
    });
    const query = (path: string, filters: [string, string, unknown][]): any => ({
        where: (f: string, op: string, v: unknown) => query(path, [...filters, [f, op, v]]),
        limit: () => query(path, filters),
        get: async () => {
            const docs = Object.entries(store[path] ?? {})
                .filter(([, d]) =>
                    filters.every(([f, op, v]) =>
                        op === '==' ? d[f] === v : op === '>=' ? (d[f] as any) >= (v as any) : false,
                    ),
                )
                .map(([id, d]) => ({ id, data: () => d }));
            return { empty: docs.length === 0, docs };
        },
    });
    return { collection: (name: string) => coll(name) } as any;
}

/**
 * The jest Response polyfill drops NextResponse.json bodies, so route tests read
 * the body from the spy call instead (same approach as attendance-outreach.test.ts).
 */
export function lastJsonBody(spy: jest.SpyInstance): any {
    const calls = spy.mock.calls;
    return calls[calls.length - 1]?.[0];
}
