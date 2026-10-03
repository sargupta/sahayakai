/**
 * My Library status semantics (listContent):
 *   ready / no status (legacy) → listed
 *   generating                 → listed (the 202 STILL_GENERATING path tells
 *                                the teacher to check My Library), unless stale
 *   error                      → never listed as if it were an artifact
 *   soft-deleted               → never listed (existing behaviour)
 */

jest.mock('@/lib/usage-tracker', () => ({ UsageTracker: { logUsage: jest.fn() } }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const docs: Array<Record<string, unknown>> = [];
const query: Record<string, unknown> = {};
Object.assign(query, {
    orderBy: () => query,
    where: () => query,
    startAfter: () => query,
    limit: () => query,
    get: async () => ({ docs: docs.map((d) => ({ id: d.id, data: () => d })) }),
});
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: () => ({ doc: () => ({ collection: () => ({ ...query, doc: () => ({ get: async () => ({ exists: false }) }) }) }) }),
    }),
}));

import { dbAdapter, isListableContent, STALE_GENERATING_MS } from '@/lib/db/adapter';

const NOW = 1_800_000_000_000;
const ts = (ms: number) => ({ toMillis: () => ms });

describe('isListableContent', () => {
    it('lists ready rows and legacy rows without a status', () => {
        expect(isListableContent({ status: 'ready' } as never, NOW)).toBe(true);
        expect(isListableContent({} as never, NOW)).toBe(true);
    });

    it('never lists failed generations', () => {
        expect(isListableContent({ status: 'error' } as never, NOW)).toBe(false);
    });

    it('lists an in-flight generation so "check My Library in a minute" holds', () => {
        expect(isListableContent({ status: 'generating', updatedAt: ts(NOW - 60_000) } as never, NOW)).toBe(true);
    });

    it('hides a generating row that never finished (stale)', () => {
        expect(
            isListableContent({ status: 'generating', updatedAt: ts(NOW - STALE_GENERATING_MS - 1) } as never, NOW),
        ).toBe(false);
    });
});

describe('dbAdapter.listContent status filtering', () => {
    beforeEach(() => { docs.length = 0; });

    it('returns ready + in-flight items and drops error + deleted ones', async () => {
        const fresh = { toMillis: () => Date.now() };
        docs.push(
            { id: 'ready', status: 'ready' },
            { id: 'legacy' },
            { id: 'inflight', status: 'generating', updatedAt: fresh },
            { id: 'failed', status: 'error' },
            { id: 'deleted', status: 'ready', deletedAt: fresh },
        );

        const { items } = await dbAdapter.listContent('u1');

        expect(items.map((i) => i.id)).toEqual(['ready', 'legacy', 'inflight']);
    });
});
