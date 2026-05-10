/**
 * Unit tests for the virtual-field-trip sidecar dispatcher (Phase D.3).
 *
 * Phase K coverage:
 *  - Pre-call rate-limit gate runs in canary/full BEFORE sidecar call.
 *  - Sidecar-served trips persist to `users/{uid}/virtual-field-trips/`
 *    (Cloud Storage JSON) + Firestore content metadata.
 *  - Persistence is fail-soft.
 */

import type {
    VirtualFieldTripInput,
    VirtualFieldTripOutput,
} from '@/ai/flows/virtual-field-trip';
import type { VirtualFieldTripSidecarMode } from '@/lib/sidecar/virtual-field-trip-dispatch';

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/virtual-field-trip', () => ({
    planVirtualFieldTrip: jest.fn(),
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

jest.mock('@/lib/sidecar/virtual-field-trip-client', () => {
    class VirtualFieldTripSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'VirtualFieldTripSidecarConfigError';
        }
    }
    class VirtualFieldTripSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`timeout ${elapsedMs}`);
            this.name = 'VirtualFieldTripSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class VirtualFieldTripSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`http ${status}`);
            this.name = 'VirtualFieldTripSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class VirtualFieldTripSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`behavioural ${axisHint} ${details}`);
            this.name = 'VirtualFieldTripSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarVirtualFieldTrip: jest.fn(),
        VirtualFieldTripSidecarConfigError,
        VirtualFieldTripSidecarTimeoutError,
        VirtualFieldTripSidecarHttpError,
        VirtualFieldTripSidecarBehaviouralError,
    };
});

import { planVirtualFieldTrip } from '@/ai/flows/virtual-field-trip';
import { getFeatureFlags } from '@/lib/feature-flags';
import { checkServerRateLimit } from '@/lib/server-safety';
import {
    callSidecarVirtualFieldTrip,
    VirtualFieldTripSidecarBehaviouralError,
    VirtualFieldTripSidecarHttpError,
    VirtualFieldTripSidecarTimeoutError,
    type SidecarVirtualFieldTripResponse,
} from '@/lib/sidecar/virtual-field-trip-client';
import { dispatchVirtualFieldTrip } from '@/lib/sidecar/virtual-field-trip-dispatch';
import { persistSidecarJSON } from '@/lib/sidecar/persist-helpers';

const mockGenkit = planVirtualFieldTrip as jest.MockedFunction<typeof planVirtualFieldTrip>;
const mockSidecar = callSidecarVirtualFieldTrip as jest.MockedFunction<typeof callSidecarVirtualFieldTrip>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockPersist = persistSidecarJSON as jest.MockedFunction<typeof persistSidecarJSON>;
const mockGate = checkServerRateLimit as jest.MockedFunction<typeof checkServerRateLimit>;

const BASE_INPUT: VirtualFieldTripInput & { userId: string } = {
    topic: 'Amazon rainforest for class 5',
    language: 'English',
    gradeLevel: 'Class 5',
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT: VirtualFieldTripOutput = {
    title: 'Genkit trip',
    stops: [
        {
            name: 'Stop 1',
            description: 'desc',
            educationalFact: 'fact',
            reflectionPrompt: 'why?',
            googleEarthUrl: 'https://earth.google.com/web/search/Amazon',
            culturalAnalogy: 'Like the Western Ghats',
            explanation: 'because',
        },
    ],
    gradeLevel: 'Class 5',
    subject: 'Geography',
};

const SIDECAR_OUTPUT: SidecarVirtualFieldTripResponse = {
    title: 'Sidecar Amazon Adventure',
    stops: [
        {
            name: 'Sidecar Stop',
            description: 'sidecar desc',
            educationalFact: 'sidecar fact',
            reflectionPrompt: 'sidecar prompt',
            googleEarthUrl: 'https://earth.google.com/web/search/Amazon',
            culturalAnalogy: 'sidecar analogy',
            explanation: 'sidecar reason',
        },
    ],
    gradeLevel: 'Class 5',
    subject: 'Geography',
    sidecarVersion: 'phase-d.3.0',
    latencyMs: 2000,
    modelUsed: 'gemini-2.0-flash',
};

function setMode(mode: VirtualFieldTripSidecarMode, percent = 100): void {
    mockGetFlags.mockResolvedValue({
        virtualFieldTripSidecarMode: mode,
        virtualFieldTripSidecarPercent: percent,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetFlags.mockResolvedValue({
        virtualFieldTripSidecarMode: 'off',
        virtualFieldTripSidecarPercent: 0,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
    mockPersist.mockResolvedValue({
        storagePath: 'users/teacher-uid-1/virtual-field-trips/test.json',
        contentId: 'test-id',
    });
    mockGate.mockResolvedValue(undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('dispatchVirtualFieldTrip — off mode', () => {
    it('calls Genkit only, never gates or persists from dispatcher', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVirtualFieldTrip(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(mockGate).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });
});

describe('dispatchVirtualFieldTrip — shadow mode', () => {
    it('serves Genkit output, runs sidecar fire-and-forget; no dispatcher persist', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVirtualFieldTrip(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockSidecar).toHaveBeenCalledTimes(1);
        expect(mockPersist).not.toHaveBeenCalled();
        expect(mockGate).not.toHaveBeenCalled();
    });
});

describe('dispatchVirtualFieldTrip — canary / full', () => {
    it('runs the rate-limit gate BEFORE the sidecar call', async () => {
        setMode('canary');
        const order: string[] = [];
        mockGate.mockImplementation(async () => {
            order.push('gate');
        });
        mockSidecar.mockImplementation(async () => {
            order.push('sidecar');
            return SIDECAR_OUTPUT;
        });

        await dispatchVirtualFieldTrip(BASE_INPUT);

        expect(order).toEqual(['gate', 'sidecar']);
        expect(mockGate).toHaveBeenCalledWith(BASE_INPUT.userId);
    });

    it('persists sidecar trip JSON on success', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVirtualFieldTrip(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.title).toBe(SIDECAR_OUTPUT.title);
        expect(mockPersist).toHaveBeenCalledTimes(1);
        const call = mockPersist.mock.calls[0][0];
        expect(call.contentType).toBe('virtual-field-trip');
        expect(call.collection).toBe('virtual-field-trips');
        expect(call.uid).toBe(BASE_INPUT.userId);
        expect(call.title).toBe(SIDECAR_OUTPUT.title);
        expect(call.metadata.subject).toBe(SIDECAR_OUTPUT.subject);
    });

    it('still returns sidecar response when persistence fails', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue(null);

        const out = await dispatchVirtualFieldTrip(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.title).toBe(SIDECAR_OUTPUT.title);
    });

    it('falls back to Genkit on sidecar timeout (no dispatcher persist)', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new VirtualFieldTripSidecarTimeoutError(15_000),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVirtualFieldTrip(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on sidecar HTTP error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new VirtualFieldTripSidecarHttpError(503, 'unavailable'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVirtualFieldTrip(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    // Phase O.3 — fill the canary fallback matrix.

    it('falls back to Genkit on sidecar 502 HTTP error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new VirtualFieldTripSidecarHttpError(502, 'bad gateway'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVirtualFieldTrip(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on sidecar behavioural-guard error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new VirtualFieldTripSidecarBehaviouralError(
                'safety', 'Field trip violates safety rules',
            ),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchVirtualFieldTrip(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('full mode persists and reports source=sidecar', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchVirtualFieldTrip(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockPersist).toHaveBeenCalledTimes(1);
        expect(mockGate).toHaveBeenCalledTimes(1);
    });

    it('blocks the sidecar call when rate limit gate throws', async () => {
        setMode('canary');
        mockGate.mockRejectedValue(new Error('Rate limit exceeded. Please wait 5 minutes.'));

        await expect(dispatchVirtualFieldTrip(BASE_INPUT)).rejects.toThrow(
            /Rate limit exceeded/,
        );
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });
});
