/**
 * @jest-environment node
 *
 * F12-P1-04: export-reminder must require CRON_SECRET in all envs and skip
 * already-anonymized users.
 */
import { NextResponse } from 'next/server';

const mockUpdate = jest.fn(async () => undefined);
const mockNotifAdd = jest.fn(async () => undefined);

let expiredDocs: any[] = [];
const activeDocsEmpty = { size: 0, empty: true, docs: [] };

function makeUserQuery() {
    let isExpiredBranch = false;
    const chain: any = {
        where(field: string, op: any, _val: any) {
            if (field === 'cancellation.gracePeriodEnd' && op === '<=') isExpiredBranch = true;
            return chain;
        },
        limit(_n: number) { return chain; },
        async get() {
            if (isExpiredBranch) {
                return { size: expiredDocs.length, empty: expiredDocs.length === 0, docs: expiredDocs };
            }
            return activeDocsEmpty;
        },
    };
    return chain;
}

jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(async () => ({
        collection: (name: string) => {
            if (name === 'users') {
                return {
                    where: (...args: any[]) => makeUserQuery().where(...args),
                    doc: (_id: string) => ({
                        update: mockUpdate,
                        collection: (_sub: string) => ({ add: mockNotifAdd }),
                    }),
                };
            }
            return {};
        },
    })),
}));

jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const jsonSpy = jest.spyOn(NextResponse, 'json');

function makeReq(headers: Record<string, string> = {}) {
    const low: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) low[k.toLowerCase()] = v;
    return {
        url: 'https://example.test/api/jobs/export-reminder',
        method: 'POST',
        headers: { get: (k: string) => low[k.toLowerCase()] ?? null },
        json: async () => ({}),
    } as any;
}
function lastJson(): { status: number; body: any } {
    const calls = jsonSpy.mock.calls;
    if (calls.length === 0) throw new Error('NextResponse.json never called');
    const last = calls[calls.length - 1];
    return { body: last[0], status: (last[1] as any)?.status ?? 200 };
}

describe('POST /api/jobs/export-reminder', () => {
    const ORIG = { ...process.env };
    let POST: (req: any) => Promise<Response>;

    beforeAll(async () => {
        // Import once — handler re-reads process.env on each call.
        const mod = await import('@/app/api/jobs/export-reminder/route');
        POST = mod.POST;
    });

    beforeEach(() => {
        jsonSpy.mockClear();
        mockUpdate.mockClear();
        mockNotifAdd.mockClear();
        process.env = { ...ORIG };
        expiredDocs = [];
    });
    afterAll(() => { process.env = ORIG; });

    it('503 when CRON_SECRET unset (even in non-prod)', async () => {
        delete process.env.CRON_SECRET;
        process.env.NODE_ENV = 'development';
        await POST(makeReq());
        expect(lastJson().status).toBe(503);
    });

    it('401 when bearer mismatched', async () => {
        process.env.CRON_SECRET = 'secret';
        await POST(makeReq({ Authorization: 'Bearer wrong' }));
        expect(lastJson().status).toBe(401);
    });

    it('idempotency: skips already-anonymized users', async () => {
        process.env.CRON_SECRET = 'secret';
        expiredDocs = [
            { id: 'u1', data: () => ({ cancellation: { anonymized: true, gracePeriodStart: new Date(Date.now() - 31*86400000).toISOString() } }) },
            { id: 'u2', data: () => ({ cancellation: { gracePeriodStart: new Date(Date.now() - 31*86400000).toISOString() } }) },
        ];
        await POST(makeReq({ Authorization: 'Bearer secret' }));
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(lastJson().status).toBe(200);
    });
});
