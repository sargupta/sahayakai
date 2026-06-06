/**
 * Unit tests for the assignment-assessor sidecar dispatcher.
 *
 * Covers off / shadow / canary (gate ordering, in-bucket, out-of-bucket,
 * fallback matrix) / full / bucket determinism.
 */

import type {
    AssessAssignmentInput,
    AssessAssignmentOutput,
} from '@/ai/flows/assignment-assessor';

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/assignment-assessor', () => ({
    assessAssignment: jest.fn(),
}));

const mockRateLimit = jest.fn(async () => undefined);
jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

jest.mock('@/lib/sidecar/assignment-assessor-client', () => {
    class AssignmentAssessorSidecarConfigError extends Error {
        constructor(m: string) { super(m); this.name = 'AssignmentAssessorSidecarConfigError'; }
    }
    class AssignmentAssessorSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(ms: number) { super(`t ${ms}`); this.name = 'AssignmentAssessorSidecarTimeoutError'; this.elapsedMs = ms; }
    }
    class AssignmentAssessorSidecarHttpError extends Error {
        readonly status: number;
        constructor(s: number, b: string) { super(`h ${s}: ${b}`); this.name = 'AssignmentAssessorSidecarHttpError'; this.status = s; }
    }
    class AssignmentAssessorSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(a: string, d: string) { super(`b ${a}: ${d}`); this.name = 'AssignmentAssessorSidecarBehaviouralError'; this.axisHint = a; }
    }
    return {
        callSidecarAssignmentAssessor: jest.fn(),
        AssignmentAssessorSidecarConfigError,
        AssignmentAssessorSidecarTimeoutError,
        AssignmentAssessorSidecarHttpError,
        AssignmentAssessorSidecarBehaviouralError,
    };
});

jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({
    writeAgentShadowDiff: jest.fn(),
}));

import { assessAssignment } from '@/ai/flows/assignment-assessor';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarAssignmentAssessor,
    AssignmentAssessorSidecarBehaviouralError,
    AssignmentAssessorSidecarHttpError,
    AssignmentAssessorSidecarTimeoutError,
} from '@/lib/sidecar/assignment-assessor-client';
import {
    decideAssignmentAssessorDispatch,
    dispatchAssessment,
} from '@/lib/sidecar/assignment-assessor-dispatch';
import { writeAgentShadowDiff } from '@/lib/sidecar/shadow-diff-writer';

const mockGenkit = assessAssignment as jest.MockedFunction<typeof assessAssignment>;
const mockSidecar = callSidecarAssignmentAssessor as jest.MockedFunction<typeof callSidecarAssignmentAssessor>;
const mockFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockShadow = writeAgentShadowDiff as jest.MockedFunction<typeof writeAgentShadowDiff>;

const BASE_INPUT: AssessAssignmentInput & { userId: string } = {
    imageDataUri: 'data:image/png;base64,xx',
    language: 'English',
    subject: 'Mathematics',
    gradeLevel: 'Class 5',
    mode: 'full',
    userId: 'teacher-uid-1',
};

const RUBRIC = {
    title: 'r',
    description: 'd',
    criteria: [],
    gradeLevel: null,
    subject: null,
};

const GENKIT_OUTPUT: AssessAssignmentOutput = {
    assessmentId: 'a-1',
    rawTranscript: 't',
    editedTranscript: null,
    language: 'English',
    overallScore: 80,
    pointsEarned: 8,
    pointsPossible: 10,
    perCriterionScores: [],
    strengths: ['s'],
    improvements: ['i'],
    nextSteps: ['n'],
    teacherNote: 'note',
    confidenceOverall: 0.9,
    warnings: [],
    rubricSnapshot: RUBRIC,
    studentId: null,
    createdAtIso: '2026-06-06T00:00:00Z',
};

const SIDECAR_OUTPUT = {
    ...GENKIT_OUTPUT,
    sidecarVersion: 'v1',
    latencyMs: 1000,
    modelUsed: 'gemini-2.5-pro',
};

function setMode(mode: 'off' | 'shadow' | 'canary' | 'full', percent = 100): void {
    mockFlags.mockResolvedValue({
        assignmentAssessorSidecarMode: mode,
        assignmentAssessorSidecarPercent: percent,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockResolvedValue(undefined);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('dispatchAssessment — off', () => {
    it('calls Genkit only', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchAssessment(BASE_INPUT);
        expect(out.source).toBe('genkit');
        expect(mockSidecar).not.toHaveBeenCalled();
    });
});

describe('dispatchAssessment — shadow', () => {
    it('returns Genkit, writes shadow-diff on success', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        const out = await dispatchAssessment(BASE_INPUT);
        expect(out.source).toBe('genkit');
        expect(mockShadow).toHaveBeenCalledTimes(1);
        const sample = mockShadow.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sample.agent).toBe('assignment-assessor');
        expect(sample.sidecarOk).toBe(true);
    });

    it('records sidecarOk=false when sidecar throws', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockRejectedValue(new AssignmentAssessorSidecarTimeoutError(8000));
        await dispatchAssessment(BASE_INPUT);
        const sample = mockShadow.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sample.sidecarOk).toBe(false);
    });
});

describe('dispatchAssessment — canary', () => {
    it('lifts rate-limit gate BEFORE calling sidecar', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        await dispatchAssessment(BASE_INPUT);
        expect(mockRateLimit).toHaveBeenCalledWith('teacher-uid-1');
        const rlOrder = mockRateLimit.mock.invocationCallOrder[0];
        const scOrder = mockSidecar.mock.invocationCallOrder[0];
        expect(rlOrder).toBeLessThan(scOrder);
    });

    it('rate-limit error skips sidecar and surfaces', async () => {
        setMode('canary');
        mockRateLimit.mockRejectedValueOnce(new Error('Rate limit exceeded'));
        await expect(dispatchAssessment(BASE_INPUT)).rejects.toThrow(/Rate limit/);
        expect(mockSidecar).not.toHaveBeenCalled();
    });

    it('serves sidecar when bucket < percent', async () => {
        setMode('canary', 100);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        const out = await dispatchAssessment(BASE_INPUT);
        expect(out.source).toBe('sidecar');
    });

    it('serves Genkit when bucket >= percent (0%)', async () => {
        setMode('canary', 0);
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchAssessment(BASE_INPUT);
        expect(out.source).toBe('genkit');
        expect(mockSidecar).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on sidecar 5xx', async () => {
        setMode('canary', 100);
        mockSidecar.mockRejectedValue(
            new AssignmentAssessorSidecarHttpError(503, 'unavailable'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchAssessment(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on sidecar timeout', async () => {
        setMode('canary', 100);
        mockSidecar.mockRejectedValue(
            new AssignmentAssessorSidecarTimeoutError(60_000),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchAssessment(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on behavioural-guard error', async () => {
        setMode('canary', 100);
        mockSidecar.mockRejectedValue(
            new AssignmentAssessorSidecarBehaviouralError('safety', 'fail'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchAssessment(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });
});

describe('dispatchAssessment — full', () => {
    it('serves sidecar', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        const out = await dispatchAssessment(BASE_INPUT);
        expect(out.source).toBe('sidecar');
    });
});

describe('decideAssignmentAssessorDispatch — bucket', () => {
    it('is deterministic per uid', async () => {
        setMode('canary', 50);
        const a = await decideAssignmentAssessorDispatch('uid-z');
        const b = await decideAssignmentAssessorDispatch('uid-z');
        expect(a.bucket).toBe(b.bucket);
    });

    it('produces uniform spread across 1000 uids', async () => {
        setMode('canary', 50);
        const buckets = new Set<number>();
        for (let i = 0; i < 1000; i++) {
            const d = await decideAssignmentAssessorDispatch(`u-${i}`);
            buckets.add(d.bucket);
        }
        expect(buckets.size).toBeGreaterThan(50);
    });
});
