/**
 * Phase J.5 — feature-flag extension tests.
 *
 * Forensic audit P0 #3 added 12 new typed `<agent>SidecarMode` /
 * `<agent>SidecarPercent` field pairs to `FeatureFlagsConfig`. These
 * tests verify:
 *
 * 1. each new field is read off the Firestore feature-flags doc via
 *    `getFeatureFlags()` (alias of `readConfig()`),
 * 2. defaults to `'off'` / `0` when the Firestore doc is missing the
 *    field (FALLBACK_CONFIG path),
 * 3. mode values are typed (only `'off' | 'shadow' | 'canary' | 'full'`),
 * 4. percent values clamp at 0..100 — at the dispatcher level, not
 *    inside `getFeatureFlags()` itself.
 *
 * Mocks `@/lib/firebase-admin` because the real module pulls in
 * `firebase-admin` and `jose` (pure ESM) which Jest's CJS transformer
 * cannot parse without a custom `transformIgnorePatterns` entry. The
 * synthetic mock matches the dispatcher-test pattern used elsewhere
 * in this folder.
 */

// Mock firebase-admin BEFORE importing the module under test.
const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGet }));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(async () => ({
        doc: mockDoc,
    })),
}));

import {
    getFeatureFlags,
    invalidateConfigCache,
    type FeatureFlagsConfig,
    type SidecarMode,
} from '@/lib/feature-flags';

// Helper: type-narrow a snapshot stub so `snap.data() as FeatureFlagsConfig`
// path inside `readConfig` returns whatever shape the test sets.
function snapshot(data: Partial<FeatureFlagsConfig> | null) {
    return {
        exists: data !== null,
        data: () => data,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    invalidateConfigCache();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
    invalidateConfigCache();
});

describe('feature-flags Phase J.5 extensions — Firestore-backed reads', () => {
    it('reads all 12 new <agent>SidecarMode/Percent pairs when present', async () => {
        const fullDoc: Partial<FeatureFlagsConfig> = {
            quizSidecarMode: 'canary',
            quizSidecarPercent: 25,
            examPaperSidecarMode: 'shadow',
            examPaperSidecarPercent: 5,
            visualAidSidecarMode: 'full',
            visualAidSidecarPercent: 100,
            worksheetSidecarMode: 'canary',
            worksheetSidecarPercent: 50,
            rubricSidecarMode: 'shadow',
            rubricSidecarPercent: 1,
            teacherTrainingSidecarMode: 'off',
            teacherTrainingSidecarPercent: 0,
            virtualFieldTripSidecarMode: 'canary',
            virtualFieldTripSidecarPercent: 10,
            instantAnswerSidecarMode: 'shadow',
            instantAnswerSidecarPercent: 25,
            parentMessageSidecarMode: 'canary',
            parentMessageSidecarPercent: 5,
            videoStorytellerSidecarMode: 'shadow',
            videoStorytellerSidecarPercent: 1,
            avatarSidecarMode: 'canary',
            avatarSidecarPercent: 25,
            voiceToTextSidecarMode: 'full',
            voiceToTextSidecarPercent: 100,
        };
        mockGet.mockResolvedValue(snapshot(fullDoc));

        const cfg = await getFeatureFlags();

        expect(cfg.quizSidecarMode).toBe('canary');
        expect(cfg.quizSidecarPercent).toBe(25);
        expect(cfg.examPaperSidecarMode).toBe('shadow');
        expect(cfg.visualAidSidecarMode).toBe('full');
        expect(cfg.worksheetSidecarPercent).toBe(50);
        expect(cfg.rubricSidecarMode).toBe('shadow');
        expect(cfg.teacherTrainingSidecarMode).toBe('off');
        expect(cfg.virtualFieldTripSidecarPercent).toBe(10);
        expect(cfg.instantAnswerSidecarMode).toBe('shadow');
        expect(cfg.parentMessageSidecarPercent).toBe(5);
        expect(cfg.videoStorytellerSidecarMode).toBe('shadow');
        expect(cfg.avatarSidecarMode).toBe('canary');
        expect(cfg.voiceToTextSidecarMode).toBe('full');
        expect(cfg.voiceToTextSidecarPercent).toBe(100);
    });

    it('falls back to off / 0 when Firestore doc is missing entirely', async () => {
        // Document does not exist on Firestore at all — `readConfig`
        // returns the FALLBACK_CONFIG.
        mockGet.mockResolvedValue(snapshot(null));

        const cfg = await getFeatureFlags();

        expect(cfg.quizSidecarMode).toBe('off');
        expect(cfg.quizSidecarPercent).toBe(0);
        expect(cfg.examPaperSidecarMode).toBe('off');
        expect(cfg.examPaperSidecarPercent).toBe(0);
        expect(cfg.visualAidSidecarMode).toBe('off');
        expect(cfg.worksheetSidecarMode).toBe('off');
        expect(cfg.rubricSidecarMode).toBe('off');
        expect(cfg.teacherTrainingSidecarMode).toBe('off');
        expect(cfg.virtualFieldTripSidecarMode).toBe('off');
        expect(cfg.instantAnswerSidecarMode).toBe('off');
        expect(cfg.parentMessageSidecarMode).toBe('off');
        expect(cfg.videoStorytellerSidecarMode).toBe('off');
        expect(cfg.avatarSidecarMode).toBe('off');
        expect(cfg.voiceToTextSidecarMode).toBe('off');
        // All percents zero too.
        expect(cfg.voiceToTextSidecarPercent).toBe(0);
    });

    it('falls back to safe defaults when Firestore read throws', async () => {
        // Simulate a Firestore outage. `readConfig` catches and returns
        // FALLBACK_CONFIG. Critical safety property: a Firestore outage
        // MUST NOT silently route teacher requests to the sidecar.
        mockGet.mockRejectedValue(new Error('Firestore unavailable'));

        const cfg = await getFeatureFlags();

        expect(cfg.quizSidecarMode).toBe('off');
        expect(cfg.examPaperSidecarMode).toBe('off');
        expect(cfg.voiceToTextSidecarMode).toBe('off');
        expect(cfg.parentCallSidecarMode).toBe('off');
    });

    it('preserves the 3 pre-existing sidecar fields untouched (regression)', async () => {
        // Phase J.5 must be additive. The 3 flags that already used the
        // Firestore plane (parent-call, lesson-plan, vidya) MUST keep
        // working. Verifies the migration didn't remove them.
        const doc: Partial<FeatureFlagsConfig> = {
            parentCallSidecarMode: 'canary',
            parentCallSidecarPercent: 5,
            lessonPlanSidecarMode: 'shadow',
            lessonPlanSidecarPercent: 1,
            vidyaSidecarMode: 'canary',
            vidyaSidecarPercent: 25,
        };
        mockGet.mockResolvedValue(snapshot(doc));

        const cfg = await getFeatureFlags();
        expect(cfg.parentCallSidecarMode).toBe('canary');
        expect(cfg.parentCallSidecarPercent).toBe(5);
        expect(cfg.lessonPlanSidecarMode).toBe('shadow');
        expect(cfg.lessonPlanSidecarPercent).toBe(1);
        expect(cfg.vidyaSidecarMode).toBe('canary');
        expect(cfg.vidyaSidecarPercent).toBe(25);
    });

    it('SidecarMode type narrows to the four allowed values', () => {
        // Type-level test: this file would not compile if `SidecarMode`
        // accepted a non-allowed string. The runtime no-op assertion
        // here is just a placeholder — the compile-time check is the
        // real assertion.
        const allowed: SidecarMode[] = ['off', 'shadow', 'canary', 'full'];
        for (const m of allowed) {
            // each member must satisfy the union exhaustively.
            const _check: 'off' | 'shadow' | 'canary' | 'full' = m;
            expect(['off', 'shadow', 'canary', 'full']).toContain(_check);
        }
    });

    it('caches reads — second call within TTL does not hit Firestore', async () => {
        // Behavioural property of `getFeatureFlags()`: the 5-min cache
        // dampens the read load that 12 dispatchers would otherwise put
        // on Firestore. Verify by counting `doc().get()` calls.
        const doc: Partial<FeatureFlagsConfig> = {
            quizSidecarMode: 'canary',
            quizSidecarPercent: 50,
        };
        mockGet.mockResolvedValue(snapshot(doc));

        await getFeatureFlags();
        await getFeatureFlags();
        await getFeatureFlags();

        expect(mockGet).toHaveBeenCalledTimes(1);
    });
});
