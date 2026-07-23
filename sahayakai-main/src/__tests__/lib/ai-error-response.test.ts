/**
 * Regression test for `handleAIError` / `logAIError` and `PlanLimitExceededError`.
 *
 * Before this fix, neither helper had a branch for `PlanLimitExceededError`
 * (thrown by `checkUsage` in usage-tracker.ts). That meant:
 *   - `handleAIError` (used by assess-assignment) fell through to the
 *     generic 500 "AI generation failed" branch instead of returning 429
 *     with the PLAN_LIMIT_EXCEEDED payload the client's upgrade UI expects.
 *   - `logAIError` (used by visual-aid/avatar alongside their own custom
 *     429 response branches) logged at ERROR severity, paging on-call for
 *     a routine, expected per-user quota hit instead of WARN.
 */

// The project's jsdom test env doesn't preserve NextResponse.json bodies
// through `await res.json()` — mirror video-storyteller-quota.test.ts and mock it.
jest.mock('next/server', () => ({
    NextResponse: {
        json: (data: unknown, init?: { status?: number }) => ({
            status: init?.status ?? 200,
            ok: (init?.status ?? 200) < 400,
            json: async () => data,
            text: async () => JSON.stringify(data),
            headers: new Map(),
        }),
    },
}));

const warnSpy = jest.fn();
const errorSpy = jest.fn();

jest.mock('@/lib/logger', () => ({
    logger: {
        warn: (...args: unknown[]) => warnSpy(...args),
        error: (...args: unknown[]) => errorSpy(...args),
    },
}));

import { handleAIError, logAIError } from '@/lib/ai-error-response';
import { PlanLimitExceededError } from '@/lib/usage-tracker';

beforeEach(() => {
    jest.clearAllMocks();
});

describe('PlanLimitExceededError handling', () => {
    it('handleAIError returns 429 with PLAN_LIMIT_EXCEEDED, not a generic 500', async () => {
        const error = new PlanLimitExceededError('gemini_tokens', 500_000, 500_000);

        const response = handleAIError(error, 'ASSESS_ASSIGNMENT', {
            message: 'Assessment API failed',
            userId: 'teacher-1',
        });

        expect(response.status).toBe(429);
        const body = await response.json();
        expect(body).toMatchObject({
            code: 'PLAN_LIMIT_EXCEEDED',
            type: 'gemini_tokens',
            used: 500_000,
            limit: 500_000,
        });
        // Routine/expected — should not be logged at ERROR.
        expect(errorSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
    });

    it('logAIError logs at WARN, not ERROR, for a plan-limit hit', () => {
        const error = new PlanLimitExceededError('image_generation', 10, 10);

        logAIError(error, 'VISUAL_AID', { message: 'Visual Aid API Failed', userId: 'teacher-2' });

        expect(errorSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const [, , meta] = warnSpy.mock.calls[0];
        expect(meta).toMatchObject({ reason: 'plan_limit', type: 'image_generation' });
    });
});
