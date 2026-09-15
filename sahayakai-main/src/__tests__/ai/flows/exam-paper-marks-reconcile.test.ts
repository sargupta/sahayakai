/**
 * @jest-environment node
 *
 * Phase 1 (2026-07-09) marks-reconcile contract for `generateExamPaper`:
 * sum(question.marks across all sections) must equal the effective maxMarks
 * (input → blueprint → model output). On drift the flow attempts ONE bounded
 * repair re-prompt; if drift survives it attaches a structured
 * `marksReconciliation` warning instead of silently returning a wrong total —
 * and it NEVER hard-fails the paper.
 *
 * In-process contract tests; no Gemini calls. Uses the real
 * `board-blueprints` data (CBSE Class 10 Mathematics → maxMarks 80) so the
 * blueprint-fallback resolution path is exercised for real.
 */

// ── Mocks (must come before importing the SUT) ─────────────────────────────
// Jest hoists `jest.mock(...)` above all imports and `const` declarations, so
// the genkit factory creates its own spies; we read them back via
// `jest.requireMock` after the SUT loads (same pattern as
// lesson-plan-language-leak.test.ts).

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

// Repair flag ON, NCERT validation OFF (not under test here).
jest.mock('@/lib/feature-flags', () => ({
    isFeatureEnabled: jest.fn(async (flag: string) => ({
        enabled: flag === 'examPaperMarksRepair',
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

// PYQ retrieval reads Firestore via getPYQsByChapter; stub it to return no
// questions so the prompt's pyqContext stays empty.
jest.mock('@/lib/services/pyq-retrieval-service', () => ({
    getPYQsByChapter: jest.fn().mockResolvedValue([]),
}));

// ── Import SUT AFTER mocks ─────────────────────────────────────────────────

import { generateExamPaper, shouldAttemptMarksRepair, type ExamPaperInput } from '@/ai/flows/exam-paper-generator';
import { computeTotalMarks } from '@/ai/data/exam-paper-marks';
import { StructuredLogger } from '@/lib/logger/structured-logger';

const promptSpy = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;

// No maxMarks → effective total resolves via the real CBSE Class 10
// Mathematics blueprint (80). No userId → profile lookup and persistence are
// skipped entirely.
const BASE_INPUT: ExamPaperInput = {
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Mathematics',
    chapters: ['Real Numbers'],
    language: 'English',
    difficulty: 'mixed',
    includeAnswerKey: true,
    includeMarkingScheme: true,
};

/** Schema-valid paper whose question marks sum to exactly `totalMarks`. */
function paperFixture(totalMarks: number) {
    return {
        title: 'CBSE Class 10 Mathematics Sample Paper',
        board: 'CBSE',
        subject: 'Mathematics',
        gradeLevel: 'Class 10',
        duration: '3 Hours',
        maxMarks: totalMarks,
        generalInstructions: ['Attempt all questions.'],
        sections: [
            {
                name: 'Section A',
                label: 'Objective Questions',
                totalMarks,
                questions: Array.from({ length: totalMarks }, (_, i) => ({
                    number: i + 1,
                    text: `Question ${i + 1}`,
                    marks: 1,
                    correctOption: '', // subjective question, no options
                    source: 'AI Generated',
                })),
            },
        ],
    };
}

describe('exam-paper-generator: marks reconcile (Phase 1 no-drift guard)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('leaves a clean paper untouched: one model call, no marksReconciliation', async () => {
        promptSpy.mockResolvedValueOnce({ output: paperFixture(80) });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(1);
        expect(result.marksReconciliation).toBeUndefined();
        expect(computeTotalMarks(result.sections)).toBe(80);
        expect(result.maxMarks).toBe(80);
    });

    it('repairs drift via one re-prompt that calls out the wrong total', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture(76) })
            .mockResolvedValueOnce({ output: paperFixture(80) });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(2);
        const retryArgs = promptSpy.mock.calls[1][0] as { blueprintConstraint: string };
        expect(retryArgs.blueprintConstraint).toContain('CRITICAL CORRECTION');
        expect(retryArgs.blueprintConstraint).toContain('totaled 76 marks');
        expect(retryArgs.blueprintConstraint).toContain('exactly 80');

        expect(computeTotalMarks(result.sections)).toBe(80);
        expect(result.marksReconciliation).toEqual({
            expected: 80,
            actual: 80,
            repaired: true,
            attempts: 2,
        });
    });

    it('keeps the better attempt and attaches a warning when drift persists (guard fires)', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture(76) })
            .mockResolvedValueOnce({ output: paperFixture(78) });

        const result = await generateExamPaper(BASE_INPUT);

        // 78 is closer to 80 than 76 — the retry wins even though it drifts.
        expect(computeTotalMarks(result.sections)).toBe(78);
        expect(result.marksReconciliation).toEqual({
            expected: 80,
            actual: 78,
            repaired: false,
            attempts: 2,
        });
        // Header shows the authoritative blueprint total, not the drifted sum;
        // section totals reflect their real question sums.
        expect(result.maxMarks).toBe(80);
        expect(result.sections[0].totalMarks).toBe(78);

        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ operation: 'reconcileMarks' }),
        );
    });

    it('falls back to attempt 1 (no exception) when the repair retry blows up', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture(76) })
            .mockRejectedValueOnce(new Error('model unavailable'));

        const result = await generateExamPaper(BASE_INPUT);

        expect(computeTotalMarks(result.sections)).toBe(76);
        expect(result.marksReconciliation).toEqual({
            expected: 80,
            actual: 76,
            repaired: false,
            attempts: 2,
        });
    });

    it('strips a model-fabricated marksReconciliation from a clean paper', async () => {
        const fabricated = {
            ...paperFixture(80),
            marksReconciliation: { expected: 999, actual: 1, repaired: true, attempts: 9 },
        };
        promptSpy.mockResolvedValueOnce({ output: fabricated });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(1);
        expect(result.marksReconciliation).toBeUndefined();
    });

    it('always attempts the repair — the (40s,75s] dead-zone was collapsed (Phase 1)', () => {
        // Phase 1 (2026-07-13): MARKS_REPAIR_BUDGET_MS was raised to the
        // dispatcher budget, so shouldAttemptMarksRepair is now always-true.
        // Capping thinkingBudget lands most papers at ~45-55s — the OLD dead-zone
        // — where a drifting paper used to silently hit the placeholder floor.
        // Post-Phase-0 a repair that pushes past 75s is an honest "generating"
        // 202, not a broken error, so we repair regardless of elapsed time.
        expect(shouldAttemptMarksRepair(10_000)).toBe(true);
        expect(shouldAttemptMarksRepair(40_000)).toBe(true);
        // Formerly the dead zone — now repairs.
        expect(shouldAttemptMarksRepair(41_000)).toBe(true);
        expect(shouldAttemptMarksRepair(50_000)).toBe(true);
        expect(shouldAttemptMarksRepair(75_000)).toBe(true);
        // Already-late regime still repairs.
        expect(shouldAttemptMarksRepair(76_000)).toBe(true);
        expect(shouldAttemptMarksRepair(170_000)).toBe(true);
    });

    it('respects an explicit input maxMarks over the blueprint total', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture(80) })
            .mockResolvedValueOnce({ output: paperFixture(40) });

        const result = await generateExamPaper({ ...BASE_INPUT, maxMarks: 40 });

        // 80 drifts against the requested 40 → repair fires and wins.
        expect(promptSpy).toHaveBeenCalledTimes(2);
        expect(computeTotalMarks(result.sections)).toBe(40);
        expect(result.marksReconciliation).toEqual({
            expected: 40,
            actual: 40,
            repaired: true,
            attempts: 2,
        });
    });

    // H10 (forensic EPG-2026-07-17): ICSE has no bundled blueprint (only 4
    // CBSE combos ship one — see board-blueprints.ts), so with no requested
    // maxMarks, effectiveMaxMarks falls back to the model's own self-reported
    // total — an unverified, circular check.
    const NO_BLUEPRINT_INPUT: ExamPaperInput = {
        board: 'ICSE',
        gradeLevel: 'Class 9',
        subject: 'Science',
        chapters: ['Matter'],
        language: 'English',
        difficulty: 'mixed',
        includeAnswerKey: true,
        includeMarkingScheme: true,
    };

    it('warns the marks total is not independently verified when no blueprint or requested maxMarks exists', async () => {
        promptSpy.mockResolvedValueOnce({ output: paperFixture(50) });

        const result = await generateExamPaper(NO_BLUEPRINT_INPUT);

        // Self-consistent (header == section sum), so no drift is detected —
        // the point of this test is the H10 warning, not a repair.
        expect(computeTotalMarks(result.sections)).toBe(50);
        expect(result.marksReconciliation).toBeUndefined();
        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            'Marks total not independently verified — no blueprint or requested maxMarks',
            expect.objectContaining({ operation: 'reconcileMarks' }),
        );
    });

    it('skips reconcile entirely when no effective maxMarks is resolvable', async () => {
        const zeroMaxMarksFixture = {
            title: 'ICSE Class 9 Science Sample Paper',
            board: 'ICSE',
            subject: 'Science',
            gradeLevel: 'Class 9',
            duration: '3 Hours',
            maxMarks: 0,
            generalInstructions: ['Attempt all questions.'],
            sections: [
                {
                    name: 'Section A',
                    label: 'Objective Questions',
                    totalMarks: 5,
                    questions: [
                        { number: 1, text: 'Question 1', marks: 5, correctOption: '', source: 'AI Generated' },
                    ],
                },
            ],
        };
        promptSpy.mockResolvedValueOnce({ output: zeroMaxMarksFixture });

        const result = await generateExamPaper(NO_BLUEPRINT_INPUT);

        expect(result.marksReconciliation).toBeUndefined();
        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            'No effective maxMarks resolvable — skipping marks reconcile',
            expect.objectContaining({ operation: 'reconcileMarks' }),
        );
    });

    it('resolves without throwing when reconcileMarks itself throws (outer catch)', async () => {
        jest.resetModules();
        jest.doMock('@/ai/data/exam-paper-marks', () => ({
            computeTotalMarks: () => { throw new Error('boom'); },
            computeSectionMarks: jest.fn(() => 0),
        }));

        const { generateExamPaper: generateExamPaperIsolated } = require('@/ai/flows/exam-paper-generator');
        const promptSpyIsolated = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;
        const StructuredLoggerIsolated = (jest.requireMock('@/lib/logger/structured-logger') as {
            StructuredLogger: { warn: jest.Mock };
        }).StructuredLogger;
        promptSpyIsolated.mockResolvedValueOnce({ output: paperFixture(80) });

        await expect(generateExamPaperIsolated(BASE_INPUT)).resolves.toBeDefined();

        expect(StructuredLoggerIsolated.warn).toHaveBeenCalledWith(
            'Marks reconcile threw (non-blocking)',
            expect.objectContaining({ operation: 'reconcileMarks' }),
        );

        jest.dontMock('@/ai/data/exam-paper-marks');
        jest.resetModules();
    });
});
