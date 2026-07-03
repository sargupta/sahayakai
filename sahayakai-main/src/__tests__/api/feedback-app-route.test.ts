/**
 * Tranche 5 route-shell tests for POST /api/feedback/app (migrated from
 * src/app/actions/feedback.ts::submitFeedback — app/page thumbs feedback,
 * distinct from the pre-existing per-content POST /api/feedback).
 *
 * Auth parity: the action was anonymous-friendly (uid stamped only when the
 * middleware header is present), so the route does NOT hard-401 itself —
 * in production the middleware already rejects tokenless /api/* calls.
 */

const serviceMocks = { submitFeedback: jest.fn() };
jest.mock('@/server/feedback', () => serviceMocks);
jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Repo convention (see profile-check.test.ts): spy on NextResponse.json to
// capture response bodies — the jest Response polyfill drops them.
import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');
function lastJsonBody(): any {
    return jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][0];
}

function makeRequest({ body = undefined as unknown, invalidJson = false } = {}) {
    return {
        headers: { get: () => null },
        json: async () => {
            if (invalidJson) throw new SyntaxError('bad json');
            return body;
        },
    } as any;
}

describe('POST /api/feedback/app', () => {
    let POST: any;
    beforeAll(async () => {
        ({ POST } = await import('@/app/api/feedback/app/route'));
    });

    beforeEach(() => jest.clearAllMocks());

    const validBody = { page: '/quiz-generator', feature: 'quiz', rating: 'thumbs-up' };

    it('returns 400 on malformed JSON', async () => {
        const res = await POST(makeRequest({ invalidJson: true }));
        expect(res.status).toBe(400);
        expect(serviceMocks.submitFeedback).not.toHaveBeenCalled();
    });

    it('returns 400 on an invalid rating value', async () => {
        const res = await POST(makeRequest({ body: { ...validBody, rating: 'meh' } }));
        expect(res.status).toBe(400);
        expect(serviceMocks.submitFeedback).not.toHaveBeenCalled();
    });

    it('returns 400 when comment exceeds 2000 chars', async () => {
        const res = await POST(makeRequest({ body: { ...validBody, comment: 'x'.repeat(2001) } }));
        expect(res.status).toBe(400);
    });

    it('accepts an anonymous submission (action parity — uid optional)', async () => {
        serviceMocks.submitFeedback.mockResolvedValue({ success: true, id: 'fb-1' });
        const res = await POST(makeRequest({ body: validBody }));
        expect(res.status).toBe(200);
        expect(serviceMocks.submitFeedback).toHaveBeenCalledWith(validBody);
        expect(lastJsonBody()).toEqual({ success: true, id: 'fb-1' });
    });

    it('passes through the service failure contract', async () => {
        serviceMocks.submitFeedback.mockResolvedValue({ success: false, error: 'Could not submit feedback.' });
        await POST(makeRequest({ body: { ...validBody, rating: 'thumbs-down' } }));
        expect(lastJsonBody()).toEqual({ success: false, error: 'Could not submit feedback.' });
    });
});
