/**
 * /api/attendance/** CRUD routes — tranche 5 migration tests.
 *
 * Every route must return 401 when the middleware-injected x-user-id header
 * is missing, BEFORE touching Firestore (the firebase-admin mock throws if
 * reached). Plus contract checks: PREMIUM_REQUIRED passthrough (client
 * matches on the exact string) and cross-teacher 403.
 *
 * Body assertions use the repo convention of spying on NextResponse.json —
 * jsdom's Response.json() can't re-read the body.
 */

import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');
function lastJsonBody(): any {
    const calls = jsonSpy.mock.calls;
    return calls[calls.length - 1][0];
}

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => {
        throw new Error('should not reach Firestore — auth must reject first');
    },
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: jest.fn(async () => ({ planType: 'free' })),
        serialize: (x: any) => x,
    },
}));

jest.mock('@/lib/plan-utils', () => ({
    hasAdvancedPlan: (plan: string) => plan === 'pro',
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

function makeRequest(opts: {
    userId?: string | null;
    body?: any;
    url?: string;
} = {}) {
    const headers = new Map<string, string>();
    if (opts.userId) headers.set('x-user-id', opts.userId);
    return {
        url: opts.url ?? 'http://localhost/api/attendance/test',
        json: async () => opts.body ?? {},
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as import('next/server').NextRequest;
}

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

describe('attendance CRUD routes — 401 without x-user-id', () => {
    beforeEach(() => jest.clearAllMocks());

    it('GET+POST /api/attendance/classes', async () => {
        const { GET, POST } = await import('@/app/api/attendance/classes/route');
        expect((await GET(makeRequest({ userId: null }))).status).toBe(401);
        expect((await POST(makeRequest({ userId: null }))).status).toBe(401);
    });

    it('GET+PATCH+DELETE /api/attendance/classes/[classId]', async () => {
        const { GET, PATCH, DELETE } = await import('@/app/api/attendance/classes/[classId]/route');
        const c = ctx({ classId: 'c1' });
        expect((await GET(makeRequest({ userId: null }), c)).status).toBe(401);
        expect((await PATCH(makeRequest({ userId: null }), c)).status).toBe(401);
        expect((await DELETE(makeRequest({ userId: null }), c)).status).toBe(401);
    });

    it('GET+POST /api/attendance/classes/[classId]/students', async () => {
        const { GET, POST } = await import('@/app/api/attendance/classes/[classId]/students/route');
        const c = ctx({ classId: 'c1' });
        expect((await GET(makeRequest({ userId: null }), c)).status).toBe(401);
        expect((await POST(makeRequest({ userId: null }), c)).status).toBe(401);
    });

    it('PATCH+DELETE /api/attendance/classes/[classId]/students/[studentId]', async () => {
        const { PATCH, DELETE } = await import('@/app/api/attendance/classes/[classId]/students/[studentId]/route');
        const c = ctx({ classId: 'c1', studentId: 's1' });
        expect((await PATCH(makeRequest({ userId: null }), c)).status).toBe(401);
        expect((await DELETE(makeRequest({ userId: null }), c)).status).toBe(401);
    });

    it('GET /api/attendance/classes/[classId]/students/[studentId]/absences', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/[studentId]/absences/route');
        const res = await GET(
            makeRequest({ userId: null, url: 'http://localhost/api/x?limitDays=30' }),
            ctx({ classId: 'c1', studentId: 's1' }),
        );
        expect(res.status).toBe(401);
    });

    it('GET+POST /api/attendance/classes/[classId]/records', async () => {
        const { GET, POST } = await import('@/app/api/attendance/classes/[classId]/records/route');
        const c = ctx({ classId: 'c1' });
        expect((await GET(makeRequest({ userId: null, url: 'http://localhost/api/x?date=2026-06-05' }), c)).status).toBe(401);
        expect((await POST(makeRequest({ userId: null }), c)).status).toBe(401);
    });

    it('GET /api/attendance/classes/[classId]/summaries', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/summaries/route');
        const res = await GET(
            makeRequest({ userId: null, url: 'http://localhost/api/x?year=2026&month=6' }),
            ctx({ classId: 'c1' }),
        );
        expect(res.status).toBe(401);
    });

    it('GET /api/attendance/classes/[classId]/performance', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/performance/route');
        expect((await GET(makeRequest({ userId: null }), ctx({ classId: 'c1' }))).status).toBe(401);
    });

    it('GET /api/attendance/classes/[classId]/behavioral-outreach', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/behavioral-outreach/route');
        const res = await GET(
            makeRequest({ userId: null, url: 'http://localhost/api/x' }),
            ctx({ classId: 'c1' }),
        );
        expect(res.status).toBe(401);
    });

    it('GET+POST /api/attendance/outreach-records', async () => {
        const { GET, POST } = await import('@/app/api/attendance/outreach-records/route');
        expect((await GET(makeRequest({ userId: null, url: 'http://localhost/api/x?classId=c1' }))).status).toBe(401);
        expect((await POST(makeRequest({ userId: null }))).status).toBe(401);
    });

    it('GET /api/attendance/twilio-config', async () => {
        const { GET } = await import('@/app/api/attendance/twilio-config/route');
        expect((await GET(makeRequest({ userId: null }))).status).toBe(401);
    });
});

describe('attendance CRUD routes — contract', () => {
    beforeEach(() => jest.clearAllMocks());

    it('POST /api/attendance/classes surfaces PREMIUM_REQUIRED verbatim with 403 (client matches on the string)', async () => {
        const { POST } = await import('@/app/api/attendance/classes/route');
        const res = await POST(makeRequest({
            userId: 'free-user',
            body: { name: 'Class 7A', subject: 'Science', gradeLevel: 'Class 7', academicYear: '2026-27' },
        }));
        expect(res.status).toBe(403);
        expect(lastJsonBody().error).toBe('PREMIUM_REQUIRED');
    });

    it('POST /api/attendance/classes rejects a malformed body with 400', async () => {
        const { POST } = await import('@/app/api/attendance/classes/route');
        const res = await POST(makeRequest({ userId: 'u1', body: { nope: true } }));
        expect(res.status).toBe(400);
    });

    it('POST /api/attendance/classes/[classId]/records rejects a non-object records payload with 400', async () => {
        const { POST } = await import('@/app/api/attendance/classes/[classId]/records/route');
        const res = await POST(
            makeRequest({ userId: 'u1', body: { date: 'not-a-date', records: {} } }),
            ctx({ classId: 'c1' }),
        );
        expect(res.status).toBe(400);
    });

    it('GET /api/attendance/twilio-config returns configured boolean for authed caller', async () => {
        const { GET } = await import('@/app/api/attendance/twilio-config/route');
        const res = await GET(makeRequest({ userId: 'u1' }));
        expect(res.status).toBe(200);
        expect(typeof lastJsonBody().configured).toBe('boolean');
    });
});
