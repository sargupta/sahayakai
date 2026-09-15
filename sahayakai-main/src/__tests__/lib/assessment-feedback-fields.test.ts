/**
 * Unit tests for the student-feedback quality work (Phases 2–4):
 *   - `effectiveQuestion` surfaces the feedback fields (improvementPoints,
 *     whyCorrect) and lets a teacher override `improvementPoints`.
 *   - Backward-compat: a question saved BEFORE these fields existed still reads
 *     cleanly (improvementPoints defaults to [], strings default to '').
 *   - `formatParentSummary` leads with the teacher's parent note.
 *   - `formatStudentHandout` includes the improvement bullets.
 *
 * These are pure functions, so no Genkit / model mocking is needed.
 */

import {
    effectiveQuestion,
    recomputeTotals,
} from '@/ai/schemas/assessment-scanner-utils';
import {
    formatParentSummary,
    formatStudentHandout,
} from '@/lib/assessment-formatters';
import type {
    AssessmentScannerOutput,
    GradedQuestion,
} from '@/ai/schemas/assessment-scanner-schemas';

function makeQuestion(overrides: Partial<GradedQuestion> = {}): GradedQuestion {
    return {
        questionId: 'p0-q1',
        pageIndex: 0,
        questionText: 'Define photosynthesis.',
        studentAnswer: 'Plants make food.',
        expectedAnswer: 'Photosynthesis is how green plants make food using sunlight.',
        marksAwarded: 1,
        marksMax: 3,
        partialCreditBreakdown: [],
        feedback: 'Partly correct.',
        improvementPoints: ['Add the role of sunlight', 'Use the word chlorophyll'],
        whyCorrect: 'Sunlight is the energy source, so it must be named.',
        conceptTested: 'Photosynthesis',
        ncertChapterId: null,
        mistakePattern: 'incomplete',
        needsTeacherReview: false,
        confidence: 0.9,
        ...overrides,
    };
}

function makeResult(
    questions: GradedQuestion[],
    overrides: Partial<AssessmentScannerOutput> = {},
): AssessmentScannerOutput {
    const totalMaxMarks = questions.reduce((s, q) => s + q.marksMax, 0);
    const totalAwardedMarks = questions.reduce((s, q) => s + q.marksAwarded, 0);
    return {
        assessmentId: 'a1',
        status: 'graded',
        pageCount: 1,
        totalAwardedMarks,
        totalMaxMarks,
        scorePct: totalMaxMarks > 0 ? (totalAwardedMarks / totalMaxMarks) * 100 : 0,
        letterGrade: 'C',
        questions,
        classAverageAtScan: null,
        conceptMastery: [],
        recommendedNextSteps: [],
        studentRecommendations: [],
        teacherParentNote: [],
        needsReviewCount: 0,
        imageQualityWarnings: [],
        skippedPageNotices: [],
        ...overrides,
    };
}

describe('effectiveQuestion — new feedback fields', () => {
    it('surfaces improvementPoints and whyCorrect', () => {
        const eff = effectiveQuestion(makeQuestion());
        expect(eff.improvementPoints).toEqual([
            'Add the role of sunlight',
            'Use the word chlorophyll',
        ]);
        expect(eff.whyCorrect).toContain('energy source');
    });

    it('prefers a teacher override for improvementPoints', () => {
        const q = makeQuestion({
            teacherOverrides: { improvementPoints: ['Just add sunlight'] },
        });
        expect(effectiveQuestion(q).improvementPoints).toEqual(['Just add sunlight']);
    });

    it('is backward-compatible with results graded before these fields existed', () => {
        // Simulate an old saved record: strip the new fields entirely.
        const legacy = makeQuestion();
        delete (legacy as Partial<GradedQuestion>).whyCorrect;
        delete (legacy as { improvementPoints?: string[] }).improvementPoints;

        const eff = effectiveQuestion(legacy);
        expect(eff.improvementPoints).toEqual([]);
        expect(eff.whyCorrect).toBe('');
    });
});

describe('editable denominator (teacher marksMax override)', () => {
    it('effectiveQuestion returns the overridden marksMax', () => {
        const q = makeQuestion({
            marksMax: 5,
            teacherOverrides: { marksMax: 2 },
        });
        expect(effectiveQuestion(q).marksMax).toBe(2);
    });

    it('recomputeTotals sums the EFFECTIVE per-question max so a denominator edit lowers the total', () => {
        // AI graded this out of 5; teacher corrects it to a 2-mark question and
        // caps the awarded mark at 2.
        const q = makeQuestion({
            marksAwarded: 5,
            marksMax: 5,
            teacherOverrides: { marksMax: 2, marksAwarded: 2 },
        });
        const totals = recomputeTotals([q]);
        expect(totals.totalMaxMarks).toBe(2);
        expect(totals.totalAwardedMarks).toBe(2);
        expect(totals.scorePct).toBe(100);
    });
});

describe('formatParentSummary — teacher parent note', () => {
    it('leads with the teacher note above the score when present', () => {
        const text = formatParentSummary(
            makeResult([makeQuestion()], {
                teacherParentNote: [
                    'Aarav is improving',
                    'Please read with him nightly',
                ],
            }),
        );
        const noteIdx = text.indexOf('Aarav is improving');
        const scoreIdx = text.indexOf('Score:');
        expect(noteIdx).toBeGreaterThan(-1);
        expect(noteIdx).toBeLessThan(scoreIdx);
    });

    it('omits the note block entirely when there is no parent note', () => {
        const text = formatParentSummary(makeResult([makeQuestion()]));
        expect(text).toContain('Score:');
        expect(text).not.toContain('undefined');
    });
});

describe('formatStudentHandout — improvement bullets', () => {
    it('includes how to improve', () => {
        const text = formatStudentHandout(makeResult([makeQuestion()]));
        expect(text).toContain('How to improve:');
        expect(text).toContain('Add the role of sunlight');
    });
});

describe('formatters honour a teacher marksMax override in the denominator', () => {
    // AI graded out of 5; teacher corrects it to a 2-mark question, capping the
    // awarded mark at 2. Both documents must print the EFFECTIVE denominator
    // (2), not the raw AI value (5) — otherwise they contradict the headline
    // score, which uses recomputeTotals -> effective max.
    const overridden = makeQuestion({
        marksAwarded: 5,
        marksMax: 5,
        teacherOverrides: { marksMax: 2, marksAwarded: 2 },
    });

    it('student handout shows the overridden max, not the raw AI max', () => {
        const text = formatStudentHandout(makeResult([overridden]));
        expect(text).toContain('Marks: 2.0 / 2');
        expect(text).not.toContain('/ 5');
    });

    it('parent summary shows the overridden max, not the raw AI max', () => {
        const text = formatParentSummary(makeResult([overridden]));
        expect(text).toContain('2.0 / 2');
        expect(text).not.toContain('2.0 / 5');
    });
});
