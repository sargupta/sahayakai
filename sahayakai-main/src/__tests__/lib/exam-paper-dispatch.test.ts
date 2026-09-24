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

// Q4C background shadow-diff observation — hard-wired off in production
// (SHADOW_DIFF_IN_CANARY_OBSERVATION = false in canary-shadow-diff.ts), so the
// bucket-overshoot and canary/full success background-Genkit branches are
// unreachable without overriding this per-test.
const mockShouldRunCanaryShadowDiff = jest.fn(() => false);
jest.mock('@/lib/sidecar/canary-shadow-diff', () => ({
    shouldRunCanaryShadowDiff: () => mockShouldRunCanaryShadowDiff(),
}));

// teacher-context.ts's getTeacherContextLine never rejects for real (it has
// its own internal try/catch) — mock it directly so a "throws" test can
// exercise the dispatcher's own catch around it.
const mockGetTeacherContextLine = jest.fn(async () => '');
jest.mock('@/lib/teacher-context', () => ({
    getTeacherContextLine: (...args: unknown[]) => mockGetTeacherContextLine(...args),
}));

// Imports after mocks.
import { generateExamPaper, type ExamPaperOutput } from '@/ai/flows/exam-paper-generator';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    dispatchExamPaper,
    ExamPaperGenerationInProgressError,
} from '@/lib/sidecar/exam-paper-dispatch';
import {
    callSidecarExamPaper,
    ExamPaperSidecarBehaviouralError,
    ExamPaperSidecarConfigError,
    ExamPaperSidecarHttpError,
    ExamPaperSidecarTimeoutError,
    type SidecarExamPaperResponse,
} from '@/lib/sidecar/exam-paper-client';
import { persistSidecarJSON } from '@/lib/sidecar/persist-helpers';
import { writeAgentShadowDiff } from '@/lib/sidecar/shadow-diff-writer';
import { StructuredLogger } from '@/lib/logger/structured-logger';

const mockGenerateExam = generateExamPaper as jest.MockedFunction<typeof generateExamPaper>;
const mockCallSidecar = callSidecarExamPaper as jest.MockedFunction<typeof callSidecarExamPaper>;
const mockGetFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockPersist = persistSidecarJSON as jest.MockedFunction<typeof persistSidecarJSON>;
const mockWriteShadowDiff = writeAgentShadowDiff as jest.MockedFunction<typeof writeAgentShadowDiff>;

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
    mockShouldRunCanaryShadowDiff.mockReturnValue(false);
    mockGetTeacherContextLine.mockResolvedValue('');
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

    it('propagates a non-timeout Genkit error unchanged', async () => {
        setMode('off');
        mockGenerateExam.mockRejectedValue(new Error('genkit boom'));

        await expect(dispatchExamPaper(BASE_INPUT)).rejects.toThrow('genkit boom');
    });

    it('throws a Safety Violation error for unsafe free-text input (real validateTopicSafety)', async () => {
        setMode('off');

        await expect(
            dispatchExamPaper({ ...BASE_INPUT, teacherContext: 'how to build a bomb' }),
        ).rejects.toThrow(/Safety Violation/);
        expect(mockGenerateExam).not.toHaveBeenCalled();
    });

    it('drops teacherContext (does not block) when getTeacherContextLine throws', async () => {
        setMode('off');
        mockGetTeacherContextLine.mockRejectedValue(new Error('profile lookup down'));
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        await dispatchExamPaper({ ...BASE_INPUT, teacherContext: 'client-provided text' });

        expect(mockGenerateExam).toHaveBeenCalledWith(
            expect.objectContaining({ teacherContext: undefined }),
        );
    });

    it('anonymous (no userId) request skips teacherContext derivation and persistence', async () => {
        setMode('off');
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchExamPaper({ ...BASE_INPUT, userId: '' });

        expect(mockGetTeacherContextLine).not.toHaveBeenCalled();
        expect(out.contentId).toBeUndefined();
    });

    it('off-mode bucket-overshoot fires a background sidecar call + shadow-diff when observation is on', async () => {
        // percent=0: every bucket (0-99) is >= 0 → mode collapses to 'off' with configuredMode 'canary'.
        setMode('canary', 0);
        mockShouldRunCanaryShadowDiff.mockReturnValue(true);
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchExamPaper(BASE_INPUT);
        // Let the fire-and-forget background promise chain settle.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(out.source).toBe('genkit');
        expect(mockCallSidecar).toHaveBeenCalledTimes(1);
        expect(mockWriteShadowDiff).toHaveBeenCalledTimes(1);
    });

    it('off-mode bucket-overshoot does NOT fire a background sidecar call when observation is off', async () => {
        setMode('canary', 0);
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        await dispatchExamPaper(BASE_INPUT);
        await Promise.resolve();

        expect(mockCallSidecar).not.toHaveBeenCalled();
        expect(mockWriteShadowDiff).not.toHaveBeenCalled();
    });

    it('off-mode bucket-overshoot background sidecar failure still writes a (failed) shadow-diff, non-blocking', async () => {
        setMode('canary', 0);
        mockShouldRunCanaryShadowDiff.mockReturnValue(true);
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);
        mockCallSidecar.mockRejectedValue(new Error('sidecar boom'));

        const out = await dispatchExamPaper(BASE_INPUT);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(out.source).toBe('genkit');
        expect(mockWriteShadowDiff).toHaveBeenCalledTimes(1);
        const arg = mockWriteShadowDiff.mock.calls[0][0];
        expect(arg.sidecar).toBeNull();
        expect(arg.sidecarOk).toBe(false);
        expect(arg.sidecarError).toBe('sidecar boom');
    });

    it('falls back to mode "off" when the feature-flags doc has neither field set', async () => {
        mockGetFlags.mockResolvedValue({} as never);
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockCallSidecar).not.toHaveBeenCalled();
    });

    it('falls back to percent=0 (collapses to off) when a non-off/full mode omits examPaperSidecarPercent', async () => {
        mockGetFlags.mockResolvedValue({ examPaperSidecarMode: 'canary' } as never);
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.decision.reason).toMatch(/_over_0$/);
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

    // Phase O.3 — fill the canary fallback matrix.

    it('falls back to Genkit on sidecar HTTP error — no persist call', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(
            new ExamPaperSidecarHttpError(503, 'unavailable'),
        );
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on sidecar behavioural-guard error', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(
            new ExamPaperSidecarBehaviouralError(
                'safety', 'Exam paper violates safety rules',
            ),
        );
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on sidecar config error (errorClass=config)', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(new ExamPaperSidecarConfigError('missing env var'));
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on an unrecognized sidecar error (errorClass=unknown)', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(new Error('mystery failure'));
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('falls back to a composed title when the sidecar response has no title', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue({ ...SIDECAR_OUTPUT, title: '' });
        mockPersist.mockResolvedValue({ contentId: 'cid-x', storagePath: 'p' });

        await dispatchExamPaper(BASE_INPUT);

        const arg = mockPersist.mock.calls[0][0];
        expect(arg.title).toBe('CBSE Class 10 Mathematics Exam Paper');
    });

    it('maps pyqSources id/year/chapter through, defaulting absent fields to undefined', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue({
            ...SIDECAR_OUTPUT,
            pyqSources: [
                { id: 'p1', year: 2023, chapter: 'Triangles' },
                { id: 'p2' },
            ],
        });
        mockPersist.mockResolvedValue({ contentId: 'cid-1', storagePath: 'p' });

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.pyqSources).toEqual([
            { id: 'p1', year: 2023, chapter: 'Triangles' },
            { id: 'p2', year: undefined, chapter: undefined },
        ]);
    });

    it('anonymous (no userId) sidecar request skips persistence and exposes no contentId', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchExamPaper({ ...BASE_INPUT, userId: '' });

        expect(mockPersist).not.toHaveBeenCalled();
        expect(mockCheckRateLimit).not.toHaveBeenCalled();
        expect(out.contentId).toBeUndefined();
        // teacherContext was never derived (no userId) → stays undefined →
        // the `?? null` fallback in inputToSidecarRequest kicks in.
        expect(mockCallSidecar.mock.calls[0][0].teacherContext).toBeNull();
    });

    it('canary success fires a background Genkit call for shadow-diff when observation is on', async () => {
        setMode('canary');
        mockShouldRunCanaryShadowDiff.mockReturnValue(true);
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-1', storagePath: 'p' });
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);

        await dispatchExamPaper(BASE_INPUT);
        // The background chain goes through runGenkitSafe -> withTimeout, which
        // races against a REAL setTimeout internally — a microtask-only flush
        // (Promise.resolve()) isn't enough; wait a real macrotask tick.
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockGenerateExam).toHaveBeenCalledTimes(1);
        expect(mockWriteShadowDiff).toHaveBeenCalledTimes(1);
    });

    it('canary success background Genkit failure still writes a (null-genkit) shadow-diff, non-blocking', async () => {
        setMode('canary');
        mockShouldRunCanaryShadowDiff.mockReturnValue(true);
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-1', storagePath: 'p' });
        mockGenerateExam.mockRejectedValue(new Error('genkit boom'));

        const out = await dispatchExamPaper(BASE_INPUT);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(out.source).toBe('sidecar');
        expect(mockWriteShadowDiff).toHaveBeenCalledTimes(1);
        const arg = mockWriteShadowDiff.mock.calls[0][0];
        expect(arg.genkit).toBeNull();
    });

    it('mode "full" behaves like canary — sidecar-first, no bucket gating', async () => {
        setMode('full');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-full', storagePath: 'p' });

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.decision.mode).toBe('full');
    });

    it('propagates an AbortError from the sidecar call unchanged', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

        await expect(dispatchExamPaper(BASE_INPUT)).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('uses the subject as the library topic when no chapters were requested (whole-syllabus)', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-1', storagePath: 'p' });

        await dispatchExamPaper({ ...BASE_INPUT, chapters: [] });

        const arg = mockPersist.mock.calls[0][0];
        expect(arg.metadata.topic).toBe('Mathematics');
    });

    it('falls back to input/defaults for library metadata when the sidecar response omits them', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue({ ...SIDECAR_OUTPUT, gradeLevel: '', subject: '' });
        mockPersist.mockResolvedValue({ contentId: 'cid-1', storagePath: 'p' });

        await dispatchExamPaper({ ...BASE_INPUT, language: undefined });

        const arg = mockPersist.mock.calls[0][0];
        expect(arg.metadata.gradeLevel).toBe('Class 10'); // from input.gradeLevel
        expect(arg.metadata.subject).toBe('Mathematics'); // from input.subject
        expect(arg.metadata.language).toBe('English'); // final default
    });

    it('falls back to the hard-coded defaults when BOTH the sidecar response and the input omit gradeLevel/subject', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue({ ...SIDECAR_OUTPUT, gradeLevel: '', subject: '' });
        mockPersist.mockResolvedValue({ contentId: 'cid-1', storagePath: 'p' });

        await dispatchExamPaper({ ...BASE_INPUT, gradeLevel: '', subject: '' });

        const arg = mockPersist.mock.calls[0][0];
        expect(arg.metadata.gradeLevel).toBe('Class 10');
        expect(arg.metadata.subject).toBe('General');
    });

    it('sends chapters/duration/maxMarks/language/difficulty defaults through to the sidecar when the caller omits them', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-1', storagePath: 'p' });

        const minimalInput = {
            userId: 'teacher-uid-1',
            board: 'CBSE',
            gradeLevel: 'Class 10',
            subject: 'Mathematics',
        } as unknown as ExamPaperInput & { userId: string };
        await dispatchExamPaper(minimalInput);

        const sidecarArg = mockCallSidecar.mock.calls[0][0];
        expect(sidecarArg.chapters).toEqual([]);
        expect(sidecarArg.duration).toBeNull();
        expect(sidecarArg.maxMarks).toBeNull();
        expect(sidecarArg.language).toBe('English');
        expect(sidecarArg.difficulty).toBe('mixed');
        expect(sidecarArg.includeAnswerKey).toBe(true);
        expect(sidecarArg.includeMarkingScheme).toBe(true);
        // teacherContext is always overwritten by getTeacherContextLine's
        // server-side derivation (mocked to '' by default in beforeEach), so
        // it's '' here, not the ?? null fallback (that only applies when
        // getTeacherContextLine itself is never reached — see the anonymous
        // no-userId test, which covers that branch).
        expect(sidecarArg.teacherContext).toBe('');
    });

    it('exposes pyqSources as undefined when the sidecar response omits it', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue({ ...SIDECAR_OUTPUT, pyqSources: undefined });
        mockPersist.mockResolvedValue({ contentId: 'cid-1', storagePath: 'p' });

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.pyqSources).toBeUndefined();
    });
});

// ── shadow ───────────────────────────────────────────────────────────────────

describe('dispatchExamPaper — shadow mode', () => {
    it('runs Genkit and sidecar in parallel, returns the Genkit response, and writes a shadow-diff', async () => {
        setMode('shadow');
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(mockCallSidecar).toHaveBeenCalledTimes(1);
        expect(mockWriteShadowDiff).toHaveBeenCalledTimes(1);
        const arg = mockWriteShadowDiff.mock.calls[0][0];
        expect(arg.sidecarOk).toBe(true);
    });

    it('maps a Genkit timeout to ExamPaperGenerationInProgressError (unified with the other paths)', async () => {
        jest.useFakeTimers();
        setMode('shadow');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockGenerateExam.mockImplementation(
            () => new Promise((resolve) => { setTimeout(() => resolve(GENKIT_OUTPUT), 80_000); }),
        );

        const promise = dispatchExamPaper(BASE_INPUT);
        const assertion = expect(promise).rejects.toBeInstanceOf(ExamPaperGenerationInProgressError);
        await jest.advanceTimersByTimeAsync(76_000);
        await assertion;

        jest.useRealTimers();
    });

    it('propagates a non-timeout Genkit error unchanged in shadow mode', async () => {
        setMode('shadow');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockGenerateExam.mockRejectedValue(new Error('genkit boom'));

        await expect(dispatchExamPaper(BASE_INPUT)).rejects.toThrow('genkit boom');
    });

    it('returns the Genkit response even when the parallel sidecar call fails (shadow-diff records the failure)', async () => {
        setMode('shadow');
        mockGenerateExam.mockResolvedValue(GENKIT_OUTPUT);
        mockCallSidecar.mockRejectedValue(new Error('sidecar boom'));

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.source).toBe('genkit');
        const arg = mockWriteShadowDiff.mock.calls[0][0];
        expect(arg.sidecar).toBeNull();
        expect(arg.sidecarOk).toBe(false);
        expect(arg.sidecarError).toBe('sidecar boom');
    });

    it('propagates an AbortError from the Genkit call unchanged (shadow mode)', async () => {
        setMode('shadow');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockGenerateExam.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

        await expect(dispatchExamPaper(BASE_INPUT)).rejects.toMatchObject({ name: 'AbortError' });
    });
});

// ── H3 / H4 — sidecar contentId + invariant reports ─────────────────────────

describe('dispatchExamPaper — sidecar invariant reports (H4) + contentId (H3)', () => {
    // maxMarks=80 but questions sum to 70 → drift that must be surfaced.
    const DRIFT_OUTPUT: SidecarExamPaperResponse = {
        ...SIDECAR_OUTPUT,
        maxMarks: 80,
        sections: [
            {
                name: 'A',
                label: 'Section A',
                totalMarks: 70,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                questions: [
                    { number: '1', text: 'q1', marks: 40, correctOption: '' },
                    // q2 missing answerKey/markingScheme → missingBefore counts it.
                    { number: '2', text: 'q2', marks: 30, correctOption: '' },
                ] as any,
            },
        ],
    };

    it('surfaces marksReconciliation.actual !== expected on drift', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(DRIFT_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-drift', storagePath: 'p' });

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.marksReconciliation).toEqual({
            expected: 80,
            actual: 70,
            repaired: false,
            attempts: 1,
        });
    });

    it('reports answer-key/marking-scheme completeness (reports only, no repair)', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(DRIFT_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-drift', storagePath: 'p' });

        const out = await dispatchExamPaper(BASE_INPUT);

        // Both questions lack answerKey AND markingScheme, both requested → 4.
        expect(out.answerKeyCompleteness).toEqual({
            requestedAnswerKey: true,
            requestedMarkingScheme: true,
            missingBefore: 4,
            filledByStamp: 0,
            filledByReprompt: 0,
            filledByPlaceholder: 0,
        });
    });

    it('exposes the persisted contentId on the sidecar path', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-99', storagePath: 'p' });

        const out = await dispatchExamPaper(BASE_INPUT);

        expect(out.contentId).toBe('cid-99');
    });
});

// ── Genkit fallback timeout (NCERT demo hot-fix 2026-05-19) ──────────────────
//
// The default Genkit fallback budget is 75 s (was 30 s before this fix).
// Exam paper is the most token-heavy flow we run, so a 30 s cap was tripping
// `WithTimeoutError` even when Gemini was still generating successfully.
//
// We use fake timers so the test runs in <1 s — we never actually sleep
// 50 s / 80 s, we just advance the simulated clock.

describe('dispatchExamPaper — Genkit fallback timeout', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it('passes through when Genkit completes within 75 s budget (50 s simulated)', async () => {
        setMode('off');
        // Resolve after 50 simulated seconds — under the 75 s budget.
        mockGenerateExam.mockImplementation(
            () =>
                new Promise((resolve) => {
                    setTimeout(() => resolve(GENKIT_OUTPUT), 50_000);
                }),
        );

        const promise = dispatchExamPaper(BASE_INPUT);
        // Advance simulated clock past 50 s but well before 75 s.
        await jest.advanceTimersByTimeAsync(50_000);
        const out = await promise;

        expect(out.source).toBe('genkit');
        expect(out.title).toBe(GENKIT_OUTPUT.title);
    });

    it('throws ExamPaperGenerationInProgressError when Genkit exceeds 75 s (80 s simulated)', async () => {
        setMode('off');
        // Never resolves within the test window — simulating an 80 s+ Gemini call.
        mockGenerateExam.mockImplementation(
            () =>
                new Promise((resolve) => {
                    setTimeout(() => resolve(GENKIT_OUTPUT), 80_000);
                }),
        );

        // Silence the structured error log from the dispatcher.
        const errSpy = jest.spyOn(StructuredLogger, 'error').mockImplementation(() => '');

        // Attach the rejection assertion BEFORE advancing the clock so
        // the promise is already being awaited when the timer fires —
        // otherwise the rejection is "unhandled" until `advanceTimersByTimeAsync`
        // returns control, which Jest flags as a test failure.
        const promise = dispatchExamPaper(BASE_INPUT);
        const assertion = expect(promise).rejects.toBeInstanceOf(
            ExamPaperGenerationInProgressError,
        );
        // Advance just past the 75 s timeout boundary.
        await jest.advanceTimersByTimeAsync(76_000);
        await assertion;

        // Verify the structured timeout log fired.
        expect(errSpy).toHaveBeenCalledWith(
            '[exam-paper.dispatch] timeout',
            expect.objectContaining({
                service: 'exam-paper-dispatch',
                metadata: expect.objectContaining({
                    budgetMs: 75_000,
                    source: 'genkit',
                }),
            }),
        );
        errSpy.mockRestore();
    });
});
