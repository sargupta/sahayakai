/**
 * Pure, client-safe helpers for AssessmentScanner output.
 *
 * Kept separate from `assessment-scanner.ts` (the Genkit flow, Node-only) so
 * the result-card component can import these without pulling Genkit / Firebase
 * Admin into the browser bundle.
 */

import type {
    AssessmentScannerOutput,
    GradedQuestion,
} from './assessment-scanner-schemas';

export function letterGradeFor(scorePct: number): string {
    if (scorePct >= 90) return 'A+';
    if (scorePct >= 80) return 'A';
    if (scorePct >= 65) return 'B';
    if (scorePct >= 50) return 'C';
    if (scorePct >= 35) return 'D';
    return 'E';
}

/**
 * The teacher may override AI-graded fields (marks, feedback, OCR transcript).
 * Read the effective value here — overrides take precedence; otherwise the AI
 * value stands. We keep both around so analytics can compare what the AI said
 * vs. what the teacher decided.
 */
export function effectiveQuestion(q: GradedQuestion) {
    const o = q.teacherOverrides;
    return {
        marksAwarded: o?.marksAwarded ?? q.marksAwarded,
        feedback: o?.feedback ?? q.feedback,
        studentFacingFeedback: o?.studentFacingFeedback ?? q.studentFacingFeedback,
        studentAnswer: o?.studentAnswer ?? q.studentAnswer,
    };
}

export interface RecomputedTotals {
    totalAwardedMarks: number;
    totalMaxMarks: number;
    scorePct: number;
    letterGrade: string;
    needsReviewCount: number;
}

/**
 * Re-derive aggregates from the question array, honouring teacher overrides.
 * Called client-side on every edit (live preview) and server-side in the PATCH
 * route (never trust client totals).
 */
export function recomputeTotals(
    questions: GradedQuestion[],
    totalMaxMarksOverride?: number,
): RecomputedTotals {
    const totalAwardedMarks = questions.reduce(
        (sum, q) => sum + effectiveQuestion(q).marksAwarded,
        0,
    );
    const totalMaxMarks =
        totalMaxMarksOverride ??
        questions.reduce((sum, q) => sum + q.marksMax, 0);
    const scorePct = totalMaxMarks > 0 ? (totalAwardedMarks / totalMaxMarks) * 100 : 0;
    const needsReviewCount = questions.filter((q) => q.needsTeacherReview).length;
    return {
        totalAwardedMarks,
        totalMaxMarks,
        scorePct,
        letterGrade: letterGradeFor(scorePct),
        needsReviewCount,
    };
}

/**
 * Apply recomputed totals onto a result object. Pure — caller decides whether
 * to persist or just render.
 */
export function withRecomputedTotals(
    result: AssessmentScannerOutput,
): AssessmentScannerOutput {
    const totals = recomputeTotals(result.questions, result.totalMaxMarks);
    return { ...result, ...totals };
}

/**
 * True when the scan actually graded something.
 *
 * `status: 'failed'` means the grading pass returned zero gradable questions —
 * nothing on the paper was read. The aggregate still carries `scorePct: 0` and
 * `letterGrade: 'E'`, because those are arithmetic on an empty set (0 of 0
 * marks), not a judgement about the child. Every consumer that turns a result
 * into a grade a human will read — the parent summary, the student handout,
 * the copy/share actions, the HTTP status of the scan route — gates on this so
 * a scan that graded nothing can never be presented as a failing grade.
 *
 * Checks the status flag AND the question array on purpose: the Python sidecar
 * sets its own status, and an empty question list is the ground truth either
 * way.
 */
export function isGradedResult(
    result: Pick<AssessmentScannerOutput, 'status' | 'questions'> | null | undefined,
): boolean {
    if (!result) return false;
    if (result.status === 'failed') return false;
    return Array.isArray(result.questions) && result.questions.length > 0;
}
