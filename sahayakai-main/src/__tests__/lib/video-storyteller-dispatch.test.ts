/**
 * Unit tests for the video-storyteller sidecar dispatcher (Phase F.1).
 *
 * Phase K coverage:
 *  - Pre-call rate-limit gate runs in canary/full BEFORE sidecar call.
 *  - Video-storyteller does NOT persist a per-user library entry — the
 *    recommendations are cached at the system level by the Genkit
 *    cache layer. The test asserts no per-user persistence call from
 *    the dispatcher.
 *
 * Phase M.1 coverage (forensic audit P0 #8):
 *  - Canary/full mode now invokes the YouTube-only
 *    `getVideoCategorySearchResults`, NOT the full
 *    `getVideoRecommendations`. The latter would call Gemini twice.
 *  - `aiCallsCount` is logged on every dispatch and is always 1.
 *  - Sidecar-fail genkit-fallback path uses the full
 *    `getVideoRecommendations` (one Gemini call).
 */

import type { VideoStorytellerSidecarMode } from '@/lib/sidecar/video-storyteller-dispatch';

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/video-storyteller', () => ({
    getVideoRecommendations: jest.fn(),
    getVideoCategorySearchResults: jest.fn(),
    getVideoAICategories: jest.fn(),
}));

jest.mock('@/lib/sidecar/persist-helpers', () => ({
    persistSidecarJSON: jest.fn(),
    persistSidecarImage: jest.fn(),
}));

jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({
    writeAgentShadowDiff: jest.fn(),
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(),
    checkImageRateLimit: jest.fn(),
}));

jest.mock('@/lib/sidecar/video-storyteller-client', () => {
    class VideoStorytellerSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'VideoStorytellerSidecarConfigError';
        }
    }
    class VideoStorytellerSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`timeout ${elapsedMs}`);
            this.name = 'VideoStorytellerSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class VideoStorytellerSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`http ${status}`);
            this.name = 'VideoStorytellerSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class VideoStorytellerSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`behavioural ${axisHint} ${details}`);
            this.name = 'VideoStorytellerSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarVideoStoryteller: jest.fn(),
        VideoStorytellerSidecarConfigError,
        VideoStorytellerSidecarTimeoutError,
        VideoStorytellerSidecarHttpError,
        VideoStorytellerSidecarBehaviouralError,
    };
});

import {
    getVideoRecommendations,
    getVideoCategorySearchResults,
} from '@/ai/flows/video-storyteller';
import { getFeatureFlags } from '@/lib/feature-flags';
import { checkServerRateLimit } from '@/lib/server-safety';
import {
    callSidecarVideoStoryteller,
    type SidecarVideoStorytellerResponse,
} from '@/lib/sidecar/video-storyteller-client';
import { dispatchVideoStoryteller } from '@/lib/sidecar/video-storyteller-dispatch';
import {
    persistSidecarJSON,
    persistSidecarImage,
} from '@/lib/sidecar/persist-helpers';

const mockGenkit = getVideoRecommendations as jest.MockedFunction<typeof getVideoRecommendations>;
const mockYouTubeOnly = getVideoCategorySearchResults as jest.MockedFunction<typeof getVideoCategorySearchResults>;
const mockSidecar = callSidecarVideoStoryteller as jest.MockedFunction<typeof callSidecarVideoStoryteller>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockGate = checkServerRateLimit as jest.MockedFunction<typeof checkServerRateLimit>;
const mockPersistJSON = persistSidecarJSON as jest.MockedFunction<typeof persistSidecarJSON>;
const mockPersistImage = persistSidecarImage as jest.MockedFunction<typeof persistSidecarImage>;

const BASE_INPUT = {
    subject: 'Mathematics',
    gradeLevel: 'Class 5',
    topic: 'Fractions',
    language: 'English',
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT = {
    categories: {
        pedagogy: ['genkit pedagogy 1'],
        storytelling: ['genkit story 1'],
        govtUpdates: ['genkit gov 1'],
        courses: ['genkit course 1'],
        topRecommended: ['genkit top 1'],
    },
    personalizedMessage: 'Genkit hello teacher.',
    categorizedVideos: { pedagogy: [], storytelling: [] },
    fromCache: false,
    latencyScore: 0,
};

const SIDECAR_OUTPUT: SidecarVideoStorytellerResponse = {
    categories: {
        pedagogy: ['sidecar pedagogy 1'],
        storytelling: ['sidecar story 1'],
        govtUpdates: ['sidecar gov 1'],
        courses: ['sidecar course 1'],
        topRecommended: ['sidecar top 1'],
    },
    personalizedMessage: 'Sidecar hello teacher.',
    sidecarVersion: 'phase-f.1.0',
    latencyMs: 800,
    modelUsed: 'gemini-2.0-flash',
};

// Phase M.1: YouTube-only result returned by
// `getVideoCategorySearchResults`. NO Gemini call — the categories +
// personalizedMessage come from the supplied aiResult arg (sidecar).
const YOUTUBE_ONLY_OUTPUT = {
    categories: SIDECAR_OUTPUT.categories,
    personalizedMessage: SIDECAR_OUTPUT.personalizedMessage,
    categorizedVideos: { pedagogy: [{ id: 'youtube-only-1' }], storytelling: [] },
    fromCache: false,
    latencyScore: 100,
};

function setMode(mode: VideoStorytellerSidecarMode, percent = 100): void {
    mockGetFlags.mockResolvedValue({
        videoStorytellerSidecarMode: mode,
        videoStorytellerSidecarPercent: percent,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetFlags.mockResolvedValue({
        videoStorytellerSidecarMode: 'off',
        videoStorytellerSidecarPercent: 0,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
    mockGate.mockResolvedValue(undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('dispatchVideoStoryteller — off mode', () => {
    it('passes through to Genkit; never gates from dispatcher', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT as any);

        const out = await dispatchVideoStoryteller(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(mockGate).not.toHaveBeenCalled();
        expect(mockPersistJSON).not.toHaveBeenCalled();
        expect(mockPersistImage).not.toHaveBeenCalled();
    });

    it('logs aiCallsCount=1 (cost dashboard signal)', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT as any);
        const logSpy = jest.spyOn(console, 'log');

        await dispatchVideoStoryteller(BASE_INPUT);

        const dispatchLog = logSpy.mock.calls
            .map((c) => {
                try {
                    return JSON.parse(c[0]);
                } catch {
                    return null;
                }
            })
            .find((p) => p && p.event === 'video_storyteller.dispatch');
        expect(dispatchLog).toBeTruthy();
        expect(dispatchLog.aiCallsCount).toBe(1);
    });
});

describe('dispatchVideoStoryteller — canary / full (Phase M.1)', () => {
    it('runs the rate-limit gate BEFORE the sidecar call', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockYouTubeOnly.mockResolvedValue(YOUTUBE_ONLY_OUTPUT as any);

        const order: string[] = [];
        mockGate.mockImplementation(async () => {
            order.push('gate');
        });
        mockSidecar.mockImplementation(async () => {
            order.push('sidecar');
            return SIDECAR_OUTPUT;
        });

        await dispatchVideoStoryteller(BASE_INPUT);

        // Gate must run BEFORE sidecar. Phase M.1: the YouTube branch
        // runs AFTER the sidecar (sequential, not parallel) since it
        // depends on sidecar's categories.
        expect(order[0]).toBe('gate');
        expect(order).toContain('sidecar');
        expect(mockGate).toHaveBeenCalledWith(BASE_INPUT.userId);
    });

    it('does NOT persist to per-user library (system-cached only)', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockYouTubeOnly.mockResolvedValue(YOUTUBE_ONLY_OUTPUT as any);

        await dispatchVideoStoryteller(BASE_INPUT);

        expect(mockPersistJSON).not.toHaveBeenCalled();
        expect(mockPersistImage).not.toHaveBeenCalled();
    });

    it('blocks sidecar call when rate limit gate throws', async () => {
        setMode('canary');
        mockGate.mockRejectedValue(new Error('Rate limit exceeded. Please wait 5 minutes.'));

        await expect(dispatchVideoStoryteller(BASE_INPUT)).rejects.toThrow(
            /Rate limit exceeded/,
        );
        expect(mockSidecar).not.toHaveBeenCalled();
    });

    it('calls getVideoCategorySearchResults (NOT getVideoRecommendations) on sidecar success', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockYouTubeOnly.mockResolvedValue(YOUTUBE_ONLY_OUTPUT as any);

        await dispatchVideoStoryteller(BASE_INPUT);

        // Phase M.1: sidecar succeeded → YouTube-only path. The full
        // `getVideoRecommendations` (which would invoke Gemini twice)
        // MUST NOT be called.
        expect(mockYouTubeOnly).toHaveBeenCalledTimes(1);
        expect(mockGenkit).not.toHaveBeenCalled();

        // The YouTube-only fn receives sidecar's AI result so it doesn't
        // re-invoke Gemini.
        expect(mockYouTubeOnly).toHaveBeenCalledWith(
            expect.objectContaining({ subject: BASE_INPUT.subject }),
            expect.objectContaining({
                categories: SIDECAR_OUTPUT.categories,
                personalizedMessage: SIDECAR_OUTPUT.personalizedMessage,
            }),
        );
    });

    it('canary mode does not call Gemini twice (aiCallsCount=1)', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockYouTubeOnly.mockResolvedValue(YOUTUBE_ONLY_OUTPUT as any);
        const logSpy = jest.spyOn(console, 'log');

        await dispatchVideoStoryteller(BASE_INPUT);

        const dispatchLog = logSpy.mock.calls
            .map((c) => {
                try {
                    return JSON.parse(c[0]);
                } catch {
                    return null;
                }
            })
            .find((p) => p && p.event === 'video_storyteller.dispatch');
        expect(dispatchLog).toBeTruthy();
        expect(dispatchLog.aiCallsCount).toBe(1);
        expect(dispatchLog.source).toBe('sidecar+genkit_videos');

        // Sanity: full Genkit (which hides a Gemini call) was NOT called.
        expect(mockGenkit).not.toHaveBeenCalled();
        // YouTube-only branch was called exactly once.
        expect(mockYouTubeOnly).toHaveBeenCalledTimes(1);
    });

    it('full mode behaves the same as canary (no Gemini double-call)', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockYouTubeOnly.mockResolvedValue(YOUTUBE_ONLY_OUTPUT as any);

        const out = await dispatchVideoStoryteller(BASE_INPUT);

        expect(out.source).toBe('sidecar+genkit_videos');
        expect(mockYouTubeOnly).toHaveBeenCalledTimes(1);
        expect(mockGenkit).not.toHaveBeenCalled();
    });

    it('returns sidecar categories + personalized message + youtube videos', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockYouTubeOnly.mockResolvedValue(YOUTUBE_ONLY_OUTPUT as any);

        const out = await dispatchVideoStoryteller(BASE_INPUT);

        expect(out.categories).toEqual(SIDECAR_OUTPUT.categories);
        expect(out.personalizedMessage).toBe(SIDECAR_OUTPUT.personalizedMessage);
        expect(out.categorizedVideos).toEqual(YOUTUBE_ONLY_OUTPUT.categorizedVideos);
        expect(out.source).toBe('sidecar+genkit_videos');
        expect(out.sidecarTelemetry?.modelUsed).toBe('gemini-2.0-flash');
    });

    it('sidecar fail → genkit_fallback uses full getVideoRecommendations (one Gemini call)', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new Error('sidecar 503'));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT as any);

        const out = await dispatchVideoStoryteller(BASE_INPUT);

        // Fallback path: full Genkit fn called exactly once. The
        // YouTube-only fn must NOT be called in this path (the AI half
        // is provided BY `getVideoRecommendations` itself).
        expect(out.source).toBe('genkit_fallback');
        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockYouTubeOnly).not.toHaveBeenCalled();
    });

    it('sidecar fail → fallback log records aiCallsCount=1', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new Error('sidecar timeout'));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT as any);
        const logSpy = jest.spyOn(console, 'log');

        await dispatchVideoStoryteller(BASE_INPUT);

        const dispatchLog = logSpy.mock.calls
            .map((c) => {
                try {
                    return JSON.parse(c[0]);
                } catch {
                    return null;
                }
            })
            .find(
                (p) =>
                    p &&
                    p.event === 'video_storyteller.dispatch' &&
                    p.source === 'genkit_fallback',
            );
        expect(dispatchLog).toBeTruthy();
        expect(dispatchLog.aiCallsCount).toBe(1);
    });
});
