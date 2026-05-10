/**
 * Unit tests for the parent-message sidecar dispatcher (Phase C §C.5).
 *
 * Phase J.5 — the dispatcher now reads `parentMessageSidecarMode/Percent`
 * from Firestore via `getFeatureFlags()`. Tests mock that module and
 * stage the values per branch.
 */

import type {
    ParentMessageInput,
    ParentMessageOutput,
} from '@/ai/flows/parent-message-generator';
import type { ParentMessageSidecarMode } from '@/lib/sidecar/parent-message-dispatch';

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/parent-message-generator', () => ({
    generateParentMessage: jest.fn(),
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

jest.mock('@/lib/sidecar/parent-message-client', () => {
    class ParentMessageSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'ParentMessageSidecarConfigError';
        }
    }
    class ParentMessageSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`timeout ${elapsedMs}`);
            this.name = 'ParentMessageSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class ParentMessageSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`http ${status}`);
            this.name = 'ParentMessageSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class ParentMessageSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`behavioural ${axisHint} ${details}`);
            this.name = 'ParentMessageSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarParentMessage: jest.fn(),
        ParentMessageSidecarConfigError,
        ParentMessageSidecarTimeoutError,
        ParentMessageSidecarHttpError,
        ParentMessageSidecarBehaviouralError,
    };
});

import { generateParentMessage } from '@/ai/flows/parent-message-generator';
import { getFeatureFlags } from '@/lib/feature-flags';
import { checkServerRateLimit } from '@/lib/server-safety';
import { dispatchParentMessage } from '@/lib/sidecar/parent-message-dispatch';
import {
    callSidecarParentMessage,
    ParentMessageSidecarBehaviouralError,
    ParentMessageSidecarHttpError,
    ParentMessageSidecarTimeoutError,
    type SidecarParentMessageResponse,
} from '@/lib/sidecar/parent-message-client';
import {
    persistSidecarJSON,
    persistSidecarImage,
} from '@/lib/sidecar/persist-helpers';

const mockGenkit = generateParentMessage as jest.MockedFunction<typeof generateParentMessage>;
const mockSidecar = callSidecarParentMessage as jest.MockedFunction<typeof callSidecarParentMessage>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockGate = checkServerRateLimit as jest.MockedFunction<typeof checkServerRateLimit>;
const mockPersistJSON = persistSidecarJSON as jest.MockedFunction<typeof persistSidecarJSON>;
const mockPersistImage = persistSidecarImage as jest.MockedFunction<typeof persistSidecarImage>;

const BASE_INPUT: ParentMessageInput & { userId: string } = {
    studentName: 'Arav',
    className: 'Class 5',
    subject: 'Mathematics',
    reason: 'consecutive_absences',
    reasonContext: 'placeholder',
    parentLanguage: 'English',
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT: ParentMessageOutput = {
    message: 'Genkit-path parent message about Arav.',
    languageCode: 'en-IN',
    wordCount: 7,
};

const SIDECAR_OUTPUT: SidecarParentMessageResponse = {
    message: 'Sidecar-path parent message about Arav with grounding.',
    languageCode: 'en-IN',
    wordCount: 9,
    sidecarVersion: 'phase-c.1.0',
    latencyMs: 850,
    modelUsed: 'gemini-2.0-flash',
};

function setMode(mode: ParentMessageSidecarMode, percent = 100): void {
    mockGetFlags.mockResolvedValue({
        parentMessageSidecarMode: mode,
        parentMessageSidecarPercent: percent,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    // Default: every read sees `off / 0` unless a test overrides.
    mockGetFlags.mockResolvedValue({
        parentMessageSidecarMode: 'off',
        parentMessageSidecarPercent: 0,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
    mockGate.mockResolvedValue(undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('dispatchParentMessage — off mode', () => {
    it('calls Genkit only', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);

        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(out.source).toBe('genkit');
    });

    it('default unset env var → off', async () => {
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);

        expect(out.decision.mode).toBe('off');
        expect(out.decision.reason).toBe('flag_off');
    });
});

describe('dispatchParentMessage — shadow mode', () => {
    it('returns Genkit message and runs sidecar in parallel', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.message).toBe(GENKIT_OUTPUT.message);
        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).toHaveBeenCalledTimes(1);
    });

    it('still serves Genkit when sidecar errors', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockRejectedValue(
            new ParentMessageSidecarTimeoutError(8000),
        );

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.source).toBe('genkit');
    });
});

describe('dispatchParentMessage — canary mode', () => {
    it('returns sidecar message with telemetry', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.message).toBe(SIDECAR_OUTPUT.message);
        expect(out.sidecarTelemetry?.sidecarVersion).toBe('phase-c.1.0');
        expect(mockGenkit).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on timeout', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new ParentMessageSidecarTimeoutError(8000),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on http error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new ParentMessageSidecarHttpError(503, 'unavailable'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on behavioural error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new ParentMessageSidecarBehaviouralError('length', 'too short'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });
});

describe('dispatchParentMessage — full mode + percent gating', () => {
    it('full mode routes 100% to sidecar', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.source).toBe('sidecar');
    });

    it('canary at 0% → off', async () => {
        setMode('canary', 0);
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.decision.mode).toBe('off');
        expect(out.decision.reason).toMatch(/^bucket_\d+_over_0$/);
    });

    it('missing Firestore mode → off', async () => {
        // Simulate a Firestore doc with no parentMessageSidecarMode field.
        mockGetFlags.mockResolvedValue(
            {} as Awaited<ReturnType<typeof getFeatureFlags>>,
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.decision.mode).toBe('off');
    });
});

// ── Phase K — pre-call rate-limit gate, no per-user persist ────────────────

describe('dispatchParentMessage — Phase K (gate-only, no persist)', () => {
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

        await dispatchParentMessage(BASE_INPUT);

        expect(order).toEqual(['gate', 'sidecar']);
        expect(mockGate).toHaveBeenCalledWith(BASE_INPUT.userId);
    });

    it('does NOT persist to per-user library (SMS-bound, not library)', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        await dispatchParentMessage(BASE_INPUT);

        expect(mockPersistJSON).not.toHaveBeenCalled();
        expect(mockPersistImage).not.toHaveBeenCalled();
    });

    it('does not gate on the off-path Genkit response', async () => {
        // The Genkit flow handles its own gating upstream in the route;
        // dispatcher must NOT add an extra tick on the off path.
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        await dispatchParentMessage(BASE_INPUT);

        expect(mockGate).not.toHaveBeenCalled();
    });

    it('blocks sidecar call when rate limit gate throws', async () => {
        setMode('canary');
        mockGate.mockRejectedValue(new Error('Rate limit exceeded. Please wait 5 minutes.'));

        await expect(dispatchParentMessage(BASE_INPUT)).rejects.toThrow(
            /Rate limit exceeded/,
        );
        expect(mockSidecar).not.toHaveBeenCalled();
    });
});
