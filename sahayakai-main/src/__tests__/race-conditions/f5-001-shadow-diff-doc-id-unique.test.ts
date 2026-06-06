/**
 * F5-001 regression test — `writeAgentShadowDiff` must produce a unique
 * doc ID for every call, even when called 200 times for the same uid in
 * the same millisecond.
 *
 * The old doc-id `${uid}__${Date.now()}` collided on same-ms bursts —
 * Firestore `.set()` silently overwrote earlier writes, breaking the
 * Q4C parity rollup and the canary→full promotion gate.
 *
 * Fix adds an 8-char random suffix → 200 calls produce 200 unique IDs.
 */

const captured: string[] = [];

const setMock = jest.fn(async () => {});

const docMock = jest.fn((id: string) => {
    captured.push(id);
    return { set: setMock };
});

const collectionMock = jest.fn(() => ({
    doc: docMock,
}));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: () => ({
            doc: () => ({
                collection: collectionMock,
            }),
        }),
    }),
}));

// Freeze Date.now so every call hits the same millisecond.
const FROZEN_MS = 1_700_000_000_000;

import { writeAgentShadowDiff } from '@/lib/sidecar/shadow-diff-writer';

describe('F5-001: shadow-diff doc IDs are unique under same-ms bursts', () => {
    let dateNowSpy: jest.SpyInstance;

    beforeEach(() => {
        captured.length = 0;
        docMock.mockClear();
        setMock.mockClear();
        collectionMock.mockClear();
        dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(FROZEN_MS);
    });

    afterEach(() => {
        dateNowSpy.mockRestore();
    });

    it('200 same-uid same-ms calls → 200 unique doc IDs', async () => {
        const calls = Array.from({ length: 200 }, () =>
            writeAgentShadowDiff({
                agent: 'vidya',
                uid: 'user-1',
                genkit: { ok: true },
                sidecar: { ok: true },
                genkitLatencyMs: 10,
                sidecarLatencyMs: 12,
                sidecarOk: true,
            }),
        );
        await Promise.all(calls);

        expect(captured).toHaveLength(200);
        const unique = new Set(captured);
        expect(unique.size).toBe(200);

        // Sanity: every id matches the new shape.
        for (const id of captured) {
            expect(id).toMatch(/^user-1__\d+__[0-9a-f]{8}$/);
        }
    });
});
