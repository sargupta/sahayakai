/**
 * CLASS GATE — a headless caller of the lesson-plan flow writes NOTHING.
 *
 * `anonymous_user` is the flow's own identity for callers with no teacher
 * account (public MCP servers, server scripts). The flow already skipped the
 * per-teacher rate limit and profile reads for it, but its Library writes and
 * usage tracking only checked `if (userId)` — so every headless call saved a
 * plan to users/anonymous_user/content (found while verifying MCP #1).
 *
 * This runs the REAL flow body (only the model prompt is stubbed) and asserts
 * that neither the fresh-generation path nor the cache-hit path persists or
 * tracks usage for a headless caller — while a real teacher still does.
 */
jest.mock('server-only', () => ({}));
const mockSaveContent = jest.fn(async () => undefined);
const mockGetUser = jest.fn(async () => null);
jest.mock('@/lib/db/adapter', () => ({ dbAdapter: { getUser: (...a: unknown[]) => mockGetUser(...(a as [])), saveContent: (...a: unknown[]) => mockSaveContent(...(a as [])) } }));
const mockStorageSave = jest.fn(async () => undefined);
jest.mock('@/lib/firebase-admin', () => ({
    getStorageInstance: async () => ({ bucket: () => ({ file: () => ({ save: (...a: unknown[]) => mockStorageSave(...(a as [])) }) }) }),
    getDb: jest.fn(),
}));
const mockTrackGemini = jest.fn();
jest.mock('@/lib/usage-tracker', () => ({ UsageTracker: { trackGemini: (...a: unknown[]) => mockTrackGemini(...a) } }));
jest.mock('@/lib/teacher-context', () => ({ getTeacherContextLine: jest.fn(async () => '') }));
jest.mock('@/lib/server-safety', () => ({ checkServerRateLimit: jest.fn(async () => undefined) }));
jest.mock('@sentry/nextjs', () => ({
    startSpan: (_o: unknown, fn: () => unknown) => fn(),
    // (name, [options], callback): run the callback
    withServerActionInstrumentation: (...args: unknown[]) => (args[args.length - 1] as () => unknown)(),
    captureException: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), startTimer: () => ({ end: jest.fn(), stop: jest.fn() }) } }));
jest.mock('@/lib/logger/structured-logger', () => ({ StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const PLAN = {
    title: 'Photosynthesis', gradeLevel: 'Class 7', duration: '40 minutes', subject: 'Science',
    objectives: ['Explain how plants make food'], keyVocabulary: [], materials: ['Leaves'],
    activities: ['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate'].map((phase) => ({ phase, name: phase, description: 'd', duration: '8 minutes' })),
    assessment: 'Quiz', homework: 'Observe a plant', language: 'English',
};
const mockPrompt = jest.fn(async () => ({ output: PLAN, usage: { totalTokens: 1234 } }));
jest.mock('@/ai/genkit', () => ({
    ai: {
        definePrompt: () => (...a: unknown[]) => mockPrompt(...(a as [])),
        defineFlow: (_c: unknown, fn: (input: unknown) => unknown) => fn,
        generate: jest.fn(),
    },
    runResiliently: async (fn: (cfg: unknown) => unknown) => fn({ config: {} }),
}));
const mockCached = { value: null as unknown };
jest.mock('@/lib/lesson-plan-cache', () => ({
    generateLessonPlanCacheKey: () => 'cache-key',
    getCachedLessonPlan: jest.fn(async () => mockCached.value),
    setCachedLessonPlan: jest.fn(),
}));

import { generateLessonPlan } from '@/ai/flows/lesson-plan-generator';

const INPUT = { topic: 'Photosynthesis', gradeLevels: ['Class 7'], language: 'English', subject: 'Science' };

beforeEach(() => {
    jest.clearAllMocks();
    mockCached.value = null;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('lesson-plan flow: headless caller (anonymous_user) has no side effects', () => {
    it('fresh generation: returns the plan, writes nothing, tracks no usage', async () => {
        const out = await generateLessonPlan({ ...INPUT, userId: 'anonymous_user' });
        expect(out.title).toBe('Photosynthesis');
        expect(mockPrompt).toHaveBeenCalledTimes(1);
        expect(mockSaveContent).not.toHaveBeenCalled();
        expect(mockStorageSave).not.toHaveBeenCalled();
        expect(mockTrackGemini).not.toHaveBeenCalled();
        expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('cache hit: returns the cached plan, writes nothing', async () => {
        mockCached.value = PLAN;
        const out = await generateLessonPlan({ ...INPUT, userId: 'anonymous_user' });
        expect(out.title).toBe('Photosynthesis');
        expect(mockPrompt).not.toHaveBeenCalled();
        expect(mockSaveContent).not.toHaveBeenCalled();
        expect(mockStorageSave).not.toHaveBeenCalled();
    });

    it('control: a real teacher still gets the plan saved to their Library and usage tracked', async () => {
        await generateLessonPlan({ ...INPUT, userId: 'teacher-1' });
        expect(mockSaveContent).toHaveBeenCalledTimes(1);
        expect((mockSaveContent.mock.calls[0] as unknown[])[0]).toBe('teacher-1');
        expect(mockTrackGemini).toHaveBeenCalledWith('teacher-1', 1234, expect.any(String));
    });
});
