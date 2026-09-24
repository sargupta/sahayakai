/**
 * Edge-case tests for the Assessment Scanner grading flow (`gradeAssessment`).
 *
 * These exercise the two-pass grading logic *for real* — the existing suites
 * (`assessment-scanner.test.ts`, `assessment-scanner-dispatch.test.ts`) all mock
 * `gradeAssessment` out and only cover the route/dispatcher plumbing. Here we
 * mock the two Genkit prompts (Pass 1 extraction, Pass 2 scoring) and drive the
 * flow through the "graceful degradation" cases from Phase 2 of the TODO:
 *
 *   - blank page (answer left empty → 0 marks, no crash)
 *   - blurry / low-legibility page (imageQualityWarnings surfaced)
 *   - fully illegible scan (every page unreadable → AssessmentEmptyExtractionError)
 *   - unreachable page URL (fetch fails → AssessmentPageUnreadableError naming the page)
 *   - partial degradation (one page dies, the rest still grade → status 'partial')
 *
 * Strategy: `ai.definePrompt` is mocked to return a callable that dispatches by
 * prompt name, so each test controls exactly what Pass 1 and Pass 2 "see". The
 * flow's own aggregation, error boundaries and Zod validation run unmocked.
 */

// Prompt implementations, keyed by the two definePrompt names. Prefixed `mock*`
// so the jest.mock factory below may reference them (jest hoists the mock above
// the imports; the closures only fire when a prompt is actually invoked).
const mockPass1 = jest.fn();
const mockPass2 = jest.fn();
const mockFetchImageAsBase64 = jest.fn();
// Captured `definePrompt` definitions, keyed by name — lets tests assert on the
// prompt WORDING (a contract-regression guard for the model-driven cases where
// behaviour can only be pinned by the instructions we send, e.g. the struck-out
// marker convention, Case 17). Prefixed `mock*` so the hoisted factory may
// reference it. Declared with `var` (not const): the flow module is imported
// (imports hoist to the top) and calls definePrompt BEFORE a const initializer
// here would run, so a const would throw a temporal-dead-zone ReferenceError.
// `var` hoists as `undefined`, so the lazy init inside the factory is safe.
var mockPromptDefs: Record<string, { name: string; prompt: string }> | undefined;

jest.mock('@/ai/genkit', () => ({
    ai: {
        // Return a callable keyed by the prompt's declared name. Pass 1 and
        // Pass 2 both flow through here; we route by `def.name`.
        definePrompt: (def: { name: string; prompt: string }) => {
            if (!mockPromptDefs) mockPromptDefs = {};
            mockPromptDefs[def.name] = def;
            return (input: unknown, config: unknown) => {
                if (def.name === 'assessmentScannerPass1') return mockPass1(input, config);
                if (def.name === 'assessmentScannerPass2') return mockPass2(input, config);
                throw new Error(`Unexpected prompt name in test: ${def.name}`);
            };
        },
    },
    // runResiliently normally retries across the key pool; in tests it just
    // invokes the operation once with a dummy resilience config.
    runResiliently: (fn: (cfg: { config: Record<string, unknown> }) => unknown) =>
        fn({ config: {} }),
}));

jest.mock('@/ai/utils/image-utils', () => ({
    fetchImageAsBase64: (...args: unknown[]) => mockFetchImageAsBase64(...args),
}));

jest.mock('@/data/ncert', () => ({
    getChapterById: jest.fn(() => null),
    getChaptersForGrade: jest.fn(() => []),
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Idempotency check + persistence use lazy dynamic imports; stub them so the
// flow neither hits Firestore nor treats every run as a cache hit.
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        saveContent: jest.fn().mockResolvedValue(undefined),
        getUser: jest.fn().mockResolvedValue(null),
    },
}));
jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn().mockResolvedValue({
        collection: () => ({
            doc: () => ({
                collection: () => ({
                    doc: () => ({ get: async () => ({ exists: false }) }),
                }),
            }),
        }),
    }),
}));
jest.mock('firebase-admin/firestore', () => ({
    Timestamp: { fromDate: (d: Date) => d },
}));

// Imports must come AFTER all jest.mock calls.
import {
    gradeAssessment,
    AssessmentEmptyExtractionError,
    AssessmentPageUnreadableError,
    AssessmentBlankScanError,
    Pass2OutputSchema,
    computePass2TokenBudget,
    PASS2_OUTPUT_TOKEN_CAP,
} from '@/ai/flows/assessment-scanner';
// The mocked db-adapter + logger — imported so a test can make persistence fail
// and assert the flow soft-fails (Case 32).
import { dbAdapter } from '@/lib/db/adapter';
import { logger } from '@/lib/logger';
// The mocked idempotency store — imported so Case 31 can make the Firestore doc
// "exist" for one call and prove a re-submit is served from cache.
import { getDb } from '@/lib/firebase-admin';
// Pure (genkit-free) constant: the subject → rubric-family resolver (Case 21).
import { resolveSubjectFamily } from '@/ai/schemas/assessment-scanner-constants';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
// A real, sharp-decodable 2×2 JPEG. Pass 1 now VALIDATES each image up front
// (a corrupt file becomes an unreadable placeholder BEFORE the single model
// call), so test fixtures must be genuinely decodable — a fake "AAAA" would be
// flagged corrupt by the validator.
const DATA_URI =
    'data:image/jpeg;base64,/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAB//Z';
// Undecodable bytes — exercises the corrupt-image path (flagged unreadable
// before the model call, so the rest of the batch still grades).
const CORRUPT_URI = 'data:image/jpeg;base64,AAAA';

/** A valid extracted question (Pass-1 shape, sans pageIndex which the flow sets). */
function extractedQuestion(overrides: Record<string, unknown> = {}) {
    return {
        questionId: 'p0-q1',
        questionType: 'short_answer',
        questionText: 'What is 2 + 2?',
        questionTextConfidence: 0.95,
        studentAnswerRaw: '4',
        studentAnswerInterpreted: '4',
        answerConfidence: 0.95,
        isAttempted: true,
        ...overrides,
    };
}

/** A single extracted PageScan (Pass-1 shape). Defaults to page 0, one question. */
function pageScan(overrides: Record<string, unknown> = {}) {
    return {
        pageIndex: 0,
        pageType: 'mixed',
        handwritingConfidence: 0.9,
        imageQualityIssues: ['none'],
        detectedLanguage: 'en',
        questions: [extractedQuestion()],
        ...overrides,
    };
}

/**
 * The Pass-1 response envelope — `{ output: { pages: [...] } }`. The default
 * fan-out invokes the mock once PER PAGE (each call returns that page's scan);
 * the 'batched' strategy invokes it once with every page. `batchResult()` with
 * no args → `{ output: { pages: [] } }`, the empty read that degrades a page to
 * an unreadable placeholder.
 */
function batchResult(...pages: Array<Record<string, unknown>>) {
    return { output: { pages } };
}

/** Convenience: a single-page batch result (the common case). */
function pageResult(overrides: Record<string, unknown> = {}) {
    return batchResult(pageScan(overrides));
}

/**
 * A graded question (Pass-2 shape). NOTE: Pass 2 no longer emits
 * `questionText` / `studentAnswer` — they're merged from the Pass-1 extraction
 * by `questionId` in aggregate(). So the mock omits them by default; supplying a
 * non-empty value here simulates a deliberate CORRECTION (which forces review).
 */
function gradedQuestion(overrides: Record<string, unknown> = {}) {
    return {
        questionId: 'p0-q1',
        pageIndex: 0,
        expectedAnswer: '4',
        marksAwarded: 2,
        marksMax: 2,
        partialCreditBreakdown: [],
        feedback: 'Correct.',
        conceptTested: 'Addition',
        ncertChapterId: null,
        mistakePattern: 'none',
        needsTeacherReview: false,
        confidence: 0.95,
        ...overrides,
    };
}

/** A Pass-2 scoring result, wrapped in the `{ output }` envelope. */
function scoringResult(questions: unknown[], overrides: Record<string, unknown> = {}) {
    return {
        output: {
            questions,
            recommendedNextSteps: ['Re-teach carry-over addition.'],
            studentRecommendations: ['Practise 5 more sums.'],
            ...overrides,
        },
    };
}

function baseInput(overrides: Record<string, unknown> = {}) {
    return {
        assessmentId: VALID_UUID,
        subject: 'Mathematics',
        gradeLevel: 'Class 10',
        language: 'English',
        pageUrls: [DATA_URI],
        userId: 'test-uid',
        ...overrides,
    };
}

beforeEach(() => {
    mockPass1.mockReset();
    mockPass2.mockReset();
    mockFetchImageAsBase64.mockReset();
    // Default: fetching a remote page succeeds (tests override to fail).
    mockFetchImageAsBase64.mockResolvedValue(DATA_URI);
});

describe('assessment-scanner prompts — struck-out work convention (Case 17)', () => {
    // These pin the prompt WORDING, not model behaviour. The model honouring the
    // convention on a real photo is still ⚠️ manual, but these fail-fast if the
    // instructions that make it possible are ever deleted from the prompts.
    // `mockPromptDefs` is populated when the flow module is imported (both
    // prompts are defined at module load), so it's ready before any test runs.
    it('Pass-1 instructs the [STRUCK: …] marker and separates raw vs interpreted', () => {
        const p1 = mockPromptDefs?.['assessmentScannerPass1']?.prompt ?? '';
        expect(p1).toContain('[STRUCK:');
        expect(p1).toContain('studentAnswerRaw');
        expect(p1).toContain('studentAnswerInterpreted');
    });

    it('Pass-2 is told to grade the un-struck interpreted answer, ignoring struck-out work', () => {
        const p2 = mockPromptDefs?.['assessmentScannerPass2']?.prompt ?? '';
        expect(p2).toContain('studentAnswerInterpreted');
        expect(p2).toMatch(/STRUCK|struck-out/);
    });
});

describe('assessment-scanner prompts — MCQ multiple-selection (Case 18)', () => {
    // Same rationale as Case 17: no structured extraction flag exists for
    // "multiple ticks" (it's free text in studentAnswerRaw), so the behaviour is
    // model-driven and these tests pin the instructions, not the model's output.
    it('Pass-1 captures ALL marked options in studentAnswerRaw for an ambiguous MCQ', () => {
        const p1 = mockPromptDefs?.['assessmentScannerPass1']?.prompt ?? '';
        expect(p1).toContain('MCQ');
        expect(p1).toContain('ALL marked options');
        expect(p1).toContain('studentAnswerRaw');
    });

    it('Pass-2 scores a multi-selection MCQ 0 and flags it for teacher review', () => {
        const p2 = mockPromptDefs?.['assessmentScannerPass2']?.prompt ?? '';
        expect(p2).toContain('multiple selections'); // rule 2: → 0
        expect(p2).toContain('multiple options ticked'); // rule 7
        expect(p2).toContain('needsTeacherReview');
    });
});

describe('assessment-scanner prompts — subject-mismatch guard (Case 20)', () => {
    // 🎯 DoD: wrong-subject sheets handled gracefully. Mismatch DETECTION is
    // model-driven (needs a real cross-subject photo), so this pins the guard
    // wording so a prompt edit can't silently remove the "don't confidently
    // grade the wrong subject" protection.
    it('Pass-2 carries the subject-mismatch guard (review + low confidence + re-scan)', () => {
        const p2 = mockPromptDefs?.['assessmentScannerPass2']?.prompt ?? '';
        expect(p2).toContain('Subject-mismatch guard');
        expect(p2).toContain('EVERY question'); // needsTeacherReview on every question
        expect(p2).toContain('≤ 0.4'); // confidence cap
        expect(p2).toContain('re-scan'); // first recommendedNextSteps bullet
    });
});

describe('resolveSubjectFamily — subject → rubric family (Case 21)', () => {
    it.each([
        ['Mathematics', 'mathematics'],
        ['Maths', 'mathematics'],
        ['Science', 'science'],
        ['Environmental Studies (EVS)', 'evs'],
        ['Social Science', 'social_science'],
        ['History', 'social_science'],
        ['Geography', 'social_science'],
        ['Civics', 'social_science'],
        ['Hindi', 'language'],
        ['English', 'language'],
        ['Other', 'other'],
        ['Astrology', 'other'], // unknown → generic fallback, never throws
    ])('maps "%s" → %s', (subject, family) => {
        expect(resolveSubjectFamily(subject)).toBe(family);
    });
});

describe('gradeAssessment — "Other" subject uses the generic rubric (Case 21)', () => {
    it('feeds Pass 2 the generic rubric and the lower-confidence guidance', async () => {
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion()]));

        await gradeAssessment(baseInput({ subject: 'Other' }));

        expect(mockPass2).toHaveBeenCalledTimes(1);
        const pass2Input = mockPass2.mock.calls[0][0] as {
            subjectRubric: string;
            confidenceGuidance: string;
        };
        // Generic rubric dimensions, resolved server-side from subject 'Other'.
        expect(pass2Input.subjectRubric).toContain('Generic rubric');
        expect(pass2Input.subjectRubric).toContain('Clarity');
        expect(pass2Input.subjectRubric).toContain('Completeness');
        // Non-Math subjects get the honest-confidence, no-blanket-flag guidance.
        expect(pass2Input.subjectRubric).toContain('set `confidence` lower');
        expect(pass2Input.confidenceGuidance).toContain('Do NOT blanket-flag');
    });
});

describe('Indic feedback language — Native Script Mandate (Case 25)', () => {
    // 🎯 DoD: works in ≥2 languages. The actual in-script output (Devanagari
    // codepoints etc.) comes from the MODEL, so a codepoint assertion only makes
    // sense against a real run — a mocked test would just be asserting our own
    // fixture. What's deterministic (and worth locking) is (a) the mandate
    // wording survives prompt edits, and (b) the requested language is actually
    // delivered to both model calls so the mandate applies to the right script.
    it('Pass-2 carries the Native Script Mandate (no Latin transliteration for Indic scripts)', () => {
        const p2 = mockPromptDefs?.['assessmentScannerPass2']?.prompt ?? '';
        expect(p2).toContain('Native Script Mandate');
        expect(p2).toContain('NEVER Latin transliteration');
        expect(p2).toContain('Devanagari');
    });

    it('threads the requested feedback language through both passes', async () => {
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion()]));

        await gradeAssessment(baseInput({ language: 'Hindi' }));

        const pass1Input = mockPass1.mock.calls[0][0] as { language: string };
        const pass2Input = mockPass2.mock.calls[0][0] as { language: string };
        expect(pass1Input.language).toBe('Hindi');
        expect(pass2Input.language).toBe('Hindi');
    });
});

describe('assessment-scanner prompts — mixed-language answer (Case 26)', () => {
    // Rule #4 is model-driven behaviour; this pins the instruction so a prompt
    // edit can't silently start penalising a correct answer for being written
    // in a different language than the question.
    it('Pass-2 awards full marks for a correct answer in another language (unless the rubric requires one)', () => {
        const p2 = mockPromptDefs?.['assessmentScannerPass2']?.prompt ?? '';
        expect(p2).toContain('Mixed-language answers');
        expect(p2).toContain('full marks if the content is correct');
    });
});

describe('gradeAssessment — happy path (harness sanity)', () => {
    it('grades a clean single Math page end-to-end', async () => {
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion()]));

        const out = await gradeAssessment(baseInput());

        expect(out.status).toBe('graded');
        expect(out.pageCount).toBe(1);
        expect(out.questions).toHaveLength(1);
        expect(out.totalAwardedMarks).toBe(2);
        expect(out.totalMaxMarks).toBe(2);
        expect(out.scorePct).toBe(100);
        expect(out.imageQualityWarnings).toEqual([]);
    });
});

describe('gradeAssessment — blank page', () => {
    it('grades an unattempted answer as 0 marks without crashing', async () => {
        // Pass 1 reads the question but the student left it blank.
        mockPass1.mockResolvedValue(
            pageResult({
                questions: [
                    extractedQuestion({
                        isAttempted: false,
                        studentAnswerRaw: '',
                        studentAnswerInterpreted: '',
                        answerConfidence: 0,
                    }),
                ],
            }),
        );
        // Pass 2 scores it 0 with the `incomplete` pattern (per the flow's rules).
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({
                    studentAnswer: '',
                    marksAwarded: 0,
                    mistakePattern: 'incomplete',
                    feedback: 'No answer written.',
                }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        expect(out.status).toBe('graded');
        expect(out.questions).toHaveLength(1);
        expect(out.questions[0].marksAwarded).toBe(0);
        expect(out.questions[0].mistakePattern).toBe('incomplete');
        expect(out.totalAwardedMarks).toBe(0);
        expect(out.scorePct).toBe(0);
        // A blank answer is not the same as an illegible scan — no re-upload warning.
        expect(out.imageQualityWarnings).toEqual([]);
    });
});

describe('gradeAssessment — blank page (empty sheet, nothing to grade)', () => {
    /** A PageScan for a genuinely empty page: no questions at all. */
    function blankPageScan(pageIndex = 0) {
        return pageScan({
            pageType: 'blank',
            questions: [],
            // A blank page still photographs clearly — handwritingConfidence is
            // high; there's simply nothing written on it.
            handwritingConfidence: 1,
            pageIndex,
        });
    }

    it('short-circuits before Pass 2 and throws AssessmentBlankScanError for an all-blank scan', async () => {
        mockPass1.mockResolvedValue(batchResult(blankPageScan()));

        const err = await gradeAssessment(baseInput()).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(AssessmentBlankScanError);
        expect(err).toMatchObject({ code: 'BLANK_SCAN', blankPages: [1] });
        // The whole point: a blank page must NOT burn a Pass-2 grading call.
        expect(mockPass2).not.toHaveBeenCalled();
    });

    it('distinguishes blank (nothing to grade) from unreadable (re-upload photo)', async () => {
        mockPass1.mockResolvedValue(batchResult(blankPageScan()));

        // Blank ≠ illegible — it must be its own error, not EMPTY_EXTRACTION.
        await expect(gradeAssessment(baseInput())).rejects.not.toBeInstanceOf(
            AssessmentEmptyExtractionError,
        );
    });

    it('grades only the non-blank pages in a multi-page scan and notes the skipped one', async () => {
        const input = baseInput({ pageUrls: [DATA_URI, DATA_URI] });
        // Page 0 has a real question; page 1 is a blank back-of-sheet. One call
        // returns both pages' scans together.
        mockPass1.mockResolvedValue(batchResult(pageScan(), blankPageScan(1)));
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion()]));

        const out = await gradeAssessment(input);

        // The readable page is graded; the blank page is skipped, not failed.
        expect(out.status).toBe('graded');
        expect(out.pageCount).toBe(2);
        expect(out.questions).toHaveLength(1);
        expect(out.skippedPageNotices).toEqual([
            expect.stringContaining('Page 2: blank'),
        ]);
        // Pass 2 only ever saw the gradable page — blank pages don't burn tokens.
        expect(mockPass2).toHaveBeenCalledTimes(1);
        const pass2Input = mockPass2.mock.calls[0][0] as { extractedPages: string };
        const graded = JSON.parse(pass2Input.extractedPages) as Array<{ pageIndex: number }>;
        expect(graded).toHaveLength(1);
        expect(graded[0].pageIndex).toBe(0);
    });
});

describe('gradeAssessment — blurry / low-legibility page', () => {
    it('surfaces per-page image-quality warnings and a re-shoot hint', async () => {
        mockPass1.mockResolvedValue(
            pageResult({
                imageQualityIssues: ['blurry', 'glare'],
                handwritingConfidence: 0.3, // < 0.5 → triggers the re-shoot hint
                questions: [extractedQuestion({ answerConfidence: 0.4 })],
            }),
        );
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({
                    confidence: 0.4,
                    needsTeacherReview: true,
                }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        // Both the detected issues and the low-confidence hint are surfaced,
        // named by 1-based page number.
        expect(out.imageQualityWarnings).toEqual(
            expect.arrayContaining([
                'Page 1: blurry, glare',
                expect.stringContaining('Page 1: handwriting hard to read'),
            ]),
        );
        expect(out.needsReviewCount).toBe(1);
        // The page was still readable enough to grade → not a failure.
        expect(out.status).toBe('graded');
    });
});

describe('gradeAssessment — single image-quality issue, page still readable', () => {
    // Case 11: glare / rotated / folded / partial_crop / low_light. Detection is
    // model-driven (Pass 1), but the deterministic contract is: whatever issue
    // Pass 1 flags is surfaced verbatim in a per-page warning AND the page is
    // still graded (a readable-but-imperfect photo is not a failure).
    it.each([
        ['glare'],
        ['rotated'],
        ['folded'],
        ['partial_crop'],
        ['low_light'],
    ])('surfaces a "%s" issue as a per-page warning and still grades the page', async (issue) => {
        mockPass1.mockResolvedValue(
            pageResult({
                imageQualityIssues: [issue],
                handwritingConfidence: 0.8, // readable → no re-shoot hint
            }),
        );
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion()]));

        const out = await gradeAssessment(baseInput());

        expect(out.imageQualityWarnings).toContain(`Page 1: ${issue}`);
        // A single legibility issue on an otherwise-readable page still grades.
        expect(out.status).toBe('graded');
        expect(out.questions).toHaveLength(1);
    });
});

describe('gradeAssessment — content-obscuring quality issues force review', () => {
    // Case 11 hardening, refined: a fold or a partial crop can physically hide/cut
    // off part of an answer — but that only matters when the model was itself
    // UNSURE of the grade. Blanket-flagging every question on a folded page buried
    // the confidently-graded correct answers alongside the one the fold actually
    // hurt, draining the review flag of signal. So the fold/crop force is now gated
    // on Pass-2 confidence: trust a confident grade, flag an unsure one.
    it.each([['folded'], ['partial_crop']])(
        'does NOT force review on a CONFIDENT grade from a "%s" page (fold landed elsewhere)',
        async (issue) => {
            mockPass1.mockResolvedValue(
                pageResult({ imageQualityIssues: [issue], handwritingConfidence: 0.85 }),
            );
            // Pass 2 read the answer with high confidence and did not ask for review.
            mockPass2.mockResolvedValue(
                scoringResult([gradedQuestion({ confidence: 0.95, needsTeacherReview: false })]),
            );

            const out = await gradeAssessment(baseInput());

            // The grade is trusted; the page issue is still surfaced as a warning.
            expect(out.questions[0].needsTeacherReview).toBe(false);
            expect(out.needsReviewCount).toBe(0);
            expect(out.imageQualityWarnings).toContain(`Page 1: ${issue}`);
        },
    );

    it.each([['folded'], ['partial_crop']])(
        'DOES force review on a LOW-confidence grade from a "%s" page (answer may be cut off)',
        async (issue) => {
            mockPass1.mockResolvedValue(
                pageResult({ imageQualityIssues: [issue], handwritingConfidence: 0.85 }),
            );
            // Pass 2 was itself unsure (below the 0.8 threshold) yet failed to set
            // the flag — a fold/crop on top of that is a real truncation risk.
            mockPass2.mockResolvedValue(
                scoringResult([gradedQuestion({ confidence: 0.5, needsTeacherReview: false })]),
            );

            const out = await gradeAssessment(baseInput());

            expect(out.questions[0].needsTeacherReview).toBe(true);
            expect(out.needsReviewCount).toBe(1);
        },
    );

    it.each([['rotated'], ['glare'], ['low_light']])(
        'does NOT force review for a "%s" page (visible/degraded, not truncated)',
        async (issue) => {
            mockPass1.mockResolvedValue(
                pageResult({ imageQualityIssues: [issue], handwritingConfidence: 0.85 }),
            );
            mockPass2.mockResolvedValue(
                scoringResult([gradedQuestion({ confidence: 0.95, needsTeacherReview: false })]),
            );

            const out = await gradeAssessment(baseInput());

            // These are surfaced as warnings (see the per-page-warning test) but
            // don't truncate content, so they don't override Pass-2's judgement.
            expect(out.questions[0].needsTeacherReview).toBe(false);
            expect(out.needsReviewCount).toBe(0);
        },
    );
});

describe('gradeAssessment — multiple students\' handwriting', () => {
    it('forces teacher review on questions from a page flagged multiple_handwriting', async () => {
        // Pass 1 detects two different hands on the page...
        mockPass1.mockResolvedValue(
            pageResult({ imageQualityIssues: ['multiple_handwriting'] }),
        );
        // ...and Pass 2 returns a CONFIDENT grade that does NOT set review itself.
        mockPass2.mockResolvedValue(
            scoringResult([gradedQuestion({ confidence: 0.95, needsTeacherReview: false })]),
        );

        const out = await gradeAssessment(baseInput());

        // The flow must override the model: a human has to confirm whose work
        // was graded, regardless of how confident Pass 2 was.
        expect(out.questions[0].needsTeacherReview).toBe(true);
        expect(out.needsReviewCount).toBe(1);
        // The flag is also surfaced as a per-page warning for the teacher.
        expect(out.imageQualityWarnings).toEqual(
            expect.arrayContaining(['Page 1: multiple_handwriting']),
        );
        expect(out.status).toBe('graded');
    });

    it('only forces review on the flagged page, leaving clean pages untouched', async () => {
        // Page 0 has mixed handwriting; page 1 is clean.
        const input = baseInput({ pageUrls: [DATA_URI, DATA_URI] });
        mockPass1.mockResolvedValue(
            batchResult(
                pageScan({ imageQualityIssues: ['multiple_handwriting'] }),
                pageScan({ pageIndex: 1, questions: [extractedQuestion({ questionId: 'p1-q1' })] }),
            ),
        );
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({ questionId: 'p0-q1', pageIndex: 0, needsTeacherReview: false }),
                gradedQuestion({ questionId: 'p1-q1', pageIndex: 1, needsTeacherReview: false }),
            ]),
        );

        const out = await gradeAssessment(input);

        const p0 = out.questions.find((q) => q.pageIndex === 0)!;
        const p1 = out.questions.find((q) => q.pageIndex === 1)!;
        expect(p0.needsTeacherReview).toBe(true);
        expect(p1.needsTeacherReview).toBe(false);
        expect(out.needsReviewCount).toBe(1);
    });
});

describe('gradeAssessment — under-read page (some questions missed)', () => {
    // A page where the model COUNTED more questions than it managed to EXTRACT is
    // a completeness gap — questions may be missing. That is surfaced to the
    // teacher as a page notice, NOT by flagging the questions that WERE read.
    // Flagging the read questions would bury the correct grades without helping
    // the teacher find the ones that were missed.
    it('surfaces a page notice but does NOT flag the confidently-graded questions', async () => {
        mockPass1.mockResolvedValue(
            pageResult({
                visibleQuestionCount: 3, // model saw ~3 questions...
                questions: [extractedQuestion({ questionId: 'p0-q1' })], // ...but only read 1
            }),
        );
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({ questionId: 'p0-q1', confidence: 0.95, needsTeacherReview: false }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        // The question we DID read was graded confidently → stays unflagged.
        expect(out.questions[0].needsTeacherReview).toBe(false);
        expect(out.needsReviewCount).toBe(0);
        // But the teacher is told the page was only partially read.
        expect(out.skippedPageNotices).toEqual(
            expect.arrayContaining([
                expect.stringContaining('only 1 of about 3 questions could be read'),
            ]),
        );
    });
});

describe('gradeAssessment — reconciles model over-flagging', () => {
    // On pilot (non-Math) subjects a cautious model routinely sets
    // needsTeacherReview: true on answers it ALSO graded as fully correct and
    // high-confidence — a self-contradiction that flags every question on a clean
    // 12/12 sheet and buries the flags that matter. When the model's own signals
    // unanimously say "correct and sure" (full marks, mistakePattern 'none',
    // confidence ≥ 0.8), the flag is noise and is cleared.
    it('clears the flag on a confident, full-mark, no-mistake answer the model over-flagged', async () => {
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(
            scoringResult([
                // Full marks (2/2), mistakePattern 'none', confident — yet flagged.
                gradedQuestion({ confidence: 0.95, mistakePattern: 'none', needsTeacherReview: true }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        expect(out.questions[0].needsTeacherReview).toBe(false);
        expect(out.needsReviewCount).toBe(0);
    });

    it('KEEPS the flag when the model was not confident (confidence < 0.8)', async () => {
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({ confidence: 0.6, mistakePattern: 'none', needsTeacherReview: true }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        // Genuine uncertainty (low confidence) on a full-mark answer stays flagged.
        expect(out.questions[0].needsTeacherReview).toBe(true);
        expect(out.needsReviewCount).toBe(1);
    });

    it('KEEPS the flag when marks are only partial (borderline partial-credit call)', async () => {
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({
                    marksAwarded: 1,
                    marksMax: 2,
                    confidence: 0.95,
                    mistakePattern: 'incomplete',
                    needsTeacherReview: true,
                }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        expect(out.questions[0].needsTeacherReview).toBe(true);
        expect(out.needsReviewCount).toBe(1);
    });

    it('does NOT override a deterministic trigger — attribution page keeps its forced flag', async () => {
        // multiple_handwriting forces review (whose work?); reconciliation must not
        // clear it even though the grade is confident + full marks.
        mockPass1.mockResolvedValue(
            pageResult({ imageQualityIssues: ['multiple_handwriting'] }),
        );
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({ confidence: 0.95, mistakePattern: 'none', needsTeacherReview: false }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        expect(out.questions[0].needsTeacherReview).toBe(true);
        expect(out.needsReviewCount).toBe(1);
    });

    it('does NOT override a deterministic trigger — a Pass-2 correction keeps its forced flag', async () => {
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(
            scoringResult([
                // Non-empty studentAnswer = a deliberate Pass-1 misread correction.
                gradedQuestion({
                    studentAnswer: 'corrected value',
                    confidence: 0.95,
                    mistakePattern: 'none',
                    needsTeacherReview: false,
                }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        expect(out.questions[0].needsTeacherReview).toBe(true);
        expect(out.needsReviewCount).toBe(1);
    });
});

describe('gradeAssessment — cover / title page', () => {
    /** A PageScan for a name/title/roll-number cover: no questions at all. */
    function coverPageScan(pageIndex = 0) {
        return pageScan({
            pageType: 'cover',
            questions: [],
            handwritingConfidence: 1,
            pageIndex,
        });
    }

    it('produces no phantom grades from a cover page and surfaces it as a cover (not "blank")', async () => {
        const input = baseInput({ pageUrls: [DATA_URI, DATA_URI] });
        // Page 0 is a name/title cover; page 1 has a real answered question.
        mockPass1.mockResolvedValue(
            batchResult(
                coverPageScan(0),
                pageScan({ pageIndex: 1, questions: [extractedQuestion({ questionId: 'p1-q1' })] }),
            ),
        );
        mockPass2.mockResolvedValue(
            scoringResult([gradedQuestion({ questionId: 'p1-q1', pageIndex: 1 })]),
        );

        const out = await gradeAssessment(input);

        // Only the real page is graded — the cover contributes no questions.
        expect(out.status).toBe('graded');
        expect(out.questions).toHaveLength(1);
        expect(out.questions[0].pageIndex).toBe(1);
        // The cover is surfaced (not silently dropped) and named as a cover.
        expect(out.skippedPageNotices).toEqual([
            expect.stringContaining('Page 1: cover/title page'),
        ]);
        // Pass 2 only ever saw the gradable page — the cover never reached it.
        const pass2Input = mockPass2.mock.calls[0][0] as { extractedPages: string };
        const graded = JSON.parse(pass2Input.extractedPages) as Array<{ pageIndex: number }>;
        expect(graded).toHaveLength(1);
        expect(graded[0].pageIndex).toBe(1);
    });
});

describe('gradeAssessment — question_only page (no answer space)', () => {
    it('re-scores question_only questions to 0/0 so they never count against the student', async () => {
        // A single question_only page: printed questions, nowhere to answer.
        mockPass1.mockResolvedValue(
            pageResult({
                pageType: 'question_only',
                questions: [
                    extractedQuestion({
                        isAttempted: false,
                        studentAnswerRaw: '',
                        studentAnswerInterpreted: '',
                    }),
                ],
            }),
        );
        // The model (following rule #5, not #8) hands back a default 0/2 that
        // WOULD drag the percentage down if we trusted it verbatim.
        mockPass2.mockResolvedValue(
            scoringResult([gradedQuestion({ marksAwarded: 0, marksMax: 2 })]),
        );

        const out = await gradeAssessment(baseInput());

        // Deterministically re-scored to 0/0 — visible in questions[], not
        // dropped, and excluded from the total (no divide-by-zero either).
        expect(out.questions).toHaveLength(1);
        expect(out.questions[0].marksMax).toBe(0);
        expect(out.questions[0].marksAwarded).toBe(0);
        expect(out.totalMaxMarks).toBe(0);
        expect(out.scorePct).toBe(0);
    });

    it('excludes only the question_only page, still scoring the answered page fairly', async () => {
        // Page 0 = question_only (must be 0/0); page 1 = a real answered question.
        const input = baseInput({ pageUrls: [DATA_URI, DATA_URI] });
        mockPass1.mockResolvedValue(
            batchResult(
                pageScan({
                    pageType: 'question_only',
                    questions: [extractedQuestion({ questionId: 'p0-q1', isAttempted: false })],
                }),
                pageScan({ pageIndex: 1, questions: [extractedQuestion({ questionId: 'p1-q1' })] }),
            ),
        );
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({ questionId: 'p0-q1', pageIndex: 0, marksAwarded: 0, marksMax: 2 }),
                gradedQuestion({ questionId: 'p1-q1', pageIndex: 1, marksAwarded: 2, marksMax: 2 }),
            ]),
        );

        const out = await gradeAssessment(input);

        const p0 = out.questions.find((q) => q.pageIndex === 0)!;
        const p1 = out.questions.find((q) => q.pageIndex === 1)!;
        expect(p0.marksMax).toBe(0);
        expect(p0.marksAwarded).toBe(0);
        expect(p1.marksMax).toBe(2);
        // Total reflects ONLY the answered page: 2/2 = 100%, not 2/4 = 50%.
        expect(out.totalAwardedMarks).toBe(2);
        expect(out.totalMaxMarks).toBe(2);
        expect(out.scorePct).toBe(100);
    });
});

describe('gradeAssessment — totalMaxMarks override vs inferred sum', () => {
    it('uses the supplied totalMaxMarks override instead of the inferred per-question sum', async () => {
        mockPass1.mockResolvedValue(pageResult());
        // The graded question sums to marksMax 10, but the teacher declared the
        // paper is out of 20 → the override must win the denominator.
        mockPass2.mockResolvedValue(
            scoringResult([gradedQuestion({ marksAwarded: 8, marksMax: 10 })]),
        );

        const out = await gradeAssessment(baseInput({ totalMaxMarks: 20 }));

        expect(out.totalMaxMarks).toBe(20);
        expect(out.totalAwardedMarks).toBe(8);
        expect(out.scorePct).toBe(40); // 8 / 20, NOT 8 / 10
    });

    it('infers totalMaxMarks as the sum of per-question marksMax when omitted', async () => {
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({ questionId: 'p0-q1', marksAwarded: 3, marksMax: 5 }),
                gradedQuestion({ questionId: 'p0-q2', marksAwarded: 2, marksMax: 5 }),
            ]),
        );

        const out = await gradeAssessment(baseInput()); // no totalMaxMarks

        expect(out.totalMaxMarks).toBe(10); // 5 + 5
        expect(out.totalAwardedMarks).toBe(5); // 3 + 2
        expect(out.scorePct).toBe(50);
    });

    it('guards against divide-by-zero: scorePct is 0 (not NaN) when totalMaxMarks resolves to 0', async () => {
        mockPass1.mockResolvedValue(pageResult());
        // Every question is worth 0 (e.g. an all-question_only scan) and no
        // override was supplied → inferred max is 0. Without the `> 0` guard
        // this would be 0/0 = NaN, which fails the output schema's scorePct.min(0).
        mockPass2.mockResolvedValue(
            scoringResult([gradedQuestion({ marksAwarded: 0, marksMax: 0 })]),
        );

        const out = await gradeAssessment(baseInput()); // no totalMaxMarks

        expect(out.totalMaxMarks).toBe(0);
        expect(out.scorePct).toBe(0);
    });
});

describe('multi-part question — 1(a)/1(b)/1(c) (Case 19)', () => {
    it('Pass-1 is told to split multi-part questions into per-sub-part entries with stable ids', () => {
        const p1 = mockPromptDefs?.['assessmentScannerPass1']?.prompt ?? '';
        expect(p1).toContain('multi-part');
        expect(p1).toContain('one entry per sub-part');
        expect(p1).toContain('p<pageIndex>-q1a');
    });

    it('grades each sub-part independently and preserves all three (no collapse/merge)', async () => {
        mockPass1.mockResolvedValue(
            pageResult({
                questions: [
                    extractedQuestion({ questionId: 'p0-q1a', questionText: '1(a)' }),
                    extractedQuestion({ questionId: 'p0-q1b', questionText: '1(b)' }),
                    extractedQuestion({ questionId: 'p0-q1c', questionText: '1(c)' }),
                ],
            }),
        );
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({ questionId: 'p0-q1a', marksAwarded: 2, marksMax: 2 }),
                gradedQuestion({ questionId: 'p0-q1b', marksAwarded: 0, marksMax: 2 }),
                gradedQuestion({ questionId: 'p0-q1c', marksAwarded: 1, marksMax: 2 }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        expect(out.questions).toHaveLength(3);
        expect(out.questions.map((q) => q.questionId)).toEqual(['p0-q1a', 'p0-q1b', 'p0-q1c']);
        // The middle sub-part scored 0 without dragging the others down; totals
        // are the independent sum of all three sub-parts.
        expect(out.questions.map((q) => q.marksAwarded)).toEqual([2, 0, 1]);
        expect(out.totalAwardedMarks).toBe(3);
        expect(out.totalMaxMarks).toBe(6);
        expect(out.scorePct).toBe(50);
    });
});

describe('nothing silently dropped (Case 27)', () => {
    it('Pass-2 is told to reuse the extracted questionId verbatim', () => {
        const p2 = mockPromptDefs?.['assessmentScannerPass2']?.prompt ?? '';
        expect(p2).toContain('reuse its exact `questionId`');
    });

    it('surfaces a placeholder for a question Pass 2 dropped — flagged for review, not counted', async () => {
        (logger.warn as jest.Mock).mockClear();
        mockPass1.mockResolvedValue(
            pageResult({
                questions: [
                    extractedQuestion({ questionId: 'p0-q1', questionText: 'Q1' }),
                    extractedQuestion({
                        questionId: 'p0-q2',
                        questionText: 'Q2',
                        studentAnswerInterpreted: 'ans2',
                    }),
                    extractedQuestion({ questionId: 'p0-q3', questionText: 'Q3' }),
                ],
            }),
        );
        // Pass 2 grades q1 and q3 but DROPS q2.
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({ questionId: 'p0-q1', marksAwarded: 2, marksMax: 2 }),
                gradedQuestion({ questionId: 'p0-q3', marksAwarded: 2, marksMax: 2 }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        // All three extracted questions surface — nothing vanished.
        expect(out.questions).toHaveLength(3);
        const q2 = out.questions.find((q) => q.questionId === 'p0-q2')!;
        expect(q2.needsTeacherReview).toBe(true);
        expect(q2.marksAwarded).toBe(0);
        expect(q2.marksMax).toBe(0);
        expect(q2.studentAnswer).toBe('ans2'); // carried from Pass-1 extraction
        expect(q2.feedback).toMatch(/not graded automatically/i);
        // The placeholder is 0/0, so totals reflect only the two graded
        // questions: 4/4 = 100%, NOT 4/6 = 67%.
        expect(out.totalAwardedMarks).toBe(4);
        expect(out.totalMaxMarks).toBe(4);
        expect(out.scorePct).toBe(100);
        expect(out.needsReviewCount).toBe(1);
        // The silent drop is logged for observability.
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('fewer questions than extracted'),
            'ASSESSMENT',
            expect.objectContaining({ extracted: 3, graded: 2, dropped: 1 }),
        );
    });

    it('adds no placeholders when Pass 2 grades every extracted question', async () => {
        (logger.warn as jest.Mock).mockClear();
        mockPass1.mockResolvedValue(
            pageResult({
                questions: [
                    extractedQuestion({ questionId: 'p0-q1' }),
                    extractedQuestion({ questionId: 'p0-q2' }),
                ],
            }),
        );
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({ questionId: 'p0-q1' }),
                gradedQuestion({ questionId: 'p0-q2' }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        expect(out.questions).toHaveLength(2);
        // No placeholder feedback, no drop warning.
        expect(logger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining('fewer questions than extracted'),
            expect.anything(),
            expect.anything(),
        );
    });
});

describe('gradeAssessment — question-order stability (Case 22)', () => {
    it('sorts graded questions by pageIndex then question number, whatever order Pass 2 returns', async () => {
        const input = baseInput({ pageUrls: [DATA_URI, DATA_URI] });
        mockPass1.mockResolvedValue(
            batchResult(
                pageScan({
                    questions: [
                        extractedQuestion({ questionId: 'p0-q1' }),
                        extractedQuestion({ questionId: 'p0-q2' }),
                    ],
                }),
                pageScan({
                    pageIndex: 1,
                    questions: [
                        extractedQuestion({ questionId: 'p1-q1' }),
                        extractedQuestion({ questionId: 'p1-q2' }),
                    ],
                }),
            ),
        );
        // Pass 2 returns them SHUFFLED across pages.
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({ questionId: 'p1-q2', pageIndex: 1 }),
                gradedQuestion({ questionId: 'p0-q2', pageIndex: 0 }),
                gradedQuestion({ questionId: 'p1-q1', pageIndex: 1 }),
                gradedQuestion({ questionId: 'p0-q1', pageIndex: 0 }),
            ]),
        );

        const out = await gradeAssessment(input);

        expect(out.questions.map((q) => q.questionId)).toEqual([
            'p0-q1',
            'p0-q2',
            'p1-q1',
            'p1-q2',
        ]);
    });

    it('orders within a page numerically (q2 before q10), not lexically', async () => {
        const ids = Array.from({ length: 11 }, (_, i) => `p0-q${i + 1}`);
        mockPass1.mockResolvedValue(
            pageResult({ questions: ids.map((id) => extractedQuestion({ questionId: id })) }),
        );
        // Pass 2 returns them reversed.
        mockPass2.mockResolvedValue(
            scoringResult(
                [...ids].reverse().map((id) => gradedQuestion({ questionId: id, pageIndex: 0 })),
            ),
        );

        const out = await gradeAssessment(baseInput());

        // q1, q2, …, q10, q11 — NOT the lexical q1, q10, q11, q2, …
        expect(out.questions.map((q) => q.questionId)).toEqual(ids);
    });
});

describe('gradeAssessment — fully illegible scan', () => {
    it('throws AssessmentEmptyExtractionError when every page is unreadable', async () => {
        // Every page comes back unreadable with nothing extracted...
        mockPass1.mockResolvedValue(
            pageResult({ pageType: 'unreadable', questions: [], handwritingConfidence: 0 }),
        );
        // ...and Pass 2 has nothing to grade.
        mockPass2.mockResolvedValue(scoringResult([]));

        const err = await gradeAssessment(baseInput()).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(AssessmentEmptyExtractionError);
        expect(err).toMatchObject({ code: 'EMPTY_EXTRACTION' });
    });
});

describe('gradeAssessment — Pass-1 quota exhaustion', () => {
    it('propagates a 429/quota failure as-is (503) instead of mislabelling it as an unreadable/empty scan', async () => {
        // runResiliently (mocked to a single pass-through call) surfaces the
        // real AIQuotaExhaustedError once the key pool is exhausted. Shape it by
        // name + status so the flow's duck-typed guard recognises it.
        const quotaErr = Object.assign(
            new Error('AI service is temporarily overloaded. Please try again in a minute.'),
            { name: 'AIQuotaExhaustedError', status: 503, retryAfterSeconds: 60 },
        );
        mockPass1.mockRejectedValue(quotaErr);

        // Must NOT be swallowed into "re-upload clearer photos" — a quota limit
        // is transient infra, not an unreadable page.
        const err = await gradeAssessment(baseInput()).catch((e: unknown) => e);
        expect(err).not.toBeInstanceOf(AssessmentEmptyExtractionError);
        expect(err).toMatchObject({ name: 'AIQuotaExhaustedError', status: 503 });
        // Nothing gradable was ever extracted, so Pass 2 must never be reached.
        expect(mockPass2).not.toHaveBeenCalled();
    });
});

describe('gradeAssessment — corrupt / unsupported image (Gemini bad-media)', () => {
    /** The Gemini SDK error shape for a rejected input image. */
    function badMediaError() {
        return new Error(
            '[GoogleGenerativeAI Error]: Unable to process input image. Please retry with a valid image.',
        );
    }

    it('propagates the raw bad-media error (→ 400 INVALID_MEDIA) instead of masking it as EMPTY_EXTRACTION', async () => {
        // Pass 1 throws Gemini's "Unable to process input image" for the only page.
        mockPass1.mockRejectedValue(badMediaError());

        // Must NOT be swallowed into our EMPTY_EXTRACTION (which logs ERROR and
        // pages on-call) — a corrupt upload is a client problem, surfaced as the
        // model's own bad-media error so the route maps it to 400 INVALID_MEDIA.
        const err = await gradeAssessment(baseInput()).catch((e: unknown) => e);
        expect(err).not.toBeInstanceOf(AssessmentEmptyExtractionError);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/Unable to process input image/);
        expect(mockPass2).not.toHaveBeenCalled();
    });

    it('still grades the readable pages when only ONE page of a multi-page scan is corrupt', async () => {
        // Page 0 is a valid image; page 1 is a corrupt/undecodable file. With
        // single-call Pass 1, the corrupt page is caught by up-front validation
        // and flagged unreadable BEFORE the model call, so the one call only ever
        // sees the good page — the corrupt page can't fail the whole batch.
        const input = baseInput({ pageUrls: [DATA_URI, CORRUPT_URI] });
        mockPass1.mockResolvedValue(pageResult()); // called once, with page 0 only
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion()]));

        const out = await gradeAssessment(input);

        // Graceful degradation: the good page is graded, the scan is 'partial',
        // and the corrupt page does NOT fail the whole request.
        expect(out.status).toBe('partial');
        expect(out.questions).toHaveLength(1);
        expect(mockPass2).toHaveBeenCalledTimes(1);
        // The single Pass-1 call only received the valid image.
        const pass1Input = mockPass1.mock.calls[0][0] as {
            pages: Array<{ pageIndex: number }>;
        };
        expect(pass1Input.pages).toHaveLength(1);
        expect(pass1Input.pages[0].pageIndex).toBe(0);
    });
});

describe('gradeAssessment — unreachable page URL', () => {
    it('throws AssessmentPageUnreadableError naming the 1-based page number', async () => {
        // Page 1 is a data URI (no fetch); page 2 is a Storage URL that 404s.
        const input = baseInput({
            pageUrls: [
                DATA_URI,
                'https://firebasestorage.googleapis.com/v0/b/test/o/page2.jpg',
            ],
        });
        mockFetchImageAsBase64.mockImplementation(async (url: string) => {
            if (url.startsWith('http')) {
                throw new Error('404 Not Found (expired download token)');
            }
            return url;
        });
        // Page 1 extracts fine; the flow should still surface the page-2 fetch
        // failure rather than silently grading a partial scan.
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion()]));

        const err = await gradeAssessment(input).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(AssessmentPageUnreadableError);
        expect(err).toMatchObject({ code: 'PAGE_UNREADABLE', pageNumber: 2 });
    });
});

describe('gradeAssessment — partial degradation', () => {
    it('marks the scan partial when a page cannot be read (fan-out: that page returns empty)', async () => {
        const input = baseInput({ pageUrls: [DATA_URI, DATA_URI] });
        // Fan-out calls Pass-1 once per page. Page 0 reads fine; page 1's own call
        // comes back with no pages (empty / truncated response), so it degrades to
        // an unreadable placeholder. The readable page still grades and nothing is
        // silently dropped, but the overall status flags the lost page.
        mockPass1.mockImplementation((promptInput: unknown) => {
            const pageIndex = (promptInput as { pages: Array<{ pageIndex: number }> })
                .pages[0].pageIndex;
            return Promise.resolve(pageIndex === 0 ? batchResult(pageScan()) : batchResult());
        });
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion()]));

        const out = await gradeAssessment(input);

        // The readable page's question is still graded, but the overall status
        // flags that a page was lost.
        expect(out.status).toBe('partial');
        expect(out.pageCount).toBe(2);
        expect(out.questions).toHaveLength(1);
        expect(out.totalAwardedMarks).toBe(2);
    });
});

describe('gradeAssessment — Pass 2 chunks only large papers (single call otherwise)', () => {
    // Pass 2 grades every question the same way regardless of chunking; the merge
    // must lose nothing and page order must be preserved. Pass 2 echoes back the
    // ids it was given so aggregate()'s id-based merge reassembles the full set.
    const gradeByEchoingIds = (promptInput: unknown) => {
        const chunkPages = JSON.parse(
            (promptInput as { extractedPages: string }).extractedPages,
        ) as Array<{ pageIndex: number; questions: Array<{ questionId: string }> }>;
        const graded = chunkPages.flatMap((p) =>
            p.questions.map((q) =>
                gradedQuestion({ questionId: q.questionId, pageIndex: p.pageIndex }),
            ),
        );
        return Promise.resolve(scoringResult(graded));
    };
    const fanOutPass1ByPage = (makePage: (idx: number) => Record<string, unknown>) =>
        mockPass1.mockImplementation((promptInput: unknown) => {
            const idx = (promptInput as { pages: Array<{ pageIndex: number }> })
                .pages[0].pageIndex;
            return Promise.resolve(batchResult(makePage(idx)));
        });

    it('grades a small paper (≤ threshold) in a SINGLE Pass-2 call', async () => {
        // 1 page × 10 questions = 10 ≤ 12 → one call, no chunking.
        fanOutPass1ByPage((idx) =>
            pageScan({
                pageIndex: idx,
                questions: Array.from({ length: 10 }, (_, i) =>
                    extractedQuestion({ questionId: `p${idx}-q${i + 1}` }),
                ),
            }),
        );
        mockPass2.mockImplementation(gradeByEchoingIds);

        const out = await gradeAssessment(baseInput({ pageUrls: [DATA_URI] }));

        expect(mockPass2).toHaveBeenCalledTimes(1);
        expect(out.questions).toHaveLength(10);
        expect(out.status).toBe('graded');
    });

    it('splits a large paper (> threshold) into multiple concurrent Pass-2 calls and merges every question', async () => {
        // 3 pages × 10 questions = 30 > 12 → chunked into multiple calls.
        fanOutPass1ByPage((idx) =>
            pageScan({
                pageIndex: idx,
                questions: Array.from({ length: 10 }, (_, i) =>
                    extractedQuestion({ questionId: `p${idx}-q${i + 1}` }),
                ),
            }),
        );
        mockPass2.mockImplementation(gradeByEchoingIds);

        const out = await gradeAssessment(
            baseInput({ pageUrls: [DATA_URI, DATA_URI, DATA_URI] }),
        );

        // More than one Pass-2 call, and nothing lost in the merge.
        expect(mockPass2.mock.calls.length).toBeGreaterThan(1);
        expect(out.questions).toHaveLength(30);
        expect(out.status).toBe('graded');
    });
});

describe('Pass2OutputSchema — chunk that omits studentRecommendations', () => {
    // Regression: `studentRecommendations` is a holistic, whole-paper field. When
    // a large paper is scored in concurrent chunks, a mid-paper chunk routinely
    // returns only `{ questions: [...] }` and omits it. This is the exact shape
    // that used to make Genkit's strict structured-output parse throw
    //   "(root): must have required property 'studentRecommendations'"
    // and 500 the whole scan. `.default([])` must make the field non-required at
    // the schema level so such a chunk parses cleanly (see Pass2OutputSchema).
    const chunkQuestion = {
        questionId: 'p4-q25a',
        pageIndex: 4,
        expectedAnswer: '',
        marksAwarded: 2,
        marksMax: 2,
        partialCreditBreakdown: [],
        conceptTested: 'Chemical Equations',
        ncertChapterId: 'Chemical Reactions and Equations',
        mistakePattern: 'none' as const,
        needsTeacherReview: false,
        confidence: 1,
    };

    it('parses (does not throw) and defaults studentRecommendations to []', () => {
        const parsed = Pass2OutputSchema.parse({ questions: [chunkQuestion] });
        expect(parsed.studentRecommendations).toEqual([]);
        // teacherParentNote already defaulted; assert it still does (guards against
        // a regression that removes the sibling default this fix mirrors).
        expect(parsed.teacherParentNote).toEqual([]);
        expect(parsed.questions).toHaveLength(1);
    });

    it('preserves studentRecommendations when the chunk does supply them', () => {
        const parsed = Pass2OutputSchema.parse({
            questions: [chunkQuestion],
            studentRecommendations: ['Revise chemical equations.'],
        });
        expect(parsed.studentRecommendations).toEqual(['Revise chemical equations.']);
    });
});

describe('Pass2OutputSchema — last question with a truncated trailing tail', () => {
    // Regression for the 358s/500 failure: gemini-2.5-flash returned COMPLETE,
    // valid JSON for all questions but clipped the LAST one after the marks,
    // omitting mistakePattern / needsTeacherReview / confidence. Genkit rejected
    // the whole array ("questions.11: must have required property 'mistakePattern'")
    // and the flow re-graded the entire paper 3× before 500-ing. Defaulting the
    // trailing scoring-metadata fields must let the clipped tail parse while
    // KEEPING the marks, so the scan succeeds instead of failing wholesale.
    const fullQuestion = {
        questionId: 'p4-q25a',
        pageIndex: 4,
        expectedAnswer: '',
        marksAwarded: 2,
        marksMax: 2,
        partialCreditBreakdown: [],
        conceptTested: 'Chemical Equations',
        ncertChapterId: 'Chemical Reactions and Equations',
        mistakePattern: 'none' as const,
        needsTeacherReview: false,
        confidence: 1,
    };
    // The exact truncated shape from the log: marks present, trailing metadata gone.
    const truncatedTail = {
        questionId: 'p5-q29a',
        pageIndex: 5,
        expectedAnswer: '',
        marksAwarded: 5,
        marksMax: 5,
        partialCreditBreakdown: [{ step: 'Identify compound P', earned: 1, max: 1 }],
        conceptTested: 'Carbon Compounds',
        // mistakePattern / needsTeacherReview / confidence / ncertChapterId all clipped
    };

    it('parses and defaults the missing trailing fields, keeping the marks', () => {
        const parsed = Pass2OutputSchema.parse({
            questions: [fullQuestion, truncatedTail],
        });
        expect(parsed.questions).toHaveLength(2);
        const last = parsed.questions[1];
        // Marks — the part that matters — are preserved verbatim.
        expect(last.marksAwarded).toBe(5);
        expect(last.marksMax).toBe(5);
        // A clipped tail parses (no crash) but the MISSING review/confidence
        // fields signal genuine uncertainty: the grade is kept, yet the question
        // is flagged for review at zero confidence rather than shown as confident.
        // (Content-only fields still fall back to neutral defaults.)
        expect(last.mistakePattern).toBeNull();
        expect(last.needsTeacherReview).toBe(true);
        expect(last.confidence).toBe(0);
        expect(last.ncertChapterId).toBeNull();
    });

    it('still fails a question missing the marks themselves (cannot salvage a grade)', () => {
        // A question clipped BEFORE its marks can't be graded — this must remain a
        // hard parse failure so it falls through to the truncation-retry path.
        expect(() =>
            Pass2OutputSchema.parse({
                questions: [{ questionId: 'p1-q1', pageIndex: 0 }],
            }),
        ).toThrow();
    });
});

describe('computePass2TokenBudget — maxOutputTokens must cover the thinking budget', () => {
    // gemini-2.5-flash meters thinking tokens + visible tokens against the SAME
    // maxOutputTokens pool. Regression: for an essay-heavy chunk the thinking
    // budget could exceed a maxOutputTokens sized from question count alone, so
    // the model spent its whole allowance thinking and truncated the JSON
    // mid-question ("questions.2: must have required property 'conceptTested'").
    // The output ceiling must always leave room for the JSON ON TOP of thinking.
    const heavyPage = (n: number, marks: number) =>
        pageScan({
            questions: Array.from({ length: n }, (_, i) =>
                extractedQuestion({
                    questionId: `q${i + 1}`,
                    questionType: 'long_answer',
                    marksAvailable: marks,
                }),
            ),
        });

    it('leaves visible-JSON headroom beyond thinkingBudget for an essay-heavy chunk', () => {
        // 6 × 6-mark long answers — the shape that used to truncate: old formula
        // gave maxOutputTokens = max(8192, 900*6) = 8192, but thinkingBudget = 8640.
        const { thinkingBudget, maxOutputTokens } = computePass2TokenBudget([heavyPage(6, 6)]);
        expect(thinkingBudget).toBeGreaterThan(8192); // would have exceeded the old ceiling
        // New ceiling covers thinking AND the full visible-JSON floor (8192).
        expect(maxOutputTokens).toBeGreaterThanOrEqual(thinkingBudget + 8192);
        expect(maxOutputTokens).toBeLessThanOrEqual(PASS2_OUTPUT_TOKEN_CAP);
    });

    it('holds the invariant maxOutputTokens > thinkingBudget across chunk shapes', () => {
        const shapes = [
            [heavyPage(1, 1)], // light single question
            [heavyPage(15, 6)], // max chunk, all heavy
            [pageScan({ questions: [extractedQuestion({ questionType: 'mcq' })] })], // trivial
        ];
        for (const pages of shapes) {
            const { thinkingBudget, maxOutputTokens } = computePass2TokenBudget(pages);
            expect(maxOutputTokens).toBeGreaterThan(thinkingBudget);
            expect(maxOutputTokens).toBeLessThanOrEqual(PASS2_OUTPUT_TOKEN_CAP);
        }
    });
});

describe('gradeAssessment — Pass-2 retries a truncated/invalid response', () => {
    it('retries the chunk on a schema-validation failure, then grades successfully', async () => {
        mockPass1.mockResolvedValue(pageResult());
        let calls = 0;
        // First generation returns truncated JSON (Genkit throws a schema-validation
        // error); the retry returns a complete, valid response.
        mockPass2.mockImplementation(() => {
            calls += 1;
            if (calls === 1) {
                return Promise.reject(
                    new Error(
                        'INVALID_ARGUMENT: Schema validation failed. Parse Errors: questions.0: must have required property \'conceptTested\'',
                    ),
                );
            }
            return Promise.resolve(scoringResult([gradedQuestion()]));
        });

        const out = await gradeAssessment(baseInput());

        expect(mockPass2).toHaveBeenCalledTimes(2); // failed once → retried → succeeded
        expect(out.status).toBe('graded');
        expect(out.questions).toHaveLength(1);
    });

    it('escalates maxOutputTokens to the model cap on retry (does not repeat identical params)', async () => {
        mockPass1.mockResolvedValue(pageResult());
        let calls = 0;
        mockPass2.mockImplementation(() => {
            calls += 1;
            if (calls === 1) {
                return Promise.reject(
                    new Error('INVALID_ARGUMENT: Schema validation failed. Parse Errors: questions.0'),
                );
            }
            return Promise.resolve(scoringResult([gradedQuestion()]));
        });

        await gradeAssessment(baseInput());

        // The genkit mock forwards the call-time config as the 2nd arg:
        // scoringPrompt(input, { config: { maxOutputTokens, ... } }).
        const firstCeiling = (mockPass2.mock.calls[0][1] as { config: { maxOutputTokens: number } })
            .config.maxOutputTokens;
        const retryCeiling = (mockPass2.mock.calls[1][1] as { config: { maxOutputTokens: number } })
            .config.maxOutputTokens;
        // Attempt 0 uses the content-scaled ceiling; the retry escalates strictly
        // higher, up to the model max — so a truncation gets more room, not a repeat.
        expect(retryCeiling).toBe(PASS2_OUTPUT_TOKEN_CAP);
        expect(retryCeiling).toBeGreaterThan(firstCeiling);
    });

    it('retries when a chunk grades FEWER questions than extracted (thinking spiral), then completes', async () => {
        // The 946b0431 failure: valid JSON but only 3 of 12 graded because the
        // model's thinking spiralled and ate the shared output budget. That path
        // threw no error, so the old retry (schema-error only) never fired and the
        // paper dropped questions → 422. Now an incomplete result also retries.
        mockPass1.mockResolvedValue(
            pageResult({
                questions: Array.from({ length: 5 }, (_, i) =>
                    extractedQuestion({ questionId: `p0-q${i + 1}` }),
                ),
            }),
        );
        let calls = 0;
        mockPass2.mockImplementation(() => {
            calls += 1;
            if (calls === 1) {
                // Incomplete: only 2 of 5 graded (valid JSON, just short).
                return Promise.resolve(
                    scoringResult([
                        gradedQuestion({ questionId: 'p0-q1' }),
                        gradedQuestion({ questionId: 'p0-q2' }),
                    ]),
                );
            }
            return Promise.resolve(
                scoringResult(
                    Array.from({ length: 5 }, (_, i) =>
                        gradedQuestion({ questionId: `p0-q${i + 1}` }),
                    ),
                ),
            );
        });

        const out = await gradeAssessment(baseInput());

        expect(mockPass2).toHaveBeenCalledTimes(2); // incomplete → retried → complete
        expect(out.questions).toHaveLength(5); // every question graded, none dropped
        expect(out.status).toBe('graded');
        // The retry caps thinking (so it can't spiral again) and hands the model
        // the whole output ceiling.
        const retryCfg = (
            mockPass2.mock.calls[1][1] as {
                config: { thinkingConfig: { thinkingBudget: number }; maxOutputTokens: number };
            }
        ).config;
        expect(retryCfg.maxOutputTokens).toBe(PASS2_OUTPUT_TOKEN_CAP);
        expect(retryCfg.thinkingConfig.thinkingBudget).toBeLessThanOrEqual(2048);
    });
});

describe('gradeAssessment — idempotent re-submit (Case 31)', () => {
    // Re-submitting the same assessmentId must return the previously-persisted
    // grade from the idempotency store WITHOUT re-running either model pass —
    // otherwise a double-tap / retry burns AI quota and risks a divergent grade.
    it('returns the cached grade on a re-submitted assessmentId without re-running the model', async () => {
        const cached = {
            assessmentId: VALID_UUID,
            status: 'graded' as const,
            pageCount: 1,
            totalAwardedMarks: 8,
            totalMaxMarks: 10,
            scorePct: 80,
            letterGrade: 'A',
            questions: [],
            classAverageAtScan: null,
            conceptMastery: [],
            recommendedNextSteps: [],
            studentRecommendations: [],
            needsReviewCount: 0,
            imageQualityWarnings: [],
            skippedPageNotices: [],
        };
        // Override the default (exists:false) idempotency store for ONE call so
        // the Firestore doc exists with a graded assessment-submission payload.
        // The chain mirrors checkIdempotency:
        // users/{uid}/content/{assessmentId}.get().
        (getDb as jest.Mock).mockResolvedValueOnce({
            collection: () => ({
                doc: () => ({
                    collection: () => ({
                        doc: () => ({
                            get: async () => ({
                                exists: true,
                                data: () => ({ type: 'assessment-submission', data: cached }),
                            }),
                        }),
                    }),
                }),
            }),
        });

        const out = await gradeAssessment(baseInput());

        // Served verbatim from cache, before either model pass runs.
        expect(out).toEqual(cached);
        expect(mockPass1).not.toHaveBeenCalled();
        expect(mockPass2).not.toHaveBeenCalled();
    });

    it('re-grades on a cache miss (no prior submission for this id)', async () => {
        // Default getDb mock → doc.exists === false → not a cache hit, so both
        // passes run. Proves the idempotency short-circuit is scoped to real hits
        // and doesn't accidentally suppress fresh grading.
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion()]));

        const out = await gradeAssessment(baseInput());

        expect(out.status).toBe('graded');
        expect(mockPass1).toHaveBeenCalledTimes(1);
        expect(mockPass2).toHaveBeenCalledTimes(1);
    });
});

describe('gradeAssessment — persistence failure (soft-fail)', () => {
    it('still resolves with the graded result when saveContent throws', async () => {
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion()]));
        // Firestore outage during the fire-and-forget persist().
        (dbAdapter.saveContent as jest.Mock).mockRejectedValueOnce(
            new Error('Firestore unavailable (DEADLINE_EXCEEDED)'),
        );

        const out = await gradeAssessment(baseInput());

        // The teacher still gets their grade — persistence is best-effort and
        // must never block or fail the user-visible response. The only cost is
        // that this run won't show up in My Library.
        expect(out.status).toBe('graded');
        expect(out.questions).toHaveLength(1);
        expect(out.totalAwardedMarks).toBe(2);

        // ...and the failure is logged (not silently swallowed). persist() is
        // fire-and-forget, so flush pending microtasks/ticks before asserting.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(logger.error).toHaveBeenCalledWith(
            'Assessment Scanner: persistence failed',
            expect.any(Error),
            'ASSESSMENT_SCANNER',
            expect.objectContaining({ assessmentId: VALID_UUID }),
        );
    });
});

describe('gradeAssessment — Q&A echo removal (Pass 2 merged from Pass 1, correctable)', () => {
    it('Pass-2 prompt tells the model NOT to re-print questionText/studentAnswer, with a correction override', () => {
        const p2 = mockPromptDefs?.['assessmentScannerPass2']?.prompt ?? '';
        expect(p2).toContain('Do NOT re-print');
        expect(p2).toContain('questionText');
        expect(p2).toMatch(/CORRECT a clear Pass-1 misread/i);
        expect(p2).toContain('needsTeacherReview');
    });

    it('fills questionText + studentAnswer from the Pass-1 extraction when Pass 2 leaves them empty', async () => {
        mockPass1.mockResolvedValue(
            batchResult(
                pageScan({
                    questions: [
                        extractedQuestion({
                            questionId: 'p0-q1',
                            questionText: 'Define photosynthesis.',
                            studentAnswerInterpreted: 'Plants make food using sunlight.',
                        }),
                    ],
                }),
            ),
        );
        // Pass 2 grades it but OMITS questionText/studentAnswer (the new default).
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion({ questionId: 'p0-q1' })]));

        const out = await gradeAssessment(baseInput());

        const q = out.questions[0];
        expect(q.questionText).toBe('Define photosynthesis.'); // merged from Pass 1
        expect(q.studentAnswer).toBe('Plants make food using sunlight.'); // merged from Pass 1
        expect(q.needsTeacherReview).toBe(false); // no correction → no forced review
    });

    it('lets Pass 2 OVERRIDE a Pass-1 misread and the correction wins', async () => {
        mockPass1.mockResolvedValue(
            batchResult(
                pageScan({
                    questions: [
                        extractedQuestion({ questionId: 'p0-q1', studentAnswerInterpreted: 'l0' }),
                    ],
                }),
            ),
        );
        // Pass 2 corrects the misread "l0" → "10" and flags review per the prompt.
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({ questionId: 'p0-q1', studentAnswer: '10', needsTeacherReview: true }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        expect(out.questions[0].studentAnswer).toBe('10'); // correction wins over Pass 1
        expect(out.questions[0].needsTeacherReview).toBe(true);
    });

    it('defensively forces review on a correction even if Pass 2 forgot the flag', async () => {
        mockPass1.mockResolvedValue(
            batchResult(pageScan({ questions: [extractedQuestion({ questionId: 'p0-q1' })] })),
        );
        // Pass 2 supplies a corrected questionText but (wrongly) leaves review false.
        mockPass2.mockResolvedValue(
            scoringResult([
                gradedQuestion({
                    questionId: 'p0-q1',
                    questionText: 'Corrected question stem',
                    needsTeacherReview: false,
                }),
            ]),
        );

        const out = await gradeAssessment(baseInput());

        expect(out.questions[0].questionText).toBe('Corrected question stem');
        expect(out.questions[0].needsTeacherReview).toBe(true); // forced by the merge
    });
});

describe('gradeAssessment — weighted Pass-2 thinking budget (by question TYPE)', () => {
    /** The Pass-2 call-time thinkingBudget the flow computed for this scan. */
    async function budgetFor(questions: Array<Record<string, unknown>>): Promise<number> {
        mockPass1.mockResolvedValue(batchResult(pageScan({ questions })));
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion({ questionId: 'p0-q1' })]));
        await gradeAssessment(baseInput());
        const cfg = (mockPass2.mock.calls[0][1] as { config: { thinkingConfig: { thinkingBudget: number }; maxOutputTokens: number } }).config;
        return cfg.thinkingConfig.thinkingBudget;
    }

    it('gives an essay-heavy paper a bigger budget than an MCQ-heavy paper of the SAME question count', async () => {
        const fiveMcq = Array.from({ length: 5 }, (_, i) =>
            extractedQuestion({ questionId: `p0-q${i + 1}`, questionType: 'mcq' }),
        );
        const mcqBudget = await budgetFor(fiveMcq);

        mockPass1.mockReset();
        mockPass2.mockReset();
        const fiveLong = Array.from({ length: 5 }, (_, i) =>
            extractedQuestion({
                questionId: `p0-q${i + 1}`,
                questionType: 'long_answer',
                marksAvailable: 5,
            }),
        );
        const longBudget = await budgetFor(fiveLong);

        // Same count (5), very different reasoning load → the flat 512×count model
        // would have tied them; the weighted model must not.
        expect(longBudget).toBeGreaterThan(mcqBudget);
    });

    it('sets a generous maxOutputTokens guard (floored, capped at the model max)', async () => {
        mockPass1.mockResolvedValue(pageResult());
        mockPass2.mockResolvedValue(scoringResult([gradedQuestion()]));
        await gradeAssessment(baseInput());
        const cfg = (mockPass2.mock.calls[0][1] as { config: { maxOutputTokens: number } }).config;
        expect(cfg.maxOutputTokens).toBeGreaterThanOrEqual(8192);
        expect(cfg.maxOutputTokens).toBeLessThanOrEqual(65536);
    });
});
