/**
 * @fileOverview Contract tests for the `sahayak/examPaperFidelity` evaluator.
 *
 * The evaluator is registered via `ai.defineEvaluator(config, fn)` as a side
 * effect of importing the module — no function is exported directly, so the
 * test captures `fn` through a mocked `ai.defineEvaluator` (same seam pattern
 * the flow tests use for `ai.defineFlow`/`ai.definePrompt`).
 *
 * Covers the two invariants CLAUDE.md calls out for reuse: `marksTotal` must
 * route through the shared `computeTotalMarks` helper and score binary-exact
 * (no tolerance band — removed 2026-07-16 because it masked real drift).
 */

// ── Mocks (must come before importing the SUT) ─────────────────────────────

jest.mock('@/ai/genkit', () => {
    const evaluatorSpy = jest.fn();
    return {
        __evaluatorSpy: evaluatorSpy,
        ai: {
            defineEvaluator: (_config: unknown, fn: (dp: unknown) => unknown) => {
                evaluatorSpy.mockImplementation(fn);
                return evaluatorSpy;
            },
        },
    };
});

// ── Import SUT AFTER mocks ─────────────────────────────────────────────────

import '@/ai/evaluators/exam-paper-fidelity';

const evaluatorSpy = (jest.requireMock('@/ai/genkit') as { __evaluatorSpy: jest.Mock }).__evaluatorSpy;

type EvalEntry = { id: string; score?: number; details?: { reasoning: string } };
type EvalResult = { evaluation: EvalEntry[] | { score: number; details?: { reasoning: string } } };

/** Single-section output whose questions carry the given (marks, text) pairs. */
function outputFixture(questions: Array<{ marks: number; text: string }>) {
    return { sections: [{ name: 'Section A', questions }] };
}

function findScore(result: EvalResult, id: string): number | undefined {
    if (!Array.isArray(result.evaluation)) throw new Error('expected array evaluation shape');
    return result.evaluation.find((e) => e.id === id)?.score;
}

describe('exam-paper-fidelity evaluator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('marksTotal sub-score', () => {
        it('scores 1 on an exact match against the expected total', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't1',
                input: { maxMarks: 10 },
                output: outputFixture([{ marks: 5, text: 'Q1' }, { marks: 5, text: 'Q2' }]),
                reference: {},
            })) as EvalResult;

            expect(findScore(result, 'marksTotal')).toBe(1);
        });

        it('scores 0 on any drift — binary, no ±tolerance band', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't2',
                input: { maxMarks: 10 },
                output: outputFixture([{ marks: 5, text: 'Q1' }, { marks: 4, text: 'Q2' }]),
                reference: {},
            })) as EvalResult;

            // 9 vs 10 is a 10% drift — the removed tolerance band would have scored
            // this 0.5; the binary-exact contract must score it 0.
            expect(findScore(result, 'marksTotal')).toBe(0);
        });

        it('omits the sub-score entirely when no expected total is measurable', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't3',
                input: {},
                output: outputFixture([{ marks: 5, text: 'Q1' }]),
                reference: {},
            })) as EvalResult;

            expect(findScore(result, 'marksTotal')).toBeUndefined();
        });

        it('prefers reference.expectedTotalMarks over input.maxMarks when both are present', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't4',
                input: { maxMarks: 10 },
                output: outputFixture([{ marks: 8, text: 'Q1' }]),
                reference: { expectedTotalMarks: 8 },
            })) as EvalResult;

            expect(findScore(result, 'marksTotal')).toBe(1);
        });
    });

    describe('blueprintAdherence sub-score', () => {
        it('scores 1 when every section hits its expected question count', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't5',
                input: {},
                output: outputFixture([{ marks: 1, text: 'Q1' }, { marks: 1, text: 'Q2' }, { marks: 1, text: 'Q3' }]),
                reference: { expectedQuestionCounts: [3] },
            })) as EvalResult;

            expect(findScore(result, 'blueprintAdherence')).toBe(1);
        });

        it('scores less than 1 when a section misses its expected question count', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't6',
                input: {},
                output: outputFixture([{ marks: 1, text: 'Q1' }]),
                reference: { expectedQuestionCounts: [5] },
            })) as EvalResult;

            expect(findScore(result, 'blueprintAdherence')).toBe(0);
        });

        it('falls back to the section-count-only comparison when expectedQuestionCounts is absent', async () => {
            // Output has 1 section; reference gives only expectedSectionCount: 2, no
            // expectedQuestionCounts — must hit the `Math.min(actualCount, expectedCount) /
            // expectedCount` branch, not the per-section matching branch.
            const result = (await evaluatorSpy({
                testCaseId: 't6b',
                input: {},
                output: { sections: [{ name: 'Section A', questions: [{ marks: 1, text: 'Q1' }] }] },
                reference: { expectedSectionCount: 2 },
            })) as EvalResult;

            expect(findScore(result, 'blueprintAdherence')).toBe(0.5);
        });
    });

    describe('chapterCoverage sub-score', () => {
        it('scores 1 when every requested chapter is mentioned in a question', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't7',
                input: { chapters: ['Real Numbers', 'Polynomials'] },
                output: outputFixture([
                    { marks: 1, text: 'Prove a property of Real Numbers.' },
                    { marks: 1, text: 'Factor this Polynomials expression.' },
                ]),
                reference: {},
            })) as EvalResult;

            expect(findScore(result, 'chapterCoverage')).toBe(1);
        });

        it('scores a fraction when a requested chapter is never mentioned', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't8',
                input: { chapters: ['Real Numbers', 'Trigonometry'] },
                output: outputFixture([{ marks: 1, text: 'Prove a property of Real Numbers.' }]),
                reference: {},
            })) as EvalResult;

            expect(findScore(result, 'chapterCoverage')).toBe(0.5);
        });

        it('word-boundary matches so a short chapter name does not false-match inside a longer word', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't9',
                input: { chapters: ['Light'] },
                output: outputFixture([{ marks: 1, text: 'Explain why this room needs to delight everyone.' }]),
                reference: {},
            })) as EvalResult;

            expect(findScore(result, 'chapterCoverage')).toBe(0);
        });

        it('scores via the blueprintSummary/resolveChapterId primary signal, not the text-fallback regex', async () => {
            // gradeLevel + subject enable resolveChapterId; blueprintSummary.chapterWise
            // covers "Real Numbers" with marks > 0. The question text never mentions the
            // chapter, so a score of 1 can only come from the summary/id path — proving
            // the text-fallback regex (which would score 0 here) did not drive the result.
            const result = (await evaluatorSpy({
                testCaseId: 't9b',
                input: { chapters: ['Real Numbers'], gradeLevel: 'Class 10', subject: 'Mathematics' },
                output: {
                    sections: [{ name: 'Section A', questions: [{ marks: 1, text: 'Solve this abstract puzzle.' }] }],
                    blueprintSummary: { chapterWise: [{ chapter: 'Real Numbers', marks: 5 }] },
                },
                reference: {},
            })) as EvalResult;

            expect(findScore(result, 'chapterCoverage')).toBe(1);
        });
    });

    describe('missing/malformed output', () => {
        it('returns a single score of 0 with reasoning when output has no sections array', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't10',
                input: {},
                output: {},
                reference: {},
            })) as EvalResult;

            expect(Array.isArray(result.evaluation)).toBe(false);
            expect((result.evaluation as { score: number }).score).toBe(0);
        });
    });

    describe('additional branch coverage', () => {
        it('tolerates a datapoint with no reference field at all', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't13',
                input: { maxMarks: 5 },
                output: outputFixture([{ marks: 5, text: 'Q1' }]),
                // reference omitted entirely — exercises the `?? {}` fallback.
            })) as EvalResult;

            expect(findScore(result, 'marksTotal')).toBe(1);
        });

        it('treats a section with no questions array as zero questions (blueprintAdherence)', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't14',
                input: {},
                output: { sections: [{ name: 'Section A' }] },
                reference: { expectedQuestionCounts: [0] },
            })) as EvalResult;

            expect(findScore(result, 'blueprintAdherence')).toBe(1);
        });

        it('blueprintAdherence is 1 when expectedQuestionCounts is empty (expectedCount=0 branch)', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't15',
                input: {},
                output: outputFixture([{ marks: 1, text: 'Q1' }]),
                reference: { expectedQuestionCounts: [] },
            })) as EvalResult;

            expect(findScore(result, 'blueprintAdherence')).toBe(1);
        });

        it('blueprintAdherence is 1 when expectedSectionCount is 0 (section-count-only expectedCount=0 branch)', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't16',
                input: {},
                output: outputFixture([{ marks: 1, text: 'Q1' }]),
                reference: { expectedSectionCount: 0 },
            })) as EvalResult;

            expect(findScore(result, 'blueprintAdherence')).toBe(1);
        });

        it('marksTotal is unmeasurable when the expected total is 0', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't17',
                input: { maxMarks: 0 },
                output: outputFixture([{ marks: 0, text: 'Q1' }]),
                reference: {},
            })) as EvalResult;

            expect(findScore(result, 'marksTotal')).toBeUndefined();
        });

        it('chapterCoverage ignores a blueprintSummary entry with zero marks or a missing chapter name', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't18',
                input: { chapters: ['Real Numbers'], gradeLevel: 'Class 10', subject: 'Mathematics' },
                output: {
                    sections: [{ name: 'Section A', questions: [{ marks: 1, text: 'no mention here' }] }],
                    blueprintSummary: { chapterWise: [{ chapter: 'Real Numbers', marks: 0 }, { marks: 5 }] },
                },
                reference: {},
            })) as EvalResult;

            // Neither entry counts (zero marks; no chapter name), so coverage falls
            // through to the text-fallback regex, which also doesn't match.
            expect(findScore(result, 'chapterCoverage')).toBe(0);
        });

        it('chapterCoverage tolerates a section with no questions array at all', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't19',
                input: { chapters: ['Real Numbers'] },
                output: { sections: [{ name: 'Section A' }] },
                reference: {},
            })) as EvalResult;

            expect(findScore(result, 'chapterCoverage')).toBe(0);
        });

        it('chapterCoverage ignores a blueprintSummary entry with marks entirely absent (not just zero)', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't20',
                input: { chapters: ['Real Numbers'], gradeLevel: 'Class 10', subject: 'Mathematics' },
                output: {
                    sections: [{ name: 'Section A', questions: [{ marks: 1, text: 'no mention here' }] }],
                    blueprintSummary: { chapterWise: [{ chapter: 'Real Numbers' }] },
                },
                reference: {},
            })) as EvalResult;

            expect(findScore(result, 'chapterCoverage')).toBe(0);
        });
    });

    describe('composite score', () => {
        it('is the weighted average over only the measurable sub-scores', async () => {
            // Only marksTotal is measurable here (no blueprint/chapter reference) —
            // composite must equal marksTotal exactly, not be diluted by absent parts.
            const result = (await evaluatorSpy({
                testCaseId: 't11',
                input: { maxMarks: 10 },
                output: outputFixture([{ marks: 10, text: 'Q1' }]),
                reference: {},
            })) as EvalResult;

            expect(findScore(result, 'composite')).toBe(1);
        });

        it('is null when nothing is measurable', async () => {
            const result = (await evaluatorSpy({
                testCaseId: 't12',
                input: {},
                output: outputFixture([{ marks: 1, text: 'Q1' }]),
                reference: {},
            })) as EvalResult;

            expect(findScore(result, 'composite')).toBeUndefined();
        });
    });
});
