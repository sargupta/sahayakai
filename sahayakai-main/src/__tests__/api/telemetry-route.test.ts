/**
 * Tranche 5 route-shell tests for POST /api/telemetry (migrated from
 * src/app/actions/telemetry.ts). Route 401s without the middleware header
 * (the client wrapper converts that back to the historic
 * `{ success: true, count: 0 }` silent drop); body must be `{ events: [] }`.
 */

const serviceMocks = { syncTelemetryEvents: jest.fn() };
jest.mock('@/server/telemetry', () => serviceMocks);
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

function makeRequest({ userId = 'test-uid', body = undefined as unknown, invalidJson = false } = {}) {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        headers: { get: (k: string) => headers.get(k) ?? null },
        json: async () => {
            if (invalidJson) throw new SyntaxError('bad json');
            return body;
        },
    } as any;
}

describe('POST /api/telemetry', () => {
    let POST: any;
    beforeAll(async () => {
        ({ POST } = await import('@/app/api/telemetry/route'));
    });

    beforeEach(() => jest.clearAllMocks());

    it('returns 401 without x-user-id and never touches the service', async () => {
        const res = await POST(makeRequest({ userId: '', body: { events: [{ e: 1 }] } }));
        expect(res.status).toBe(401);
        expect(serviceMocks.syncTelemetryEvents).not.toHaveBeenCalled();
    });

    it('returns 400 on malformed JSON', async () => {
        const res = await POST(makeRequest({ invalidJson: true }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when events is not an array', async () => {
        const res = await POST(makeRequest({ body: { events: 'nope' } }));
        expect(res.status).toBe(400);
        expect(serviceMocks.syncTelemetryEvents).not.toHaveBeenCalled();
    });

    it('caps the accepted batch at 500 (schema-level)', async () => {
        const res = await POST(makeRequest({ body: { events: Array(501).fill({ e: 1 }) } }));
        expect(res.status).toBe(400);
    });

    it('forwards a valid batch and returns the service result', async () => {
        serviceMocks.syncTelemetryEvents.mockResolvedValue({ success: true, count: 2 });
        const res = await POST(makeRequest({ body: { events: [{ e: 1 }, { e: 2 }] } }));
        expect(res.status).toBe(200);
        expect(serviceMocks.syncTelemetryEvents).toHaveBeenCalledWith([{ e: 1 }, { e: 2 }]);
        expect(lastJsonBody()).toEqual({ success: true, count: 2 });
    });
});
