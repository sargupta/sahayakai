/**
 * @jest-environment node
 *
 * Phase 2 (2026-07-10) answer-key / marking-scheme completeness contract for
 * `generateExamPaper`: when includeAnswerKey / includeMarkingScheme are on,
 * EVERY question must end up with a non-empty answerKey / markingScheme. The
 * flow detects the gaps, attempts ONE bounded targeted backfill re-prompt, and
 * then a deterministic placeholder floor guarantees 100% coverage — attaching a
 * structured `answerKeyCompleteness` report and NEVER hard-failing the paper.
 *
 * In-process contract tests; no Gemini calls. Uses the real `board-blueprints`
 * data (CBSE Class 10 Mathematics). Papers pass an explicit input maxMarks that
 * matches their fixture total so the Phase 1 marks-reconcile is a no-op here and
 * the ONLY second prompt call is the backfill under test.
 */

// ── Mocks (must come before importing the SUT) ─────────────────────────────
// ai.definePrompt() returns the SAME promptSpy for both the main generate
// prompt and the backfill prompt, so the two calls are distinguished purely by
// order: call[0] = generate, call[1] = backfill (mirrors the Phase 1 test).

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

// Backfill flag ON; marks-repair + NCERT validation OFF so the ONLY second
// prompt call is the key backfill, and drift never triggers a repair re-prompt.
jest.mock('@/lib/feature-flags', () => ({
    isFeatureEnabled: jest.fn(async (flag: string) => ({
        enabled: flag === 'examPaperKeyBackfill',
    })),
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

import { generateExamPaper, examPaperStamping, type ExamPaperInput } from '@/ai/flows/exam-paper-generator';
import { StructuredLogger } from '@/lib/logger/structured-logger';
import { SchemaValidationError } from '@/lib/errors';

const promptSpy = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;

const QUESTION_COUNT = 3;
const MARKS_EACH = 5;
const TOTAL = QUESTION_COUNT * MARKS_EACH; // 15

// Explicit maxMarks matches the fixture total → no marks drift, reconcile is a
// no-op, so the backfill is the only possible second prompt call.
const BASE_INPUT: ExamPaperInput = {
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

const PLACEHOLDER_ANSWER = 'Answer to be reviewed.';
const placeholderScheme = (marks: number) => `${marks} mark(s) for a complete and correct answer.`;

/**
 * Schema-valid single-section paper (marks sum to TOTAL). Control which keys
 * each question already carries; optionally fabricate an answerKeyCompleteness
 * field to prove it gets stripped.
 */
function paperFixture(opts: {
    withAnswerKey: boolean;
    withMarkingScheme: boolean;
    fabricateCompleteness?: boolean;
}) {
    const questions = Array.from({ length: QUESTION_COUNT }, (_, i) => {
        const q: Record<string, unknown> = {
            number: i + 1,
            text: `Question ${i + 1}`,
            marks: MARKS_EACH,
            correctOption: '', // subjective question, no options
            source: 'AI Generated',
        };
        if (opts.withAnswerKey) q.answerKey = `Model answer ${i + 1}`;
        if (opts.withMarkingScheme) q.markingScheme = `Given ${MARKS_EACH} marks`;
        return q;
    });

    const paper: Record<string, unknown> = {
        title: 'CBSE Class 10 Mathematics Sample Paper',
        board: 'CBSE',
        subject: 'Mathematics',
        gradeLevel: 'Class 10',
        duration: '3 Hours',
        maxMarks: TOTAL,
        generalInstructions: ['Attempt all questions.'],
        sections: [
            { name: 'Section A', label: 'Objective Questions', totalMarks: TOTAL, questions },
        ],
    };
    if (opts.fabricateCompleteness) {
        paper.answerKeyCompleteness = {
            requestedAnswerKey: true,
            requestedMarkingScheme: true,
            missingBefore: 99,
            filledByStamp: 9,
            filledByReprompt: 9,
            filledByPlaceholder: 9,
        };
    }
    return paper;
}

/**
 * MCQ paper: each question carries `options` + a `correctOption` marker but no
 * answerKey/markingScheme, so the deterministic stamp (not the backfill) fills them.
 * `overrides` lets a question pre-carry an answerKey to prove no-overwrite.
 */
function mcqPaperFixture(overrides: Partial<Record<number, { answerKey?: string }>> = {}) {
    const questions = Array.from({ length: QUESTION_COUNT }, (_, i) => {
        const q: Record<string, unknown> = {
            number: i + 1,
            text: `MCQ ${i + 1}`,
            marks: MARKS_EACH,
            options: ['(a) one', '(b) two', '(c) three', '(d) four'],
            correctOption: 'b',
            source: 'AI Generated',
        };
        if (overrides[i]?.answerKey) q.answerKey = overrides[i]!.answerKey;
        return q;
    });
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

/** Backfill re-prompt output: `{ items: [{ idx, answerKey?, markingScheme? }] }`. */
function backfill(items: Array<{ idx: number; answerKey?: string; markingScheme?: string }>) {
    return { items };
}

/** Flatten all questions across sections in positional order. */
function allQuestions(result: Awaited<ReturnType<typeof generateExamPaper>>) {
    return result.sections.flatMap(s => s.questions);
}

describe('exam-paper-generator: answer-key / marking-scheme completeness (Phase 2 guard)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('leaves a fully-covered paper untouched: one model call, no report attached', async () => {
        promptSpy.mockResolvedValueOnce({ output: paperFixture({ withAnswerKey: true, withMarkingScheme: true }) });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(1);
        expect(result.answerKeyCompleteness).toBeUndefined();
        for (const q of allQuestions(result)) {
            expect(q.answerKey?.trim()).toBeTruthy();
            expect(q.markingScheme?.trim()).toBeTruthy();
        }
    });

    it('fills every missing markingScheme via the backfill re-prompt (100% by reprompt)', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture({ withAnswerKey: true, withMarkingScheme: false }) })
            .mockResolvedValueOnce({
                output: backfill([
                    { idx: 0, markingScheme: 'Scheme A' },
                    { idx: 1, markingScheme: 'Scheme B' },
                    { idx: 2, markingScheme: 'Scheme C' },
                ]),
            });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(2);
        // Second call is the backfill, carrying only the missing items with idx.
        const backfillArgs = promptSpy.mock.calls[1][0] as { items: Array<{ idx: number; needMarkingScheme: boolean }> };
        expect(backfillArgs.items).toHaveLength(3);
        expect(backfillArgs.items.map(i => i.idx)).toEqual([0, 1, 2]);
        expect(backfillArgs.items.every(i => i.needMarkingScheme)).toBe(true);

        const qs = allQuestions(result);
        expect(qs.map(q => q.markingScheme)).toEqual(['Scheme A', 'Scheme B', 'Scheme C']);
        expect(result.answerKeyCompleteness).toEqual({
            requestedAnswerKey: true,
            requestedMarkingScheme: true,
            missingBefore: 3,
            filledByStamp: 0,
            filledByReprompt: 3,
            filledByPlaceholder: 0,
        });
    });

    it('fills every missing answerKey via the backfill re-prompt (markingScheme already present)', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture({ withAnswerKey: false, withMarkingScheme: true }) })
            .mockResolvedValueOnce({
                output: backfill([
                    { idx: 0, answerKey: 'some answer' },
                    { idx: 1, answerKey: 'some answer' },
                    { idx: 2, answerKey: 'some answer' },
                ]),
            });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(2);
        // Second call is the backfill — only answerKey is requested, markingScheme was never missing.
        const backfillArgs = promptSpy.mock.calls[1][0] as { items: Array<{ idx: number; needAnswerKey: boolean; needMarkingScheme: boolean }> };
        expect(backfillArgs.items).toHaveLength(3);
        expect(backfillArgs.items.every(i => i.needAnswerKey)).toBe(true);
        expect(backfillArgs.items.every(i => i.needMarkingScheme === false)).toBe(true);

        const qs = allQuestions(result);
        expect(qs.map(q => q.answerKey)).toEqual(['some answer', 'some answer', 'some answer']);
        expect(result.answerKeyCompleteness?.filledByReprompt).toBeGreaterThanOrEqual(1);
    });

    it('swallows a thrown StructuredLogger.warn from the missing-keys log (outer catch, invariant #2 unaffected)', async () => {
        promptSpy.mockResolvedValueOnce({ output: paperFixture({ withAnswerKey: true, withMarkingScheme: false }) });
        // No marks drift, no PYQ ratio issue, no NCERT invalid-chapter warning in this
        // scenario — the missing-keys warn logged right when gaps are first detected is
        // the very first (and only) warn call in the whole flow, so throwing on the
        // FIRST invocation proves backfillAnswerKeys's outer catch swallows it.
        (StructuredLogger.warn as jest.Mock).mockImplementationOnce(() => {
            throw new Error('logger down');
        });

        const result = await generateExamPaper(BASE_INPUT);

        // The throw happens the instant the gap is detected — before the backfill
        // re-prompt or the placeholder floor run — so only the generate call fires
        // and the markingScheme gaps are left unfilled. The point of this case is
        // that the paper still resolves at all (the outer catch swallows the throw
        // instead of it propagating out of generateExamPaper).
        expect(promptSpy).toHaveBeenCalledTimes(1);
        expect(result.sections.length).toBeGreaterThan(0);
        expect(result.answerKeyCompleteness).toBeUndefined();
    });

    it('ignores missing answerKey when includeAnswerKey is false; enforces only markingScheme', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture({ withAnswerKey: false, withMarkingScheme: false }) })
            .mockResolvedValueOnce({
                output: backfill([
                    { idx: 0, markingScheme: 'Scheme A' },
                    { idx: 1, markingScheme: 'Scheme B' },
                    { idx: 2, markingScheme: 'Scheme C' },
                ]),
            });

        const result = await generateExamPaper({ ...BASE_INPUT, includeAnswerKey: false });

        const backfillArgs = promptSpy.mock.calls[1][0] as { items: Array<{ needAnswerKey: boolean; needMarkingScheme: boolean }> };
        expect(backfillArgs.items.every(i => i.needAnswerKey === false)).toBe(true);
        expect(backfillArgs.items.every(i => i.needMarkingScheme === true)).toBe(true);

        for (const q of allQuestions(result)) {
            // answerKey was never requested → stays empty, not floored.
            expect(q.answerKey?.trim()).toBeFalsy();
            expect(q.markingScheme?.trim()).toBeTruthy();
        }
        expect(result.answerKeyCompleteness).toEqual({
            requestedAnswerKey: false,
            requestedMarkingScheme: true,
            missingBefore: 3,
            filledByStamp: 0,
            filledByReprompt: 3,
            filledByPlaceholder: 0,
        });
    });

    it('floors whatever the backfill left behind, warning with the question numbers', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture({ withAnswerKey: true, withMarkingScheme: false }) })
            // Backfill only answers idx 0 — idx 1 and 2 fall through to the floor.
            .mockResolvedValueOnce({ output: backfill([{ idx: 0, markingScheme: 'Scheme A' }]) });

        const result = await generateExamPaper(BASE_INPUT);

        const qs = allQuestions(result);
        expect(qs[0].markingScheme).toBe('Scheme A');
        expect(qs[1].markingScheme).toBe(placeholderScheme(MARKS_EACH));
        expect(qs[2].markingScheme).toBe(placeholderScheme(MARKS_EACH));
        // Every question still ends up non-empty (invariant #2).
        for (const q of qs) expect(q.markingScheme?.trim()).toBeTruthy();

        expect(result.answerKeyCompleteness).toEqual({
            requestedAnswerKey: true,
            requestedMarkingScheme: true,
            missingBefore: 3,
            filledByStamp: 0,
            filledByReprompt: 1,
            filledByPlaceholder: 2,
            placeholderReason: 'model-omitted-items',
        });

        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                operation: 'keyCompleteness',
                metadata: expect.objectContaining({ questionNumbers: [1, 2, 3] }),
            }),
        );
    });

    it('falls back to the placeholder floor (no exception) when the backfill re-prompt throws', async () => {
        promptSpy
            .mockResolvedValueOnce({ output: paperFixture({ withAnswerKey: true, withMarkingScheme: false }) })
            .mockRejectedValueOnce(new Error('model unavailable'));

        const result = await generateExamPaper(BASE_INPUT);

        for (const q of allQuestions(result)) {
            expect(q.markingScheme).toBe(placeholderScheme(MARKS_EACH));
        }
        expect(result.answerKeyCompleteness).toEqual({
            requestedAnswerKey: true,
            requestedMarkingScheme: true,
            missingBefore: 3,
            filledByStamp: 0,
            filledByReprompt: 0,
            filledByPlaceholder: 3,
            placeholderReason: 'reprompt-threw',
        });
    });

    it('stamps objective MCQ keys deterministically from correctOption — no backfill call', async () => {
        promptSpy.mockResolvedValueOnce({ output: mcqPaperFixture() });

        const result = await generateExamPaper(BASE_INPUT);

        // Only the generate call — stamping resolved every gap, so no backfill re-prompt.
        expect(promptSpy).toHaveBeenCalledTimes(1);
        for (const q of allQuestions(result)) {
            expect(q.answerKey).toBe('(b) two'); // option label stripped + re-prefixed canonically
            expect(q.markingScheme).toBe(`${MARKS_EACH} mark(s) for selecting the correct option (b).`);
        }
        expect(result.answerKeyCompleteness).toEqual({
            requestedAnswerKey: true,
            requestedMarkingScheme: true,
            missingBefore: 0,
            filledByStamp: QUESTION_COUNT * 2, // answerKey + markingScheme per question
            filledByReprompt: 0,
            filledByPlaceholder: 0,
        });
    });

    it('never overwrites a model-provided answerKey when stamping', async () => {
        promptSpy.mockResolvedValueOnce({
            output: mcqPaperFixture({ 0: { answerKey: 'Model-written key' } }),
        });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(1);
        const qs = allQuestions(result);
        expect(qs[0].answerKey).toBe('Model-written key'); // preserved, not stamped over
        expect(qs[1].answerKey).toBe('(b) two');           // empty → stamped
        // q0 answerKey preserved (no fill) but its markingScheme still stamped → 5 fills.
        expect(result.answerKeyCompleteness?.filledByStamp).toBe(QUESTION_COUNT * 2 - 1);
        expect(result.answerKeyCompleteness?.filledByReprompt).toBe(0);
        expect(result.answerKeyCompleteness?.filledByPlaceholder).toBe(0);
    });

    it('strips a model-fabricated answerKeyCompleteness from a fully-covered paper', async () => {
        promptSpy.mockResolvedValueOnce({
            output: paperFixture({ withAnswerKey: true, withMarkingScheme: true, fabricateCompleteness: true }),
        });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(1);
        expect(result.answerKeyCompleteness).toBeUndefined();
    });

    // M2 (2026-07-16): the placeholder floor must survive a throw from the
    // deterministic stamp step — previously stamp/backfill/floor shared one
    // try/catch, so a stamp throw was swallowed by the OUTER catch and the
    // floor (the invariant-#2 backstop) never ran. `examPaperStamping` is a
    // live-object testability seam (same-module function calls bypass
    // jest.mock/spyOn on the plain named export) added specifically so this
    // failure mode is provable without extracting stampObjectiveKeys to its
    // own module.
    it('M2: the placeholder floor still fills every question when stampObjectiveKeys throws', async () => {
        const stampSpy = jest.spyOn(examPaperStamping, 'stampObjectiveKeys').mockImplementation(() => {
            throw new Error('stamp boom');
        });

        promptSpy
            .mockResolvedValueOnce({ output: paperFixture({ withAnswerKey: false, withMarkingScheme: false }) })
            // Backfill runs (flag ON) but returns nothing useful — everything
            // must fall through to the floor.
            .mockResolvedValueOnce({ output: backfill([]) });

        const result = await generateExamPaper(BASE_INPUT);

        expect(stampSpy).toHaveBeenCalled();
        for (const q of allQuestions(result)) {
            expect(q.answerKey?.trim()).toBeTruthy();
            expect(q.markingScheme?.trim()).toBeTruthy();
        }
        expect(result.answerKeyCompleteness).toEqual({
            requestedAnswerKey: true,
            requestedMarkingScheme: true,
            missingBefore: QUESTION_COUNT,
            filledByStamp: 0,
            filledByReprompt: 0,
            filledByPlaceholder: QUESTION_COUNT * 2,
            placeholderReason: 'model-omitted-items',
        });
        expect(result.answerKeyCompleteness?.filledByPlaceholder).not.toBeUndefined();

        stampSpy.mockRestore();
    });

    // M1 (2026-07-16): `sections` now has `.min(1)` and the flow adds an
    // explicit post-parse check for "sections exist but every one is empty" —
    // an empty paper is never valid and never repairable, so both shapes must
    // reject with SchemaValidationError instead of persisting/returning a
    // blank "ready" paper.
    it('M1: rejects an empty sections array with SchemaValidationError', async () => {
        promptSpy.mockResolvedValueOnce({
            output: {
                title: 'Empty Paper',
                board: 'CBSE',
                subject: 'Mathematics',
                gradeLevel: 'Class 10',
                duration: '3 Hours',
                maxMarks: TOTAL,
                generalInstructions: ['Attempt all questions.'],
                sections: [],
            },
        });

        await expect(generateExamPaper(BASE_INPUT)).rejects.toBeInstanceOf(SchemaValidationError);
    });

    it('M1: rejects a paper whose only section has zero questions', async () => {
        promptSpy.mockResolvedValueOnce({
            output: {
                title: 'Empty Section Paper',
                board: 'CBSE',
                subject: 'Mathematics',
                gradeLevel: 'Class 10',
                duration: '3 Hours',
                maxMarks: TOTAL,
                generalInstructions: ['Attempt all questions.'],
                sections: [{ name: 'Section A', label: 'Objective Questions', totalMarks: 0, questions: [] }],
            },
        });

        await expect(generateExamPaper(BASE_INPUT)).rejects.toThrow(/no questions/i);
    });

    // L3 (2026-07-16): `marks` must be a non-negative integer — a negative or
    // fractional value is never a valid mark allocation and previously slipped
    // through as a bare `z.number()`.
    it('L3: rejects negative or fractional question marks', async () => {
        const badPaper = (marks: number) => ({
            title: 'Bad Marks Paper',
            board: 'CBSE',
            subject: 'Mathematics',
            gradeLevel: 'Class 10',
            duration: '3 Hours',
            maxMarks: TOTAL,
            generalInstructions: ['Attempt all questions.'],
            sections: [{
                name: 'Section A',
                label: 'Objective Questions',
                totalMarks: TOTAL,
                questions: [
                    { number: 1, text: 'Q1', marks, correctOption: '', source: 'AI Generated' },
                ],
            }],
        });

        promptSpy.mockResolvedValueOnce({ output: badPaper(-2) });
        await expect(generateExamPaper(BASE_INPUT)).rejects.toBeInstanceOf(SchemaValidationError);

        promptSpy.mockResolvedValueOnce({ output: badPaper(2.5) });
        await expect(generateExamPaper(BASE_INPUT)).rejects.toBeInstanceOf(SchemaValidationError);
    });
});
