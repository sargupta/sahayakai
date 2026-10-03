/**
 * Saved conversations (My Library → Conversations).
 *
 * - Only conversations the teacher explicitly bookmarks are listed.
 * - They stay in users/{uid}/vidya_sessions — never written to
 *   users/{uid}/content (the Generations / artifacts store).
 * - Pruning (10 most recent) never deletes a saved conversation.
 * - Every read/write is path-scoped to the caller's uid.
 */

jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

type Doc = Record<string, unknown>;
const store = new Map<string, Map<string, Doc>>(); // collection path → id → doc
const touchedCollections = new Set<string>();

const ts = (ms: number) => ({ toDate: () => new Date(ms), toMillis: () => ms });

function col(path: string): any {
    touchedCollections.add(path.split('/').slice(-1)[0]);
    const docs = () => [...(store.get(path) ?? new Map()).entries()];
    const snap = (entries: Array<[string, Doc]>) => ({
        empty: entries.length === 0,
        docs: entries.map(([id, data]) => ({ id, data: () => data, ref: doc(`${path}/${id}`) })),
    });
    const query = (filter?: (d: Doc) => boolean, order?: string, lim?: number): any => ({
        where: (field: string, _op: string, value: unknown) => query((d) => d[field] === value, order, lim),
        orderBy: (field: string) => query(filter, field, lim),
        limit: (n: number) => query(filter, order, n),
        get: async () => {
            let entries = docs().filter(([, d]) => (filter ? filter(d) : true));
            if (order) entries = entries.sort((a, b) => (b[1][order] as any).toMillis() - (a[1][order] as any).toMillis());
            return snap(entries.slice(0, lim ?? Infinity));
        },
    });
    return { doc: (id: string) => doc(`${path}/${id}`), ...query() };
}
function doc(path: string): any {
    const i = path.lastIndexOf('/');
    const c = path.slice(0, i);
    const id = path.slice(i + 1);
    return {
        get: async () => ({ id, exists: store.get(c)?.has(id) ?? false, data: () => store.get(c)?.get(id) }),
        set: async (data: Doc, opts?: { merge?: boolean }) => {
            if (!store.has(c)) store.set(c, new Map());
            const prev = opts?.merge ? store.get(c)!.get(id) ?? {} : {};
            const next: Doc = { ...prev };
            for (const [k, v] of Object.entries(data)) {
                if (v && typeof v === 'object' && (v as any).__delete) delete next[k];
                else next[k] = v;
            }
            store.get(c)!.set(id, next);
        },
        delete: async () => { store.get(c)?.delete(id); },
        collection: (sub: string) => col(`${path}/${sub}`),
    };
}
const db = {
    collection: (name: string) => col(name),
    batch: () => {
        const ops: Array<() => Promise<void>> = [];
        return { delete: (ref: any) => ops.push(() => ref.delete()), commit: async () => { for (const op of ops) await op(); } };
    },
};
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => db }));
jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => ts(Date.now()),
        delete: () => ({ __delete: true }),
        arrayUnion: (...v: unknown[]) => v,
    },
}));

import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');
const lastBody = () => jsonSpy.mock.calls.at(-1)?.[0] as any;

function req(method: string, uid: string, opts: { search?: string; body?: unknown } = {}) {
    return {
        method,
        url: `http://localhost/api/vidya/session${opts.search ?? ''}`,
        nextUrl: { searchParams: new URLSearchParams(opts.search ?? '') },
        headers: { get: (k: string) => (k === 'x-user-id' ? uid : null) },
        json: async () => opts.body ?? {},
    } as any;
}
function seed(uid: string, id: string, data: Doc) {
    const path = `users/${uid}/vidya_sessions`;
    if (!store.has(path)) store.set(path, new Map());
    store.get(path)!.set(id, data);
}
const msgs = (q: string) => [{ role: 'user', parts: [{ text: q }] }, { role: 'model', parts: [{ text: 'answer' }] }];

let route: typeof import('@/app/api/vidya/session/route');
beforeAll(async () => { route = await import('@/app/api/vidya/session/route'); });
beforeEach(() => { store.clear(); touchedCollections.clear(); jsonSpy.mockClear(); });

describe('saved conversations', () => {
    it('lists ONLY bookmarked conversations, newest first, with a title from the first question', async () => {
        seed('t1', 's-old', { messages: msgs('How do I teach fractions?'), saved: true, savedAt: ts(1000), updatedAt: ts(1000) });
        seed('t1', 's-new', { messages: msgs('Ideas for a noisy class'), saved: true, savedAt: ts(2000), updatedAt: ts(2000) });
        seed('t1', 's-chat', { messages: msgs('Hi Vidya'), updatedAt: ts(3000) }); // ordinary chat

        await route.GET(req('GET', 't1', { search: '?saved=1' }));

        const { items } = lastBody();
        expect(items.map((i: any) => i.id)).toEqual(['s-new', 's-old']);
        expect(items[0]).toMatchObject({ title: 'Ideas for a noisy class', messageCount: 2 });
    });

    it('bookmarks / un-bookmarks without ever writing to the content (Generations) store', async () => {
        seed('t1', 's1', { messages: msgs('Explain photosynthesis simply'), updatedAt: ts(1) });

        await route.PATCH(req('PATCH', 't1', { body: { sessionId: 's1', saved: true } }));
        expect(store.get('users/t1/vidya_sessions')!.get('s1')).toMatchObject({ saved: true, title: 'Explain photosynthesis simply' });

        await route.PATCH(req('PATCH', 't1', { body: { sessionId: 's1', saved: false } }));
        expect(store.get('users/t1/vidya_sessions')!.get('s1')!.saved).toBe(false);
        expect(store.get('users/t1/vidya_sessions')!.get('s1')!.messages).toBeDefined(); // history kept

        expect(touchedCollections.has('content')).toBe(false);
        expect([...store.keys()].some((p) => p.includes('/content'))).toBe(false);
    });

    it('opens one of the teacher\'s own conversations', async () => {
        seed('t1', 's1', { messages: msgs('Q'), saved: true, title: 'Q' });
        await route.GET(req('GET', 't1', { search: '?id=s1' }));
        expect(lastBody()).toMatchObject({ sessionId: 's1', saved: true, messages: msgs('Q') });
    });

    it('cannot reach or bookmark another teacher\'s conversation', async () => {
        seed('t1', 's1', { messages: msgs('private'), updatedAt: ts(1) });

        const read = await route.GET(req('GET', 't2', { search: '?id=s1' }));
        expect(read.status).toBe(404);
        const write = await route.PATCH(req('PATCH', 't2', { body: { sessionId: 's1', saved: true } }));
        expect(write.status).toBe(404);
        expect(store.get('users/t1/vidya_sessions')!.get('s1')!.saved).toBeUndefined();
    });

    it('rejects a malformed bookmark request', async () => {
        const res = await route.PATCH(req('PATCH', 't1', { body: { sessionId: 's1', saved: 'yes' } }));
        expect(res.status).toBe(400);
    });

    it('pruning keeps saved conversations even when they are old', async () => {
        seed('t1', 'saved-old', { messages: msgs('keep me'), saved: true, updatedAt: ts(1) });
        for (let i = 0; i < 12; i++) seed('t1', `chat-${i}`, { messages: msgs(`c${i}`), updatedAt: ts(100 + i) });

        await route.POST(req('POST', 't1', { body: { sessionId: 'chat-new', messages: msgs('new'), isNew: true } }));
        await new Promise((r) => setTimeout(r, 0)); // prune is fire-and-forget

        const remaining = store.get('users/t1/vidya_sessions')!;
        expect(remaining.has('saved-old')).toBe(true);
        const unsaved = [...remaining.values()].filter((d) => d.saved !== true);
        expect(unsaved.length).toBeLessThanOrEqual(10);
    });
});

describe('every conversation is retained automatically (My Library → Conversations)', () => {
    it('a normal chat turn creates a conversation that is listed WITHOUT a bookmark, and no Generation', async () => {
        await route.POST(req('POST', 't1', { body: { sessionId: 'sess_chat', messages: msgs('Who are you and what can you help me with?'), isNew: true } }));

        await route.GET(req('GET', 't1', { search: '?list=1' }));
        expect(lastBody().items).toEqual([
            expect.objectContaining({ id: 'sess_chat', title: 'Who are you and what can you help me with?', saved: false, messageCount: 2 }),
        ]);
        expect(touchedCollections.has('content')).toBe(false);
        expect([...store.keys()].some((p) => p.includes('/content'))).toBe(false);
    });

    it('a contextual question (e.g. on Attendance) is a conversation, never a Generation', async () => {
        await route.POST(req('POST', 't1', { body: { sessionId: 'sess_ctx', messages: msgs('How many students are absent?'), screenPath: '/attendance/8b', isNew: true } }));
        await route.GET(req('GET', 't1', { search: '?list=1' }));
        expect(lastBody().items.map((i: any) => i.id)).toEqual(['sess_ctx']);
        expect(touchedCollections.has('content')).toBe(false);
    });

    it('lists ALL conversations newest first (saved and unsaved), skipping sessions with no teacher message', async () => {
        seed('t1', 'old-saved', { messages: msgs('kept one'), saved: true, savedAt: ts(5), updatedAt: ts(1000) });
        seed('t1', 'new-chat', { messages: msgs('latest chat'), updatedAt: ts(3000) });
        seed('t1', 'mid-chat', { messages: msgs('earlier chat'), updatedAt: ts(2000) });
        seed('t1', 'empty', { messages: [], updatedAt: ts(4000) });

        await route.GET(req('GET', 't1', { search: '?list=1' }));
        const { items } = lastBody();
        expect(items.map((i: any) => [i.id, i.saved])).toEqual([['new-chat', false], ['mid-chat', false], ['old-saved', true]]);
    });

    it('a teacher only ever sees their own conversations', async () => {
        seed('t1', 's-a', { messages: msgs('teacher A private chat'), updatedAt: ts(1) });
        seed('t2', 's-b', { messages: msgs('teacher B chat'), updatedAt: ts(2) });

        await route.GET(req('GET', 't2', { search: '?list=1' }));
        expect(lastBody().items.map((i: any) => i.id)).toEqual(['s-b']);
    });
});
