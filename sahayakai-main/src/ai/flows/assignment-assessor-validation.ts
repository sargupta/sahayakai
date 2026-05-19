/**
 * @fileOverview Post-hoc validation for assignment-assessor output.
 *
 * Catches the "model invented an answer for a blank page" failure that
 * documented blank-region hallucination causes in multi-modal LLMs.
 *
 * Strategy: if the transcript is entirely [BLANK] / empty / placeholder,
 * any non-zero criterion score is a hallucination — clamp the result to
 * a zero-score response with the appropriate warning, and let the API
 * route return that to the teacher unchanged.
 *
 * Returned shape:
 *   - `repaired` is null when the original output is acceptable as-is.
 *   - `repaired` holds the corrected output when a guard fired.
 *   - `addedWarnings` lists which guards triggered (for logging).
 */

import type { AssessAssignmentOutput } from './assignment-assessor';

const BLANK_TOKEN_RE = /^\s*(\[BLANK\]|\[\?\?\?\]|—|-|\.|…|null|none)?\s*$/i;

export interface ValidationResult {
  repaired: AssessAssignmentOutput | null;
  addedWarnings: string[];
}

export function validateAssessment(output: AssessAssignmentOutput): ValidationResult {
  const addedWarnings: string[] = [];

  const transcriptEmpty = isEffectivelyBlank(output.rawTranscript);
  const anyNonZeroScore = output.perCriterionScores.some((c) => c.points > 0);
  const overallNonZero = output.overallScore > 0 || output.pointsEarned > 0;

  if (transcriptEmpty && (anyNonZeroScore || overallNonZero)) {
    // Hard repair: the model invented answers despite a blank page.
    addedWarnings.push('blank_transcript_hallucination_repaired');
    return {
      addedWarnings,
      repaired: forceBlankPageResult(output, addedWarnings),
    };
  }

  if (transcriptEmpty && !output.warnings.includes('page_appears_blank')) {
    addedWarnings.push('page_appears_blank_added');
    return {
      addedWarnings,
      repaired: {
        ...output,
        warnings: [...output.warnings, 'page_appears_blank'],
      },
    };
  }

  return { repaired: null, addedWarnings };
}

function isEffectivelyBlank(transcript: string): boolean {
  if (!transcript) return true;
  // Strip lines that match the blank token pattern; if nothing real remains,
  // treat the transcript as blank.
  const lines = transcript.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return true;
  return lines.every((l) => BLANK_TOKEN_RE.test(l));
}

function forceBlankPageResult(
  output: AssessAssignmentOutput,
  warnings: string[],
): AssessAssignmentOutput {
  return {
    ...output,
    overallScore: 0,
    pointsEarned: 0,
    perCriterionScores: output.perCriterionScores.map((c) => ({
      ...c,
      points: 0,
      level: c.level || 'Beginning',
      feedback: 'No student work was detected for this criterion.',
      confidence: Math.min(c.confidence ?? 0.1, 0.1),
    })),
    strengths: ['—'],
    improvements: ['Please re-upload a clearer photo of the student\'s work.'],
    nextSteps: ['Ask the student to complete the assignment if it was not done.'],
    teacherNote: 'No student work was detected in this image. Please verify the photo and try again.',
    confidenceOverall: 0.1,
    warnings: Array.from(new Set([...output.warnings, 'page_appears_blank', ...warnings])),
  };
}
