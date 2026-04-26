/**
 * Unit tests for the `withTimeout` wrapper in
 * `src/ai/flows/parent-call-agent.ts`.
 *
 * The wrapper exists to bound `runResiliently`'s 60s worst-case
 * backoff to a 10s ceiling so the Twilio webhook budget can't be
 * blown by a single-key 429 storm. We test the public API
 * (`generateAgentReply`) end-to-end with the underlying genkit prompt
 * mocked, so the timeout path is exercised the same way it would fire
 * in production.
 *
 * Round-2 audit reference: master-plan risk #1.
 */

import type { AgentReplyInput, AgentReplyOutput } from '@/ai/flows/parent-call-agent';

// ── Mock the genkit + behavioural-guard imports ───────────────────────────
// We do not call assertAllRules — we test the timeout wrapping. Mock the
// guard to a no-op so a missing terminator in the synthetic reply cannot
// confound the timeout assertion.

jest.mock('@/ai/genkit', () => ({
    ai: {
        definePrompt: () => async () => ({ output: { reply: 'mock', shouldEndCall: false } }),
    },
    runResiliently: jest.fn(),
}));

jest.mock('@/lib/parent-call-guard', () => ({
    assertAllRules: jest.fn(),
    BehaviouralGuardError: class extends Error {
        readonly axis = 'forbidden_phrase';
        readonly details = '';
        readonly parentLanguage = '';
        constructor(msg: string) {
            super(msg);
        }
    },
}));

import { runResiliently } from '@/ai/genkit';
import { generateAgentReply, GenkitTimeoutError } from '@/ai/flows/parent-call-agent';

const mockRunResiliently = runResiliently as jest.MockedFunction<typeof runResiliently>;

// Use fake timers so the 10s ceiling can fire deterministically.
beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

const BASE_INPUT: AgentReplyInput = {
    studentName: 'Arav',
    className: 'Class 5',
    subject: 'Science',
    reason: 'Homework',
    teacherMessage: 'Daily homework reminder',
    parentLanguage: 'en',
    transcript: [],
    parentSpeech: 'OK',
    turnNumber: 1,
};

const FAST_REPLY: AgentReplyOutput = {
    reply: 'Thank you. Reading at home helps your child grow stronger.',
    shouldEndCall: false,
    followUpQuestion: undefined,
};

describe('generateAgentReply — withTimeout', () => {
    it('returns the reply when runResiliently resolves under the ceiling', async () => {
        mockRunResiliently.mockResolvedValue({ output: FAST_REPLY });

        const promise = generateAgentReply(BASE_INPUT);
        // No timer advance needed — the mock resolves immediately.
        await jest.runAllTimersAsync();

        const out = await promise;
        expect(out.reply).toBe(FAST_REPLY.reply);
        expect(mockRunResiliently).toHaveBeenCalledTimes(1);
    });

    it('throws GenkitTimeoutError when runResiliently exceeds 10s', async () => {
        // Make runResiliently a promise that never resolves so only the
        // timeout race can complete. Using a never-resolving promise
        // simulates the real production failure mode (60s of 429
        // backoff that the wrapper must abort).
        mockRunResiliently.mockReturnValue(new Promise(() => {}));

        const promise = generateAgentReply(BASE_INPUT);

        // Catch ahead so the rejection doesn't trip the unhandled-rejection
        // guard while we advance the clock.
        const settled = promise.catch((err) => err);

        // Advance fake clock past the 10s ceiling.
        await jest.advanceTimersByTimeAsync(10_001);

        const err = await settled;
        expect(err).toBeInstanceOf(GenkitTimeoutError);
        expect((err as GenkitTimeoutError).span).toBe('parentCall.agentReply');
        expect((err as GenkitTimeoutError).elapsedMs).toBe(10_000);
    });

    it('does NOT timeout if runResiliently resolves at 9.9s', async () => {
        mockRunResiliently.mockImplementation(
            () =>
                new Promise<{ output: AgentReplyOutput }>((resolve) => {
                    setTimeout(() => resolve({ output: FAST_REPLY }), 9_900);
                }),
        );

        const promise = generateAgentReply(BASE_INPUT);
        await jest.advanceTimersByTimeAsync(9_900);

        const out = await promise;
        expect(out.reply).toBe(FAST_REPLY.reply);
    });
});

describe('GenkitTimeoutError', () => {
    it('carries span + elapsedMs', () => {
        const err = new GenkitTimeoutError('parentCall.summary', 30_000);
        expect(err.name).toBe('GenkitTimeoutError');
        expect(err.span).toBe('parentCall.summary');
        expect(err.elapsedMs).toBe(30_000);
        expect(err.message).toContain('30000');
    });
});
