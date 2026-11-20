/**
 * Class gate: a request that names a tool and asks for it opens that tool.
 *
 * Production, 17 Nov 2026: "help me generate a lesson plan" was classified
 * `unknown`, and /api/ai/intent turned it into a one-line instant answer, so
 * VIDYA never opened the lesson planner. For every tool and in English, Hindi
 * and Bengali, a classifier miss (`unknown` / `instantAnswer`) on an explicit
 * request must still navigate to the tool; a question ABOUT a tool, with no
 * asking verb, is still answered.
 */
import { toolRequested } from '@/lib/intent/tool-request';

const mockRouter = jest.fn();
const mockInstantAnswer = jest.fn();
jest.mock('@/ai/flows/agent-definitions', () => ({ agentRouterFlow: (...a: unknown[]) => mockRouter(...a) }));
jest.mock('@/lib/sidecar/instant-answer-dispatch', () => ({ dispatchInstantAnswer: (...a: unknown[]) => mockInstantAnswer(...a) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/ai-error-response', () => ({ logAIError: jest.fn() }));
const jsonSpy = jest.fn();
jest.mock('next/server', () => ({
    NextResponse: {
        json: (data: unknown, init?: { status?: number }) => {
            jsonSpy(data, init);
            return { status: init?.status ?? 200 };
        },
    },
}));

import { POST } from '@/app/api/ai/intent/route';

function req(prompt: string) {
    return {
        json: async () => ({ prompt, language: 'en', uiLanguage: 'en' }),
        headers: { get: (k: string) => (k === 'x-user-id' ? 'teacher-1' : null) },
    } as unknown as Request;
}
const result = () => (jsonSpy.mock.calls.at(-1)?.[0] as { result: Record<string, unknown> }).result;

const ASKS: Array<[string, string]> = [
    ['help me generate a lesson plan', '/lesson-plan'],
    ['Can you create a lesson plan on fractions', '/lesson-plan'],
    ['मुझे पाठ योजना बनाओ', '/lesson-plan'],
    ['লেসন প্ল্যান তৈরি করে দাও', '/lesson-plan'],
    ['make a quiz', '/quiz-generator'],
    ['क्विज़ बनाओ', '/quiz-generator'],
    ['I need a worksheet', '/worksheet-wizard'],
    ['please prepare an exam paper for class 10', '/exam-paper'],
    ['প্রশ্নপত্র বানাও', '/exam-paper'],
    ['create a rubric', '/rubric-generator'],
    ['design a visual aid for the water cycle', '/visual-aid-designer'],
];

beforeEach(() => {
    jest.clearAllMocks();
    mockInstantAnswer.mockResolvedValue({ answer: 'A short answer.', videoSuggestionUrl: null });
});

describe('a named tool request opens the tool even when the classifier misses', () => {
    it.each(ASKS)('%s → %s (classifier said unknown)', async (prompt, route) => {
        mockRouter.mockResolvedValue({ type: 'unknown', plannedActions: [] });
        await POST(req(prompt));
        expect(result()).toMatchObject({ action: 'NAVIGATE' });
        expect(String(result().url)).toMatch(new RegExp(`^${route}\\?`));
        expect(mockInstantAnswer).not.toHaveBeenCalled();
    });

    it.each(ASKS)('%s → %s (classifier said instantAnswer)', async (prompt, route) => {
        mockRouter.mockResolvedValue({ type: 'instantAnswer', plannedActions: [] });
        await POST(req(prompt));
        expect(String(result().url)).toMatch(new RegExp(`^${route}\\?`));
    });

    it.each(['What is a rubric?', 'Why do lesson plans matter?', 'Hi Vidya'])('"%s" is still answered', async (prompt) => {
        mockRouter.mockResolvedValue({ type: 'unknown', plannedActions: [] });
        await POST(req(prompt));
        expect(result()).toMatchObject({ action: 'ANSWER' });
        expect(toolRequested(prompt)).toBeNull();
    });

    it('a confident classifier result is never overridden', async () => {
        mockRouter.mockResolvedValue({ type: 'quiz', topic: 'plants', plannedActions: [] });
        await POST(req('make a lesson plan and a quiz'));
        expect(String(result().url)).toMatch(/^\/quiz-generator\?/);
    });
});
