/**
 * @fileOverview Shared marks-summing helpers for exam papers.
 *
 * - computeSectionMarks - Sum of question marks within one section.
 * - computeTotalMarks - Sum of all question marks across sections.
 *
 * Extracted (2026-07-09, Phase 1 marks-reconcile) so the runtime reconcile
 * step in `exam-paper-generator.ts` and the offline evaluator
 * (`src/ai/evaluators/exam-paper-fidelity.ts`) share one summing definition
 * and cannot drift apart. Semantics deliberately mirror the evaluator's
 * original inline reduce (`questions ?? []`, `marks ?? 0`) and the param
 * types are loose so both the flow's strict output shape and the evaluator's
 * partially-typed datapoint shape fit.
 */

export interface MarksBearingQuestion {
  marks?: number;
}

export interface MarksBearingSection {
  questions?: MarksBearingQuestion[];
}

export function computeSectionMarks(section: MarksBearingSection): number {
  const questions = section.questions ?? [];
  return questions.reduce((sum, q) => sum + (q.marks ?? 0), 0);
}

export function computeTotalMarks(sections: ReadonlyArray<MarksBearingSection>): number {
  return sections.reduce((sum, section) => sum + computeSectionMarks(section), 0);
}
