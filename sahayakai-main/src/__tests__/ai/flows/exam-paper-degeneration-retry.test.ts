/**
 * @jest-environment node
 *
 * H6 (forensic EPG-2026-07-17): the bounded generation retry loop
 * (exam-paper-generator.ts) had zero tests. It re-rolls a degenerate/truncated
 * generation up to MAX_GEN_ATTEMPTS — perturbing temperature on each retry, and
 * switching to a fallback model once on a quota wall. retryTemperature /
 * isRetryableGenerationFailure / QUOTA_FALLBACK_MODEL are module-private, so we
 * drive the loop through generateExamPaper and observe via the prompt spy.
 *
 * The runResiliently mock is `async fn => fn({config:{}})` — it awaits the
 * callback exactly once and does NOT catch, so a rejected prompt propagates to
 * the flow-level loop (exactly the seam under test).
 */

// ── Mocks (before importing the SUT) ───────────────────────────────────────

jest.mock('@/ai/genkit', () => {
    const flowSpy = jest.fn();
    const promptSpy = jest.fn();
    return {
        __flowSpy: flowSpy,
        __promptSpy: promptSpy,
        ai: {
            definePrompt: jest.fn(() => promptSpy),
            defineFlow: (_config: unknown, fn: (input: unknown) => unknown) => {
                flowSpy.mockImplementation(fn as (input: unknown) => unknown);
                return flowSpy;
            },
            generate: jest.fn(),
        },
        runResiliently: jest.fn(async (fn: (cfg: unknown) => unknown) => fn({ config: {} })),
    };
});

jest.mock('@/ai/soul', () => ({ SAHAYAK_SOUL_PROMPT: '', STRUCTURED_OUTPUT_OVERRIDE: '' }));

// All flags OFF — isolate the generation loop from the repair/verify passes.
jest.mock('@/lib/feature-flags', () => ({
    isFeatureEnabled: jest.fn(async () => ({ enabled: false })),
}));

jest.mock('@/lib/ncert/validate-chapter', () => ({ validateChapterForFlow: jest.fn(() => null) }));
jest.mock('@/lib/firebase-admin', () => ({ getStorageInstance: jest.fn() }));
jest.mock('@/lib/logger/structured-logger', () => ({
    StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(() => 'error-id') },
}));

// Empty bank → no pyqContext → no ratio/novelty passes; only the gen loop runs.
jest.mock('@/lib/services/pyq-retrieval-service', () => ({
    getPYQsByChapter: jest.fn().mockResolvedValue([]),
}));

// ── Import SUT AFTER mocks ─────────────────────────────────────────────────

import { generateExamPaper, type ExamPaperInput } from '@/ai/flows/exam-paper-generator';
import { FlowExecutionError } from '@/lib/errors';

const promptSpy = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;

const BASE_INPUT: ExamPaperInput = {
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Mathematics',
    chapters: ['Real Numbers'],
    language: 'English',
    difficulty: 'mixed',
    includeAnswerKey: true,
    includeMarkingScheme: true,
    maxMarks: 10,
};

/** Schema-valid paper, `count` 1-mark questions summing to `count` marks. */
function paperFixture(count = 10) {
    return {
        title: 'CBSE Class 10 Mathematics Sample Paper',
        board: 'CBSE',
        subject: 'Mathematics',
        gradeLevel: 'Class 10',
        duration: '3 Hours',
        maxMarks: count,
        generalInstructions: ['Attempt all questions.'],
        sections: [{
            name: 'Section A',
            label: 'Objective Questions',
            totalMarks: count,
            questions: Array.from({ length: count }, (_, i) => ({
                number: i + 1,
                text: `Question ${i + 1}`,
                marks: 1,
                correctOption: '',
                answerKey: 'A',
                markingScheme: '1 mark',
                source: 'New',
            })),
        }],
    };
}

describe('exam-paper generation retry loop (H6)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('re-rolls a retryable (degenerate) failure and perturbs the temperature', async () => {
        promptSpy
            .mockRejectedValueOnce(new Error('Schema validation failed: required property "marks"'))
            .mockResolvedValueOnce({ output: paperFixture(), usage: {} });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(2);
        expect(result.title).toContain('CBSE');
        // Attempt 1 uses the base temperature (no override object); attempt 2 climbs.
        const retryConfig = (promptSpy.mock.calls[1][1] as { config: { temperature?: number; topP?: number } }).config;
        expect(retryConfig.temperature).toBeCloseTo(0.65); // retryTemperature(2) = min(0.9, 0.4 + 0.25)
        expect(retryConfig.topP).toBe(0.95);
    });

    it('does NOT re-roll a non-degenerate error — it surfaces on the first attempt', async () => {
        promptSpy.mockRejectedValueOnce(new Error('some unrelated failure'));

        await expect(generateExamPaper(BASE_INPUT)).rejects.toThrow();
        expect(promptSpy).toHaveBeenCalledTimes(1);
    });

    it('re-rolls a truncated/empty (null output) generation', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: null, usage: {} })
            .mockResolvedValueOnce({ output: paperFixture(), usage: {} });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(2);
        expect(result.sections[0].questions.length).toBe(10);
    });

    it('rejects with FlowExecutionError after MAX_GEN_ATTEMPTS (3) consecutive null outputs', async () => {
        promptSpy.mockResolvedValue({ output: null, usage: {} });

        await expect(generateExamPaper(BASE_INPUT)).rejects.toBeInstanceOf(FlowExecutionError);
        expect(promptSpy).toHaveBeenCalledTimes(3);
    });

    it('switches to the fallback model once on a quota wall (does not consume a perturbation)', async () => {
        const quotaErr = Object.assign(new Error('daily quota exhausted'), { name: 'AIQuotaExhaustedError' });
        promptSpy
            .mockRejectedValueOnce(quotaErr)
            .mockResolvedValueOnce({ output: paperFixture(), usage: {} });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(2);
        expect(result.title).toContain('CBSE');
        // First attempt: strong model (no explicit model override). Retry: fallback model set.
        expect((promptSpy.mock.calls[0][1] as { model?: string }).model).toBeUndefined();
        expect((promptSpy.mock.calls[1][1] as { model?: string }).model).toBeTruthy();
    });
});
