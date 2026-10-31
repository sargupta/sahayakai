/**
 * /api/ai/intent (dashboard prompt box):
 *   - greetings / unclassified prompts are answered, through the
 *     instant-answer dispatcher, which never persists to My Library
 *     (gated in instant-answer-dispatch.test.ts);
 *   - questions ABOUT the app ("where is attendance?") are answered from the
 *     app manifest and never reach the instant-answer flow at all;
 *   - "take me to X" navigates only to a manifest route;
 *   - generator intents route exactly as before.
 */

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

beforeEach(() => {
    jest.clearAllMocks();
    mockInstantAnswer.mockResolvedValue({ answer: 'Namaste! How can I help?', videoSuggestionUrl: null });
});

describe('POST /api/ai/intent — conversation vs app help vs generators', () => {
    it('"Hi Vidya" (unknown) is answered as conversation', async () => {
        mockRouter.mockResolvedValue({ type: 'unknown', plannedActions: [] });

        await POST(req('Hi Vidya'));

        expect(result()).toMatchObject({ action: 'ANSWER', content: 'Namaste! How can I help?' });
        expect(mockInstantAnswer).toHaveBeenCalledTimes(1);
    });

    it('"Where is attendance?" is answered from the app map, not the instant-answer flow', async () => {
        mockRouter.mockResolvedValue({
            type: 'appHelp', plannedActions: [], appDestination: 'attendance', wantsNavigation: false,
            appAnswer: 'Attendance is in the sidebar under Assess → Attendance.',
        });

        await POST(req('Where is attendance?'));

        expect(result()).toMatchObject({ action: 'ANSWER', content: 'Attendance is in the sidebar under Assess → Attendance.' });
        expect(mockInstantAnswer).not.toHaveBeenCalled();
    });

    it('falls back to the manifest location when the model gave no answer text', async () => {
        mockRouter.mockResolvedValue({ type: 'appHelp', plannedActions: [], appDestination: 'my-library' });

        await POST(req('where is my library'));

        expect(String(result().content)).toContain('My Library');
    });

    it('"Take me to the Library" navigates to the manifest route', async () => {
        mockRouter.mockResolvedValue({ type: 'appHelp', plannedActions: [], appDestination: 'my-library', wantsNavigation: true });

        await POST(req('Take me to the Library'));

        expect(result()).toEqual({ action: 'NAVIGATE', url: '/my-library' });
    });

    it('never navigates to a destination outside the manifest', async () => {
        mockRouter.mockResolvedValue({ type: 'appHelp', plannedActions: [], appDestination: '/admin/cost-dashboard', wantsNavigation: true });

        await POST(req('open admin'));

        expect(result().action).toBe('ANSWER');
    });

    it('generator intents still route to the tool page', async () => {
        mockRouter.mockResolvedValue({ type: 'worksheet', topic: 'Fractions', gradeLevel: 'Class 5', plannedActions: [] });

        await POST(req('Make me a Class 5 fractions worksheet'));

        expect(result().action).toBe('NAVIGATE');
        expect(String(result().url)).toMatch(/^\/worksheet-wizard\?/);
        expect(mockInstantAnswer).not.toHaveBeenCalled();
    });
});
