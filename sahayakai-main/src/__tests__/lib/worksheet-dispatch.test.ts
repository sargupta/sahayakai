/**
 * Unit tests for the worksheet sidecar dispatcher (Phase D.4 + Phase K).
 *
 * Phase K additions:
 * - sidecar success → persistSidecarJSON called with collection 'worksheets'.
 * - persist throws → 200 still served (fail-soft).
 * - rate-limit gate runs before any sidecar call.
 */

import type {
    WorksheetWizardInput,
    WorksheetWizardOutput,
} from '@/ai/flows/worksheet-wizard';
import type { WorksheetSidecarMode } from '@/lib/sidecar/worksheet-dispatch';

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/worksheet-wizard', () => ({
    generateWorksheet: jest.fn(),
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

jest.mock('@/lib/sidecar/worksheet-client', () => {
    class WorksheetSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'WorksheetSidecarConfigError';
        }
    }
    class WorksheetSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`timeout ${elapsedMs}`);
            this.name = 'WorksheetSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class WorksheetSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`http ${status}`);
            this.name = 'WorksheetSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class WorksheetSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`behavioural ${axisHint} ${details}`);
            this.name = 'WorksheetSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarWorksheet: jest.fn(),
        WorksheetSidecarConfigError,
        WorksheetSidecarTimeoutError,
        WorksheetSidecarHttpError,
        WorksheetSidecarBehaviouralError,
    };
});

import { generateWorksheet } from '@/ai/flows/worksheet-wizard';
import { getFeatureFlags } from '@/lib/feature-flags';
import { checkServerRateLimit } from '@/lib/server-safety';
import { persistSidecarJSON } from '@/lib/sidecar/persist-helpers';
import { dispatchWorksheet } from '@/lib/sidecar/worksheet-dispatch';
import {
    callSidecarWorksheet,
    WorksheetSidecarTimeoutError,
    type SidecarWorksheetResponse,
} from '@/lib/sidecar/worksheet-client';

const mockGenkit = generateWorksheet as jest.MockedFunction<typeof generateWorksheet>;
const mockSidecar = callSidecarWorksheet as jest.MockedFunction<typeof callSidecarWorksheet>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockRateLimit = checkServerRateLimit as jest.MockedFunction<typeof checkServerRateLimit>;
const mockPersist = persistSidecarJSON as jest.MockedFunction<typeof persistSidecarJSON>;

const BASE_INPUT: WorksheetWizardInput & { userId: string } = {
    imageDataUri: 'data:image/png;base64,xxx',
    prompt: 'multiplication practice',
    language: 'English',
    gradeLevel: 'Class 4',
    subject: 'Math',
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT: WorksheetWizardOutput = {
    title: 'Multiplication Worksheet',
    gradeLevel: 'Class 4',
    subject: 'Math',
    learningObjectives: ['Multiply 2-digit numbers'],
    studentInstructions: 'Solve all problems.',
    activities: [
        {
            type: 'question',
            content: '12 × 5 = ?',
            explanation: 'Use chunking.',
        },
    ],
    answerKey: [{ activityIndex: 0, answer: '60' }],
};

const SIDECAR_OUTPUT: SidecarWorksheetResponse = {
    title: 'Sidecar Worksheet',
    gradeLevel: 'Class 4',
    subject: 'Math',
    learningObjectives: ['Sidecar objective'],
    studentInstructions: 'Sidecar instructions.',
    activities: [
        {
            type: 'question',
            content: 'Sidecar question.',
            explanation: 'Sidecar explanation.',
        },
    ],
    answerKey: [{ activityIndex: 0, answer: 'Sidecar answer.' }],
    sidecarVersion: 'phase-d.4.0',
    latencyMs: 800,
    modelUsed: 'gemini-2.0-flash',
};

function setMode(mode: WorksheetSidecarMode, percent = 100): void {
    mockGetFlags.mockResolvedValue({
        worksheetSidecarMode: mode,
        worksheetSidecarPercent: percent,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetFlags.mockResolvedValue({
        worksheetSidecarMode: 'off',
        worksheetSidecarPercent: 0,
    } as Awaited<ReturnType<typeof getFeatureFlags>>);
    mockRateLimit.mockResolvedValue(undefined);
    mockPersist.mockResolvedValue({
        contentId: 'cid-test',
        storagePath: 'users/teacher-uid-1/worksheets/test.json',
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('dispatchWorksheet — pre-call gates', () => {
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

        await dispatchWorksheet(BASE_INPUT);

        expect(mockRateLimit).toHaveBeenCalledWith('teacher-uid-1');
        expect(callOrder[0]).toBe('rate-limit');
        expect(callOrder[1]).toBe('sidecar');
    });

    it('propagates rate-limit error so the route can return 429/503', async () => {
        setMode('canary');
        mockRateLimit.mockRejectedValue(new Error('Rate limit exceeded. Please wait 5 minutes.'));

        await expect(dispatchWorksheet(BASE_INPUT)).rejects.toThrow(
            /Rate limit exceeded/,
        );
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });
});

describe('dispatchWorksheet — sidecar success persists to library', () => {
    it('canary success → persistSidecarJSON called with collection "worksheets"', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchWorksheet(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockPersist).toHaveBeenCalledTimes(1);
        const callArg = mockPersist.mock.calls[0][0];
        expect(callArg.uid).toBe('teacher-uid-1');
        expect(callArg.collection).toBe('worksheets');
        expect(callArg.contentType).toBe('worksheet');
        expect(callArg.metadata.topic).toBe(BASE_INPUT.prompt);
        expect(callArg.metadata.language).toBe('English');
    });

    it('full mode success → persistSidecarJSON called', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchWorksheet(BASE_INPUT);
        expect(out.source).toBe('sidecar');
        expect(mockPersist).toHaveBeenCalledTimes(1);
        expect(mockPersist.mock.calls[0][0].collection).toBe('worksheets');
    });

    it('persist throws → 200 still served (fail-soft)', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockRejectedValue(new Error('storage write failed'));

        const out = await dispatchWorksheet(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.title).toBe(SIDECAR_OUTPUT.title);
    });
});

describe('dispatchWorksheet — sidecar failure does not persist', () => {
    it('genkit fallback path skips persist (Genkit owns its own persistence)', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(new WorksheetSidecarTimeoutError(25_000));
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchWorksheet(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('off mode skips persist (Genkit owns its own persistence)', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchWorksheet(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockPersist).not.toHaveBeenCalled();
    });
});
