/**
 * Unit tests for the instant-answer sidecar dispatcher (Phase B §B.5).
 *
 * Covers off / shadow / canary / full × {ok, timeout, http, behavioural}.
 * Synthetic mocks (matches existing sidecar-dispatch / lesson-plan /
 * vidya patterns to dodge Jest's CJS-vs-pure-ESM transformer issue).
 *
 * Phase J.5 — the dispatcher now reads `instantAnswerSidecarMode/Percent`
 * from Firestore via `getFeatureFlags()`. Tests mock that module and
 * stage the values per branch.
 */

import type { InstantAnswerInput, InstantAnswerOutput } from '@/ai/flows/instant-answer';
import type { InstantAnswerSidecarMode } from '@/lib/sidecar/instant-answer-dispatch';

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/instant-answer', () => ({
    instantAnswer: jest.fn(),
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

jest.mock('@/lib/sidecar/instant-answer-client', () => {
    class InstantAnswerSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'InstantAnswerSidecarConfigError';
        }
    }
    class InstantAnswerSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(
                `Instant-answer sidecar request timed out after ${elapsedMs}ms`,
            );
            this.name = 'InstantAnswerSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class InstantAnswerSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(
                `Instant-answer sidecar returned HTTP ${status}: ${bodyExcerpt}`,
            );
            this.name = 'InstantAnswerSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class InstantAnswerSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(
                `Instant-answer sidecar behavioural guard failed (${axisHint}): ${details}`,
            );
            this.name = 'InstantAnswerSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarInstantAnswer: jest.fn(),
        InstantAnswerSidecarConfigError,
        InstantAnswerSidecarTimeoutError,
        InstantAnswerSidecarHttpError,
        InstantAnswerSidecarBehaviouralError,
    };
});

import { instantAnswer } from '@/ai/flows/instant-answer';
import { getFeatureFlags } from '@/lib/feature-flags';
import { checkServerRateLimit } from '@/lib/server-safety';
import { dispatchInstantAnswer } from '@/lib/sidecar/instant-answer-dispatch';
import {
    callSidecarInstantAnswer,
    InstantAnswerSidecarBehaviouralError,
    InstantAnswerSidecarHttpError,
    InstantAnswerSidecarTimeoutError,
    type SidecarInstantAnswerResponse,
} from '@/lib/sidecar/instant-answer-client';
import { persistSidecarJSON } from '@/lib/sidecar/persist-helpers';

const mockGenkit = instantAnswer as jest.MockedFunction<typeof instantAnswer>;
const mockSidecar = callSidecarInstantAnswer as jest.MockedFunction<typeof callSidecarInstantAnswer>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockPersist = persistSidecarJSON as jest.MockedFunction<typeof persistSidecarJSON>;
const mockGate = checkServerRateLimit as jest.MockedFunction<typeof checkServerRateLimit>;

// ── Fixtures ───────────────────────────────────────────────────────────────

const BASE_INPUT: InstantAnswerInput & { userId: string } = {
    question: 'What is photosynthesis?',
    language: 'en',
    gradeLevel: 'Class 5',
    subject: 'Science',
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT: InstantAnswerOutput = {
    answer: 'Photosynthesis (Genkit path).',
    videoSuggestionUrl:
        'https://www.youtube.com/results?search_query=photosynthesis',
    gradeLevel: 'Class 5',
    subject: 'Science',
};

const SIDECAR_OUTPUT: SidecarInstantAnswerResponse = {
    answer: 'Photosynthesis (sidecar path with grounding).',
    videoSuggestionUrl:
        'https://www.youtube.com/results?search_query=photosynthesis+for+class+5',
    gradeLevel: 'Class 5',
    subject: 'Science',
    sidecarVersion: 'phase-6.1.0',
    latencyMs: 850,
    modelUsed: 'gemini-2.0-flash',
    groundingUsed: true,
};

// Phase J.5 — the dispatcher now reads
// `instantAnswerSidecarMode/Percent` from Firestore via
// `getFeatureFlags()`. We stage the mock per test to drive each branch.
function setMode(mode: InstantAnswerSidecarMode, percent = 100): void {
    mockGetFlags.mockResolvedValue({
        instantAnswerSidecarMode: mode,
        instantAnswerSidecarPercent: percent,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Default: every read sees `off / 0` unless a test overrides.
    mockGetFlags.mockResolvedValue({
        instantAnswerSidecarMode: 'off',
        instantAnswerSidecarPercent: 0,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
    mockPersist.mockResolvedValue({
        storagePath: 'users/teacher-uid-1/instant-answers/test.json',
        contentId: 'test-id',
    });
    mockGate.mockResolvedValue(undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ── off ────────────────────────────────────────────────────────────────────

describe('dispatchInstantAnswer — off mode', () => {
    it('calls Genkit only and never touches the sidecar', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchInstantAnswer(BASE_INPUT);

        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(out.source).toBe('genkit');
        expect(out.answer).toBe(GENKIT_OUTPUT.answer);
        expect(out.sidecarTelemetry).toBeUndefined();
    });

    it('surfaces Genkit errors so the route can land its own error response', async () => {
        setMode('off');
        const err = new Error('Genkit blew up');
        mockGenkit.mockRejectedValue(err);

        await expect(dispatchInstantAnswer(BASE_INPUT)).rejects.toThrow(err);
        expect(mockSidecar).not.toHaveBeenCalled();
    });
});

// ── shadow ─────────────────────────────────────────────────────────────────

describe('dispatchInstantAnswer — shadow mode', () => {
    it('returns Genkit answer and runs sidecar in parallel', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchInstantAnswer(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.answer).toBe(GENKIT_OUTPUT.answer);
        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).toHaveBeenCalledTimes(1);
        expect(out.sidecarTelemetry).toBeUndefined();
    });

    it('still serves Genkit when sidecar errors', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockRejectedValue(
            new InstantAnswerSidecarTimeoutError(10_000),
        );

        const out = await dispatchInstantAnswer(BASE_INPUT);
        expect(out.source).toBe('genkit');
    });

    it('throws when Genkit fails (sidecar irrelevant)', async () => {
        setMode('shadow');
        const err = new Error('Genkit failed');
        mockGenkit.mockRejectedValue(err);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        await expect(dispatchInstantAnswer(BASE_INPUT)).rejects.toThrow(err);
    });
});

// ── canary / full ──────────────────────────────────────────────────────────

describe('dispatchInstantAnswer — canary mode (sidecar serves)', () => {
    it('returns sidecar answer with telemetry', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchInstantAnswer(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.answer).toBe(SIDECAR_OUTPUT.answer);
        expect(mockGenkit).not.toHaveBeenCalled();
        expect(out.sidecarTelemetry).toBeDefined();
        expect(out.sidecarTelemetry?.groundingUsed).toBe(true);
        expect(out.sidecarTelemetry?.sidecarVersion).toBe('phase-6.1.0');
    });

    it('falls back to Genkit on sidecar timeout', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new InstantAnswerSidecarTimeoutError(10_000),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchInstantAnswer(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(out.answer).toBe(GENKIT_OUTPUT.answer);
        expect(mockGenkit).toHaveBeenCalledTimes(1);
    });

    it('falls back to Genkit on sidecar HTTP error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new InstantAnswerSidecarHttpError(503, 'unavailable'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchInstantAnswer(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on behavioural-guard error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new InstantAnswerSidecarBehaviouralError('length', 'too long'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchInstantAnswer(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
        expect(out.answer).toBe(GENKIT_OUTPUT.answer);
    });

    it('surfaces Genkit errors when both paths fail', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new InstantAnswerSidecarHttpError(500, 'oops'),
        );
        const genkitErr = new Error('Genkit also failed');
        mockGenkit.mockRejectedValue(genkitErr);

        await expect(dispatchInstantAnswer(BASE_INPUT)).rejects.toThrow(
            genkitErr,
        );
    });
});

describe('dispatchInstantAnswer — full mode', () => {
    it('routes 100% to sidecar when ok', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchInstantAnswer(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockGenkit).not.toHaveBeenCalled();
    });
});

// ── Firestore-flag-driven decide ──────────────────────────────────────────

describe('dispatchInstantAnswer — Firestore dispatch decision (Phase J.5)', () => {
    it('defaults to off when Firestore field missing', async () => {
        // beforeEach already returns `{instantAnswerSidecarMode: 'off'}`,
        // simulating an untouched Firestore doc.
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchInstantAnswer(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.decision.mode).toBe('off');
        expect(out.decision.reason).toBe('flag_off');
        expect(mockSidecar).not.toHaveBeenCalled();
    });

    it('respects percent bucket gate in canary mode', async () => {
        // setMode with percent=0 → bucket >= 0 → off
        setMode('canary', 0);
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchInstantAnswer(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.decision.mode).toBe('off');
        expect(out.decision.reason).toMatch(/^bucket_\d+_over_0$/);
    });

    it('treats missing Firestore mode as off', async () => {
        // Simulate a Firestore doc with no instantAnswerSidecarMode field.
        mockGetFlags.mockResolvedValue(
            {} as Awaited<ReturnType<typeof getFeatureFlags>>,
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchInstantAnswer(BASE_INPUT);
        expect(out.decision.mode).toBe('off');
        expect(out.decision.reason).toBe('flag_off');
    });
});

// ── Phase K — pre-call rate-limit gate + Storage/Firestore persist ─────────

describe('dispatchInstantAnswer — Phase K (gate + persist)', () => {
    it('runs the rate-limit gate BEFORE the sidecar call in canary mode', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const order: string[] = [];
        mockGate.mockImplementation(async () => {
            order.push('gate');
        });
        mockSidecar.mockImplementation(async () => {
            order.push('sidecar');
            return SIDECAR_OUTPUT;
        });

        await dispatchInstantAnswer(BASE_INPUT);

        expect(order).toEqual(['gate', 'sidecar']);
        expect(mockGate).toHaveBeenCalledWith(BASE_INPUT.userId);
    });

    it('persists sidecar answer JSON when canary serves it', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        await dispatchInstantAnswer(BASE_INPUT);

        expect(mockPersist).toHaveBeenCalledTimes(1);
        const call = mockPersist.mock.calls[0][0];
        expect(call.contentType).toBe('instant-answer');
        expect(call.collection).toBe('instant-answers');
        expect(call.uid).toBe(BASE_INPUT.userId);
        expect(call.title).toBe(BASE_INPUT.question);
        // Payload should hold the sanitised answer fields.
        expect(call.output).toMatchObject({
            answer: SIDECAR_OUTPUT.answer,
            videoSuggestionUrl: SIDECAR_OUTPUT.videoSuggestionUrl,
        });
    });

    it('does not persist on the off-path Genkit response', async () => {
        // Genkit flow handles its own persistence; dispatcher must
        // NOT duplicate it.
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        await dispatchInstantAnswer(BASE_INPUT);

        expect(mockPersist).not.toHaveBeenCalled();
        expect(mockGate).not.toHaveBeenCalled();
    });

    it('does not persist when sidecar fails and falls back to Genkit', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new InstantAnswerSidecarTimeoutError(10_000),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        await dispatchInstantAnswer(BASE_INPUT);

        // The fallback Genkit flow handles persistence itself.
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('still returns sidecar response when persistence fails (fail-soft)', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue(null);

        const out = await dispatchInstantAnswer(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.answer).toBe(SIDECAR_OUTPUT.answer);
    });

    it('blocks sidecar call when rate limit gate throws', async () => {
        setMode('canary');
        mockGate.mockRejectedValue(new Error('Rate limit exceeded. Please wait 5 minutes.'));

        await expect(dispatchInstantAnswer(BASE_INPUT)).rejects.toThrow(
            /Rate limit exceeded/,
        );
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });
});
