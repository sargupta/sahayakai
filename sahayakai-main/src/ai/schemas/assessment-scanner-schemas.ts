/**
 * Assessment Scanner — Zod schemas.
 *
 * Phase-2 scope: up to 3 pages per scan, six subject families (Mathematics,
 * Science, EVS, Social Science, Hindi, English) plus an "Other" generic
 * fallback. Multi-student rosters and class analytics still land in Phase 3+.
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

// Re-export client-safe constants so existing server-side callers that import
// them from this file (route, flow, tests) keep working. The constants live
// in a separate module so UI code can import them without pulling Genkit into
// the client bundle.
export {
    ASSESSMENT_DEMO_PAGE_CAP,
    PHASE_1_PAGE_CAP,
    ASSESSMENT_MAX_PAGES,
    ASSESSMENT_SUPPORTED_SUBJECTS,
    resolveSubjectFamily,
    type AssessmentSupportedSubject,
    type SubjectRubricFamily,
} from './assessment-scanner-constants';
import { ASSESSMENT_MAX_PAGES } from './assessment-scanner-constants';

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
    teacherOverrides: z
        .object({
            marksAwarded: z.number().min(0).optional(),
            feedback: z.string().optional(),
            studentFacingFeedback: z.string().optional(),
            studentAnswer: z.string().optional(),
            editedAt: z.string().optional(),
        })
        .optional()
        .describe(
            'Teacher corrections layered on top of the AI grade. Kept separate from the AI fields so we can compare AI vs human judgement and improve the prompt over time.',
        ),
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

// Page-cap, subject list, and `resolveSubjectFamily` now live in
// `./assessment-scanner-constants.ts` (re-exported at the top of this file)
// so client-side pages can import them without pulling Genkit / Node-only
// telemetry deps into the browser bundle.

export const AssessmentScannerInputSchema = z.object({
    assessmentId: z
        .string()
        .uuid()
        .describe('Client-generated UUIDv4. Idempotency key — re-submitting returns cached result.'),
    studentId: z
        .string()
        .max(128)
        .optional()
        .describe('Optional today; required once class rosters land (Phase 3+).'),
    classId: z
        .string()
        .max(128)
        .optional()
        .describe('Optional today; required once class rosters land (Phase 3+).'),
    subject: z
        .string()
        .max(100)
        .describe(
            'Subject from ASSESSMENT_SUPPORTED_SUBJECTS (Mathematics, Science, EVS, Social Science / History / Geography / Civics, Hindi, English, or "Other"). The route validates against this list and rejects unknowns with a 400.',
        ),
    gradeLevel: z
        .string()
        .max(50)
        .describe('Grade from GRADE_LEVELS (e.g. "Class 10").'),
    language: z
        .string()
        .max(50)
        .default('English')
        .describe('Language for the feedback output. One of LANGUAGES.'),
    pageUrls: z
        .array(z.string().max(14_000_000))
        .min(1)
        .max(ASSESSMENT_MAX_PAGES)
        .describe(
            'HTTPS URLs (Firebase Storage download URLs) OR data URIs. The flow normalises both. Schema ceiling is 15; the route currently caps demo traffic at ASSESSMENT_DEMO_PAGE_CAP (3) for cost + latency control.',
        ),
    ncertChapterIds: z
        .array(z.string().max(200))
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
        .max(20_000)
        .optional()
        .describe('Optional pasted/dictated answer key. Authoritative when present.'),
    educationBoard: z.string().max(100).optional(),
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
    teacherEditedAt: z
        .string()
        .optional()
        .describe(
            'ISO timestamp of the latest teacher edit. Surfaced as an "Edited" badge in My Library so the teacher can tell at a glance which results they have already reviewed.',
        ),
    errorMessage: z.string().optional(),
});
export type AssessmentScannerOutput = z.infer<typeof AssessmentScannerOutputSchema>;
