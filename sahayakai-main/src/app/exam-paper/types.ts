/**
 * @fileOverview Shared types + constants for the exam-paper feature UI.
 * Extracted from the former monolithic page.tsx so the hooks (brain) and the
 * dumb presentational components can both import a single source of truth.
 */

// ── Types for generated paper ────────────────────────────────────────────

export interface GeneratedQuestion {
  // Flow returns `number`, not `questionNumber`
  number?: number;
  questionNumber?: number;
  text: string;
  options?: string[];
  correctOption?: string;
  marks: number;
  // Flow embeds answer per-question as `answerKey` (string), not `answer`
  answerKey?: string;
  answer?: string;
  markingScheme?: string;
  internalChoice?: string;
  source?: string;
}

export interface GeneratedSection {
  name: string;
  label: string;
  instructions?: string;
  questions: GeneratedQuestion[];
  totalMarks: number;
}

export interface GeneratedPaper {
  title: string;
  board: string;
  gradeLevel: string;
  subject: string;
  duration: string | number; // Flow returns string e.g. "3 Hours"
  maxMarks: number;
  generalInstructions: string[];
  sections: GeneratedSection[];
  answerKey?: GeneratedQuestion[]; // Not in flow output — derived from sections
  blueprintSummary?: { chapterWise: { chapter: string; marks: number }[]; difficultyWise: { level: string; percentage: number }[] } | string;
  // Phase 1 marks-reconcile (2026-07-09): present only when the first
  // generation attempt drifted from the effective maxMarks. repaired=false
  // means the paper still drifts — surface as a warning (UI banner is a
  // fast-follow, pending the 11-language i18n gate).
  marksReconciliation?: { expected: number; actual: number; repaired: boolean; attempts: number };
  // Phase 2 (2026-07-10): present only when a requested answer key / marking
  // scheme was missing after generation. filledByPlaceholder > 0 is the
  // "review this paper" signal (a key had to be floored deterministically).
  // UI banner is a fast-follow, pending the 11-language i18n gate.
  answerKeyCompleteness?: {
    requestedAnswerKey: boolean;
    requestedMarkingScheme: boolean;
    missingBefore: number;
    filledByStamp: number;
    filledByReprompt: number;
    filledByPlaceholder: number;
    // M11: WHY filledByPlaceholder > 0. Absent when it's 0.
    placeholderReason?: string;
  };
  // C7 (forensic EPG-2026-07-17): present only when a question tagged "New" was
  // found to duplicate a retrieved PYQ and relabeled. relabeled > 0 is a
  // "some 'New' questions weren't original" signal.
  newVerification?: { checked: number; relabeled: number };
  // Per-chapter NCERT validation warnings (mirrors the flow's Zod shape). Reaches
  // the client already; typed here so the H1 banner can read it without `as any`.
  validationWarnings?: {
    invalid: boolean;
    lenient: boolean;
    message: string;
    input: { gradeLevel: string; subject: string; chapter: string };
  }[];
}

// ── Constants ────────────────────────────────────────────────────────────

export const GRADE_OPTIONS = ["Class 9", "Class 10"] as const;
export const DIFFICULTY_OPTIONS = ["easy", "moderate", "hard", "mixed"] as const;
