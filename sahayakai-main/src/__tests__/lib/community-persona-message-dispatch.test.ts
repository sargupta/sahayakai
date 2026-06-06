/**
 * Unit tests for the community-persona-message sidecar dispatcher.
 *
 * Covers off / shadow / canary (in-bucket, out-of-bucket, fallback) /
 * full / behavioural-guard error / bucket determinism.
 */

import type { PersonaMessageOutput } from '@/ai/flows/community-persona-message';
import type { PersonaDef } from '@/ai/data/community-personas';

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/community-persona-message', () => ({
    generateCommunityPersonaMessage: jest.fn(),
}));

jest.mock('@/lib/sidecar/community-persona-message-client', () => {
    class CommunityPersonaMessageSidecarConfigError extends Error {
        constructor(m: string) { super(m); this.name = 'CommunityPersonaMessageSidecarConfigError'; }
    }
    class CommunityPersonaMessageSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(ms: number) { super(`t ${ms}`); this.name = 'CommunityPersonaMessageSidecarTimeoutError'; this.elapsedMs = ms; }
    }
    class CommunityPersonaMessageSidecarHttpError extends Error {
        readonly status: number;
        constructor(s: number, b: string) { super(`h ${s}: ${b}`); this.name = 'CommunityPersonaMessageSidecarHttpError'; this.status = s; }
    }
    class CommunityPersonaMessageSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(a: string, d: string) { super(`b ${a}: ${d}`); this.name = 'CommunityPersonaMessageSidecarBehaviouralError'; this.axisHint = a; }
    }
    return {
        callSidecarCommunityPersonaMessage: jest.fn(),
        CommunityPersonaMessageSidecarConfigError,
        CommunityPersonaMessageSidecarTimeoutError,
        CommunityPersonaMessageSidecarHttpError,
        CommunityPersonaMessageSidecarBehaviouralError,
    };
});

jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({
    writeAgentShadowDiff: jest.fn(),
}));

import { generateCommunityPersonaMessage } from '@/ai/flows/community-persona-message';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarCommunityPersonaMessage,
    CommunityPersonaMessageSidecarBehaviouralError,
    CommunityPersonaMessageSidecarHttpError,
    CommunityPersonaMessageSidecarTimeoutError,
} from '@/lib/sidecar/community-persona-message-client';
import {
    decideCommunityPersonaMessageDispatch,
    dispatchCommunityPersonaMessage,
} from '@/lib/sidecar/community-persona-message-dispatch';
import { writeAgentShadowDiff } from '@/lib/sidecar/shadow-diff-writer';

const mockGenkit = generateCommunityPersonaMessage as jest.MockedFunction<typeof generateCommunityPersonaMessage>;
const mockSidecar = callSidecarCommunityPersonaMessage as jest.MockedFunction<typeof callSidecarCommunityPersonaMessage>;
const mockFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockShadow = writeAgentShadowDiff as jest.MockedFunction<typeof writeAgentShadowDiff>;

const PERSONA: PersonaDef = {
    id: 'p1',
    displayName: 'Ms. Devi',
    state: 'Karnataka',
    subject: 'Mathematics',
    gradeLevel: 'Class 5',
    voiceTone: 'warm',
    preferredLanguage: 'English',
    yearsExperience: 12,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const BASE_INPUT = {
    persona: PERSONA,
    recentMessages: [],
    mode: 'auto' as const,
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT: PersonaMessageOutput = {
    message: 'hello from Ms. Devi',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const SIDECAR_OUTPUT = {
    message: 'hello from Ms. Devi (sidecar)',
    sidecarVersion: 'v1',
    latencyMs: 800,
    modelUsed: 'gemini-2.5-flash',
};

function setMode(mode: 'off' | 'shadow' | 'canary' | 'full', percent = 100): void {
    mockFlags.mockResolvedValue({
        communityPersonaMessageSidecarMode: mode,
        communityPersonaMessageSidecarPercent: percent,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('dispatchCommunityPersonaMessage — off', () => {
    it('calls Genkit only', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchCommunityPersonaMessage(BASE_INPUT);
        expect(out.source).toBe('genkit');
        expect(mockSidecar).not.toHaveBeenCalled();
    });
});

describe('dispatchCommunityPersonaMessage — shadow', () => {
    it('serves Genkit + writes shadow-diff', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        const out = await dispatchCommunityPersonaMessage(BASE_INPUT);
        expect(out.source).toBe('genkit');
        const sample = mockShadow.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sample.agent).toBe('community-persona-message');
        expect(sample.sidecarOk).toBe(true);
    });

    it('records sidecarOk=false on sidecar failure', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockRejectedValue(
            new CommunityPersonaMessageSidecarTimeoutError(5000),
        );
        await dispatchCommunityPersonaMessage(BASE_INPUT);
        const sample = mockShadow.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sample.sidecarOk).toBe(false);
    });
});

describe('dispatchCommunityPersonaMessage — canary', () => {
    it('serves sidecar when bucket < percent', async () => {
        setMode('canary', 100);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        const out = await dispatchCommunityPersonaMessage(BASE_INPUT);
        expect(out.source).toBe('sidecar');
    });

    it('serves Genkit when bucket >= percent (0%)', async () => {
        setMode('canary', 0);
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchCommunityPersonaMessage(BASE_INPUT);
        expect(out.source).toBe('genkit');
        expect(mockSidecar).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on sidecar 5xx', async () => {
        setMode('canary', 100);
        mockSidecar.mockRejectedValue(
            new CommunityPersonaMessageSidecarHttpError(503, 'unavailable'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchCommunityPersonaMessage(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on sidecar timeout', async () => {
        setMode('canary', 100);
        mockSidecar.mockRejectedValue(
            new CommunityPersonaMessageSidecarTimeoutError(10_000),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchCommunityPersonaMessage(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on behavioural-guard error', async () => {
        setMode('canary', 100);
        mockSidecar.mockRejectedValue(
            new CommunityPersonaMessageSidecarBehaviouralError('safety', 'fail'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchCommunityPersonaMessage(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });
});

describe('dispatchCommunityPersonaMessage — full', () => {
    it('serves sidecar', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        const out = await dispatchCommunityPersonaMessage(BASE_INPUT);
        expect(out.source).toBe('sidecar');
    });
});

describe('decideCommunityPersonaMessageDispatch — bucket', () => {
    it('is deterministic per uid', async () => {
        setMode('canary', 50);
        const a = await decideCommunityPersonaMessageDispatch('uid-x');
        const b = await decideCommunityPersonaMessageDispatch('uid-x');
        expect(a.bucket).toBe(b.bucket);
    });

    it('produces uniform spread across 1000 uids', async () => {
        setMode('canary', 50);
        const buckets = new Set<number>();
        for (let i = 0; i < 1000; i++) {
            const d = await decideCommunityPersonaMessageDispatch(`u-${i}`);
            buckets.add(d.bucket);
        }
        expect(buckets.size).toBeGreaterThan(50);
    });
});
