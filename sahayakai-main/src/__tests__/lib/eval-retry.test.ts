/**
 * Class gate: a quota error from the app is retried by the live-eval runner, after a wait;
 * a language or expectation failure never is (review 2026-11-16: two cases went red on
 * "AI service is temporarily overloaded" because the runner only knew raw provider messages).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { AIQuotaExhaustedError } from '@/ai/genkit';
import { evalRetryDelayMs, MAX_EVAL_RETRY_WAIT_MS } from '@/lib/eval-retry';

jest.mock('@/ai/genkit', () => {
    class AIQuotaExhaustedError extends Error {
        readonly retryAfterSeconds: number;
        constructor(message: string, retryAfterSeconds = 60) { super(message); this.name = 'AIQuotaExhaustedError'; this.retryAfterSeconds = retryAfterSeconds; }
    }
    return { AIQuotaExhaustedError };
});

describe('live-eval retry classification', () => {
    it("retries the app's quota error after its own wait, capped", () => {
        expect(evalRetryDelayMs(new AIQuotaExhaustedError('AI service is temporarily overloaded. Please try again in a minute.', 30))).toBe(30_000);
        expect(evalRetryDelayMs(new AIQuotaExhaustedError('x', 600))).toBe(MAX_EVAL_RETRY_WAIT_MS);
    });

    it('retries raw provider transients quickly', () => {
        for (const m of ['429 Too Many Requests', 'RESOURCE_EXHAUSTED', '503 UNAVAILABLE', 'fetch failed', 'timeout after 90000ms']) {
            expect(evalRetryDelayMs(new Error(m))).toBe(2_000);
        }
    });

    it('never retries a quality failure', () => {
        expect(evalRetryDelayMs(new Error('language regression: only 6 target-script chars in checked fields (need >= 8)'))).toBeNull();
        expect(evalRetryDelayMs(new Error('expect status="ok", got "fail"'))).toBeNull();
        expect(evalRetryDelayMs(new Error('flow returned empty result'))).toBeNull();
    });

    it('the eval runner uses this classifier', () => {
        const runner = readFileSync(path.resolve(__dirname, '..', '..', '..', 'scripts', 'eval', 'run-evals.mts'), 'utf8');
        expect(runner).toMatch(/evalRetryDelayMs\(/);
        expect(runner).not.toMatch(/const isTransient\s*=/);
    });
});
