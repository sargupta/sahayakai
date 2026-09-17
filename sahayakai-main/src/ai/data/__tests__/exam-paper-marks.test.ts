/**
 * Parity tests for the shared marks-summing helpers (Phase 1, 2026-07-09).
 *
 * `computeTotalMarks` was extracted from the offline evaluator's inline
 * reduce (src/ai/evaluators/exam-paper-fidelity.ts, formerly lines 74-77):
 *
 *     sections.reduce((sum, section) => {
 *       const questions = section.questions ?? [];
 *       return sum + questions.reduce((qSum, q) => qSum + (q.marks ?? 0), 0);
 *     }, 0);
 *
 * These fixtures pin that exact semantics (`questions ?? []`, `marks ?? 0`)
 * so the flow's runtime enforcement and the evaluator's measurement cannot
 * drift apart. If you change the helper, re-check the evaluator's contract.
 */

import { computeTotalMarks, computeSectionMarks } from '../exam-paper-marks';

/** The evaluator's original inline reduce, verbatim — the parity oracle. */
function evaluatorInlineSum(
    sections: Array<{ questions?: Array<{ marks?: number }> }>,
): number {
    return sections.reduce((sum, section) => {
        const questions = section.questions ?? [];
        return sum + questions.reduce((qSum, q) => qSum + (q.marks ?? 0), 0);
    }, 0);
}

describe('exam-paper-marks helpers', () => {
    const CASES: Array<{
        name: string;
        sections: Array<{ questions?: Array<{ marks?: number }> }>;
        expected: number;
    }> = [
        {
            name: 'normal paper: multiple sections, all marks present',
            sections: [
                { questions: [{ marks: 1 }, { marks: 1 }, { marks: 2 }] },
                { questions: [{ marks: 3 }, { marks: 5 }] },
            ],
            expected: 12,
        },
        {
            name: 'question with missing marks counts as 0',
            sections: [{ questions: [{ marks: 4 }, {}, { marks: undefined }] }],
            expected: 4,
        },
        {
            name: 'section with missing questions array counts as 0',
            sections: [{}, { questions: [{ marks: 7 }] }],
            expected: 7,
        },
        {
            name: 'empty sections array sums to 0',
            sections: [],
            expected: 0,
        },
        {
            name: 'section with empty questions array sums to 0',
            sections: [{ questions: [] }],
            expected: 0,
        },
    ];

    it.each(CASES)('computeTotalMarks: $name', ({ sections, expected }) => {
        expect(computeTotalMarks(sections)).toBe(expected);
    });

    it.each(CASES)('matches the evaluator inline-reduce semantics: $name', ({ sections }) => {
        expect(computeTotalMarks(sections)).toBe(evaluatorInlineSum(sections));
    });

    it('computeSectionMarks sums one section with the same semantics', () => {
        expect(computeSectionMarks({ questions: [{ marks: 2 }, {}, { marks: 3 }] })).toBe(5);
        expect(computeSectionMarks({})).toBe(0);
    });
});
