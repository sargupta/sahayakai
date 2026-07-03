/**
 * Tranche 5 route-shell tests for GET /api/logs (migrated from
 * src/app/actions/logs.ts::getLogsAction — admin log dashboard).
 * validateAdmin stays inside the service; the route 401s without the
 * middleware header and clamps limit.
 */

const serviceMocks = { getLogsAction: jest.fn() };
jest.mock('@/server/logs', () => serviceMocks);
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

function makeRequest({ userId = 'admin-uid', search = '' } = {}) {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        headers: { get: (k: string) => headers.get(k) ?? null },
        nextUrl: { searchParams: new URLSearchParams(search) },
    } as any;
}

describe('GET /api/logs', () => {
    let GET: any;
    beforeAll(async () => {
        ({ GET } = await import('@/app/api/logs/route'));
    });

    beforeEach(() => jest.clearAllMocks());

    it('returns 401 without x-user-id and never calls the service', async () => {
        const res = await GET(makeRequest({ userId: '' }));
        expect(res.status).toBe(401);
        expect(serviceMocks.getLogsAction).not.toHaveBeenCalled();
    });

    it('forwards limit + severity and returns the { logs } contract', async () => {
        serviceMocks.getLogsAction.mockResolvedValue({ logs: [{ message: 'boot' }] });
        const res = await GET(makeRequest({ search: 'limit=25&severity=ERROR' }));
        expect(res.status).toBe(200);
        expect(serviceMocks.getLogsAction).toHaveBeenCalledWith(25, 'ERROR');
        expect(lastJsonBody()).toEqual({ logs: [{ message: 'boot' }] });
    });

    it('clamps a hostile limit to the 1..500 range', async () => {
        serviceMocks.getLogsAction.mockResolvedValue({ logs: [] });
        await GET(makeRequest({ search: 'limit=999999' }));
        expect(serviceMocks.getLogsAction).toHaveBeenCalledWith(500, undefined);
    });

    it('passes through the non-admin error contract (service catches validateAdmin)', async () => {
        serviceMocks.getLogsAction.mockResolvedValue({
            logs: [],
            error: 'Failed to retrieve logs. Ensure you have the required GCP permissions.',
        });
        const res = await GET(makeRequest({ userId: 'not-admin' }));
        expect(res.status).toBe(200);
        const data = lastJsonBody();
        expect(data.logs).toEqual([]);
        expect(data.error).toMatch(/Failed to retrieve logs/);
    });
});
