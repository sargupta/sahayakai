/**
 * @jest-environment node
 *
 * Phase 3 (2026-07-10) board/subject coverage + graceful-invalid-chapter
 * contract for `generateExamPaper`:
 *   1. An un-blueprinted board (e.g. ICSE / ISC) routes through the generic
 *      no-blueprint fallback in buildBlueprintConstraint and still produces a
 *      paper — this is the "≥2 boards" path (CBSE blueprinted + ICSE fallback).
 *   2. A blueprinted board (CBSE) still gets the HARD blueprint constraint, so
 *      findBlueprint genuinely discriminates the two.
 *   3. An invalid chapter surfaces a validationWarning AND generation still
 *      proceeds (never a hard-fail).
 *
 * In-process contract tests; no Gemini calls. Uses the real board-blueprints
 * data and the same stubbed-model harness as the Phase 1/2 tests.
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

// All flags OFF by default (no repair / backfill / NCERT). Individual tests
// override via the mockFlag handle below.
jest.mock('@/lib/feature-flags', () => ({
    isFeatureEnabled: jest.fn(async () => ({ enabled: false })),
}));

// Valid by default (returns null). Case 3 overrides to return a warning.
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

import { generateExamPaper, type ExamPaperInput } from '@/ai/flows/exam-paper-generator';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { validateChapterForFlow } from '@/lib/ncert/validate-chapter';
import { StructuredLogger } from '@/lib/logger/structured-logger';

const promptSpy = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;
const mockFlag = isFeatureEnabled as jest.Mock;
const mockValidate = validateChapterForFlow as jest.Mock;

const MARKS_EACH = 5;
const COUNT = 3;
const TOTAL = MARKS_EACH * COUNT; // 15

/** Schema-valid, fully-covered single-section paper summing to `total`. */
function paperFixture(total = TOTAL) {
    const count = total / MARKS_EACH;
    return {
        title: 'Sample Paper',
        board: 'CBSE',
        subject: 'Mathematics',
        gradeLevel: 'Class 10',
        duration: '3 Hours',
        maxMarks: total,
        generalInstructions: ['Attempt all questions.'],
        sections: [
            {
                name: 'Section A',
                label: 'Questions',
                totalMarks: total,
                questions: Array.from({ length: count }, (_, i) => ({
                    number: i + 1,
                    text: `Question ${i + 1}`,
                    marks: MARKS_EACH,
                    correctOption: '', // subjective question, no options
                    answerKey: `Answer ${i + 1}`,
                    markingScheme: `${MARKS_EACH} marks`,
                    source: 'AI Generated',
                })),
            },
        ],
    };
}

const firstConstraint = () =>
    (promptSpy.mock.calls[0][0] as { blueprintConstraint: string }).blueprintConstraint;

describe('exam-paper-generator: board coverage + graceful invalid chapter (Phase 3)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFlag.mockImplementation(async () => ({ enabled: false }));
        mockValidate.mockReturnValue(null);
    });

    it('routes an un-blueprinted board (ICSE) through the fallback and still returns a paper', async () => {
        promptSpy.mockResolvedValueOnce({ output: paperFixture() });

        const input: ExamPaperInput = {
            board: 'ICSE / ISC',
            gradeLevel: 'Class 10',
            subject: 'Mathematics',
            chapters: ['Algebra'],
            language: 'English',
            difficulty: 'mixed',
            includeAnswerKey: true,
            includeMarkingScheme: true,
            maxMarks: TOTAL,
        };

        const result = await generateExamPaper(input);

        expect(firstConstraint()).toContain('No official blueprint found');
        expect(result.sections.length).toBeGreaterThan(0);
        expect(result.sections[0].questions.length).toBeGreaterThan(0);
    });

    it('routes a blueprinted board (CBSE) through the hard blueprint constraint', async () => {
        promptSpy.mockResolvedValueOnce({ output: paperFixture() });

        const input: ExamPaperInput = {
            board: 'CBSE',
            gradeLevel: 'Class 10',
            subject: 'Mathematics',
            chapters: ['Real Numbers'],
            language: 'English',
            difficulty: 'mixed',
            includeAnswerKey: true,
            includeMarkingScheme: true,
            maxMarks: TOTAL,
        };

        await generateExamPaper(input);

        expect(firstConstraint()).toContain('HARD CONSTRAINT: Official');
    });

    it('surfaces a validation warning for an invalid chapter but still returns the paper', async () => {
        mockFlag.mockImplementation(async (flag: string) => ({ enabled: flag === 'ncertChapterValidation' }));
        mockValidate.mockReturnValue({
            invalid: true,
            lenient: false,
            message: 'Chapter not found in the NCERT seed.',
            input: { gradeLevel: 'Class 10', subject: 'Mathematics', chapter: 'Nonexistent Chapter' },
        });
        promptSpy.mockResolvedValueOnce({ output: paperFixture() });

        const input: ExamPaperInput = {
            board: 'CBSE',
            gradeLevel: 'Class 10',
            subject: 'Mathematics',
            chapters: ['Nonexistent Chapter'],
            language: 'English',
            difficulty: 'mixed',
            includeAnswerKey: true,
            includeMarkingScheme: true,
            maxMarks: TOTAL,
        };

        const result = await generateExamPaper(input);

        // Generation proceeded (never hard-failed) …
        expect(result.sections.length).toBeGreaterThan(0);
        // … and the warning is surfaced for the UI to render.
        expect(result.validationWarnings).toHaveLength(1);
        expect(result.validationWarnings?.[0].message).toContain('NCERT');
        expect(result.validationWarnings?.[0].invalid).toBe(true);
    });

    it('logs and proceeds when NCERT validation itself throws (non-blocking)', async () => {
        mockFlag.mockImplementation(async (flag: string) => ({ enabled: flag === 'ncertChapterValidation' }));
        mockValidate.mockImplementation(() => { throw new Error('seed corrupt'); });
        promptSpy.mockResolvedValueOnce({ output: paperFixture() });

        const input: ExamPaperInput = {
            board: 'CBSE',
            gradeLevel: 'Class 10',
            subject: 'Mathematics',
            chapters: ['Real Numbers'],
            language: 'English',
            difficulty: 'mixed',
            includeAnswerKey: true,
            includeMarkingScheme: true,
            maxMarks: TOTAL,
        };

        const result = await generateExamPaper(input);

        // Never hard-fails — the paper still comes back with no validation warnings.
        expect(result.sections.length).toBeGreaterThan(0);
        expect(result.sections[0].questions.length).toBeGreaterThan(0);
        expect(result.validationWarnings).toBeUndefined();

        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            'NCERT validation threw (non-blocking)',
            expect.objectContaining({ operation: 'ncertValidation' }),
        );
    });
});
