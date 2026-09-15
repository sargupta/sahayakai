/**
 * @jest-environment node
 *
 * Whole-syllabus coverage contract for `generateExamPaper`: an empty
 * `chapters: []` means "cover the entire syllabus" and must be expanded ONCE
 * — before the blueprint constraint, PYQ retrieval, and prompt all see the
 * same concrete chapter list — never silently left as `[]` (which would
 * starve PYQ retrieval and leave the prompt's chapter list blank). Also
 * covers the two related graceful-degradation edges in the same code path:
 * an unparseable `gradeLevel` and a subject outside the PYQ store.
 *
 * In-process contract tests; no Gemini calls, no real Firestore/NCERT data —
 * `findBlueprint` and `ncert-chapters` are mocked directly so each scenario
 * (blueprint-driven expansion, NCERT fallback, >50 truncation) is exercised
 * without depending on the real corpus ever crossing 50 chapters.
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

// All repair passes + NCERT chapter-name validation OFF — expansion/PYQ-skip
// behavior is the only thing under test.
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

const mockGetPYQsByChapter = jest.fn().mockResolvedValue([]);
jest.mock('@/lib/services/pyq-retrieval-service', () => ({
    getPYQsByChapter: (...args: unknown[]) => mockGetPYQsByChapter(...args),
}));

const mockFindBlueprint = jest.fn();
jest.mock('@/ai/data/board-blueprints', () => ({
    findBlueprint: (...args: unknown[]) => mockFindBlueprint(...args),
}));

const mockCanonicaliseGrade = jest.fn();
const mockCanonicaliseSubject = jest.fn();
const mockGetChaptersForCell = jest.fn();
jest.mock('@/ai/data/ncert-chapters', () => ({
    canonicaliseGrade: (...args: unknown[]) => mockCanonicaliseGrade(...args),
    canonicaliseSubject: (...args: unknown[]) => mockCanonicaliseSubject(...args),
    getChaptersForCell: (...args: unknown[]) => mockGetChaptersForCell(...args),
}));

// ── Import SUT AFTER mocks ─────────────────────────────────────────────────

import { generateExamPaper, type ExamPaperInput } from '@/ai/flows/exam-paper-generator';
import { StructuredLogger } from '@/lib/logger/structured-logger';

const promptSpy = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;

const BASE_INPUT: ExamPaperInput = {
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Mathematics',
    chapters: [],
    language: 'English',
    difficulty: 'mixed',
    includeAnswerKey: true,
    includeMarkingScheme: true,
    maxMarks: 10,
};

/** Schema-valid paper whose question marks sum to exactly `totalMarks`. */
function paperFixture(totalMarks: number) {
    return {
        title: 'CBSE Class 10 Mathematics Sample Paper',
        board: 'CBSE',
        subject: 'Mathematics',
        gradeLevel: 'Class 10',
        duration: '3 Hours',
        maxMarks: totalMarks,
        generalInstructions: ['Attempt all questions.'],
        sections: [
            {
                name: 'Section A',
                label: 'Objective Questions',
                totalMarks,
                questions: Array.from({ length: totalMarks }, (_, i) => ({
                    number: i + 1,
                    text: `Question ${i + 1}`,
                    marks: 1,
                    correctOption: '',
                    source: 'AI Generated',
                })),
            },
        ],
    };
}

/** Minimal blueprint shape sufficient for buildBlueprintConstraint + expansion. */
function blueprintFixture(chapterWeightage: Record<string, number>) {
    return {
        board: 'CBSE',
        gradeLevel: 'Class 10',
        subject: 'Mathematics',
        duration: 180,
        maxMarks: 10,
        generalInstructions: ['Attempt all questions.'],
        sections: [
            {
                name: 'Section A',
                label: 'Objective Questions',
                totalMarks: 10,
                questionCount: 10,
                questionType: { type: 'MCQ', marksPerQuestion: 1, internalChoice: false },
            },
        ],
        chapterWeightage,
    };
}

describe('exam-paper-generator: whole-syllabus expansion + related PYQ edges', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetPYQsByChapter.mockResolvedValue([]);
    });

    it('expands empty chapters from the blueprint chapterWeightage when a blueprint exists', async () => {
        mockFindBlueprint.mockResolvedValue(blueprintFixture({ 'Real Numbers': 6, 'Polynomials': 4 }));
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        await generateExamPaper(BASE_INPUT);

        const callArgs = promptSpy.mock.calls[0][0] as { chapters: string[] };
        expect(callArgs.chapters).toEqual(['Real Numbers', 'Polynomials']);
    });

    it('falls back to the NCERT chapter list when no blueprint exists', async () => {
        mockFindBlueprint.mockResolvedValue(undefined);
        mockCanonicaliseGrade.mockReturnValue(10);
        mockCanonicaliseSubject.mockReturnValue('Mathematics');
        mockGetChaptersForCell.mockReturnValue([{ title: 'Chapter A' }, { title: 'Chapter B' }]);
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        await generateExamPaper(BASE_INPUT);

        const callArgs = promptSpy.mock.calls[0][0] as { chapters: string[] };
        expect(callArgs.chapters).toEqual(['Chapter A', 'Chapter B']);
    });

    it('caps expansion at 50 chapters and surfaces a validationWarnings entry (not a silent truncation)', async () => {
        const bigWeightage = Object.fromEntries(
            Array.from({ length: 60 }, (_, i) => [`Chapter ${i + 1}`, 1]),
        );
        mockFindBlueprint.mockResolvedValue(blueprintFixture(bigWeightage));
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        const result = await generateExamPaper(BASE_INPUT);

        const callArgs = promptSpy.mock.calls[0][0] as { chapters: string[] };
        expect(callArgs.chapters).toHaveLength(50);

        expect(result.validationWarnings).toHaveLength(1);
        expect(result.validationWarnings?.[0].message).toContain('capped to the first 50');
        expect(result.validationWarnings?.[0].message).toContain('10 chapter(s) were not included');
    });

    it('defaults an unparseable gradeLevel to Class 10 and still retrieves PYQs', async () => {
        mockFindBlueprint.mockResolvedValue(undefined);
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        await generateExamPaper({ ...BASE_INPUT, chapters: ['Real Numbers'], gradeLevel: 'Senior Secondary' });

        expect(mockGetPYQsByChapter).toHaveBeenCalledTimes(1);
        const classArg = mockGetPYQsByChapter.mock.calls[0][2];
        expect(classArg).toBe(10);
        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Could not parse gradeLevel'),
            expect.objectContaining({ operation: 'retrievePYQs' }),
        );
    });

    it('skips PYQ retrieval entirely for a subject outside the PYQ store', async () => {
        mockFindBlueprint.mockResolvedValue(undefined);
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        await generateExamPaper({ ...BASE_INPUT, chapters: ['Some Chapter'], subject: 'Social Science' });

        expect(mockGetPYQsByChapter).not.toHaveBeenCalled();
        const callArgs = promptSpy.mock.calls[0][0] as { pyqContext: string };
        expect(callArgs.pyqContext).toBe('');
    });

    it('falls through to prompt-only coverage (chapters stays []) when whole-syllabus expansion itself throws', async () => {
        mockFindBlueprint.mockResolvedValue(undefined);
        mockCanonicaliseGrade.mockImplementation(() => {
            throw new Error('bad grade');
        });
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        const result = await generateExamPaper(BASE_INPUT);

        expect(result.sections.length).toBeGreaterThan(0);
        const callArgs = promptSpy.mock.calls[0][0] as { chapters: string[] };
        expect(callArgs.chapters).toEqual([]);
        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Whole-syllabus expansion failed'),
            expect.objectContaining({ operation: 'expandSyllabus' }),
        );
    });

    it('generates without PYQs (pyqContext empty) when PYQ retrieval itself throws', async () => {
        mockFindBlueprint.mockResolvedValue(undefined);
        mockGetPYQsByChapter.mockRejectedValue(new Error('firestore down'));
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        const result = await generateExamPaper({ ...BASE_INPUT, chapters: ['Real Numbers'], subject: 'Mathematics' });

        expect(result.sections.length).toBeGreaterThan(0);
        const callArgs = promptSpy.mock.calls[0][0] as { pyqContext: string };
        expect(callArgs.pyqContext).toBe('');
        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('PYQ retrieval failed'),
            expect.objectContaining({ operation: 'retrievePYQs' }),
        );
    });
});
