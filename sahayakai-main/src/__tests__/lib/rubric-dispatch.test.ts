/**
 * Unit tests for the rubric sidecar dispatcher (Phase D.1 + Phase K).
 *
 * Phase K additions:
 * - sidecar success → persistSidecarJSON called with collection 'rubrics'.
 * - persist throws → 200 still served (fail-soft).
 * - rate-limit gate runs before any sidecar call.
 */

import type {
    RubricGeneratorInput,
    RubricGeneratorOutput,
} from '@/ai/flows/rubric-generator';
import type { RubricSidecarMode } from '@/lib/sidecar/rubric-dispatch';

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/rubric-generator', () => ({
    generateRubric: jest.fn(),
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(),
}));

jest.mock('@/lib/sidecar/persist-helpers', () => ({
    persistSidecarJSON: jest.fn(),
}));

jest.mock('@/lib/sidecar/rubric-client', () => {
    class RubricSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'RubricSidecarConfigError';
        }
    }
    class RubricSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`timeout ${elapsedMs}`);
            this.name = 'RubricSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class RubricSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`http ${status}`);
            this.name = 'RubricSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class RubricSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`behavioural ${axisHint} ${details}`);
            this.name = 'RubricSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarRubric: jest.fn(),
        RubricSidecarConfigError,
        RubricSidecarTimeoutError,
        RubricSidecarHttpError,
        RubricSidecarBehaviouralError,
    };
});

import { generateRubric } from '@/ai/flows/rubric-generator';
import { getFeatureFlags } from '@/lib/feature-flags';
import { checkServerRateLimit } from '@/lib/server-safety';
import { persistSidecarJSON } from '@/lib/sidecar/persist-helpers';
import { dispatchRubric } from '@/lib/sidecar/rubric-dispatch';
import {
    callSidecarRubric,
    RubricSidecarTimeoutError,
    type SidecarRubricResponse,
} from '@/lib/sidecar/rubric-client';

const mockGenkit = generateRubric as jest.MockedFunction<typeof generateRubric>;
const mockSidecar = callSidecarRubric as jest.MockedFunction<typeof callSidecarRubric>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockRateLimit = checkServerRateLimit as jest.MockedFunction<typeof checkServerRateLimit>;
const mockPersist = persistSidecarJSON as jest.MockedFunction<typeof persistSidecarJSON>;

const BASE_INPUT: RubricGeneratorInput & { userId: string } = {
    assignmentDescription: 'Solar system project for Class 5',
    gradeLevel: 'Class 5',
    subject: 'Science',
    language: 'English',
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT: RubricGeneratorOutput = {
    title: 'Solar System Rubric',
    description: 'Grades the Class 5 solar system poster.',
    criteria: [
        {
            name: 'Research',
            description: 'Depth of research.',
            levels: [
                { name: 'Exemplary', description: 'A+', points: 4 },
                { name: 'Proficient', description: 'A', points: 3 },
                { name: 'Developing', description: 'B', points: 2 },
                { name: 'Beginning', description: 'C', points: 1 },
            ],
        },
    ],
    gradeLevel: 'Class 5',
    subject: 'Science',
};

const SIDECAR_OUTPUT: SidecarRubricResponse = {
    title: 'Sidecar Rubric',
    description: 'Sidecar description.',
    criteria: [
        {
            name: 'Sidecar Criterion',
            description: 'Sidecar.',
            levels: [
                { name: 'Exemplary', description: '4', points: 4 },
                { name: 'Proficient', description: '3', points: 3 },
                { name: 'Developing', description: '2', points: 2 },
                { name: 'Beginning', description: '1', points: 1 },
            ],
        },
    ],
    gradeLevel: 'Class 5',
    subject: 'Science',
    sidecarVersion: 'phase-d.1.0',
    latencyMs: 750,
    modelUsed: 'gemini-2.0-flash',
};

function setMode(mode: RubricSidecarMode, percent = 100): void {
    mockGetFlags.mockResolvedValue({
        rubricSidecarMode: mode,
        rubricSidecarPercent: percent,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetFlags.mockResolvedValue({
        rubricSidecarMode: 'off',
        rubricSidecarPercent: 0,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
    mockRateLimit.mockResolvedValue(undefined);
    mockPersist.mockResolvedValue({
        contentId: 'cid-test',
        storagePath: 'users/teacher-uid-1/rubrics/test.json',
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('dispatchRubric — pre-call gates', () => {
    it('runs checkServerRateLimit before any sidecar call', async () => {
        setMode('canary');
        const callOrder: string[] = [];
        mockRateLimit.mockImplementation(async () => {
            callOrder.push('rate-limit');
        });
        mockSidecar.mockImplementation(async () => {
            callOrder.push('sidecar');
            return SIDECAR_OUTPUT;
        });

        await dispatchRubric(BASE_INPUT);

        expect(mockRateLimit).toHaveBeenCalledWith('teacher-uid-1');
        expect(callOrder[0]).toBe('rate-limit');
        expect(callOrder[1]).toBe('sidecar');
    });

    it('propagates rate-limit error so the route can return 429/503', async () => {
        setMode('canary');
        mockRateLimit.mockRejectedValue(new Error('Rate limit exceeded. Please wait 5 minutes.'));

        await expect(dispatchRubric(BASE_INPUT)).rejects.toThrow(
            /Rate limit exceeded/,
        );
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });
});

describe('dispatchRubric — sidecar success persists to library', () => {
    it('canary success → persistSidecarJSON called with collection "rubrics"', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchRubric(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockPersist).toHaveBeenCalledTimes(1);
        const callArg = mockPersist.mock.calls[0][0];
        expect(callArg.uid).toBe('teacher-uid-1');
        expect(callArg.collection).toBe('rubrics');
        expect(callArg.contentType).toBe('rubric');
        expect(callArg.metadata.topic).toBe(BASE_INPUT.assignmentDescription);
        expect(callArg.metadata.language).toBe('English');
    });

    it('full mode success → persistSidecarJSON called', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchRubric(BASE_INPUT);
        expect(out.source).toBe('sidecar');
        expect(mockPersist).toHaveBeenCalledTimes(1);
        expect(mockPersist.mock.calls[0][0].collection).toBe('rubrics');
    });

    it('persist throws → 200 still served (fail-soft)', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockRejectedValue(new Error('firestore down'));

        const out = await dispatchRubric(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.title).toBe(SIDECAR_OUTPUT.title);
    });
});

describe('dispatchRubric — sidecar failure does not persist', () => {
    it('genkit fallback path skips persist (Genkit owns its own persistence)', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new RubricSidecarTimeoutError(12_000));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchRubric(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('off mode skips persist (Genkit owns its own persistence)', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchRubric(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockPersist).not.toHaveBeenCalled();
    });
});
