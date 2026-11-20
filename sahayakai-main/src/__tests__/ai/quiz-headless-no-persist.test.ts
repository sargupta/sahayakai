/**
 * @jest-environment node
 *
 * CLASS GATE — the quiz service, called with the MCP's headless caller
 * (`HEADLESS_QUIZ_CALLER`, an empty userId), writes NOTHING (no Storage
 * blob, no Library doc), reads no teacher profile or context and meters no
 * Gemini usage — while a real teacher still gets all of that. Runs the REAL
 * `generateQuiz` and the REAL `quizGeneratorFlow` (usage metering lives
 * there); only the model prompt is stubbed.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/ai/genkit', () => {
    const promptSpy = jest.fn();
    class AIQuotaExhaustedError extends Error {}
    return {
        __promptSpy: promptSpy,
        AIQuotaExhaustedError,
        ai: { definePrompt: jest.fn(() => promptSpy), defineFlow: (_c: unknown, fn: (i: unknown) => unknown) => fn, generate: jest.fn() },
        runResiliently: jest.fn(async (fn: (cfg: unknown) => unknown) => fn({ config: {} })),
    };
});
jest.mock('@/ai/soul', () => ({ SAHAYAK_SOUL_PROMPT: '', STRUCTURED_OUTPUT_OVERRIDE: '' }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/logger/structured-logger', () => ({ StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const mockStorageSave = jest.fn(async () => undefined);
jest.mock('@/lib/firebase-admin', () => ({
    getStorageInstance: async () => ({ bucket: () => ({ file: () => ({ save: (...a: unknown[]) => mockStorageSave(...(a as [])) }) }) }),
    getDb: jest.fn(),
}));
jest.mock('firebase-admin/firestore', () => ({ Timestamp: { fromDate: (d: Date) => d } }));
const mockSaveContent = jest.fn(async () => undefined);
const mockGetUser = jest.fn(async () => ({ preferredLanguage: 'Hindi' }));
jest.mock('@/lib/db/adapter', () => ({ dbAdapter: { saveContent: (...a: unknown[]) => mockSaveContent(...(a as [])), getUser: (...a: unknown[]) => mockGetUser(...(a as [])) } }));
const mockTeacherContext = jest.fn(async () => 'ctx');
jest.mock('@/lib/teacher-context', () => ({ getTeacherContextLine: (...a: unknown[]) => mockTeacherContext(...(a as [])) }));
const mockTrackGemini = jest.fn();
jest.mock('@/lib/usage-tracker', () => ({ UsageTracker: { trackGemini: (...a: unknown[]) => mockTrackGemini(...a) } }));

import { generateQuiz } from '@/ai/flows/quiz-generator';
import { HEADLESS_QUIZ_CALLER } from '@/lib/mcp/quiz/service';

const promptSpy = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;

const QUIZ = {
    title: 'Fractions', teacherInstructions: 'Use the board.', gradeLevel: 'Class 7', subject: 'Mathematics',
    questions: [1, 2, 3].map((n) => ({ questionText: `What is ${n}/4 + 1/4 written in simplest form?`, questionType: 'short_answer', correctAnswer: `${n + 1}/4`, explanation: 'Add the numerators and keep the denominator the same, then simplify.', difficultyLevel: 'medium' })),
};
const INPUT = { topic: 'Fractions', gradeLevel: 'Class 7', questionTypes: ['short_answer' as const], numQuestions: 3 };

beforeEach(() => {
    jest.clearAllMocks();
    promptSpy.mockReset().mockResolvedValue({ output: QUIZ, usage: { totalTokens: 1234 } });
});

it('the MCP headless caller is falsy (the service\'s "no teacher" identity)', () => {
    expect(HEADLESS_QUIZ_CALLER).toBe('');
});

it('a headless (MCP) call persists nothing, reads no teacher data and meters no usage', async () => {
    const out = await generateQuiz({ ...INPUT, userId: HEADLESS_QUIZ_CALLER });
    expect(out.medium?.questions).toHaveLength(3);
    expect(out.isSaved).toBe(false);
    expect(mockStorageSave).not.toHaveBeenCalled();
    expect(mockSaveContent).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockTeacherContext).not.toHaveBeenCalled();
    expect(mockTrackGemini).not.toHaveBeenCalled();
});

it('a real teacher still gets Library persistence and usage metering (interactive behaviour unchanged)', async () => {
    const out = await generateQuiz({ ...INPUT, userId: 'teacher-123' });
    expect(out.isSaved).toBe(true);
    expect(mockStorageSave).toHaveBeenCalledTimes(1);
    expect(mockSaveContent).toHaveBeenCalledWith('teacher-123', expect.objectContaining({ type: 'quiz' }));
    expect(mockTrackGemini).toHaveBeenCalledWith('teacher-123', 1234, expect.any(String));
});
