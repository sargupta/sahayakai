/**
 * Unit tests for the exam-paper sidecar dispatcher (Phase E.2) covering
 * Phase K persistence + rate-limit gate lift.
 *
 * Note: the Genkit flow does NOT call validateTopicSafety (the topic is
 * structured: board / grade / subject / chapters), so the dispatcher
 * lifts only the rate-limit gate.
 */

import type { ExamPaperInput } from '@/ai/flows/exam-paper-generator';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/exam-paper-generator', () => ({
    generateExamPaper: jest.fn(),
}));

jest.mock('@/lib/sidecar/exam-paper-client', () => {
    class ExamPaperSidecarConfigError extends Error {
        constructor(m: string) { super(m); this.name = 'ExamPaperSidecarConfigError'; }
    }
    class ExamPaperSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`Exam paper sidecar request timed out after ${elapsedMs}ms`);
            this.name = 'ExamPaperSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class ExamPaperSidecarHttpError extends Error {
        readonly status: number;
        constructor(status: number, body: string) {
            super(`Exam paper sidecar returned HTTP ${status}: ${body}`);
            this.name = 'ExamPaperSidecarHttpError';
            this.status = status;
        }
    }
    class ExamPaperSidecarBehaviouralError extends Error {
        constructor(axisHint: string, details: string) {
            super(`Exam paper sidecar behavioural guard failed (${axisHint}): ${details}`);
            this.name = 'ExamPaperSidecarBehaviouralError';
        }
    }
    return {
        callSidecarExamPaper: jest.fn(),
        ExamPaperSidecarConfigError,
        ExamPaperSidecarTimeoutError,
        ExamPaperSidecarHttpError,
        ExamPaperSidecarBehaviouralError,
    };
});

jest.mock('@/lib/sidecar/persist-helpers', () => ({
    persistSidecarJSON: jest.fn(),
}));

jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({
    writeAgentShadowDiff: jest.fn(),
}));

const mockCheckRateLimit = jest.fn(async () => undefined);
jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

// Imports after mocks.
import { generateExamPaper, type ExamPaperOutput } from '@/ai/flows/exam-paper-generator';
import { getFeatureFlags } from '@/lib/feature-flags';
import { dispatchExamPaper } from '@/lib/sidecar/exam-paper-dispatch';
import {
    callSidecarExamPaper,
    ExamPaperSidecarTimeoutError,
    type SidecarExamPaperResponse,
} from '@/lib/sidecar/exam-paper-client';
import { persistSidecarJSON } from '@/lib/sidecar/persist-helpers';

const mockGenerateExam = generateExamPaper as jest.MockedFunction<typeof generateExamPaper>;
const mockCallSidecar = callSidecarExamPaper as jest.MockedFunction<typeof callSidecarExamPaper>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockPersist = persistSidecarJSON as jest.MockedFunction<typeof persistSidecarJSON>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_INPUT: ExamPaperInput & { userId: string } = {
    userId: 'teacher-uid-1',
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Mathematics',
    chapters: ['Quadratic Equations', 'Triangles'],
    language: 'English',
    difficulty: 'mixed',
    includeAnswerKey: true,
    includeMarkingScheme: true,
};

const SIDECAR_OUTPUT: SidecarExamPaperResponse = {
    title: 'CBSE Class 10 Mathematics Sample Paper',
    board: 'CBSE',
    subject: 'Mathematics',
    gradeLevel: 'Class 10',
    duration: '3 Hours',
    maxMarks: 80,
    generalInstructions: ['All questions are compulsory.'],
    sections: [],
    blueprintSummary: { chapterWise: [], difficultyWise: [] },
    pyqSources: [],
    sidecarVersion: 'phase-e2.0.0',
    latencyMs: 5500,
    modelUsed: 'gemini-2.0-flash',
};

const GENKIT_OUTPUT: ExamPaperOutput = {
    title: 'CBSE Class 10 Mathematics Sample Paper (Genkit)',
    board: 'CBSE',
    subject: 'Mathematics',
    gradeLevel: 'Class 10',
    duration: '3 Hours',
    maxMarks: 80,
    generalInstructions: ['All questions are compulsory.'],
    sections: [],
    blueprintSummary: { chapterWise: [], difficultyWise: [] },
    pyqSources: [],
};

function setMode(mode: 'off' | 'shadow' | 'canary' | 'full', percent = 100): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetFlags.mockResolvedValue({
        examPaperSidecarMode: mode,
        examPaperSidecarPercent: percent,
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

// ── off ──────────────────────────────────────────────────────────────────────

describe('dispatchExamPaper — off mode', () => {
    it('calls Genkit only and never persists from the dispatcher', async () => {
        setMode('off');
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockCallSidecar).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
        expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });
});

// ── canary / full — Phase K ──────────────────────────────────────────────────

describe('dispatchExamPaper — canary mode (Phase K persistence)', () => {
    it('lifts the rate-limit gate before calling sidecar', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-1', storagePath: 'p' });

        await dispatchExamPaper(BASE_INPUT);

        expect(mockCheckRateLimit).toHaveBeenCalledWith('teacher-uid-1');
        const rl = mockCheckRateLimit.mock.invocationCallOrder[0];
        const sc = mockCallSidecar.mock.invocationCallOrder[0];
        expect(rl).toBeLessThan(sc);
    });

    it('persists sidecar output to exam-papers collection on success', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-42', storagePath: 'p' });

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockPersist).toHaveBeenCalledTimes(1);
        const arg = mockPersist.mock.calls[0][0];
        expect(arg.uid).toBe('teacher-uid-1');
        expect(arg.collection).toBe('exam-papers');
        expect(arg.contentType).toBe('exam-paper');
        expect(arg.title).toBe('CBSE Class 10 Mathematics Sample Paper');
        expect(arg.metadata.gradeLevel).toBe('Class 10');
        expect(arg.metadata.subject).toBe('Mathematics');
        expect(arg.metadata.topic).toBe('Quadratic Equations, Triangles');
        expect(arg.metadata.language).toBe('English');
    });

    it('persistence failure does NOT drop the response (fail-soft)', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue(null);

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.title).toBe('CBSE Class 10 Mathematics Sample Paper');
    });

    it('falls back to Genkit on sidecar timeout — no persist call', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(new ExamPaperSidecarTimeoutError(30_000));
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });
});
