/**
 * Unit tests for the visual-aid sidecar dispatcher (Phase E.3).
 *
 * Phase K coverage:
 *  - Pre-call image rate-limit gate runs in canary/full BEFORE sidecar
 *    is invoked (the audit found image-gen could bypass the 10/day cap
 *    when routed to the sidecar).
 *  - Sidecar-served images are persisted to Cloud Storage + Firestore
 *    via `persistSidecarImage` so the teacher's library mirrors what
 *    the Genkit path would have written.
 *  - Persistence is fail-soft: a Storage failure must not throw or
 *    drop the otherwise-good response.
 */

import type {
    VisualAidInput,
    VisualAidOutput,
} from '@/ai/flows/visual-aid-designer';
import type { VisualAidSidecarMode } from '@/lib/sidecar/visual-aid-dispatch';

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/visual-aid-designer', () => ({
    generateVisualAid: jest.fn(),
}));

jest.mock('@/lib/sidecar/visual-aid-client', () => {
    class VisualAidSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'VisualAidSidecarConfigError';
        }
    }
    class VisualAidSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`timeout ${elapsedMs}`);
            this.name = 'VisualAidSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class VisualAidSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`http ${status}`);
            this.name = 'VisualAidSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class VisualAidSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`behavioural ${axisHint} ${details}`);
            this.name = 'VisualAidSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarVisualAid: jest.fn(),
        VisualAidSidecarConfigError,
        VisualAidSidecarTimeoutError,
        VisualAidSidecarHttpError,
        VisualAidSidecarBehaviouralError,
    };
});

jest.mock('@/lib/sidecar/persist-helpers', () => ({
    persistSidecarImage: jest.fn(),
    persistSidecarJSON: jest.fn(),
}));

jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({
    writeAgentShadowDiff: jest.fn(),
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(),
    checkImageRateLimit: jest.fn(),
}));

import { generateVisualAid } from '@/ai/flows/visual-aid-designer';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    checkImageRateLimit,
    checkServerRateLimit,
} from '@/lib/server-safety';
import {
    callSidecarVisualAid,
    VisualAidSidecarHttpError,
    VisualAidSidecarTimeoutError,
    type SidecarVisualAidResponse,
} from '@/lib/sidecar/visual-aid-client';
import { dispatchVisualAid } from '@/lib/sidecar/visual-aid-dispatch';
import { persistSidecarImage } from '@/lib/sidecar/persist-helpers';

const mockGenkit = generateVisualAid as jest.MockedFunction<typeof generateVisualAid>;
const mockSidecar = callSidecarVisualAid as jest.MockedFunction<typeof callSidecarVisualAid>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockPersist = persistSidecarImage as jest.MockedFunction<typeof persistSidecarImage>;
const mockImageGate = checkImageRateLimit as jest.MockedFunction<typeof checkImageRateLimit>;
const mockServerGate = checkServerRateLimit as jest.MockedFunction<typeof checkServerRateLimit>;

const BASE_INPUT: VisualAidInput & { userId: string } = {
    prompt: 'water cycle',
    language: 'English',
    gradeLevel: 'Class 5',
    subject: 'Science',
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT: VisualAidOutput = {
    imageDataUri: 'data:image/png;base64,GENKIT',
    pedagogicalContext: 'Genkit pedagogy',
    discussionSpark: 'Genkit spark',
    subject: 'Science',
};

const SIDECAR_OUTPUT: SidecarVisualAidResponse = {
    imageDataUri: 'data:image/png;base64,SIDECAR',
    pedagogicalContext: 'Sidecar pedagogy',
    discussionSpark: 'Sidecar spark',
    subject: 'Science',
    sidecarVersion: 'phase-e.3.0',
    latencyMs: 1200,
    imageModelUsed: 'gemini-3-pro-image-preview',
    metadataModelUsed: 'gemini-2.5-flash',
};

function setMode(mode: VisualAidSidecarMode, percent = 100): void {
    mockGetFlags.mockResolvedValue({
        visualAidSidecarMode: mode,
        visualAidSidecarPercent: percent,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetFlags.mockResolvedValue({
        visualAidSidecarMode: 'off',
        visualAidSidecarPercent: 0,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
    mockPersist.mockResolvedValue({
        storagePath: 'users/teacher-uid-1/visual-aids/test.png',
        contentId: 'test-id',
    });
    mockImageGate.mockResolvedValue(undefined);
    mockServerGate.mockResolvedValue(undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('dispatchVisualAid — off mode', () => {
    it('calls Genkit only, never gates or persists from dispatcher', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVisualAid(BASE_INPUT);

        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(out.source).toBe('genkit');
        // Genkit flow has its own internal gate + persist; dispatcher
        // does not duplicate either in off mode.
        expect(mockImageGate).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });
});

describe('dispatchVisualAid — shadow mode', () => {
    it('returns Genkit and runs sidecar fire-and-forget; no dispatcher persist', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVisualAid(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockSidecar).toHaveBeenCalledTimes(1);
        // Shadow mode never serves the sidecar response, so no persist.
        expect(mockPersist).not.toHaveBeenCalled();
        expect(mockImageGate).not.toHaveBeenCalled();
    });
});

describe('dispatchVisualAid — canary mode (sidecar serves)', () => {
    it('runs the image rate-limit gate BEFORE calling the sidecar', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        // Track call order: gate before sidecar.
        const order: string[] = [];
        mockImageGate.mockImplementation(async () => {
            order.push('gate');
        });
        mockSidecar.mockImplementation(async () => {
            order.push('sidecar');
            return SIDECAR_OUTPUT;
        });

        await dispatchVisualAid(BASE_INPUT);

        expect(order).toEqual(['gate', 'sidecar']);
        expect(mockImageGate).toHaveBeenCalledWith(BASE_INPUT.userId);
    });

    it('persists sidecar image to Storage + Firestore on success', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVisualAid(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.imageDataUri).toBe(SIDECAR_OUTPUT.imageDataUri);
        expect(mockPersist).toHaveBeenCalledTimes(1);
        const call = mockPersist.mock.calls[0][0];
        expect(call.contentType).toBe('visual-aid');
        expect(call.collection).toBe('visual-aids');
        expect(call.uid).toBe(BASE_INPUT.userId);
        expect(call.imageDataUri).toBe(SIDECAR_OUTPUT.imageDataUri);
        expect(call.extraData).toMatchObject({
            pedagogicalContext: SIDECAR_OUTPUT.pedagogicalContext,
            discussionSpark: SIDECAR_OUTPUT.discussionSpark,
        });
    });

    it('still returns the sidecar response when persistence fails', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        // persistSidecarImage is fail-soft (returns null) — the response
        // must still come back to the caller.
        mockPersist.mockResolvedValue(null);

        const out = await dispatchVisualAid(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.imageDataUri).toBe(SIDECAR_OUTPUT.imageDataUri);
    });

    it('blocks the sidecar call when the image rate limit is exceeded', async () => {
        setMode('canary');
        mockImageGate.mockRejectedValue(
            new Error('Daily image limit reached. You can generate 10 images per day.'),
        );

        await expect(dispatchVisualAid(BASE_INPUT)).rejects.toThrow(
            /Daily image limit reached/,
        );
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on sidecar timeout (no dispatcher persist)', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new VisualAidSidecarTimeoutError(110_000));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVisualAid(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on sidecar HTTP error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new VisualAidSidecarHttpError(503, 'unavailable'));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVisualAid(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });
});

describe('dispatchVisualAid — full mode', () => {
    it('persists sidecar image and reports source=sidecar', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVisualAid(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockImageGate).toHaveBeenCalledTimes(1);
        expect(mockPersist).toHaveBeenCalledTimes(1);
    });
});
