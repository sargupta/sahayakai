/**
 * @jest-environment node
 *
 * C2 (forensic EPG-2026-07-17): a hard ceiling on LOGICAL model calls per
 * request. `shouldAttemptMarksRepair` is a deliberate always-true no-op, so
 * before this fix nothing capped how many prompts one request could chain.
 * `MAX_MODEL_CALLS` (env `EXAM_PAPER_MAX_MODEL_CALLS`) now gates every repair
 * pass. Set to 1 here so the single generation call exhausts the budget and no
 * repair re-prompt may fire — even though the paper is out of band AND both
 * repair flags are on.
 *
 * Env MUST be set before importing the SUT (the constant is read at module load).
 */

process.env.EXAM_PAPER_MAX_MODEL_CALLS = '1';

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

jest.mock('@/ai/soul', () => ({ SAHAYAK_SOUL_PROMPT: '', STRUCTURED_OUTPUT_OVERRIDE: '' }));

// Both repair flags ON — the ONLY thing that may stop a repair here is the ceiling.
jest.mock('@/lib/feature-flags', () => ({
    isFeatureEnabled: jest.fn(async (flag: string) => ({
        enabled: flag === 'examPaperPyqRatioRepair' || flag === 'examPaperMarksRepair',
    })),
}));

jest.mock('@/lib/ncert/validate-chapter', () => ({ validateChapterForFlow: jest.fn(() => null) }));
jest.mock('@/lib/firebase-admin', () => ({ getStorageInstance: jest.fn() }));
jest.mock('@/lib/logger/structured-logger', () => ({
    StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(() => 'error-id') },
}));

// Non-empty so pyqContext is truthy and the reconcile block runs.
jest.mock('@/lib/services/pyq-retrieval-service', () => ({
    getPYQsByChapter: jest.fn().mockResolvedValue([
        { id: 'CBSE_mathematics_c10_fixture1', question: 'Fixture PYQ 1', subject: 'mathematics', class: 10, year: 2024, chapter: 'Real Numbers', marks: 1, type: 'MCQ', board: 'CBSE' },
    ]),
}));

// ── Import SUT AFTER mocks ─────────────────────────────────────────────────
// `require` (not `import`) so it runs AFTER the process.env line above — ES
// import statements are hoisted above it and would read the default ceiling.

type SUT = typeof import('@/ai/flows/exam-paper-generator');
type ExamPaperInput = SUT['generateExamPaper'] extends (input: infer I) => unknown ? I : never;
const { generateExamPaper } = require('@/ai/flows/exam-paper-generator') as SUT;

const promptSpy = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;
const mockFlag = (jest.requireMock('@/lib/feature-flags') as { isFeatureEnabled: jest.Mock }).isFeatureEnabled;
const RATIO_AND_MARKS_ONLY = (flag: string) => ({
    enabled: flag === 'examPaperPyqRatioRepair' || flag === 'examPaperMarksRepair',
});

const BASE_INPUT: ExamPaperInput = {
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Mathematics',
    chapters: ['Real Numbers'],
    language: 'English',
    difficulty: 'mixed',
    includeAnswerKey: true,
    includeMarkingScheme: true,
    maxMarks: 10,
};

function paperFixture(count: number, pyqCount: number) {
    return {
        title: 'CBSE Class 10 Mathematics Sample Paper',
        board: 'CBSE',
        subject: 'Mathematics',
        gradeLevel: 'Class 10',
        duration: '3 Hours',
        maxMarks: count,
        generalInstructions: ['Attempt all questions.'],
        sections: [{
            name: 'Section A',
            label: 'Objective Questions',
            totalMarks: count,
            questions: Array.from({ length: count }, (_, i) => ({
                number: i + 1,
                text: `Question ${i + 1}`,
                marks: 1,
                correctOption: '',
                source: i < pyqCount ? 'PYQ 2024' : 'New',
            })),
        }],
    };
}

describe('exam-paper-generator: MAX_MODEL_CALLS ceiling (C2)', () => {
    it('blocks the repair re-prompt once the logical call budget is spent', async () => {
        // 20% PYQ against a 50±5 target: out of band, so the ratio repair WOULD
        // fire — but the ceiling of 1 was already spent by the generation call.
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10, 2) });

        const result = await generateExamPaper({ ...BASE_INPUT, pyqRatio: 50 });

        expect(promptSpy).toHaveBeenCalledTimes(1); // no repair re-prompt despite the drift
        expect(result.sections[0].questions.filter(q => /^pyq/i.test(q.source)).length).toBe(2);
    });

    it('blocks the answer-key backfill re-prompt once the call budget is spent', async () => {
        // Marks match (no drift), so only the backfill gate is under test here.
        // Non-MCQ questions (empty correctOption) with no answerKey/markingScheme
        // survive deterministic stamping, so `missing.length > 0` — but the
        // ceiling of 1 was already spent by the main generation call, so the
        // backfill re-prompt must not fire. Enable ONLY the backfill flag so
        // 'backfill-disabled' can't mask the ceiling reason.
        mockFlag.mockImplementation(async (flag: string) => ({ enabled: flag === 'examPaperKeyBackfill' }));
        promptSpy.mockClear(); // this file has no shared beforeEach reset; the prior test left a call recorded
        promptSpy.mockResolvedValueOnce({
            output: {
                title: 'CBSE Class 10 Mathematics Sample Paper',
                board: 'CBSE',
                subject: 'Mathematics',
                gradeLevel: 'Class 10',
                duration: '3 Hours',
                maxMarks: 10,
                generalInstructions: ['Attempt all questions.'],
                sections: [{
                    name: 'Section A',
                    label: 'Objective Questions',
                    totalMarks: 10,
                    questions: Array.from({ length: 10 }, (_, i) => ({
                        number: i + 1,
                        text: `Question ${i + 1}`,
                        marks: 1,
                        correctOption: '',
                        source: 'New',
                        // answerKey/markingScheme deliberately omitted.
                    })),
                }],
            },
        });

        const result = await generateExamPaper(BASE_INPUT);

        expect(promptSpy).toHaveBeenCalledTimes(1); // no backfill re-prompt despite missing keys
        expect(result.answerKeyCompleteness?.placeholderReason).toBe('model-call-ceiling-reached');

        mockFlag.mockImplementation(RATIO_AND_MARKS_ONLY); // restore the file's default
    });
});
