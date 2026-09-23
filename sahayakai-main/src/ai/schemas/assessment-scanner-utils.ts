/**
 * Pure, client-safe helpers for AssessmentScanner output.
 *
 * Kept separate from `assessment-scanner.ts` (the Genkit flow, Node-only) so
 * the result-card component can import these without pulling Genkit / Firebase
 * Admin into the browser bundle.
 */

import type { GradedQuestion } from './assessment-scanner-schemas';

export function letterGradeFor(scorePct: number): string {
    if (scorePct >= 90) return 'A+';
    if (scorePct >= 80) return 'A';
    if (scorePct >= 65) return 'B';
    if (scorePct >= 50) return 'C';
    if (scorePct >= 35) return 'D';
    return 'E';
}

/**
 * Coerce any value into a safe string for rendering. The output schema types
 * these fields as `z.string()`, but not every value that reaches the UI has
 * been through that parse — the idempotency cache returns a persisted record
 * with a raw cast (no re-validation), and legacy/edited records can carry a
 * missing or numeric field. A bad value here reaches `.trim()` / `.replace()`
 * at the render site and white-screens the whole card, so normalise defensively:
 * nullish → '', everything else → String(v) (so a numeric answer like 42 still
 * renders as "42" instead of crashing).
 */
const asText = (v: unknown): string => (v == null ? '' : String(v));

/**
 * The teacher may override AI-graded fields (marks, feedback, OCR transcript).
 * Read the effective value here — overrides take precedence; otherwise the AI
 * value stands. We keep both around so analytics can compare what the AI said
 * vs. what the teacher decided.
 */
export function effectiveQuestion(q: GradedQuestion) {
    const o = q.teacherOverrides;
    // Teacher can correct the denominator (e.g. AI guessed a 2-mark question
    // was worth 5). Effective max drives the score once edited.
    const marksMax = o?.marksMax ?? q.marksMax;
    return {
        // Awarded can never exceed the effective max. Neither an AI over-award
        // nor a raw PATCH body is re-validated against `awarded <= max`, and an
        // over-award would push scorePct/masteryPct past the schema's .max(100)
        // and 500 the scan on re-parse. Clamp to [0, marksMax] here so every
        // consumer (card, recomputeTotals, formatters) sees one coherent value.
        marksAwarded: Math.min(Math.max(0, o?.marksAwarded ?? q.marksAwarded), marksMax),
        marksMax,
        // String fields are coerced via `asText` so an unvalidated/legacy record
        // (see `asText`) can never crash the render with `.trim`/`.replace`.
        feedback: asText(o?.feedback ?? q.feedback),
        // `improvementPoints` is overridable; the AI value defaults to [] via the
        // schema, but guard with `?? []` for older saved records graded before the
        // field existed.
        improvementPoints: o?.improvementPoints ?? q.improvementPoints ?? [],
        studentAnswer: asText(o?.studentAnswer ?? q.studentAnswer),
        // Read-only (not teacher-overridable today) — passed through for a single
        // source of truth at the render site.
        whyCorrect: asText(q.whyCorrect),
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
    // Sum the EFFECTIVE per-question max so a teacher's denominator edit flows
    // into the total. `totalMaxMarksOverride` still wins when a caller passes a
    // grade-time declared total (kept for back-compat), but the card/PATCH omit
    // it so per-question edits drive the score.
    const totalMaxMarks =
        totalMaxMarksOverride ??
        questions.reduce((sum, q) => sum + effectiveQuestion(q).marksMax, 0);
    // `Math.min(100, …)` guards the `totalMaxMarksOverride` path, where a caller
    // could pass a declared total smaller than the summed awarded marks; the
    // per-question clamp in effectiveQuestion covers the summed-max path.
    const scorePct =
        totalMaxMarks > 0 ? Math.min(100, (totalAwardedMarks / totalMaxMarks) * 100) : 0;
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
 * Failed-scan gate (migrated from production). A scan "graded something" only if
 * it has a non-failed status AND at least one question. The Python sidecar sets
 * its own status, and an empty question list is the ground truth either way — so
 * a 0% "score" from an empty extraction must never be presented as a real grade.
 */
export function isGradedResult(
    result: { status?: string; questions?: unknown[] } | null | undefined,
): boolean {
    if (!result) return false;
    if (result.status === 'failed') return false;
    return Array.isArray(result.questions) && result.questions.length > 0;
}
