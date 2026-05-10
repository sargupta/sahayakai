/**
 * Unit tests for the quiz sidecar dispatcher (Phase E.1) covering Phase K
 * persistence + pre-call gate lifts.
 *
 * Verifies:
 * - off / shadow paths unchanged
 * - canary / full path persists to Storage + Firestore via persistSidecarJSON
 * - pre-call topic-safety + rate-limit gates fire BEFORE the sidecar call
 * - persistence failure is fail-soft (response still 200)
 */

import type { QuizGeneratorInput, QuizVariantsOutput } from '@/ai/schemas/quiz-generator-schemas';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/quiz-generator', () => ({
    generateQuiz: jest.fn(),
}));

jest.mock('@/lib/sidecar/quiz-client', () => {
    class QuizSidecarConfigError extends Error {
        constructor(m: string) { super(m); this.name = 'QuizSidecarConfigError'; }
    }
    class QuizSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`Quiz sidecar request timed out after ${elapsedMs}ms`);
            this.name = 'QuizSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class QuizSidecarHttpError extends Error {
        readonly status: number;
        constructor(status: number, body: string) {
            super(`Quiz sidecar returned HTTP ${status}: ${body}`);
            this.name = 'QuizSidecarHttpError';
            this.status = status;
        }
    }
    class QuizSidecarBehaviouralError extends Error {
        constructor(axisHint: string, details: string) {
            super(`Quiz sidecar behavioural guard failed (${axisHint}): ${details}`);
            this.name = 'QuizSidecarBehaviouralError';
        }
    }
    return {
        callSidecarQuiz: jest.fn(),
        QuizSidecarConfigError,
        QuizSidecarTimeoutError,
        QuizSidecarHttpError,
        QuizSidecarBehaviouralError,
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
import { generateQuiz } from '@/ai/flows/quiz-generator';
import { getFeatureFlags } from '@/lib/feature-flags';
import { dispatchQuiz } from '@/lib/sidecar/quiz-dispatch';
import {
    callSidecarQuiz,
    QuizSidecarBehaviouralError,
    QuizSidecarHttpError,
    QuizSidecarTimeoutError,
    type SidecarQuizResponse,
} from '@/lib/sidecar/quiz-client';
import { persistSidecarJSON } from '@/lib/sidecar/persist-helpers';
import { writeAgentShadowDiff } from '@/lib/sidecar/shadow-diff-writer';

const mockGenerateQuiz = generateQuiz as jest.MockedFunction<typeof generateQuiz>;
const mockCallSidecar = callSidecarQuiz as jest.MockedFunction<typeof callSidecarQuiz>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockPersist = persistSidecarJSON as jest.MockedFunction<typeof persistSidecarJSON>;
const mockShadowDiff = writeAgentShadowDiff as jest.MockedFunction<typeof writeAgentShadowDiff>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_INPUT: QuizGeneratorInput & { userId: string } = {
    userId: 'teacher-uid-1',
    topic: 'Photosynthesis',
    numQuestions: 5,
    questionTypes: ['multiple_choice'],
    gradeLevel: 'Class 5',
    language: 'English',
    subject: 'Science',
};

const GENKIT_OUTPUT: QuizVariantsOutput = {
    easy: { title: 'Easy', questions: [], gradeLevel: 'Class 5', subject: 'Science' },
    medium: { title: 'Medium', questions: [], gradeLevel: 'Class 5', subject: 'Science' },
    hard: { title: 'Hard', questions: [], gradeLevel: 'Class 5', subject: 'Science' },
    id: 'genkit-id-123',
    gradeLevel: 'Class 5',
    subject: 'Science',
    topic: 'Photosynthesis',
    isSaved: true,
};

const SIDECAR_OUTPUT: SidecarQuizResponse = {
    easy: { title: 'Easy', questions: [], teacherInstructions: null, gradeLevel: 'Class 5', subject: 'Science' },
    medium: { title: 'Medium', questions: [], teacherInstructions: null, gradeLevel: 'Class 5', subject: 'Science' },
    hard: { title: 'Hard', questions: [], teacherInstructions: null, gradeLevel: 'Class 5', subject: 'Science' },
    gradeLevel: 'Class 5',
    subject: 'Science',
    topic: 'Photosynthesis',
    sidecarVersion: 'phase-e1.0.0',
    latencyMs: 4200,
    modelUsed: 'gemini-2.0-flash',
    variantsGenerated: 3,
};

function setMode(mode: 'off' | 'shadow' | 'canary' | 'full', percent = 100): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetFlags.mockResolvedValue({
        quizSidecarMode: mode,
        quizSidecarPercent: percent,
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

describe('dispatchQuiz — off mode', () => {
    it('calls Genkit only', async () => {
        setMode('off');
        mockGenerateQuiz.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchQuiz(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockCallSidecar).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
        // Off mode never lifts the gates — Genkit's flow does it inside.
        expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });
});

// ── shadow ───────────────────────────────────────────────────────────────────

describe('dispatchQuiz — shadow mode', () => {
    it('returns Genkit and does not lift the rate-limit gate (Genkit does it)', async () => {
        setMode('shadow');
        mockGenerateQuiz.mockResolvedValue(GENKIT_OUTPUT);
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchQuiz(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockCheckRateLimit).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });

    // Phase M.5 — shadow branch must persist (genkit, sidecar) pairs
    // through the new generic helper so the offline aggregator can read
    // them. Before M.5 the dispatcher only console.log'd the diff.
    it('writes a (genkit, sidecar) sample to writeAgentShadowDiff on success', async () => {
        setMode('shadow');
        mockGenerateQuiz.mockResolvedValue(GENKIT_OUTPUT);
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        await dispatchQuiz(BASE_INPUT);

        expect(mockShadowDiff).toHaveBeenCalledTimes(1);
        const sample = mockShadowDiff.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sample.agent).toBe('quiz');
        expect(sample.uid).toBe(BASE_INPUT.userId);
        expect(sample.sidecarOk).toBe(true);
        expect(sample.genkit).toEqual(GENKIT_OUTPUT);
        expect(sample.sidecar).toEqual(SIDECAR_OUTPUT);
        expect(typeof sample.genkitLatencyMs).toBe('number');
        expect(typeof sample.sidecarLatencyMs).toBe('number');
    });

    it('records sidecarOk=false + sidecarError when the sidecar threw', async () => {
        setMode('shadow');
        mockGenerateQuiz.mockResolvedValue(GENKIT_OUTPUT);
        mockCallSidecar.mockRejectedValue(new QuizSidecarTimeoutError(45_000));

        await dispatchQuiz(BASE_INPUT);

        expect(mockShadowDiff).toHaveBeenCalledTimes(1);
        const sample = mockShadowDiff.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sample.agent).toBe('quiz');
        expect(sample.sidecarOk).toBe(false);
        expect(sample.sidecar).toBeNull();
        expect(typeof sample.sidecarError).toBe('string');
    });
});

// ── canary / full — Phase K ──────────────────────────────────────────────────

describe('dispatchQuiz — canary mode (Phase K persistence)', () => {
    it('lifts rate-limit gate BEFORE the sidecar call', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-1', storagePath: 'p' });

        await dispatchQuiz(BASE_INPUT);

        expect(mockCheckRateLimit).toHaveBeenCalledWith('teacher-uid-1');
        // Order: rate-limit BEFORE sidecar
        const rateLimitCallOrder = mockCheckRateLimit.mock.invocationCallOrder[0];
        const sidecarCallOrder = mockCallSidecar.mock.invocationCallOrder[0];
        expect(rateLimitCallOrder).toBeLessThan(sidecarCallOrder);
    });

    it('rejects unsafe topics BEFORE calling sidecar', async () => {
        setMode('canary');

        await expect(
            dispatchQuiz({ ...BASE_INPUT, topic: 'how to make a bomb' }),
        ).rejects.toThrow(/Safety Violation/);

        expect(mockCallSidecar).not.toHaveBeenCalled();
        expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });

    it('rate-limit error surfaces and skips the sidecar call', async () => {
        setMode('canary');
        mockCheckRateLimit.mockRejectedValueOnce(new Error('Rate limit exceeded. Please wait 5 minutes.'));

        await expect(dispatchQuiz(BASE_INPUT)).rejects.toThrow(/Rate limit exceeded/);
        expect(mockCallSidecar).not.toHaveBeenCalled();
    });

    it('persists sidecar output to quizzes collection on success', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'persisted-cid-42', storagePath: 'users/.../quizzes/...json' });

        const out = await dispatchQuiz(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockPersist).toHaveBeenCalledTimes(1);
        const arg = mockPersist.mock.calls[0][0];
        expect(arg.uid).toBe('teacher-uid-1');
        expect(arg.collection).toBe('quizzes');
        expect(arg.contentType).toBe('quiz');
        expect(arg.title).toBe('Photosynthesis');
        expect(arg.metadata.gradeLevel).toBe('Class 5');
        expect(arg.metadata.subject).toBe('Science');
        expect(arg.metadata.topic).toBe('Photosynthesis');
        expect(arg.metadata.language).toBe('English');
        // Response carries the persisted contentId so the route returns isSaved=true
        expect(out.id).toBe('persisted-cid-42');
        expect(out.isSaved).toBe(true);
    });

    it('persistence failure does NOT drop the response (fail-soft)', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue(null);

        const out = await dispatchQuiz(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        // Sidecar response is preserved
        expect(out.topic).toBe('Photosynthesis');
        // isSaved=false signals the user library write failed but the
        // response is still served so the quiz appears on screen.
        expect(out.isSaved).toBe(false);
        expect(out.id).toBeUndefined();
    });

    it('falls back to Genkit on sidecar timeout', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(new QuizSidecarTimeoutError(45_000));
        mockGenerateQuiz.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchQuiz(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        // Sidecar persistence helper is NEVER called when the sidecar
        // itself failed — Genkit's own persistence handles the fallback
        // path.
        expect(mockPersist).not.toHaveBeenCalled();
    });

    // Phase O.3 — fill the canary fallback matrix that quiz was missing.

    it('falls back to Genkit on sidecar HTTP error (no persist)', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(
            new QuizSidecarHttpError(503, 'unavailable'),
        );
        mockGenerateQuiz.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchQuiz(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on sidecar behavioural-guard error', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(
            new QuizSidecarBehaviouralError('safety', 'Quiz violates safety rules'),
        );
        mockGenerateQuiz.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchQuiz(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });
});

describe('dispatchQuiz — full mode (Phase K persistence)', () => {
    it('persists and returns sidecar output', async () => {
        setMode('full');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-full', storagePath: 'p' });

        const out = await dispatchQuiz(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockPersist).toHaveBeenCalledTimes(1);
        expect(mockGenerateQuiz).not.toHaveBeenCalled();
        expect(out.id).toBe('cid-full');
    });
});
