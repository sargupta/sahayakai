/**
 * Unit tests for the avatar-generator sidecar dispatcher (Phase F.2 +
 * Phase O.3).
 *
 * Phase O.3 closes a forensic gap: only 5 of 14 dispatchers had a
 * canary-path fallback test. Avatar was one of the 9 missing. This
 * file exercises the off / shadow / canary success / canary fallback
 * (timeout, HTTP, behavioural-guard) / full matrix.
 *
 * The dispatcher writes the sidecar's image directly to Firebase
 * Storage on the canary/full happy path (no `persistSidecarImage`
 * helper — storage is inline). We mock `@/lib/firebase-admin` so the
 * write is a no-op.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/avatar-generator', () => ({
    generateAvatar: jest.fn(),
}));

jest.mock('@/lib/firebase-admin', () => ({
    getStorageInstance: jest.fn(async () => ({
        bucket: () => ({
            file: () => ({
                save: jest.fn(async () => undefined),
            }),
        }),
    })),
    getDb: jest.fn(async () => ({
        collection: () => ({
            doc: () => ({
                set: jest.fn(async () => undefined),
            }),
        }),
    })),
}));

jest.mock('@/lib/sidecar/avatar-generator-client', () => {
    class AvatarSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'AvatarSidecarConfigError';
        }
    }
    class AvatarSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`Avatar sidecar request timed out after ${elapsedMs}ms`);
            this.name = 'AvatarSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class AvatarSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`Avatar sidecar returned HTTP ${status}: ${bodyExcerpt}`);
            this.name = 'AvatarSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class AvatarSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`Avatar sidecar behavioural guard failed (${axisHint}): ${details}`);
            this.name = 'AvatarSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarAvatar: jest.fn(),
        AvatarSidecarConfigError,
        AvatarSidecarTimeoutError,
        AvatarSidecarHttpError,
        AvatarSidecarBehaviouralError,
    };
});

// Imports after mocks.
import { generateAvatar, type AvatarGeneratorOutput } from '@/ai/flows/avatar-generator';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarAvatar,
    AvatarSidecarBehaviouralError,
    AvatarSidecarHttpError,
    AvatarSidecarTimeoutError,
    type SidecarAvatarResponse,
} from '@/lib/sidecar/avatar-generator-client';
import {
    dispatchAvatar,
    type AvatarSidecarMode,
} from '@/lib/sidecar/avatar-generator-dispatch';

const mockGenkit = generateAvatar as jest.MockedFunction<typeof generateAvatar>;
const mockSidecar = callSidecarAvatar as jest.MockedFunction<typeof callSidecarAvatar>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;

// ── Fixtures ───────────────────────────────────────────────────────────────

const BASE_INPUT = {
    name: 'Priya Sharma',
    userId: 'teacher-uid-1',
};

// 1×1 PNG as a tiny avatar payload.
const TINY_PNG_DATA_URI =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjkI4QAAAABJRU5ErkJggg==';

const GENKIT_OUTPUT: AvatarGeneratorOutput = {
    imageDataUri: TINY_PNG_DATA_URI,
};

const SIDECAR_OUTPUT: SidecarAvatarResponse = {
    imageDataUri: TINY_PNG_DATA_URI,
    sidecarVersion: 'phase-f.2.0',
    latencyMs: 4_200,
    modelUsed: 'imagen-3',
};

function setMode(mode: AvatarSidecarMode, percent = 100): void {
    mockGetFlags.mockResolvedValue({
        avatarSidecarMode: mode,
        avatarSidecarPercent: percent,
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

describe('dispatchAvatar — off mode', () => {
    it('calls Genkit only and never touches the sidecar', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchAvatar(BASE_INPUT);

        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(out.source).toBe('genkit');
        expect(out.imageDataUri).toBe(TINY_PNG_DATA_URI);
        expect(out.sidecarTelemetry).toBeUndefined();
    });
});

// ── shadow ─────────────────────────────────────────────────────────────────

describe('dispatchAvatar — shadow mode', () => {
    it('returns Genkit and runs sidecar in parallel', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchAvatar(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).toHaveBeenCalledTimes(1);
        expect(out.sidecarTelemetry).toBeUndefined();
    });

    it('still serves Genkit when sidecar errors', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockRejectedValue(new AvatarSidecarTimeoutError(100_000));

        const out = await dispatchAvatar(BASE_INPUT);
        expect(out.source).toBe('genkit');
    });
});

// ── canary success ─────────────────────────────────────────────────────────

describe('dispatchAvatar — canary mode (sidecar serves)', () => {
    it('returns sidecar response with telemetry attached', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchAvatar(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.imageDataUri).toBe(TINY_PNG_DATA_URI);
        expect(mockGenkit).not.toHaveBeenCalled();
        expect(out.sidecarTelemetry).toBeDefined();
        expect(out.sidecarTelemetry?.sidecarVersion).toBe('phase-f.2.0');
    });

    // ── Phase O.3: canary fallback matrix ──────────────────────────────────

    it('falls back to Genkit on sidecar timeout', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new AvatarSidecarTimeoutError(100_000));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchAvatar(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(out.imageDataUri).toBe(TINY_PNG_DATA_URI);
        expect(mockGenkit).toHaveBeenCalledTimes(1);
    });

    it('falls back to Genkit on sidecar HTTP error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new AvatarSidecarHttpError(503, 'unavailable'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchAvatar(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on sidecar 502 HTTP error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new AvatarSidecarHttpError(502, 'bad gateway'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchAvatar(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on behavioural-guard error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new AvatarSidecarBehaviouralError(
                'safety', 'Avatar violates safety rules',
            ),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchAvatar(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
    });
});

// ── full ───────────────────────────────────────────────────────────────────

describe('dispatchAvatar — full mode', () => {
    it('routes 100% to sidecar when ok', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchAvatar(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockGenkit).not.toHaveBeenCalled();
    });
});
