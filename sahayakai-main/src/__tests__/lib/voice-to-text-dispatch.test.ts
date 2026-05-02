/**
 * Unit tests for the voice-to-text sidecar dispatcher (Phase I + Phase O.3).
 *
 * Phase O.3 closes a forensic gap: only 5 of 14 dispatchers had a
 * canary-path fallback test. Voice-to-text was one of the 9 missing.
 * This file exercises the off / shadow / canary success / canary
 * fallback (timeout, HTTP, behavioural-guard) / full matrix.
 *
 * The dispatcher slots between Sarvam STT (tier 1) and Genkit Gemini
 * (tier 2/3 fallback). The sidecar is the alternative tier-2/3 path.
 */

import type { VoiceToTextOutput } from '@/ai/flows/voice-to-text';
import type { VoiceToTextSidecarMode } from '@/lib/sidecar/voice-to-text-dispatch';

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/voice-to-text', () => ({
    voiceToText: jest.fn(),
}));

jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({
    writeAgentShadowDiff: jest.fn(),
}));

jest.mock('@/lib/sidecar/voice-to-text-client', () => {
    class VoiceToTextSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'VoiceToTextSidecarConfigError';
        }
    }
    class VoiceToTextSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`VTT sidecar request timed out after ${elapsedMs}ms`);
            this.name = 'VoiceToTextSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class VoiceToTextSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`VTT sidecar returned HTTP ${status}: ${bodyExcerpt}`);
            this.name = 'VoiceToTextSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class VoiceToTextSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`VTT sidecar behavioural guard failed (${axisHint}): ${details}`);
            this.name = 'VoiceToTextSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarVoiceToText: jest.fn(),
        VoiceToTextSidecarConfigError,
        VoiceToTextSidecarTimeoutError,
        VoiceToTextSidecarHttpError,
        VoiceToTextSidecarBehaviouralError,
    };
});

// Imports after mocks.
import { voiceToText } from '@/ai/flows/voice-to-text';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarVoiceToText,
    VoiceToTextSidecarBehaviouralError,
    VoiceToTextSidecarHttpError,
    VoiceToTextSidecarTimeoutError,
    type SidecarVoiceToTextResponse,
} from '@/lib/sidecar/voice-to-text-client';
import { dispatchVoiceToText } from '@/lib/sidecar/voice-to-text-dispatch';

const mockGenkit = voiceToText as jest.MockedFunction<typeof voiceToText>;
const mockSidecar = callSidecarVoiceToText as jest.MockedFunction<typeof callSidecarVoiceToText>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;

// ── Fixtures ───────────────────────────────────────────────────────────────

const BASE_INPUT = {
    audioDataUri: 'data:audio/webm;base64,GkXf' + 'A'.repeat(64),
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT: VoiceToTextOutput = {
    text: 'Photosynthesis is the process plants use.',
    language: 'en',
};

const SIDECAR_OUTPUT: SidecarVoiceToTextResponse = {
    text: 'Photosynthesis is the process plants use to make food.',
    language: 'en',
    sidecarVersion: 'phase-i.0',
    latencyMs: 950,
    modelUsed: 'gemini-2.0-flash',
};

function setMode(mode: VoiceToTextSidecarMode, percent = 100): void {
    mockGetFlags.mockResolvedValue({
        voiceToTextSidecarMode: mode,
        voiceToTextSidecarPercent: percent,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    setMode('off');
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ── off ────────────────────────────────────────────────────────────────────

describe('dispatchVoiceToText — off mode', () => {
    it('calls Genkit only and never touches the sidecar', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVoiceToText(BASE_INPUT);

        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(out.source).toBe('genkit');
        expect(out.text).toBe(GENKIT_OUTPUT.text);
        expect(out.sidecarTelemetry).toBeUndefined();
    });
});

// ── shadow ─────────────────────────────────────────────────────────────────

describe('dispatchVoiceToText — shadow mode', () => {
    it('returns Genkit and runs sidecar in parallel', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVoiceToText(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.text).toBe(GENKIT_OUTPUT.text);
        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).toHaveBeenCalledTimes(1);
        expect(out.sidecarTelemetry).toBeUndefined();
    });

    it('still serves Genkit when sidecar errors', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockRejectedValue(new VoiceToTextSidecarTimeoutError(70_000));

        const out = await dispatchVoiceToText(BASE_INPUT);
        expect(out.source).toBe('genkit');
    });
});

// ── canary success ─────────────────────────────────────────────────────────

describe('dispatchVoiceToText — canary mode (sidecar serves)', () => {
    it('returns sidecar response with telemetry attached', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVoiceToText(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.text).toBe(SIDECAR_OUTPUT.text);
        expect(out.language).toBe(SIDECAR_OUTPUT.language);
        expect(mockGenkit).not.toHaveBeenCalled();
        expect(out.sidecarTelemetry).toBeDefined();
        expect(out.sidecarTelemetry?.sidecarVersion).toBe('phase-i.0');
    });

    // ── Phase O.3: canary fallback matrix ──────────────────────────────────

    it('falls back to Genkit on sidecar timeout', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new VoiceToTextSidecarTimeoutError(70_000));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVoiceToText(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(out.text).toBe(GENKIT_OUTPUT.text);
        expect(mockGenkit).toHaveBeenCalledTimes(1);
    });

    it('falls back to Genkit on sidecar HTTP error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new VoiceToTextSidecarHttpError(503, 'unavailable'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVoiceToText(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on sidecar 502 HTTP error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new VoiceToTextSidecarHttpError(502, 'bad gateway'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVoiceToText(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on behavioural-guard error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new VoiceToTextSidecarBehaviouralError(
                'language', 'Detected language not in allowed set',
            ),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVoiceToText(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
    });
});

// ── full ───────────────────────────────────────────────────────────────────

describe('dispatchVoiceToText — full mode', () => {
    it('routes 100% to sidecar when ok', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVoiceToText(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockGenkit).not.toHaveBeenCalled();
    });
});
