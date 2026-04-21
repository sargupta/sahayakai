/**
 * Regression tests for the atomic quota reservation flow.
 *
 * Before the fix: plan-guard did read → handler → increment (fire-and-forget).
 * Two concurrent requests from the same user could both pass the limit check
 * before either incremented, effectively bypassing the limit.
 *
 * After the fix: reserveQuota() does a transactional check-and-increment. Two
 * concurrent calls cannot both succeed when the limit is tight.
 *
 * We mock firebase-admin/firestore to simulate real transaction semantics.
 */

import { FieldValue } from 'firebase-admin/firestore';

jest.mock('../../lib/firebase-admin', () => ({
    getDb: jest.fn(),
}));

// Mock firebase-admin/firestore so FieldValue.increment is a marker
jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        increment: (n: number) => ({ __increment: n }),
        serverTimestamp: () => ({ __serverTimestamp: true }),
    },
}));

import { reserveQuota, rollbackQuota } from '../../lib/usage-counters';
import { getDb } from '../../lib/firebase-admin';

/**
 * Minimal Firestore stub that simulates optimistic concurrency in runTransaction:
 * - Each tx gets a snapshot of the doc's current state
 * - Writes stage a patch; tx.commit() applies patches in serial order
 * - If two txs race on the same doc, the second to commit sees stale read
 *   and we re-invoke the updateFn (matching Firestore's retry behavior).
 */
function makeFakeDb() {
    const store = new Map<string, Record<string, any>>();

    const ref = (path: string) => ({
        path,
        async get() {
            return {
                exists: store.has(path),
                data: () => store.get(path) ?? {},
            };
        },
        async set(data: any, _opts?: any) {
            const existing = store.get(path) ?? {};
            const merged = { ...existing };
            for (const [k, v] of Object.entries(data)) {
                if (v && typeof v === 'object' && '__increment' in v) {
                    merged[k] = (merged[k] ?? 0) + (v as any).__increment;
                } else if (v && typeof v === 'object' && '__serverTimestamp' in v) {
                    merged[k] = new Date();
                } else {
                    merged[k] = v;
                }
            }
            store.set(path, merged);
        },
    });

    // Single global mutex to serialize transactions (matches Firestore strong
    // consistency on a single document; good enough for these tests).
    let txMutex = Promise.resolve();

    return {
        collection: (name: string) => ({
            doc: (id: string) => {
                const r = ref(`${name}/${id}`);
                return {
                    ...r,
                    async update(data: any) {
                        return r.set(data);
                    },
                };
            },
        }),
        async runTransaction<T>(updateFn: (tx: any) => Promise<T>): Promise<T> {
            const run = async (): Promise<T> => {
                const tx = {
                    async get(docRef: any) {
                        return docRef.get();
                    },
                    set(docRef: any, data: any) {
                        // Apply immediately; our mutex ensures isolation
                        return (docRef as any).set(data);
                    },
                    update(docRef: any, data: any) {
                        return (docRef as any).set(data);
                    },
                };
                return updateFn(tx);
            };
            const result = txMutex.then(run);
            // Next tx waits until this one finishes (regardless of outcome)
            txMutex = result.then(
                () => undefined,
                () => undefined,
            );
            return result;
        },
        _store: store,
    };
}

describe('reserveQuota atomic check-and-increment', () => {
    let fakeDb: ReturnType<typeof makeFakeDb>;

    beforeEach(() => {
        fakeDb = makeFakeDb();
        (getDb as jest.Mock).mockResolvedValue(fakeDb);
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('allows requests under the monthly limit', async () => {
        const result = await reserveQuota('user-a', 'lesson-plan', 10);
        expect(result.ok).toBe(true);
    });

    it('blocks requests at the monthly limit', async () => {
        // Pre-populate to 10/10
        for (let i = 0; i < 10; i++) {
            const r = await reserveQuota('user-b', 'lesson-plan', 10);
            expect(r.ok).toBe(true);
        }
        const blocked = await reserveQuota('user-b', 'lesson-plan', 10);
        expect(blocked.ok).toBe(false);
        if (!blocked.ok) {
            expect(blocked.reason).toBe('monthly');
            expect(blocked.used).toBe(10);
            expect(blocked.limit).toBe(10);
        }
    });

    it('blocks requests at the daily limit even if monthly has room', async () => {
        for (let i = 0; i < 5; i++) {
            const r = await reserveQuota('user-c', 'instant-answer', -1, 5);
            expect(r.ok).toBe(true);
        }
        const blocked = await reserveQuota('user-c', 'instant-answer', -1, 5);
        expect(blocked.ok).toBe(false);
        if (!blocked.ok) {
            expect(blocked.reason).toBe('daily');
        }
    });

    it('allows unlimited when both limits are -1', async () => {
        for (let i = 0; i < 50; i++) {
            const r = await reserveQuota('user-d', 'voice-to-text', -1, -1);
            expect(r.ok).toBe(true);
        }
    });

    it('REGRESSION: concurrent requests cannot both pass a tight limit', async () => {
        // The pre-fix bug: two parallel requests both read `used=9`, both pass
        // the check, both execute, both increment → usage becomes 11 on a
        // limit of 10. With atomic reservation, exactly one should succeed.

        // Pre-populate 9/10
        for (let i = 0; i < 9; i++) {
            await reserveQuota('user-race', 'lesson-plan', 10);
        }

        // Fire two parallel requests — exactly one should get ok:true
        const [a, b] = await Promise.all([
            reserveQuota('user-race', 'lesson-plan', 10),
            reserveQuota('user-race', 'lesson-plan', 10),
        ]);

        const successes = [a, b].filter((r) => r.ok).length;
        const failures = [a, b].filter((r) => !r.ok).length;
        expect(successes).toBe(1);
        expect(failures).toBe(1);
    });

    it('REGRESSION: 50 parallel requests cannot exceed a limit of 10', async () => {
        // Escalated version of the race test — mirrors the "script 100 parallel
        // requests to bypass a 10-limit" attack path from the bug report.
        const results = await Promise.all(
            Array.from({ length: 50 }, () => reserveQuota('user-swarm', 'quiz', 10)),
        );
        const successes = results.filter((r) => r.ok).length;
        expect(successes).toBeLessThanOrEqual(10);
    });

    it('rollbackQuota decrements the counter when called after a failed handler', async () => {
        const reserved = await reserveQuota('user-rollback', 'lesson-plan', 5);
        expect(reserved.ok).toBe(true);

        await rollbackQuota('user-rollback', 'lesson-plan');

        // After rollback, the user should be back to 0 used and able to reserve again
        for (let i = 0; i < 5; i++) {
            const r = await reserveQuota('user-rollback', 'lesson-plan', 5);
            expect(r.ok).toBe(true);
        }
    });

    it('FAIL-CLOSED: transaction errors surface as a 429-like denial, not a silent pass', async () => {
        // Simulate Firestore outage by making runTransaction reject
        (getDb as jest.Mock).mockResolvedValueOnce({
            collection: () => ({ doc: () => ({}) }),
            runTransaction: () => Promise.reject(new Error('Firestore unavailable')),
        });

        const result = await reserveQuota('user-down', 'lesson-plan', 10);
        // The old code would have silently swallowed this and let the user through.
        // The new code returns ok:false so the caller responds with 429.
        expect(result.ok).toBe(false);
    });
});
