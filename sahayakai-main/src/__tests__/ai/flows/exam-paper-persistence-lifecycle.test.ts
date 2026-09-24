/**
 * @jest-environment node
 *
 * Persistence lifecycle contract for `generateExamPaper` (H3, 2026-07-16):
 * a single `contentId`, minted up front, is used to upsert the SAME Firestore
 * doc through 'generating' -> 'ready' | 'error' — never a second doc, never a
 * model-fabricated id, and a Firestore write failure must never fail
 * generation (persistStatus is best-effort by design).
 *
 * In-process contract tests; no Gemini calls, no real Firestore (dbAdapter is
 * mocked at the module boundary, following the pattern used across
 * src/__tests__/api/exam-paper-save.test.ts and src/__tests__/lib/persist-helpers.test.ts).
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

// All repair passes OFF — persistence lifecycle is the only thing under test,
// so a clean fixture (matching marks, placeholder-filled keys) must produce
// exactly ONE prompt call.
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

jest.mock('@/lib/services/pyq-retrieval-service', () => ({
    getPYQsByChapter: jest.fn().mockResolvedValue([]),
}));

const mockSaveContent = jest.fn();
const mockGetUser = jest.fn();
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        saveContent: (...args: unknown[]) => mockSaveContent(...args),
        getUser: (...args: unknown[]) => mockGetUser(...args),
    },
}));

// teacher-context.ts's getTeacherContextLine has its own internal try/catch and
// never rejects for real — mock it directly so a "throws" test can exercise
// generateExamPaper's own catch around it (exam-paper-generator.ts:485-490).
const mockGetTeacherContextLine = jest.fn();
jest.mock('@/lib/teacher-context', () => ({
    getTeacherContextLine: (...args: unknown[]) => mockGetTeacherContextLine(...args),
}));

// ── Import SUT AFTER mocks ─────────────────────────────────────────────────

import { generateExamPaper, type ExamPaperInput } from '@/ai/flows/exam-paper-generator';
import { StructuredLogger } from '@/lib/logger/structured-logger';

const promptSpy = (jest.requireMock('@/ai/genkit') as { __promptSpy: jest.Mock }).__promptSpy;

// uuid is globally manual-mocked to always return 'mock-uuid-v4' (src/__mocks__/uuid.ts).
const MINTED_ID = 'mock-uuid-v4';

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

/** Schema-valid paper whose question marks sum to exactly `totalMarks`. */
function paperFixture(totalMarks: number, extra: Record<string, unknown> = {}) {
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
        ...extra,
    };
}

describe('exam-paper-generator: persistence lifecycle (H3 contentId contract)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSaveContent.mockReset().mockResolvedValue(undefined);
        mockGetUser.mockReset().mockResolvedValue(undefined);
        mockGetTeacherContextLine.mockReset().mockResolvedValue('');
    });

    it('never mints a contentId or writes to Firestore for an anonymous (no-userId) request', async () => {
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        const result = await generateExamPaper({ ...BASE_INPUT, userId: undefined });

        expect(result.contentId).toBeUndefined();
        expect(mockSaveContent).not.toHaveBeenCalled();
    });

    it('mints one contentId and upserts the SAME doc across generating -> ready', async () => {
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        const result = await generateExamPaper({ ...BASE_INPUT, userId: 'teacher-1' });

        expect(mockSaveContent).toHaveBeenCalledTimes(2);

        const [generatingArgs, readyArgs] = mockSaveContent.mock.calls as Array<[string, Record<string, unknown>]>;
        expect(generatingArgs[0]).toBe('teacher-1');
        expect(generatingArgs[1].id).toBe(MINTED_ID);
        expect(generatingArgs[1].status).toBe('generating');
        expect(generatingArgs[1]).not.toHaveProperty('data');

        expect(readyArgs[1].id).toBe(MINTED_ID);
        expect(readyArgs[1].status).toBe('ready');
        expect(readyArgs[1]).toHaveProperty('data');

        expect(result.contentId).toBe(MINTED_ID);
    });

    it('overwrites a model-fabricated contentId with the system-minted one', async () => {
        promptSpy.mockResolvedValueOnce({
            output: paperFixture(10, { contentId: 'fabricated-id-from-model' }),
        });

        const result = await generateExamPaper({ ...BASE_INPUT, userId: 'teacher-1' });

        expect(result.contentId).toBe(MINTED_ID);
        expect(result.contentId).not.toBe('fabricated-id-from-model');

        const readyArgs = mockSaveContent.mock.calls[1] as [string, { data: { contentId?: string } }];
        expect(readyArgs[1].data.contentId).toBe(MINTED_ID);
    });

    it('degrades gracefully when the Firestore write throws — generation still resolves', async () => {
        mockSaveContent.mockRejectedValue(new Error('firestore unavailable'));
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        const result = await generateExamPaper({ ...BASE_INPUT, userId: 'teacher-1' });

        expect(result.sections[0].questions).toHaveLength(10);
        expect(StructuredLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('status write failed'),
            expect.objectContaining({ operation: 'persistStatus' }),
        );
    });

    it('flips the doc to \'error\' (no data) when generation hard-fails, never leaving it stuck on \'generating\'', async () => {
        // Zero-question paper trips the empty-paper guard (M1) — a schema-valid
        // section array with no questions, the one hard-fail path (typed
        // SchemaValidationError) in this otherwise all-graceful-degradation flow.
        promptSpy.mockResolvedValueOnce({
            output: { ...paperFixture(10), sections: [{ name: 'Section A', label: 'Empty', totalMarks: 0, questions: [] }] },
        });

        let caught: (Error & { errorCode?: string }) | undefined;
        try {
            await generateExamPaper({ ...BASE_INPUT, userId: 'teacher-1' });
        } catch (e) {
            caught = e as Error & { errorCode?: string };
        }

        expect(caught?.name).toBe('SchemaValidationError');
        expect(caught?.errorCode).toBe('AI-SCHEMA-001');
        expect(caught?.message).toBe('Generated exam paper has no questions');

        expect(mockSaveContent).toHaveBeenCalledTimes(2);
        const [, errorArgs] = mockSaveContent.mock.calls as Array<[string, Record<string, unknown>]>;
        expect(errorArgs[1].status).toBe('error');
        expect(errorArgs[1]).not.toHaveProperty('data');
    });

    it('falls back to the teacher profile\'s preferredLanguage when language is unset', async () => {
        mockGetUser.mockResolvedValue({ preferredLanguage: 'Hindi' });
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        await generateExamPaper({ ...BASE_INPUT, userId: 'teacher-1', language: undefined });

        expect(mockGetUser).toHaveBeenCalledWith('teacher-1');
        const callArgs = promptSpy.mock.calls[0][0] as { language: string };
        expect(callArgs.language).toBe('Hindi');
    });

    it('does not fall back to the profile language when an explicit language (incl. English) is set', async () => {
        mockGetUser.mockResolvedValue({ preferredLanguage: 'Hindi' });
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        await generateExamPaper({ ...BASE_INPUT, userId: 'teacher-1', language: 'English' });

        expect(mockGetUser).not.toHaveBeenCalled();
        const callArgs = promptSpy.mock.calls[0][0] as { language: string };
        expect(callArgs.language).toBe('English');
    });

    it('degrades gracefully when getTeacherContextLine throws — generation still resolves', async () => {
        mockGetTeacherContextLine.mockRejectedValue(new Error('profile lookup down'));
        promptSpy.mockResolvedValueOnce({ output: paperFixture(10) });

        const result = await generateExamPaper({ ...BASE_INPUT, userId: 'teacher-1' });

        expect(result.sections[0].questions).toHaveLength(10);
    });
});
