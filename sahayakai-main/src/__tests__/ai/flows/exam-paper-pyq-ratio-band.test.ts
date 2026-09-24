/**
 * @jest-environment node
 *
 * Teacher-configurable PYQ/New ratio (2026-07-19): `input.pyqRatio` (0-100)
 * sets a target % of PYQ-sourced questions; the generated paper's actual
 * PYQ share must land within ±5 percentage points of that target. Unset
 * `pyqRatio` must reproduce today's exact pre-existing behavior (asymmetric
 * 50%/20% floors, no ceiling) — this is a strictly additive feature.
 *
 * In-process contract tests; no Gemini calls.
 */

// ── Mocks (must come before importing the SUT) ─────────────────────────────

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

jest.mock('@/ai/soul', () => ({
    SAHAYAK_SOUL_PROMPT: '',
    STRUCTURED_OUTPUT_OVERRIDE: '',
}));

// Repair flag ON — under test here.
jest.mock('@/lib/feature-flags', () => ({
    isFeatureEnabled: jest.fn(async (flag: string) => ({
        enabled: flag === 'examPaperPyqRatioRepair',
    })),
}));

jest.mock('@/lib/ncert/validate-chapter', () => ({
    validateChapterForFlow: jest.fn(() => null),
}));

jest.mock('@/lib/firebase-admin', () => ({
    getStorageInstance: jest.fn(),
}));

jest.mock('@/lib/logger/structured-logger', () => ({
    StructuredLogger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(() => 'error-id'),
    },
}));

// Non-empty so pyqContext is truthy and the reconcile block actually runs.
jest.mock('@/lib/services/pyq-retrieval-service', () => ({
    getPYQsByChapter: jest.fn().mockResolvedValue([
        { id: 'CBSE_mathematics_c10_fixture1', question: 'Fixture PYQ 1', subject: 'mathematics', class: 10, year: 2024, chapter: 'Real Numbers', marks: 1, type: 'MCQ', board: 'CBSE' },
        { id: 'CBSE_mathematics_c10_fixture2', question: 'Fixture PYQ 2', subject: 'mathematics', class: 10, year: 2023, chapter: 'Real Numbers', marks: 1, type: 'MCQ', board: 'CBSE' },
    ]),
}));

// ── Import SUT AFTER mocks ─────────────────────────────────────────────────

import {
    generateExamPaper,
    computePyqMixFloor,
    computeSectionMinNew,
    verifyNewQuestions,
    pyqMixInBand,
    type ExamPaperInput,
} from '@/ai/flows/exam-paper-generator';
import { StructuredLogger } from '@/lib/logger/structured-logger';

const promptSpy = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;
const mockGetPYQsByChapter = (jest.requireMock('@/lib/services/pyq-retrieval-service') as { getPYQsByChapter: jest.Mock }).getPYQsByChapter;

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

/** Schema-valid paper with `count` 1-mark questions, `pyqCount` of them tagged as PYQ. */
function paperFixture(count: number, pyqCount: number) {
    return {
        title: 'CBSE Class 10 Mathematics Sample Paper',
        board: 'CBSE',
        subject: 'Mathematics',
        gradeLevel: 'Class 10',
        duration: '3 Hours',
        maxMarks: count,
        generalInstructions: ['Attempt all questions.'],
        sections: [
            {
                name: 'Section A',
                label: 'Objective Questions',
                totalMarks: count,
                questions: Array.from({ length: count }, (_, i) => ({
                    number: i + 1,
                    text: `Question ${i + 1}`,
                    marks: 1,
                    correctOption: '',
                    source: i < pyqCount ? 'PYQ 2024' : 'New',
                })),
            },
        ],
    };
}

describe('computePyqMixFloor', () => {
    it('no target reproduces the original hardcoded floors, no ceiling', () => {
        expect(computePyqMixFloor(10)).toEqual({ minNew: 2, minPyq: 5, maxNew: 10, maxPyq: 10 });
        expect(computePyqMixFloor(1)).toEqual({ minNew: 1, minPyq: 1, maxNew: 1, maxPyq: 1 });
    });

    it('computes a symmetric ±5pp band around an explicit target', () => {
        expect(computePyqMixFloor(20, 50)).toEqual({ minPyq: 9, maxPyq: 11, minNew: 9, maxNew: 11 });
    });

    it('minPyq never exceeds maxPyq, across small N and extreme targets', () => {
        const totals = [1, 2, 3, 5, 10, 20];
        const targets = [0, 5, 50, 95, 100];
        for (const total of totals) {
            for (const target of targets) {
                const { minPyq, maxPyq } = computePyqMixFloor(total, target);
                expect(minPyq).toBeLessThanOrEqual(maxPyq);
            }
        }
    });

    it('target=100 forces all-PYQ; target=0 forces all-New', () => {
        expect(computePyqMixFloor(10, 100)).toEqual({ minPyq: 10, maxPyq: 10, minNew: 0, maxNew: 0 });
        expect(computePyqMixFloor(10, 0)).toEqual({ minPyq: 0, maxPyq: 1, minNew: 9, maxNew: 10 });
    });
});

describe('computeSectionMinNew', () => {
    it('a 1-question (or smaller) section is never split', () => {
        expect(computeSectionMinNew(1)).toBe(0);
        expect(computeSectionMinNew(1, 90)).toBe(0);
        expect(computeSectionMinNew(0, 50)).toBe(0);
    });

    it('no target keeps the original 30% floor', () => {
        expect(computeSectionMinNew(10)).toBe(3);
    });

    it('an explicit target overrides the 30% floor with (100-target)%', () => {
        expect(computeSectionMinNew(10, 50)).toBe(5);
        expect(computeSectionMinNew(10, 90)).toBe(1); // floor-of-1 even at a high PYQ target
    });
});

describe('exam-paper-generator: PYQ ratio band (reconcilePyqRatio)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (jest.requireMock('@/lib/feature-flags') as { isFeatureEnabled: jest.Mock }).isFeatureEnabled
            .mockImplementation(async (flag: string) => ({ enabled: flag === 'examPaperPyqRatioRepair' }));
    });

    it('no pyqRatio + heavily PYQ-weighted paper never triggers the new ceiling path (additive-only guard)', async () => {
        // 80% PYQ / 20% New — satisfies the pre-existing minNew=2 floor (so
        // that unrelated, unchanged check doesn't fire), and would only be
        // rejected by the NEW ceiling logic if one applied. No pyqRatio set
        // means maxPyq=total (unconstrained), so this must pass untouched.
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10, 8) });
        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(1); // no repair re-prompt fired
        expect(result.sections[0].questions.filter(q => /^pyq/i.test(q.source)).length).toBe(8);
    });

    it('undershoot with an explicit target repairs with the existing "BOTH minimums" wording', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture(10, 2) }) // 20% PYQ against a 50±5 target
            .mockResolvedValueOnce({ output: paperFixture(10, 5) }); // 50% — inside [45,55]

        const result = await generateExamPaper({ ...BASE_INPUT, pyqRatio: 50 });

        expect(promptSpy).toHaveBeenCalledTimes(2);
        const retryArgs = promptSpy.mock.calls[1][0] as { blueprintConstraint: string };
        expect(retryArgs.blueprintConstraint).toContain('BOTH minimums are met');
        expect(retryArgs.blueprintConstraint).not.toContain('FEWER PYQ-adapted');
        expect(result.sections[0].questions.filter(q => /^pyq/i.test(q.source)).length).toBe(5);
    });

    it('overshoot with an explicit target repairs with the NEW "FEWER PYQ" wording', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture(10, 10) }) // 100% PYQ against a 50±5 target
            .mockResolvedValueOnce({ output: paperFixture(10, 5) }); // 50% — inside [45,55]

        const result = await generateExamPaper({ ...BASE_INPUT, pyqRatio: 50 });

        expect(promptSpy).toHaveBeenCalledTimes(2);
        const retryArgs = promptSpy.mock.calls[1][0] as { blueprintConstraint: string };
        expect(retryArgs.blueprintConstraint).toContain('FEWER PYQ-adapted');
        expect(retryArgs.blueprintConstraint).toContain('MORE');
        expect(result.sections[0].questions.filter(q => /^pyq/i.test(q.source)).length).toBe(5);
    });

    it('a paper already inside the band is left untouched (no repair call)', async () => {
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10, 5) }); // exactly 50%, target 50±5

        const result = await generateExamPaper({ ...BASE_INPUT, pyqRatio: 50 });

        expect(promptSpy).toHaveBeenCalledTimes(1);
        expect(result.sections[0].questions.filter(q => /^pyq/i.test(q.source)).length).toBe(5);
        expect(StructuredLogger.warn).not.toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ operation: 'reconcilePyqRatio' }),
        );
    });

    // C6 residual gap: the DEFAULT (unset pyqRatio) below-floor repair branch —
    // computePyqMixFloor(total, undefined)'s hardcoded 50%/20% floors. Every
    // other flow-driven test either sets pyqRatio or is a non-breach case.
    it('unset pyqRatio + below the hardcoded PYQ floor triggers the default-branch repair', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture(10, 1) }) // 1 PYQ < minPyq(5) for total 10
            .mockResolvedValueOnce({ output: paperFixture(10, 5) }); // 5 PYQ ≥ minPyq(5), 5 New ≥ minNew(2)

        const result = await generateExamPaper(BASE_INPUT); // no pyqRatio

        expect(promptSpy).toHaveBeenCalledTimes(2);
        expect(result.sections[0].questions.filter(q => /^pyq/i.test(q.source)).length).toBe(5);
    });
});

// ── C7: "New" novelty verify (pure) ────────────────────────────────────────
describe('verifyNewQuestions (C7)', () => {
    it('relabels a number-swapped "New" question as the matched PYQ, leaves genuine ones', () => {
        const pyqs = [{ question: 'Find the value of x if 2x + 3 = 7', year: 2023 }];
        const questions = [
            { text: 'Find the value of x if 5x + 9 = 14', source: 'New' }, // same words, swapped numbers
            { text: 'Prove that the square root of two is irrational', source: 'New' }, // genuinely new
            { text: 'Already tagged', source: 'PYQ 2022' }, // not inspected
        ];

        const report = verifyNewQuestions(questions, pyqs);

        expect(report.checked).toBe(2); // the two "New" tags
        expect(report.relabeled).toBe(1);
        expect(questions[0].source).toBe('PYQ 2023'); // digit-stripped tokens match → relabeled
        expect(questions[1].source).toBe('New'); // no overlap → untouched
        expect(questions[2].source).toBe('PYQ 2022'); // PYQ tags skipped
    });

    it('falls back to a bare "PYQ" tag when the matched PYQ has no year', () => {
        const pyqs = [{ question: 'State Newtons second law of motion' }];
        const questions = [{ text: 'State Newtons second law of motion', source: 'New' }];

        const report = verifyNewQuestions(questions, pyqs);

        expect(report.relabeled).toBe(1);
        expect(questions[0].source).toBe('PYQ');
    });
});

// ── C1: a later repair pass must not silently undo an earlier one ───────────
describe('exam-paper-generator: marks repair cannot silently regress the mix (C1)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Both the ratio AND marks repair passes enabled — the C1 collision.
        (jest.requireMock('@/lib/feature-flags') as { isFeatureEnabled: jest.Mock }).isFeatureEnabled
            .mockImplementation(async (flag: string) => ({
                enabled: flag === 'examPaperPyqRatioRepair' || flag === 'examPaperMarksRepair',
            }));
    });

    it('keeps the mix-correct paper when the marks-repair regen would break the mix', async () => {
        promptSpy
            // Attempt 1: 20% PYQ against a 50±5 target → ratio pass fires.
            .mockResolvedValueOnce({ output: paperFixture(10, 2) })
            // Ratio repair: mix now in band (6/11 PYQ), but 11 marks ≠ maxMarks 10 → marks pass fires.
            .mockResolvedValueOnce({ output: paperFixture(11, 6) })
            // Marks repair: marks perfect (10) BUT mix broken (100% PYQ) — must be REJECTED.
            .mockResolvedValueOnce({ output: paperFixture(10, 10) });

        const result = await generateExamPaper({ ...BASE_INPUT, pyqRatio: 50 });

        expect(promptSpy).toHaveBeenCalledTimes(3);
        // The mix-correct attempt (11 questions, 6 PYQ) is kept, NOT the mix-breaking one.
        const questions = result.sections.flatMap(s => s.questions);
        expect(questions.length).toBe(11);
        expect(questions.filter(q => /^pyq/i.test(q.source)).length).toBe(6);
        expect(pyqMixInBand(questions, 50)).toBe(true);
        // Residual marks drift is reported honestly rather than silently "fixed".
        expect(result.marksReconciliation).toMatchObject({ expected: 10, actual: 11, repaired: false });
        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('rejected'),
            expect.objectContaining({ operation: 'reconcileMarks' }),
        );
    });
});

// ── allocateBudget: largest-remainder loop (generator.ts:447-451) ──────────
// Every other test in this file uses a single chapter, so allocateBudget's
// remainder-distribution loop body never executes. 4 equal-weight chapters
// (no blueprint chapterWeightage match required) forces 450/4 = 112.5, which
// can only be split by handing out the 2 leftover slots to the largest
// fractional remainders.
describe('exam-paper-generator: allocateBudget remainder distribution', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (jest.requireMock('@/lib/feature-flags') as { isFeatureEnabled: jest.Mock }).isFeatureEnabled
            .mockImplementation(async (flag: string) => ({ enabled: flag === 'examPaperPyqRatioRepair' }));
        mockGetPYQsByChapter.mockResolvedValue([]);
    });

    it('splits PYQ_TOTAL across 4 chapters via the largest-remainder loop (not all equal)', async () => {
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10, 5) });

        await generateExamPaper({ ...BASE_INPUT, chapters: ['Real Numbers', 'Polynomials', 'Circles', 'Statistics'] });

        const budgets = mockGetPYQsByChapter.mock.calls.map((c: unknown[]) => c[3] as number);
        expect(budgets).toHaveLength(4);
        expect(budgets.reduce((a, b) => a + b, 0)).toBe(450); // PYQ_TOTAL, no drift
        expect(new Set(budgets).size).toBeGreaterThan(1); // proves the remainder loop ran (450/4 doesn't divide evenly)
    });
});

// ── examPaperNewVerification (C7 integration, generator.ts:664-698) ─────────
// This file's default feature-flag mock only enables examPaperPyqRatioRepair;
// these tests locally override it to also enable examPaperNewVerification.
describe('exam-paper-generator: examPaperNewVerification (C7 integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (jest.requireMock('@/lib/feature-flags') as { isFeatureEnabled: jest.Mock }).isFeatureEnabled
            .mockImplementation(async (flag: string) => ({
                enabled: flag === 'examPaperPyqRatioRepair' || flag === 'examPaperNewVerification',
            }));
    });

    it('relabels a "New" question that exactly duplicates a retrieved PYQ when the flag is enabled', async () => {
        mockGetPYQsByChapter.mockResolvedValue([
            { id: 'CBSE_mathematics_c10_dup1', question: 'What is 2 plus 2', subject: 'mathematics', class: 10, year: 2023, chapter: 'Real Numbers', marks: 1, type: 'MCQ', board: 'CBSE' },
        ]);
        const paper = paperFixture(10, 5); // indices 5-9 are "New"
        paper.sections[0].questions[9].text = 'What is 2 plus 2'; // identical words → Jaccard 1.0, guaranteed match
        promptSpy.mockResolvedValueOnce({ output: paper });

        const result = await generateExamPaper(BASE_INPUT);

        expect(result.newVerification).toBeDefined();
        expect(result.newVerification?.relabeled).toBeGreaterThanOrEqual(1);
        expect(result.sections[0].questions[9].source.startsWith('New')).toBe(false);
    });

    it('a malformed PYQ (missing question text) is caught and logged without rejecting the flow', async () => {
        mockGetPYQsByChapter.mockResolvedValue([
            { id: 'CBSE_mathematics_c10_malformed', question: undefined as unknown as string, subject: 'mathematics', class: 10, year: 2023, chapter: 'Real Numbers', marks: 1, type: 'MCQ', board: 'CBSE' },
        ]);
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10, 5) });

        await expect(generateExamPaper(BASE_INPUT)).resolves.toBeDefined();

        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ operation: 'verifyNewQuestions' }),
        );
    });
});

// ── PYQ ratio repair retry failure paths (generator.ts:786-812) ────────────
// The existing "undershoot"/"overshoot" tests only cover a retry that FIXES
// the mix. These cover the retry itself failing — still out of band, or the
// re-prompt call rejecting outright — both of which must fall back to the
// first attempt rather than throwing.
describe('exam-paper-generator: PYQ ratio repair retry failure paths', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (jest.requireMock('@/lib/feature-flags') as { isFeatureEnabled: jest.Mock }).isFeatureEnabled
            .mockImplementation(async (flag: string) => ({ enabled: flag === 'examPaperPyqRatioRepair' }));
        mockGetPYQsByChapter.mockResolvedValue([
            { id: 'CBSE_mathematics_c10_fixture1', question: 'Fixture PYQ 1', subject: 'mathematics', class: 10, year: 2024, chapter: 'Real Numbers', marks: 1, type: 'MCQ', board: 'CBSE' },
            { id: 'CBSE_mathematics_c10_fixture2', question: 'Fixture PYQ 2', subject: 'mathematics', class: 10, year: 2023, chapter: 'Real Numbers', marks: 1, type: 'MCQ', board: 'CBSE' },
        ]);
    });

    it('a repair retry that is STILL out of band logs the persistent-drift warning and keeps the first attempt', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture(10, 2) }) // first attempt: 20%, out of band for target 50
            .mockResolvedValueOnce({ output: paperFixture(10, 2) }); // retry: still 20%, still out of band

        const result = await generateExamPaper({ ...BASE_INPUT, pyqRatio: 50 });

        expect(promptSpy).toHaveBeenCalledTimes(2);
        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('PYQ/new ratio drift persists'),
            expect.objectContaining({ operation: 'reconcilePyqRatio' }),
        );
        // First attempt (2 PYQ) is kept, NOT the (also out-of-band) retry.
        expect(result.sections[0].questions.filter(q => /^pyq/i.test(q.source)).length).toBe(2);
    });

    it('a repair retry that rejects keeps the first attempt and logs the retry-failed warning', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture(10, 2) })
            .mockRejectedValueOnce(new Error('model unavailable'));

        const result = await generateExamPaper({ ...BASE_INPUT, pyqRatio: 50 });

        expect(promptSpy).toHaveBeenCalledTimes(2);
        expect(result.sections[0].questions.filter(q => /^pyq/i.test(q.source)).length).toBe(2);
        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            'PYQ ratio repair retry failed — keeping first attempt',
            expect.objectContaining({ operation: 'reconcilePyqRatio' }),
        );
    });

    it('reconcilePyqRatio outer catch: a throw before the repair attempt is swallowed (non-blocking)', async () => {
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10, 2) }); // out of band for target 50
        // The very first StructuredLogger.warn call inside reconcilePyqRatio is the
        // "out of required band" notice (before the inner repair try) — throwing
        // there exercises the function's OWN outer catch, not the inner one.
        (StructuredLogger.warn as jest.Mock).mockImplementationOnce(() => {
            throw new Error('logger down');
        });

        const result = await generateExamPaper({ ...BASE_INPUT, pyqRatio: 50 });

        expect(result.sections[0].questions).toHaveLength(10);
        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            'PYQ ratio reconcile threw (non-blocking)',
            expect.objectContaining({ operation: 'reconcilePyqRatio' }),
        );
    });
});

// ── buildPYQContext: answer field (generator.ts:1322-1324) ──────────────────
describe('exam-paper-generator: buildPYQContext answer field', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (jest.requireMock('@/lib/feature-flags') as { isFeatureEnabled: jest.Mock }).isFeatureEnabled
            .mockImplementation(async (flag: string) => ({ enabled: flag === 'examPaperPyqRatioRepair' }));
    });

    it('includes a PYQ\'s answer field in the prompt context with an "A: " prefix', async () => {
        mockGetPYQsByChapter.mockResolvedValue([
            { id: 'CBSE_mathematics_c10_ans1', question: 'Solve for x: x - 2 = 0', subject: 'mathematics', class: 10, year: 2022, chapter: 'Real Numbers', marks: 1, type: 'MCQ', board: 'CBSE', answer: 'x = 2' },
        ]);
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10, 5) });

        await generateExamPaper(BASE_INPUT);

        const callArgs = promptSpy.mock.calls[0][0] as { pyqContext: string };
        expect(callArgs.pyqContext).toContain('A: x = 2');
    });
});
