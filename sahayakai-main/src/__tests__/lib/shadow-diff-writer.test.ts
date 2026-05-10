/**
 * Tests for the Phase M.5 generic shadow-diff writer.
 *
 * Verifies:
 *   1. Happy path → Firestore receives a doc at
 *      `agent_shadow_diffs/{date}/{agent}/{uid}__{ts}` with the
 *      sample fields + `createdAt`.
 *   2. Failure path (Firestore unavailable) → fail-soft, never
 *      throws, emits a structured `shadow_diff_write_failed` warn.
 *   3. Multiple agents land in their respective subcollections
 *      (vidya vs quiz) so an aggregator can read them per-agent.
 *
 * Round-2 audit reference: M.5 first-canary-flip-no-longer-blind.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSet = jest.fn(async () => undefined);
const mockDocLeaf = jest.fn(() => ({ set: mockSet }));
const mockSubcollection = jest.fn(() => ({ doc: mockDocLeaf }));
const mockDocDate = jest.fn(() => ({ collection: mockSubcollection }));
const mockCollection = jest.fn(() => ({ doc: mockDocDate }));
const mockDb = { collection: mockCollection };

const mockGetDb = jest.fn(async () => mockDb);

jest.mock('@/lib/firebase-admin', () => ({
    getDb: (...args: unknown[]) => mockGetDb(...args),
}));

import { writeAgentShadowDiff } from '@/lib/sidecar/shadow-diff-writer';

beforeEach(() => {
    jest.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
    mockGetDb.mockResolvedValue(mockDb);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('writeAgentShadowDiff', () => {
    it('writes a doc to agent_shadow_diffs/{date}/{agent}/{uid}__{ts}', async () => {
        await writeAgentShadowDiff({
            agent: 'vidya',
            uid: 'teacher-uid-1',
            genkit: { response: 'genkit answer' },
            sidecar: { response: 'sidecar answer' },
            genkitLatencyMs: 1234,
            sidecarLatencyMs: 1100,
            sidecarOk: true,
        });

        expect(mockGetDb).toHaveBeenCalledTimes(1);
        // Root collection.
        expect(mockCollection).toHaveBeenCalledWith('agent_shadow_diffs');
        // Date doc — YYYY-MM-DD.
        const [dateArg] = mockDocDate.mock.calls[0] as unknown as [string];
        expect(dateArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // Subcollection = agent name.
        expect(mockSubcollection).toHaveBeenCalledWith('vidya');
        // Doc id = `{uid}__{ts}`.
        const [docIdArg] = mockDocLeaf.mock.calls[0] as unknown as [string];
        expect(docIdArg).toMatch(/^teacher-uid-1__\d+$/);
        // Set called with the sample fields + createdAt.
        expect(mockSet).toHaveBeenCalledTimes(1);
        const [body] = mockSet.mock.calls[0] as unknown as [
            Record<string, unknown>,
        ];
        expect(body).toMatchObject({
            agent: 'vidya',
            uid: 'teacher-uid-1',
            sidecarOk: true,
            genkitLatencyMs: 1234,
            sidecarLatencyMs: 1100,
        });
        expect(body.createdAt).toBeInstanceOf(Date);
    });

    it('persists sidecar errors when the sidecar call failed', async () => {
        await writeAgentShadowDiff({
            agent: 'quiz',
            uid: 'teacher-uid-2',
            genkit: { variants: 3 },
            sidecar: null,
            genkitLatencyMs: 2500,
            sidecarLatencyMs: 8000,
            sidecarOk: false,
            sidecarError: 'sidecar timeout: 8000ms',
        });

        expect(mockSubcollection).toHaveBeenCalledWith('quiz');
        const [body] = mockSet.mock.calls[0] as unknown as [
            Record<string, unknown>,
        ];
        expect(body).toMatchObject({
            agent: 'quiz',
            sidecar: null,
            sidecarOk: false,
            sidecarError: 'sidecar timeout: 8000ms',
        });
    });

    it('routes different agents into distinct subcollections', async () => {
        await writeAgentShadowDiff({
            agent: 'vidya',
            uid: 'teacher-uid-3',
            genkit: { response: 'a' },
            sidecar: { response: 'b' },
            genkitLatencyMs: 100,
            sidecarLatencyMs: 110,
            sidecarOk: true,
        });
        await writeAgentShadowDiff({
            agent: 'lesson-plan',
            uid: 'teacher-uid-3',
            genkit: { title: 'a' },
            sidecar: { title: 'b' },
            genkitLatencyMs: 200,
            sidecarLatencyMs: 220,
            sidecarOk: true,
        });

        const subcollectionCalls = mockSubcollection.mock.calls.map(
            (c) => c[0],
        );
        expect(subcollectionCalls).toEqual(['vidya', 'lesson-plan']);
    });

    it('fails soft when Firestore is unavailable (getDb throws)', async () => {
        mockGetDb.mockRejectedValueOnce(new Error('firestore down'));
        const warnSpy = jest.spyOn(console, 'warn');

        await expect(
            writeAgentShadowDiff({
                agent: 'vidya',
                uid: 'teacher-uid-4',
                genkit: null,
                sidecar: null,
                genkitLatencyMs: 0,
                sidecarLatencyMs: 0,
                sidecarOk: false,
                sidecarError: 'irrelevant',
            }),
        ).resolves.toBeUndefined();

        expect(mockSet).not.toHaveBeenCalled();
        // Warn line is structured JSON tagged with the failure event.
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const warnArg = warnSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(warnArg);
        expect(parsed.event).toBe('shadow_diff_write_failed');
        expect(parsed.agent).toBe('vidya');
        expect(parsed.uid).toBe('teacher-uid-4');
        expect(parsed.error).toBe('firestore down');
    });

    it('fails soft when set() rejects after getDb resolves', async () => {
        mockSet.mockRejectedValueOnce(new Error('quota exceeded'));
        const warnSpy = jest.spyOn(console, 'warn');

        await expect(
            writeAgentShadowDiff({
                agent: 'rubric',
                uid: 'teacher-uid-5',
                genkit: { criteria: ['a'] },
                sidecar: { criteria: ['a'] },
                genkitLatencyMs: 50,
                sidecarLatencyMs: 60,
                sidecarOk: true,
            }),
        ).resolves.toBeUndefined();

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const parsed = JSON.parse(warnSpy.mock.calls[0]?.[0] as string);
        expect(parsed.event).toBe('shadow_diff_write_failed');
        expect(parsed.agent).toBe('rubric');
        expect(parsed.error).toBe('quota exceeded');
    });
});
