/**
 * F5-005 regression test — failed→processing status flip must be
 * compare-and-set, not last-write-wins.
 *
 * We exercise the transaction-wrapped CAS directly via an in-memory
 * Firestore mock with optimistic locking. Two concurrent retriers must
 * see exactly one winner — the second retrier observes `status ===
 * 'processing'` and skips.
 */

type DocRecord = { data: any; version: number };

const store = new Map<string, DocRecord>();
function get(k: string) { return store.get(k); }
function setRec(k: string, data: any) {
    const prev = store.get(k);
    store.set(k, { data, version: (prev?.version ?? 0) + 1 });
}

class MockDocRef {
    constructor(public path: string) {}
    async get() {
        const rec = store.get(this.path);
        return { exists: !!rec && rec.data !== undefined, data: () => rec?.data, ref: this };
    }
}

const mockDb = {
    doc(p: string) { return new MockDocRef(p); },
    async runTransaction(fn: (tx: any) => Promise<any>) {
        for (let attempt = 0; attempt < 5; attempt++) {
            const readVersions = new Map<string, number>();
            const writes: Array<() => void> = [];
            const tx = {
                async get(ref: MockDocRef) {
                    const rec = store.get(ref.path);
                    readVersions.set(ref.path, rec?.version ?? 0);
                    await new Promise((r) => queueMicrotask(r));
                    return { exists: !!rec && rec.data !== undefined, data: () => rec?.data };
                },
                update(ref: MockDocRef, patch: any) {
                    writes.push(() => {
                        const cur = store.get(ref.path)?.data ?? {};
                        setRec(ref.path, { ...cur, ...patch });
                    });
                },
            };
            const ret = await fn(tx);
            let stale = false;
            for (const [k, v] of readVersions) {
                if ((store.get(k)?.version ?? 0) !== v) { stale = true; break; }
            }
            if (stale) continue;
            for (const w of writes) w();
            return ret;
        }
        throw new Error('Transaction failed after retries');
    },
};

describe('F5-005: failed→processing flip is compare-and-set', () => {
    beforeEach(() => {
        store.clear();
        setRec('webhook_events/evt-1', { status: 'failed' });
    });

    it('two concurrent retriers → exactly one wins the flip', async () => {
        async function attemptRetry(): Promise<boolean> {
            const ref = mockDb.doc('webhook_events/evt-1');
            return mockDb.runTransaction(async (tx) => {
                const existing = await tx.get(ref);
                if (existing.data()?.status === 'failed') {
                    tx.update(ref, { status: 'processing', retriedAt: new Date() });
                    return true;
                }
                return false;
            });
        }

        const [a, b, c] = await Promise.all([attemptRetry(), attemptRetry(), attemptRetry()]);
        const winners = [a, b, c].filter(Boolean).length;
        expect(winners).toBe(1);
        expect(store.get('webhook_events/evt-1')?.data?.status).toBe('processing');
    });
});
