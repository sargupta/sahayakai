/**
 * Assessment Scanner — Zod schemas.
 *
 * Phase-1 MVP scope: single page, single student, math + MCQ + short answer
 * only. Multi-page, full subject coverage, gradebook tracking, and class
 * analytics land in subsequent phases.
 *
 * Schemas live in their own file (mirroring `quiz-generator-schemas.ts`) so
 * the API route can import them without dragging Genkit + the LLM client into
 * the route's bundle. Keeps cold-start time on the route low.
 *
 * Two-pass design (see flow file for orchestration):
 *   PASS 1: extract page structure (questions + student answers, verbatim)
 *   PASS 2: rubric-grounded scoring with NCERT context
 *
 * The two-pass split is deliberate — it gives a clean failure boundary
 * (extraction failed vs grading failed) and lets us cache extraction across
 * teacher edits in later phases.
 */

import { z } from 'genkit';

// ───────────────────────────────────────────────────────────────────────────
// PASS 1: Page extraction
// ───────────────────────────────────────────────────────────────────────────

export const QUESTION_TYPES = [
    'mcq',
    'fill_blank',
    'short_answer',
    'long_answer',
    'math_calculation',
    'diagram',
    'match_following',
    'true_false',
] as const;

export const IMAGE_QUALITY_ISSUES = [
    'blurry',
    'glare',
    'low_light',
    'rotated',
    'partial_crop',
    'multiple_handwriting',
    'none',
] as const;

export const PAGE_TYPES = [
    'question_only',
    'answer_only',
    'mixed',
    'cover',
    'unreadable',
] as const;

const ExtractedQuestionSchema = z.object({
    questionId: z
        .string()
        .describe('Stable id of the form `p{pageIndex}-q{n}` so Pass 2 can map back.'),
    questionType: z.enum(QUESTION_TYPES),
    questionText: z
        .string()
        .describe(
            "The question's verbatim text from the page. If only the answer is visible (no question on the page), reconstruct from the student's answer + NCERT context and set questionTextConfidence accordingly.",
        ),
    questionTextConfidence: z
        .number()
        .min(0)
        .max(1)
        .describe('0..1 confidence the question text is correctly read.'),
    studentAnswerRaw: z
        .string()
        .describe(
            "Exactly what's written by the student, including struck-out marks. Use [STRUCK: …] markers to denote struck-out segments.",
        ),
    studentAnswerInterpreted: z
        .string()
        .describe('Best read of the student\'s INTENDED final answer (un-struck content only).'),
    answerConfidence: z
        .number()
        .min(0)
        .max(1)
        .describe('0..1 confidence in the interpreted answer reading.'),
    isAttempted: z
        .boolean()
        .describe('false when the student left the answer blank.'),
    workShown: z
        .string()
        .optional()
        .describe('For math: any working / steps the student wrote out (so Pass 2 can award method marks).'),
    marksAvailable: z
        .number()
        .optional()
        .describe('If a marks-per-question hint is printed on the page (e.g. "[5]"), capture it here.'),
});

export const PageScanSchema = z.object({
    pageIndex: z.number().int().min(0),
    pageType: z.enum(PAGE_TYPES),
    handwritingConfidence: z
        .number()
        .min(0)
        .max(1)
        .describe('Overall legibility of the handwriting on the page.'),
    imageQualityIssues: z
        .array(z.enum(IMAGE_QUALITY_ISSUES))
        .describe('All quality issues detected. Use ["none"] if the page is clean.'),
    detectedLanguage: z
        .string()
        .describe('BCP-47 code of the dominant language on the page (e.g. "en", "hi", "kn").'),
    questions: z
        .array(ExtractedQuestionSchema)
        .describe('All extracted questions on this page. Empty for a cover/unreadable page.'),
});
export type PageScan = z.infer<typeof PageScanSchema>;
export type ExtractedQuestion = z.infer<typeof ExtractedQuestionSchema>;

// ───────────────────────────────────────────────────────────────────────────
// PASS 2: Rubric-grounded scoring
// ───────────────────────────────────────────────────────────────────────────

export const MISTAKE_PATTERNS = [
    'conceptual',
    'computational',
    'transcription',
    'incomplete',
    'off_topic',
    'none',
] as const;

const PartialCreditStepSchema = z.object({
    step: z.string().describe('What the step is (e.g. "Set up equation correctly").'),
    earned: z.number().min(0),
    max: z.number().min(0),
});

export const GradedQuestionSchema = z.object({
    questionId: z.string(),
    pageIndex: z.number().int().min(0),
    questionText: z.string(),
    studentAnswer: z.string().describe('The interpreted student answer (post-Pass-1).'),
    expectedAnswer: z
        .string()
        .describe(
            "The correct/reference answer used for scoring. Inferred from NCERT context unless a teacher answer key was supplied.",
        ),
    marksAwarded: z.number().min(0),
    marksMax: z.number().min(0),
    partialCreditBreakdown: z
        .array(PartialCreditStepSchema)
        .describe('Step-wise marks for math; empty array for non-math.'),
    feedback: z
        .string()
        .describe('Teacher-facing feedback in `language`. ~1-2 sentences. Specific and actionable.'),
    studentFacingFeedback: z
        .string()
        .describe(
            'Gentler, age-appropriate feedback addressed to the student in `language`. Encouraging tone for low scores.',
        ),
    conceptTested: z
        .string()
        .describe('Short concept name (e.g. "Pythagoras Theorem", "Subject-Verb Agreement").'),
    ncertChapterId: z
        .string()
        .nullable()
        .describe('Best-matched NCERT chapter id, or null if no match in scope.'),
    mistakePattern: z.enum(MISTAKE_PATTERNS).nullable(),
    needsTeacherReview: z
        .boolean()
        .describe(
            'true when confidence < 0.8 OR partial credit is ambiguous OR multiple options were marked on an MCQ.',
        ),
    confidence: z
        .number()
        .min(0)
        .max(1)
        .describe('Grader\'s confidence in the score (separate from extraction confidence).'),
});
export type GradedQuestion = z.infer<typeof GradedQuestionSchema>;

const ConceptMasterySchema = z.object({
    chapterId: z.string(),
    chapterTitle: z.string(),
    masteryPct: z.number().min(0).max(100),
    weakestConcept: z.string().nullable(),
});

// ───────────────────────────────────────────────────────────────────────────
// Public API: input + output schemas
// ───────────────────────────────────────────────────────────────────────────

/**
 * Phase-1 cap on pages. Multi-page lands in Phase 2; until then, more than 1
 * page in a single request is rejected at the route layer.
 */
export const PHASE_1_PAGE_CAP = 1;

/** Phase-2 hard cap on pages per assessment. */
export const ASSESSMENT_MAX_PAGES = 15;

export const AssessmentScannerInputSchema = z.object({
    assessmentId: z
        .string()
        .uuid()
        .describe('Client-generated UUIDv4. Idempotency key — re-submitting returns cached result.'),
    studentId: z
        .string()
        .optional()
        .describe('Phase-1: optional. Phase-2+: required (linked to roster).'),
    classId: z
        .string()
        .optional()
        .describe('Phase-1: optional. Phase-2+: required.'),
    subject: z
        .string()
        .describe('Subject from SUBJECTS enum (e.g. "Mathematics"). Phase-1: only "Mathematics" is allowed.'),
    gradeLevel: z
        .string()
        .describe('Grade from GRADE_LEVELS (e.g. "Class 10").'),
    language: z
        .string()
        .default('English')
        .describe('Language for the feedback output. One of LANGUAGES.'),
    pageUrls: z
        .array(z.string())
        .min(1)
        .max(ASSESSMENT_MAX_PAGES)
        .describe(
            'HTTPS URLs (Firebase Storage download URLs) OR data URIs. The flow normalises both.',
        ),
    ncertChapterIds: z
        .array(z.string())
        .max(10)
        .optional()
        .describe('Optional teacher-selected scope. If omitted, falls back to grade+subject chapters.'),
    totalMaxMarks: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Override total. If omitted, inferred as sum of marksMax across graded questions.'),
    teacherAnswerKeyText: z
        .string()
        .optional()
        .describe('Optional pasted/dictated answer key. Authoritative when present.'),
    educationBoard: z.string().optional(),
    userId: z.string().describe('Set server-side from the x-user-id header.'),
});
export type AssessmentScannerInput = z.infer<typeof AssessmentScannerInputSchema>;

export const AssessmentScannerOutputSchema = z.object({
    assessmentId: z.string(),
    status: z.enum(['graded', 'partial', 'failed']),
    pageCount: z.number().int().min(0),
    totalAwardedMarks: z.number().min(0),
    totalMaxMarks: z.number().min(0),
    scorePct: z.number().min(0).max(100),
    letterGrade: z
        .string()
        .describe('A+/A/B/C/D/E. Derived from scorePct using a fixed band.'),
    questions: z.array(GradedQuestionSchema),
    classAverageAtScan: z
        .number()
        .nullable()
        .describe('Snapshot of the class\'s average at scan time. null until Phase 3 (class analytics).'),
    conceptMastery: z
        .array(ConceptMasterySchema)
        .describe('Per-NCERT-chapter mastery rollup. Empty array when chapters could not be resolved.'),
    recommendedNextSteps: z
        .array(z.string())
        .describe('Teacher-facing guidance: "Re-teach factorisation; assign 5 practice sums on…".'),
    studentRecommendations: z
        .array(z.string())
        .describe('Student-facing guidance, in `language`. Read aloud via TTS on the result page.'),
    needsReviewCount: z
        .number()
        .int()
        .min(0)
        .describe('Count of questions where needsTeacherReview === true. Surfaced as a UI badge.'),
    imageQualityWarnings: z
        .array(z.string())
        .describe(
            'Human-readable per-page warnings the UI can show before render (e.g. "Page 1: blurry").',
        ),
    errorMessage: z.string().optional(),
});
export type AssessmentScannerOutput = z.infer<typeof AssessmentScannerOutputSchema>;
