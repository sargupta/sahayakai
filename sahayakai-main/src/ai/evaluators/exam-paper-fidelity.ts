/**
 * @fileOverview Evaluator for exam paper generation fidelity.
 *
 * Measures three sub-scores:
 *   1. blueprintAdherence — Do sections/question counts match the expected blueprint?
 *   2. marksTotal         — Does the sum of all question marks match the expected total?
 *   3. chapterCoverage    — What fraction of requested chapters are covered by at least one question?
 *
 * Composite = blueprintAdherence * 0.4 + marksTotal * 0.3 + chapterCoverage * 0.3
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { computeTotalMarks } from '@/ai/data/exam-paper-marks';
import { resolveChapterId } from '@/ai/data/ncert-chapters';

ai.defineEvaluator(
  {
    name: 'sahayak/examPaperFidelity',
    displayName: 'Exam Paper Fidelity',
    definition:
      'Measures how faithfully a generated exam paper follows the requested blueprint, marks total, and chapter coverage.',
  },
  async (datapoint) => {
    const input = datapoint.input as Record<string, unknown> | undefined;
    const output = datapoint.output as Record<string, unknown> | undefined;
    const reference = (datapoint.reference as Record<string, unknown>) ?? {};

    if (!output || !Array.isArray(output.sections)) {
      return {
        testCaseId: datapoint.testCaseId,
        evaluation: {
          score: 0,
          details: { reasoning: 'Output is missing or has no sections array.' },
        },
      };
    }

    const sections = output.sections as Array<{
      name?: string;
      questions?: Array<{ marks?: number; text?: string }>;
    }>;

    // ─── 1. Blueprint Adherence (heuristic, 0-1 | null when unmeasurable) ─

    let blueprintAdherence: number | null = null;

    const expectedSectionCount = reference.expectedSectionCount as number | undefined;
    const expectedQuestionCounts = reference.expectedQuestionCounts as number[] | undefined;

    if (expectedSectionCount != null || expectedQuestionCounts != null) {
      const expectedCount = expectedSectionCount ?? (expectedQuestionCounts?.length ?? sections.length);
      const actualCount = sections.length;

      if (expectedQuestionCounts && Array.isArray(expectedQuestionCounts)) {
        // Compare section-by-section question counts; count how many match.
        let matchingSections = 0;
        const comparisons = Math.min(expectedQuestionCounts.length, sections.length);
        for (let i = 0; i < comparisons; i++) {
          const actualQCount = sections[i].questions?.length ?? 0;
          if (actualQCount === expectedQuestionCounts[i]) {
            matchingSections++;
          }
        }
        blueprintAdherence = expectedCount > 0 ? matchingSections / expectedCount : 1;
      } else {
        // Only section count check.
        blueprintAdherence = expectedCount > 0 ? Math.min(actualCount, expectedCount) / expectedCount : 1;
      }
    }

    // ─── 2. Marks Total (arithmetic, 0-1 | null when unmeasurable) ────────

    let marksTotal: number | null = null;

    // Shared with the flow's runtime reconcile step (2026-07-09, Phase 1) so
    // the evaluator's measurement and the flow's enforcement cannot diverge.
    const actualTotalMarks = computeTotalMarks(sections);

    const expectedTotalMarks =
      (reference.expectedTotalMarks as number | undefined) ??
      (input?.maxMarks as number | undefined);

    if (expectedTotalMarks != null && expectedTotalMarks > 0) {
      // Binary-exact against hard invariant #1 — any drift is a failure; the old
      // 0.5-for-≤10% tolerance band masked real marks drift (M6, 2026-07-16).
      marksTotal = actualTotalMarks === expectedTotalMarks ? 1 : 0;
    }

    // ─── 3. Chapter Coverage (set check, 0-1 | null when unmeasurable) ────

    let chapterCoverage: number | null = null;

    const requestedChapters = (input?.chapters as string[] | undefined) ?? [];
    const gradeLevel = input?.gradeLevel as string | undefined;
    const subject = input?.subject as string | undefined;

    if (requestedChapters.length > 0) {
      // Collect all question texts to check for chapter mentions (fallback path).
      const allQuestionTexts = sections.flatMap((s) =>
        (s.questions ?? []).map((q) => q.text ?? ''),
      );

      // Covered chapters per the blueprintSummary (marks > 0).
      const chapterWise = (output.blueprintSummary as Record<string, unknown>)?.chapterWise as
        | Array<{ chapter?: string; marks?: number }>
        | undefined;
      const coveredTitles = (chapterWise ?? [])
        .filter((c) => (c.marks ?? 0) > 0)
        .map((c) => c.chapter ?? '');

      // Primary signal: resolve requested + covered summary chapters to canonical
      // chapter ids and intersect by id — survives em-dash/rename drift, same join
      // key the pipeline trusts (M7, 2026-07-16). Needs grade+subject to resolve.
      const coveredIds = new Set<string>();
      if (gradeLevel && subject) {
        for (const title of coveredTitles) {
          const id = resolveChapterId(gradeLevel, subject, title);
          if (id) coveredIds.add(id);
        }
      }

      let coveredCount = 0;
      for (const chapter of requestedChapters) {
        const requestedId =
          gradeLevel && subject ? resolveChapterId(gradeLevel, subject, chapter) : null;
        const coveredBySummary = requestedId != null && coveredIds.has(requestedId);

        // Fallback (id didn't resolve or no summary): word-boundary regex over the
        // ESCAPED title so "Light" no longer matches "delight".
        const escaped = chapter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundary = new RegExp(`\\b${escaped}\\b`, 'i');
        const mentionedInText = allQuestionTexts.some((text) => wordBoundary.test(text));

        if (coveredBySummary || mentionedInText) {
          coveredCount++;
        }
      }

      chapterCoverage = coveredCount / requestedChapters.length;
    }

    // ─── Composite Score (weight-renormalised over measurable sub-scores) ─

    const parts: Array<{ score: number; weight: number }> = [];
    if (blueprintAdherence != null) parts.push({ score: blueprintAdherence, weight: 0.4 });
    if (marksTotal != null) parts.push({ score: marksTotal, weight: 0.3 });
    if (chapterCoverage != null) parts.push({ score: chapterCoverage, weight: 0.3 });

    const weightSum = parts.reduce((s, p) => s + p.weight, 0);
    const composite =
      weightSum > 0 ? parts.reduce((s, p) => s + p.score * p.weight, 0) / weightSum : null;

    const fmt = (v: number | null) => (v == null ? 'N/A' : v.toFixed(2));

    return {
      testCaseId: datapoint.testCaseId,
      evaluation: [
        // Genkit's Score.score rejects null → omit (undefined) when unmeasurable.
        { id: 'blueprintAdherence', score: blueprintAdherence ?? undefined },
        { id: 'marksTotal', score: marksTotal ?? undefined },
        { id: 'chapterCoverage', score: chapterCoverage ?? undefined },
        {
          id: 'composite',
          score: composite ?? undefined,
          details: {
            reasoning:
              composite == null
                ? 'No measurable reference — no sub-score could be evaluated (blueprint, marks total, and chapters all absent).'
                : `blueprintAdherence=${fmt(blueprintAdherence)}, ` +
                  `marksTotal=${fmt(marksTotal)} (actual=${actualTotalMarks}, expected=${expectedTotalMarks ?? 'N/A'}), ` +
                  `chapterCoverage=${fmt(chapterCoverage)}. ` +
                  `Composite = weighted avg over measurable sub-scores = ${composite.toFixed(2)}.`,
          },
        },
      ],
    };
  },
);
