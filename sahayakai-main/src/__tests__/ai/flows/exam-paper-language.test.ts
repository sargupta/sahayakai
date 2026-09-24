/**
 * @jest-environment node
 *
 * H1 (2026-07-16) language-lock contract for `generateExamPaper` (Cluster 4,
 * see tasks/SOLUTIONS-exam-pipeline.md): this flow was the only AI flow that
 * never normalized its `language` input, and the deterministic MCQ stamp /
 * completeness placeholder floor fabricated English marking-scheme sentences
 * regardless of the requested paper language — a language leak into a Hindi
 * (or any non-English) paper. `normalizeLanguage` + `getExamPaperTemplates`
 * fix this: both fabrication sites are now language-templated, with English +
 * Hindi verified translations and an English-fallback + one-time WARN for the
 * other 9 languages (translator follow-up, not silently leaking English).
 *
 * In-process contract tests; no Gemini calls. Reuses the stubbed-model
 * harness from exam-paper-board-coverage.test.ts / lesson-plan-language-leak.test.ts.
 */

// ── Mocks (must come before importing the SUT) ─────────────────────────────

jest.mock('@/ai/genkit', () => {
    const flowSpy = jest.fn();
    const promptSpy = jest.fn();
    return {
        __flowSpy: flowSpy,
        __promptSpy: promptSpy,
        ai: {
            definePrompt: jest.fn(() => promptSpy),
            defineFlow: (_config: unknown, fn: (input: unknown) => unknown) => {
                flowSpy.mockImplementation(fn as (input: unknown) => unknown);
                return flowSpy;
            },
            generate: jest.fn(),
        },
        runResiliently: jest.fn(async (fn: (cfg: unknown) => unknown) => fn({ config: {} })),
    };
});

jest.mock('@/ai/soul', () => ({
    SAHAYAK_SOUL_PROMPT: '',
    STRUCTURED_OUTPUT_OVERRIDE: '',
}));

// All flags OFF: no backfill re-prompt, no marks repair, no NCERT validation —
// isolates the deterministic stamp / placeholder floor as the ONLY source of
// the marking-scheme text under test.
jest.mock('@/lib/feature-flags', () => ({
    isFeatureEnabled: jest.fn(async () => ({ enabled: false })),
}));

jest.mock('@/lib/ncert/validate-chapter', () => ({
    validateChapterForFlow: jest.fn(() => null),
}));

jest.mock('@/lib/firebase-admin', () => ({
    getStorageInstance: jest.fn(),
}));

jest.mock('@/lib/logger/structured-logger', () => ({
    StructuredLogger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(() => 'error-id'),
    },
}));

// PYQ retrieval reads Firestore via getPYQsByChapter; stub it to return no
// questions so the prompt's pyqContext stays empty.
jest.mock('@/lib/services/pyq-retrieval-service', () => ({
    getPYQsByChapter: jest.fn().mockResolvedValue([]),
}));

// ── Import SUT AFTER mocks ─────────────────────────────────────────────────

import { generateExamPaper, getExamPaperTemplates, type ExamPaperInput } from '@/ai/flows/exam-paper-generator';
import { StructuredLogger } from '@/lib/logger/structured-logger';

const promptSpy = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;

const QUESTION_COUNT = 3;
const MARKS_EACH = 5;
const TOTAL = QUESTION_COUNT * MARKS_EACH; // 15

const DEVANAGARI = /[ऀ-ॿ]/;
const ENGLISH_MARKS_LEAK = /mark\(s\)/;
const ENGLISH_PLACEHOLDER_LEAK = /Answer to be reviewed/;

const BASE_INPUT: ExamPaperInput = {
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Mathematics',
    chapters: ['Real Numbers'],
    difficulty: 'mixed',
    includeAnswerKey: true,
    includeMarkingScheme: true,
    maxMarks: TOTAL,
};

/** Subjective (no options) paper — everything missing, forces the placeholder floor. */
function subjectivePaperFixture() {
    const questions = Array.from({ length: QUESTION_COUNT }, (_, i) => ({
        number: i + 1,
        text: `Question ${i + 1}`,
        marks: MARKS_EACH,
        correctOption: '',
        source: 'AI Generated',
    }));
    return {
        title: 'CBSE Class 10 Mathematics Sample Paper',
        board: 'CBSE',
        subject: 'Mathematics',
        gradeLevel: 'Class 10',
        duration: '3 Hours',
        maxMarks: TOTAL,
        generalInstructions: ['Attempt all questions.'],
        sections: [
            { name: 'Section A', label: 'Subjective Questions', totalMarks: TOTAL, questions },
        ],
    };
}

/** MCQ paper — no pre-set answerKey/markingScheme, so the deterministic stamp fires. */
function mcqPaperFixture() {
    const questions = Array.from({ length: QUESTION_COUNT }, (_, i) => ({
        number: i + 1,
        text: `MCQ ${i + 1}`,
        marks: MARKS_EACH,
        options: ['(a) one', '(b) two', '(c) three', '(d) four'],
        correctOption: 'b',
        source: 'AI Generated',
    }));
    return {
        title: 'CBSE Class 10 Mathematics Sample Paper',
        board: 'CBSE',
        subject: 'Mathematics',
        gradeLevel: 'Class 10',
        duration: '3 Hours',
        maxMarks: TOTAL,
        generalInstructions: ['Attempt all questions.'],
        sections: [
            { name: 'Section A', label: 'MCQ', totalMarks: TOTAL, questions },
        ],
    };
}

function allQuestions(result: Awaited<ReturnType<typeof generateExamPaper>>) {
    return result.sections.flatMap(s => s.questions);
}

describe('exam-paper-generator: language lock on fabricated marking-scheme text (H1)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('stamps MCQ marking schemes in Hindi (Devanagari, no English "mark(s)" leak)', async () => {
        promptSpy.mockResolvedValueOnce({ output: mcqPaperFixture() });

        const result = await generateExamPaper({ ...BASE_INPUT, language: 'Hindi' });

        for (const q of allQuestions(result)) {
            expect(q.markingScheme).toBeTruthy();
            expect(q.markingScheme).not.toMatch(ENGLISH_MARKS_LEAK);
            expect(q.markingScheme).toMatch(DEVANAGARI);
        }
    });

    it('floors missing answer keys / marking schemes in Hindi (placeholder floor, backfill off)', async () => {
        promptSpy.mockResolvedValueOnce({ output: subjectivePaperFixture() });

        const result = await generateExamPaper({ ...BASE_INPUT, language: 'Hindi' });

        // Only the generate call — backfill flag is OFF, so the floor is the
        // only path that could have filled these fields.
        expect(promptSpy).toHaveBeenCalledTimes(1);
        for (const q of allQuestions(result)) {
            expect(q.answerKey).toBeTruthy();
            expect(q.markingScheme).toBeTruthy();
            expect(q.answerKey).not.toMatch(ENGLISH_PLACEHOLDER_LEAK);
            expect(q.markingScheme).not.toMatch(ENGLISH_MARKS_LEAK);
            expect(q.answerKey).toMatch(DEVANAGARI);
            expect(q.markingScheme).toMatch(DEVANAGARI);
        }
    });

    it('normalizes an ISO language code ("hi") to the Hindi templates, not English', async () => {
        promptSpy.mockResolvedValueOnce({ output: subjectivePaperFixture() });

        const result = await generateExamPaper({ ...BASE_INPUT, language: 'hi' });

        for (const q of allQuestions(result)) {
            expect(q.markingScheme).toMatch(DEVANAGARI);
            expect(q.markingScheme).not.toMatch(ENGLISH_MARKS_LEAK);
        }
    });

    it('leaves an English paper on the English templates (no regression)', async () => {
        promptSpy.mockResolvedValueOnce({ output: subjectivePaperFixture() });

        const result = await generateExamPaper({ ...BASE_INPUT, language: 'English' });

        for (const q of allQuestions(result)) {
            expect(q.answerKey).toBe('Answer to be reviewed.');
            expect(q.markingScheme).toBe(`${MARKS_EACH} mark(s) for a complete and correct answer.`);
        }
    });

    describe('getExamPaperTemplates', () => {
        it('falls back to English for an unmapped language and warns exactly once', () => {
            const templates = getExamPaperTemplates('xx-unknown-language');

            expect(templates.placeholderAnswer).toBe('Answer to be reviewed.');
            expect(templates.mcqOptionMark(5, 'b')).toBe('5 mark(s) for selecting the correct option (b).');
            expect(StructuredLogger.warn).toHaveBeenCalledTimes(1);
            expect(StructuredLogger.warn).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    operation: 'getExamPaperTemplates',
                    metadata: { language: 'xx-unknown-language' },
                }),
            );

            // Second call for the SAME unmapped language must not warn again.
            getExamPaperTemplates('xx-unknown-language');
            expect(StructuredLogger.warn).toHaveBeenCalledTimes(1);
        });

        it('resolves Hindi and English directly with no warning', () => {
            expect(getExamPaperTemplates('Hindi').placeholderAnswer).toBe('उत्तर की समीक्षा की जानी है।');
            expect(getExamPaperTemplates('English').placeholderAnswer).toBe('Answer to be reviewed.');
            expect(StructuredLogger.warn).not.toHaveBeenCalled();
        });

        // The other 9 mapped languages (Kannada, Tamil, Telugu, Marathi, Bengali,
        // Gujarati, Punjabi, Malayalam, Odia) are machine-authored per a ponytail
        // comment in the source pending native-speaker review — this doesn't
        // re-verify translation quality, just that each language's template
        // functions actually run (they were previously never invoked by any
        // test) and produce a non-empty, script-native string.
        it.each([
            'Kannada', 'Tamil', 'Telugu', 'Marathi', 'Bengali',
            'Gujarati', 'Punjabi', 'Malayalam', 'Odia',
        ])('resolves %s directly with no warning and non-empty template strings', (language) => {
            const templates = getExamPaperTemplates(language);

            expect(templates.placeholderAnswer.length).toBeGreaterThan(0);
            expect(templates.mcqOptionMark(5, 'b')).toContain('5');
            expect(templates.placeholderMarkingScheme(3)).toContain('3');
            expect(StructuredLogger.warn).not.toHaveBeenCalled();
        });
    });
});
