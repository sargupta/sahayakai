/**
 * @jest-environment node
 *
 * CLASS GATE — the exam-paper flow, called with the MCP's headless caller
 * (`HEADLESS_EXAM_PAPER_CALLER`, an empty userId), writes NOTHING and reads
 * no teacher profile or context — while a real teacher still gets the
 * Library lifecycle. Runs the REAL flow body; only the model prompt is
 * stubbed. If anyone changes the flow's `if (uid)` guards, or the MCP's
 * headless caller value, this fails.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/ai/genkit', () => {
    const promptSpy = jest.fn();
    return {
        __promptSpy: promptSpy,
        ai: { definePrompt: jest.fn(() => promptSpy), defineFlow: (_c: unknown, fn: (i: unknown) => unknown) => fn, generate: jest.fn() },
        runResiliently: jest.fn(async (fn: (cfg: unknown) => unknown) => fn({ config: {} })),
    };
});
jest.mock('@/ai/soul', () => ({ SAHAYAK_SOUL_PROMPT: '', STRUCTURED_OUTPUT_OVERRIDE: '' }));
jest.mock('@/lib/feature-flags', () => ({ isFeatureEnabled: jest.fn(async () => ({ enabled: false })) }));
jest.mock('@/lib/ncert/validate-chapter', () => ({ validateChapterForFlow: jest.fn(() => null) }));
jest.mock('@/lib/firebase-admin', () => ({ getStorageInstance: jest.fn(), getDb: jest.fn() }));
jest.mock('@/lib/logger/structured-logger', () => ({ StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(() => 'error-id') } }));
jest.mock('@/lib/services/pyq-retrieval-service', () => ({ getPYQsByChapter: jest.fn().mockResolvedValue([]) }));
const mockSaveContent = jest.fn(async () => undefined);
const mockGetUser = jest.fn(async () => undefined);
jest.mock('@/lib/db/adapter', () => ({ dbAdapter: { saveContent: (...a: unknown[]) => mockSaveContent(...(a as [])), getUser: (...a: unknown[]) => mockGetUser(...(a as [])) } }));
const mockTeacherContext = jest.fn(async () => '');
jest.mock('@/lib/teacher-context', () => ({ getTeacherContextLine: (...a: unknown[]) => mockTeacherContext(...(a as [])) }));

import { generateExamPaper, type ExamPaperInput } from '@/ai/flows/exam-paper-generator';
import { HEADLESS_EXAM_PAPER_CALLER } from '@/lib/mcp/exam-paper/service';

const promptSpy = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;

const INPUT: ExamPaperInput = {
    board: 'CBSE', gradeLevel: 'Class 8', subject: 'Science', chapters: ['Force and Pressure'], language: 'English',
    difficulty: 'moderate', includeAnswerKey: true, includeMarkingScheme: true, maxMarks: 4,
};
const PAPER = {
    title: 'CBSE Class 8 Science', board: 'CBSE', subject: 'Science', gradeLevel: 'Class 8', duration: '30 Minutes', maxMarks: 4,
    generalInstructions: ['Attempt all.'],
    sections: [{ name: 'Section A', label: 'Short', totalMarks: 4, questions: [1, 2, 3, 4].map((n) => ({ number: n, text: `Q${n}`, marks: 1, correctOption: '', source: 'New', answerKey: 'A', markingScheme: '1' })) }],
};

beforeEach(() => {
    jest.clearAllMocks();
    promptSpy.mockReset().mockResolvedValue({ output: PAPER });
});

it('the MCP headless caller is falsy (the flow\'s "no teacher" identity)', () => {
    expect(HEADLESS_EXAM_PAPER_CALLER).toBe('');
});

it('a headless (MCP) call persists nothing and reads no teacher data', async () => {
    const out = await generateExamPaper({ ...INPUT, userId: HEADLESS_EXAM_PAPER_CALLER });
    expect(out.sections).toHaveLength(1);
    expect(out.contentId).toBeUndefined();
    expect(mockSaveContent).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockTeacherContext).not.toHaveBeenCalled();
});

it('a real teacher still gets the Library lifecycle (interactive behaviour unchanged)', async () => {
    const out = await generateExamPaper({ ...INPUT, userId: 'teacher-123' });
    expect(out.contentId).toBeDefined();
    expect(mockSaveContent).toHaveBeenCalledWith('teacher-123', expect.anything());
});
