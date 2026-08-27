/**
 * Class gate for the 2026-08-24 visual-aid misclassification.
 *
 * WHAT HAPPENED
 * Every visual-aid generation returned HTTP 500 "Image generation failed.
 * Please try again." Investigation showed the failures were upstream Gemini /
 * Imagen 429s — logAIError already classified them correctly as
 * reason:'quota', but the route's HTTP branches only knew about its own
 * per-user cap ("Daily image limit reached"), so an upstream quota error fell
 * through to a blanket 500.
 *
 * Two costs. The teacher was told to retry something that would keep failing,
 * and on-call was paged for a crash that was really rate limiting. Eight other
 * AI routes already funnelled their fall-through through handleAIError, which
 * returns 503 + Retry-After for exactly this; visual-aid was the one route
 * still hand-rolling its own ending.
 *
 * WHAT THIS GATE CATCHES
 * Not "upstream 429 returns 503" alone — the class is: this route must never
 * answer a classified, non-crash condition with a blanket 500. Any future
 * error shape that handleAIError knows how to classify is covered without
 * touching this file, and a regression that reinstates a catch-all 500 fails
 * here.
 */

import { NextResponse } from 'next/server';

const dispatchVisualAidMock = jest.fn();
const checkUsageMock = jest.fn();

jest.mock('@/lib/sidecar/visual-aid-dispatch', () => ({
    dispatchVisualAid: (...a: any[]) => dispatchVisualAidMock(...a),
}));

class PlanLimitExceededError extends Error {
    type = 'visual-aid';
    used = 10;
    limit = 10;
    constructor() {
        super('Plan limit exceeded');
        this.name = 'PlanLimitExceededError';
    }
}

jest.mock('@/lib/usage-tracker', () => ({
    checkUsage: (...a: any[]) => checkUsageMock(...a),
    PlanLimitExceededError,
}));

// withPlanCheck wraps the handler; pass it straight through so the test
// exercises the route's own catch block rather than the plan gate.
jest.mock('@/lib/plan-guard', () => ({
    withPlanCheck: () => (h: any) => h,
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const jsonSpy = jest.spyOn(NextResponse, 'json');
function lastCall(): { body: any; status: number } {
    const c = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1];
    return { body: c[0] as any, status: (c[1] as any)?.status ?? 200 };
}

function makeRequest(body: unknown = { prompt: 'a leaf', gradeLevel: 'Class 6', language: 'en' }) {
    return {
        headers: { get: (h: string) => (h === 'x-user-id' ? 'user-123' : null) },
        json: async () => body,
    } as any;
}

/** Shape of an upstream provider quota rejection, as the SDK surfaces it. */
function upstreamQuotaError() {
    const e: any = new Error('429 Too Many Requests: Resource has been exhausted');
    e.status = 429;
    return e;
}

describe('POST /api/ai/visual-aid — error classification (class gate)', () => {
    let POST: any;

    beforeAll(async () => {
        ({ POST } = await import('@/app/api/ai/visual-aid/route'));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        checkUsageMock.mockResolvedValue(undefined);
    });

    // The exact production failure: upstream 429, previously a blanket 500.
    it('answers an upstream provider 429 with a retryable 5xx, not a blanket 500', async () => {
        dispatchVisualAidMock.mockRejectedValueOnce(upstreamQuotaError());

        await POST(makeRequest());
        const { body, status } = lastCall();

        expect(status).not.toBe(500);
        expect(status).toBeGreaterThanOrEqual(429);
        expect(String(body.error)).not.toBe('Image generation failed. Please try again.');
    });

    it('does not tell the teacher to retry when retrying cannot help', async () => {
        // The app's own daily cap is a hard stop until midnight IST. Answering
        // it with "please try again" is what made the old message misleading.
        dispatchVisualAidMock.mockRejectedValueOnce(
            new Error('Daily image limit reached. You can generate 10 images per day.')
        );

        await POST(makeRequest());
        const { body, status } = lastCall();

        expect(status).toBe(429);
        expect(String(body.error)).toMatch(/Daily image limit reached/);
    });

    it('keeps the route-specific classifications intact', async () => {
        const cases: Array<[Error, number]> = [
            [new Error('IMAGE_GENERATION_TIMEOUT'), 504],
            [new Error('IMAGE_GENERATION_EMPTY'), 422],
            [new Error('Safety Violation: unsafe prompt'), 400],
            [new PlanLimitExceededError(), 429],
        ];
        for (const [err, expected] of cases) {
            jest.clearAllMocks();
            checkUsageMock.mockResolvedValue(undefined);
            dispatchVisualAidMock.mockRejectedValueOnce(err);

            await POST(makeRequest());
            expect(lastCall().status).toBe(expected);
        }
    });

    it('still surfaces a genuine crash as a server error', async () => {
        // The gate must not push everything off 500 — an actual bug should
        // still read as a server error, or we would hide real crashes.
        dispatchVisualAidMock.mockRejectedValueOnce(new TypeError('x is not a function'));

        await POST(makeRequest());
        expect(lastCall().status).toBeGreaterThanOrEqual(500);
    });
});
