/**
 * Unit tests for the VIDYA orchestrator sidecar dispatcher (Phase 5 §5.7).
 *
 * Covers the off / shadow / canary / full branching matrix with mocked
 * Genkit + sidecar paths so the test runs without network calls.
 *
 *   mode      sidecar OK      sidecar transport err   sidecar behavioural
 *   ─────────────────────────────────────────────────────────────────────
 *   off       (not called)    (not called)            (not called)
 *   shadow    Genkit serves   Genkit serves           Genkit serves
 *   canary    sidecar serves  Genkit fallback         Genkit fallback ★
 *   full      sidecar serves  Genkit fallback         Genkit fallback ★
 *
 * ★ Behavioural-fail falls back here (DIFFERENT from parent-call).
 * Genkit's SAHAYAK_SOUL prompt has its own non-redundant safety pass —
 * the teacher always gets *some* response.
 */

import type { AssistantInput, AssistantOutput } from '@/ai/flows/vidya-assistant';
import type { VidyaSidecarMode } from '@/lib/feature-flags';

// ── Mock setup ─────────────────────────────────────────────────────────────
// Synthetic mocks for the same Jest-can't-parse-pure-ESM reason as
// `sidecar-dispatch.test.ts` and `lesson-plan-dispatch.test.ts`.

jest.mock('@/lib/feature-flags', () => ({
    decideVidyaDispatch: jest.fn(),
}));

jest.mock('@/ai/flows/vidya-assistant', () => ({
    runGenkitVidya: jest.fn(),
}));

jest.mock('@/lib/sidecar/vidya-client', () => {
    class VidyaSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'VidyaSidecarConfigError';
        }
    }
    class VidyaSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`VIDYA sidecar request timed out after ${elapsedMs}ms`);
            this.name = 'VidyaSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class VidyaSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`VIDYA sidecar returned HTTP ${status}: ${bodyExcerpt}`);
            this.name = 'VidyaSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class VidyaSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`VIDYA sidecar behavioural guard failed (${axisHint}): ${details}`);
            this.name = 'VidyaSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarVidya: jest.fn(),
        VidyaSidecarConfigError,
        VidyaSidecarTimeoutError,
        VidyaSidecarHttpError,
        VidyaSidecarBehaviouralError,
    };
});

// Imports after mocks.
import { runGenkitVidya } from '@/ai/flows/vidya-assistant';
import { decideVidyaDispatch } from '@/lib/feature-flags';
import { dispatchVidya } from '@/lib/sidecar/vidya-dispatch';
import {
    callSidecarVidya,
    VidyaSidecarBehaviouralError,
    VidyaSidecarHttpError,
    VidyaSidecarTimeoutError,
    type SidecarVidyaResponse,
} from '@/lib/sidecar/vidya-client';

const mockGenkit = runGenkitVidya as jest.MockedFunction<typeof runGenkitVidya>;
const mockSidecar = callSidecarVidya as jest.MockedFunction<typeof callSidecarVidya>;
const mockDecide = decideVidyaDispatch as jest.MockedFunction<typeof decideVidyaDispatch>;

// ── Fixtures ───────────────────────────────────────────────────────────────

const BASE_INPUT: { uid: string; request: AssistantInput } = {
    uid: 'teacher-uid-vidya',
    request: {
        message: 'create a lesson plan on photosynthesis for class 5',
        chatHistory: [],
        currentScreenContext: { path: '/dashboard', uiState: null },
        teacherProfile: {
            preferredGrade: 'Class 5',
            preferredSubject: 'Science',
            preferredLanguage: 'en',
        },
        detectedLanguage: 'en',
    },
};

const GENKIT_OUTPUT: AssistantOutput = {
    response: 'Opening lesson plan now (Genkit path).',
    action: {
        type: 'NAVIGATE_AND_FILL',
        flow: 'lesson-plan',
        params: { topic: 'Photosynthesis', gradeLevel: 'Class 5' },
    },
};

const SIDECAR_OUTPUT: SidecarVidyaResponse = {
    response: 'Opening the right tool for you now.',
    action: {
        type: 'NAVIGATE_AND_FILL',
        flow: 'lesson-plan',
        params: {
            topic: 'Photosynthesis',
            gradeLevel: 'Class 5',
            subject: 'Science',
            language: 'en',
            ncertChapter: null,
        },
    },
    intent: 'lesson-plan',
    sidecarVersion: 'phase-5.4.0',
    latencyMs: 850,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function setMode(mode: VidyaSidecarMode): void {
    mockDecide.mockResolvedValue({
        mode,
        reason: `test_${mode}`,
        bucket: 0,
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ── off ────────────────────────────────────────────────────────────────────

describe('dispatchVidya — off mode', () => {
    it('calls Genkit only and never touches the sidecar', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVidya(BASE_INPUT);

        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(out.source).toBe('genkit');
        expect(out.response).toBe(GENKIT_OUTPUT.response);
        expect(out.sidecarTelemetry).toBeUndefined();
    });

    it('surfaces Genkit errors so the route can land its own error response', async () => {
        setMode('off');
        const err = new Error('Genkit blew up');
        mockGenkit.mockRejectedValue(err);

        await expect(dispatchVidya(BASE_INPUT)).rejects.toThrow(err);
        expect(mockSidecar).not.toHaveBeenCalled();
    });
});

// ── shadow ─────────────────────────────────────────────────────────────────

describe('dispatchVidya — shadow mode', () => {
    it('returns Genkit response and runs sidecar in parallel', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVidya(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.response).toBe(GENKIT_OUTPUT.response);
        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).toHaveBeenCalledTimes(1);
        expect(out.sidecarTelemetry).toBeUndefined();
    });

    it('still serves Genkit when sidecar errors', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockRejectedValue(new VidyaSidecarTimeoutError(8_000));

        const out = await dispatchVidya(BASE_INPUT);
        expect(out.source).toBe('genkit');
    });

    it('throws when Genkit fails (sidecar irrelevant)', async () => {
        setMode('shadow');
        const err = new Error('Genkit failed');
        mockGenkit.mockRejectedValue(err);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        await expect(dispatchVidya(BASE_INPUT)).rejects.toThrow(err);
    });
});

// ── canary / full ──────────────────────────────────────────────────────────

describe('dispatchVidya — canary mode (sidecar serves)', () => {
    it('returns sidecar response with telemetry attached', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVidya(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.response).toBe(SIDECAR_OUTPUT.response);
        expect(mockGenkit).not.toHaveBeenCalled();
        expect(out.sidecarTelemetry).toBeDefined();
        expect(out.sidecarTelemetry?.intent).toBe('lesson-plan');
        expect(out.sidecarTelemetry?.sidecarVersion).toBe('phase-5.4.0');
    });

    it('falls back to Genkit on sidecar timeout', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new VidyaSidecarTimeoutError(8_000));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVidya(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(out.response).toBe(GENKIT_OUTPUT.response);
        expect(mockGenkit).toHaveBeenCalledTimes(1);
    });

    it('falls back to Genkit on sidecar HTTP error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new VidyaSidecarHttpError(503, 'unavailable'));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVidya(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on behavioural-guard error (different from parent-call)', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new VidyaSidecarBehaviouralError('length', 'response too long'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVidya(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(out.response).toBe(GENKIT_OUTPUT.response);
    });

    it('surfaces Genkit errors when both paths fail', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new VidyaSidecarHttpError(500, 'oops'));
        const genkitErr = new Error('Genkit also failed');
        mockGenkit.mockRejectedValue(genkitErr);

        await expect(dispatchVidya(BASE_INPUT)).rejects.toThrow(genkitErr);
    });
});

describe('dispatchVidya — full mode', () => {
    it('routes 100% to sidecar when ok', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVidya(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockGenkit).not.toHaveBeenCalled();
    });
});

// ── decide-failure fail-safe ───────────────────────────────────────────────

describe('dispatchVidya — decide-failure fail-safe', () => {
    it('falls back to off mode if decideVidyaDispatch rejects', async () => {
        mockDecide.mockRejectedValue(new Error('firestore stalled'));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVidya(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.decision.mode).toBe('off');
        expect(out.decision.reason).toBe('decide_failed');
        expect(mockSidecar).not.toHaveBeenCalled();
    });
});
