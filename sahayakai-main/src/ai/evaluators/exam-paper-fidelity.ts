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

    // ─── 1. Blueprint Adherence (heuristic, 0-1) ────────────────────────

    let blueprintAdherence = 1;

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

    // ─── 2. Marks Total (arithmetic, 0-1) ────────────────────────────────

    let marksTotal = 1;

    const actualTotalMarks = sections.reduce((sum, section) => {
      const questions = section.questions ?? [];
      return sum + questions.reduce((qSum, q) => qSum + (q.marks ?? 0), 0);
    }, 0);

    const expectedTotalMarks =
      (reference.expectedTotalMarks as number | undefined) ??
      (input?.maxMarks as number | undefined);

    if (expectedTotalMarks != null && expectedTotalMarks > 0) {
      if (actualTotalMarks === expectedTotalMarks) {
        marksTotal = 1;
      } else {
        const deviation = Math.abs(actualTotalMarks - expectedTotalMarks) / expectedTotalMarks;
        marksTotal = deviation <= 0.1 ? 0.5 : 0;
      }
    }

    // ─── 3. Chapter Coverage (set check, 0-1) ────────────────────────────

    let chapterCoverage = 1;

    const requestedChapters = (input?.chapters as string[] | undefined) ?? [];

    if (requestedChapters.length > 0) {
      // Collect all question texts to check for chapter mentions.
      const allQuestionTexts = sections.flatMap((s) =>
        (s.questions ?? []).map((q) => (q.text ?? '').toLowerCase()),
      );

      // Also check the blueprintSummary.chapterWise for chapter names.
      const chapterWise = (output.blueprintSummary as Record<string, unknown>)?.chapterWise as
        | Array<{ chapter?: string; marks?: number }>
        | undefined;
      const coveredChaptersInSummary = new Set(
        (chapterWise ?? []).filter((c) => (c.marks ?? 0) > 0).map((c) => (c.chapter ?? '').toLowerCase()),
      );

      let coveredCount = 0;
      for (const chapter of requestedChapters) {
        const chapterLower = chapter.toLowerCase();

        // A chapter is "covered" if any question text mentions it OR the blueprintSummary lists it with marks > 0.
        const mentionedInQuestions = allQuestionTexts.some((text) => text.includes(chapterLower));
        const mentionedInSummary = coveredChaptersInSummary.has(chapterLower);

        if (mentionedInQuestions || mentionedInSummary) {
          coveredCount++;
        }
      }

      chapterCoverage = requestedChapters.length > 0 ? coveredCount / requestedChapters.length : 1;
    }

    // ─── Composite Score ─────────────────────────────────────────────────

    const composite = blueprintAdherence * 0.4 + marksTotal * 0.3 + chapterCoverage * 0.3;

    return {
      testCaseId: datapoint.testCaseId,
      evaluation: [
        { id: 'blueprintAdherence', score: blueprintAdherence },
        { id: 'marksTotal', score: marksTotal },
        { id: 'chapterCoverage', score: chapterCoverage },
        {
          id: 'composite',
          score: composite,
          details: {
            reasoning:
              `blueprintAdherence=${blueprintAdherence.toFixed(2)}, ` +
              `marksTotal=${marksTotal.toFixed(2)} (actual=${actualTotalMarks}, expected=${expectedTotalMarks ?? 'N/A'}), ` +
              `chapterCoverage=${chapterCoverage.toFixed(2)}. ` +
              `Composite = ${blueprintAdherence.toFixed(2)}*0.4 + ${marksTotal.toFixed(2)}*0.3 + ${chapterCoverage.toFixed(2)}*0.3 = ${composite.toFixed(2)}.`,
          },
        },
      ],
    };
  },
);
