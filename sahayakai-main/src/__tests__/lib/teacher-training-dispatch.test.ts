/**
 * Unit tests for the teacher-training sidecar dispatcher (Phase D.2 + Phase K).
 *
 * Phase K additions:
 * - sidecar success → persistSidecarJSON called with collection 'teacher-training'.
 * - persist throws → 200 still served (fail-soft).
 * - rate-limit gate runs before any sidecar call.
 */

import type {
    TeacherTrainingInput,
    TeacherTrainingOutput,
} from '@/ai/flows/teacher-training';
import type { TeacherTrainingSidecarMode } from '@/lib/sidecar/teacher-training-dispatch';

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/teacher-training', () => ({
    getTeacherTrainingAdvice: jest.fn(),
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(),
}));

jest.mock('@/lib/sidecar/persist-helpers', () => ({
    persistSidecarJSON: jest.fn(),
}));

jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({
    writeAgentShadowDiff: jest.fn(),
}));

jest.mock('@/lib/sidecar/teacher-training-client', () => {
    class TeacherTrainingSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'TeacherTrainingSidecarConfigError';
        }
    }
    class TeacherTrainingSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`timeout ${elapsedMs}`);
            this.name = 'TeacherTrainingSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class TeacherTrainingSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`http ${status}`);
            this.name = 'TeacherTrainingSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class TeacherTrainingSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`behavioural ${axisHint} ${details}`);
            this.name = 'TeacherTrainingSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarTeacherTraining: jest.fn(),
        TeacherTrainingSidecarConfigError,
        TeacherTrainingSidecarTimeoutError,
        TeacherTrainingSidecarHttpError,
        TeacherTrainingSidecarBehaviouralError,
    };
});

import { getTeacherTrainingAdvice } from '@/ai/flows/teacher-training';
import { getFeatureFlags } from '@/lib/feature-flags';
import { checkServerRateLimit } from '@/lib/server-safety';
import { persistSidecarJSON } from '@/lib/sidecar/persist-helpers';
import { dispatchTeacherTraining } from '@/lib/sidecar/teacher-training-dispatch';
import {
    callSidecarTeacherTraining,
    TeacherTrainingSidecarTimeoutError,
    type SidecarTeacherTrainingResponse,
} from '@/lib/sidecar/teacher-training-client';

const mockGenkit = getTeacherTrainingAdvice as jest.MockedFunction<typeof getTeacherTrainingAdvice>;
const mockSidecar = callSidecarTeacherTraining as jest.MockedFunction<typeof callSidecarTeacherTraining>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockRateLimit = checkServerRateLimit as jest.MockedFunction<typeof checkServerRateLimit>;
const mockPersist = persistSidecarJSON as jest.MockedFunction<typeof persistSidecarJSON>;

const BASE_INPUT: TeacherTrainingInput & { userId: string } = {
    question: 'How do I keep students engaged in a 60-student classroom?',
    language: 'English',
    subject: 'Pedagogy',
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT: TeacherTrainingOutput = {
    introduction: 'Genkit intro.',
    advice: [
        {
            strategy: 'Use peer learning groups.',
            pedagogy: 'Vygotsky',
            explanation: 'Genkit explanation.',
        },
    ],
    conclusion: 'Genkit conclusion.',
    gradeLevel: 'Class 5',
    subject: 'Pedagogy',
};

const SIDECAR_OUTPUT: SidecarTeacherTrainingResponse = {
    introduction: 'Sidecar intro.',
    advice: [
        {
            strategy: 'Sidecar strategy.',
            pedagogy: 'Sidecar pedagogy.',
            explanation: 'Sidecar explanation.',
        },
    ],
    conclusion: 'Sidecar conclusion.',
    gradeLevel: 'Class 5',
    subject: 'Pedagogy',
    sidecarVersion: 'phase-d.2.0',
    latencyMs: 700,
    modelUsed: 'gemini-2.0-flash',
};

function setMode(mode: TeacherTrainingSidecarMode, percent = 100): void {
    mockGetFlags.mockResolvedValue({
        teacherTrainingSidecarMode: mode,
        teacherTrainingSidecarPercent: percent,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetFlags.mockResolvedValue({
        teacherTrainingSidecarMode: 'off',
        teacherTrainingSidecarPercent: 0,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
    mockRateLimit.mockResolvedValue(undefined);
    mockPersist.mockResolvedValue({
        contentId: 'cid-test',
        storagePath: 'users/teacher-uid-1/teacher-training/test.json',
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('dispatchTeacherTraining — pre-call gates', () => {
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

        await dispatchTeacherTraining(BASE_INPUT);

        expect(mockRateLimit).toHaveBeenCalledWith('teacher-uid-1');
        expect(callOrder[0]).toBe('rate-limit');
        expect(callOrder[1]).toBe('sidecar');
    });

    it('propagates rate-limit error so the route can return 429/503', async () => {
        setMode('canary');
        mockRateLimit.mockRejectedValue(new Error('Rate limit exceeded. Please wait 5 minutes.'));

        await expect(dispatchTeacherTraining(BASE_INPUT)).rejects.toThrow(
            /Rate limit exceeded/,
        );
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });
});

describe('dispatchTeacherTraining — sidecar success persists to library', () => {
    it('canary success → persistSidecarJSON called with collection "teacher-training"', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchTeacherTraining(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockPersist).toHaveBeenCalledTimes(1);
        const callArg = mockPersist.mock.calls[0][0];
        expect(callArg.uid).toBe('teacher-uid-1');
        expect(callArg.collection).toBe('teacher-training');
        expect(callArg.contentType).toBe('teacher-training');
        expect(callArg.metadata.topic).toBe(BASE_INPUT.question);
        expect(callArg.metadata.language).toBe('English');
    });

    it('full mode success → persistSidecarJSON called', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchTeacherTraining(BASE_INPUT);
        expect(out.source).toBe('sidecar');
        expect(mockPersist).toHaveBeenCalledTimes(1);
        expect(mockPersist.mock.calls[0][0].collection).toBe('teacher-training');
    });

    it('persist throws → 200 still served (fail-soft)', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockRejectedValue(new Error('firestore down'));

        const out = await dispatchTeacherTraining(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.introduction).toBe(SIDECAR_OUTPUT.introduction);
    });
});

describe('dispatchTeacherTraining — sidecar failure does not persist', () => {
    it('genkit fallback path skips persist (Genkit owns its own persistence)', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new TeacherTrainingSidecarTimeoutError(12_000));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchTeacherTraining(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('off mode skips persist (Genkit owns its own persistence)', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchTeacherTraining(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockPersist).not.toHaveBeenCalled();
    });
});
