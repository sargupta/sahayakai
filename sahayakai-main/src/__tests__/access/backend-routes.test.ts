/**
 * @jest-environment node
 *
 * Access gate backend routes: authentication, authorisation and the response
 * shapes promised in docs/ACCESS_GATE_DESIGN.md. Business rules are covered
 * in backend-lib.test.ts; here the fakes sit under the real route handlers.
 */
import { NextResponse } from 'next/server';
import { FakeAuth, FakeFirestore, makeRequest } from './backend-fakes';

let db: FakeFirestore;
let auth: FakeAuth;
const isAdminMock = jest.fn(async (_uid: string) => false);

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: jest.requireActual('./backend-fakes').fakeFieldValue,
}));
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => db,
    getAuthInstance: async () => auth,
}));
jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/auth-utils', () => ({
    isAdmin: (uid: string) => isAdminMock(uid),
}));

import { GET as requestGET, POST as requestPOST } from '@/app/api/access/request/route';
import { POST as quotePOST } from '@/app/api/access/quote/route';
import { GET as adminRequestsGET } from '@/app/api/admin/access/requests/route';
import { POST as adminDecisionPOST } from '@/app/api/admin/access/requests/[uid]/route';
import { GET as adminQuotesGET, PATCH as adminQuotesPATCH } from '@/app/api/admin/access/quotes/route';
import { GET as adminUsersGET, POST as adminUsersPOST } from '@/app/api/admin/access/users/route';
import { GET as adminFlagsGET } from '@/app/api/admin/access/flags/route';
import { POST as pilotOrgsPOST } from '@/app/api/admin/access/pilot-orgs/route';
import { POST as pilotOrgActionPOST } from '@/app/api/admin/access/pilot-orgs/[orgId]/route';
import {
    DELETE as joinLinksDELETE,
    GET as joinLinksGET,
    POST as joinLinksPOST,
} from '@/app/api/organizations/[orgId]/join-links/route';
import { POST as joinPOST } from '@/app/api/organizations/join/route';
import { POST as expiryPOST } from '@/app/api/jobs/access-expiry/route';

const ADMIN = { 'x-user-id': 'sys-admin' };
const TEACHER = { 'x-user-id': 'newbie', 'x-user-email': 'new@example.test', 'x-user-name': 'New Teacher' };
const SCHOOL_ADMIN = { 'x-user-id': 'admin1' };
const DAY = 24 * 60 * 60 * 1000;

const validRequest = {
    schoolName: 'St. Example School', role: 'Principal', board: 'CBSE',
    city: 'Siliguri', state: 'West Bengal', phone: '9876543210', acceptTerms: true,
};
const validQuote = {
    schoolName: 'St. Example School', contactName: 'A. Principal', role: 'Principal',
    email: 'principal@example.test', phone: '0353 2512345', city: 'Siliguri', state: 'West Bengal',
    estimate: {
        teachers: 60, billing: 'annual', includeParentCalls: false,
        students: 1200, callsPerStudentPerYear: 0, avgMinutesPerCall: 0,
    },
};

const params = <T,>(value: T) => ({ params: Promise.resolve(value) });

// jest.setup.ts replaces the global Response with a stub whose json() cannot
// read a NextResponse body, so record what each handler passed to
// NextResponse.json and look the payload up by response object.
const payloads = new WeakMap<object, unknown>();
const realJson = NextResponse.json.bind(NextResponse);
jest.spyOn(NextResponse, 'json').mockImplementation(((data: unknown, init?: ResponseInit) => {
    const res = realJson(data, init);
    payloads.set(res, data);
    return res;
}) as typeof NextResponse.json);

async function body(res: Response): Promise<any> {
    if (!payloads.has(res)) throw new Error('response was not produced by NextResponse.json');
    return payloads.get(res);
}

function seedPilotOrg(id = 'org1') {
    db.seed(`organizations/${id}`, {
        name: 'St. Example School', type: 'school', adminUserId: 'admin1', plan: 'gold',
        totalSeats: 5, usedSeats: 1, status: 'pilot', pilotEndsAt: new Date(Date.now() + 10 * DAY),
    });
    db.seed(`organizations/${id}/members/admin1`, { userId: 'admin1', role: 'admin' });
}

beforeEach(() => {
    db = new FakeFirestore();
    auth = new FakeAuth();
    isAdminMock.mockReset();
    isAdminMock.mockImplementation(async (uid: string) => uid === 'sys-admin');
    process.env.ACCESS_LEGACY_CUTOFF = '2026-12-01T00:00:00.000Z';
    delete process.env.TURNSTILE_SECRET_KEY;
    auth.add({ uid: 'sys-admin', email: 'ops@example.test', creationTime: '2026-01-01T00:00:00.000Z' });
    auth.add({ uid: 'admin1', email: 'principal@example.test', creationTime: '2026-12-05T00:00:00.000Z' });
    auth.add({ uid: 'newbie', email: 'new@example.test', creationTime: '2026-12-05T00:00:00.000Z' });
});

afterAll(() => {
    delete process.env.ACCESS_LEGACY_CUTOFF;
});

describe('/api/access/request', () => {
    it('requires a signed-in caller', async () => {
        expect((await requestGET(makeRequest({ method: 'GET' }))).status).toBe(401);
        expect((await requestPOST(makeRequest({ body: validRequest }))).status).toBe(401);
    });

    it('returns null before a request exists', async () => {
        const res = await requestGET(makeRequest({ method: 'GET', headers: TEACHER }));
        expect(await body(res)).toEqual({ request: null });
    });

    it('creates a pending request using the token identity, not the body', async () => {
        const res = await requestPOST(makeRequest({
            headers: TEACHER,
            body: { ...validRequest, email: 'spoof@evil.test', uid: 'sys-admin', status: 'approved' },
        }));
        expect(res.status).toBe(200);
        expect(await body(res)).toEqual({ ok: true, status: 'pending' });
        expect(db.read('access_requests/newbie')).toMatchObject({
            uid: 'newbie', email: 'new@example.test', displayName: 'New Teacher', status: 'pending',
        });
        expect(db.read('access_requests/sys-admin')).toBeUndefined();

        const view = await body(await requestGET(makeRequest({ method: 'GET', headers: TEACHER })));
        expect(view.request).toMatchObject({ status: 'pending', schoolName: 'St. Example School' });
    });

    it('400s invalid input and a non-object body', async () => {
        const noTerms = await requestPOST(makeRequest({ headers: TEACHER, body: { ...validRequest, acceptTerms: false } }));
        expect(noTerms.status).toBe(400);
        expect((await body(noTerms)).code).toBe('VALIDATION_FAILED');
        expect((await requestPOST(makeRequest({ headers: TEACHER, body: [] }))).status).toBe(400);
        expect((await requestPOST(makeRequest({ headers: TEACHER }))).status).toBe(400);
    });

    it('409s after a decision', async () => {
        await requestPOST(makeRequest({ headers: TEACHER, body: validRequest }));
        await adminDecisionPOST(makeRequest({ headers: ADMIN, body: { decision: 'reject' } }), params({ uid: 'newbie' }));
        const res = await requestPOST(makeRequest({ headers: TEACHER, body: validRequest }));
        expect(res.status).toBe(409);
    });
});

describe('/api/access/quote', () => {
    it('accepts a valid anonymous request', async () => {
        const res = await quotePOST(makeRequest({ headers: { 'x-forwarded-for': '203.0.113.7' }, body: validQuote }));
        expect(res.status).toBe(200);
        const json = await body(res);
        expect(json.ok).toBe(true);
        expect(db.read(`quote_requests/${json.id}`)).toMatchObject({ status: 'new', schoolName: 'St. Example School' });
    });

    it('400s an inconsistent estimate before consuming a slot', async () => {
        const res = await quotePOST(makeRequest({
            headers: { 'x-forwarded-for': '203.0.113.7' },
            body: { ...validQuote, estimate: { ...validQuote.estimate, includeParentCalls: true, teachers: 608, students: 400 } },
        }));
        expect(res.status).toBe(400);
        expect([...db.store.keys()].some((k) => k.startsWith('quote_request_meta/'))).toBe(false);
    });

    it('ignores the student count when parent calls are not part of the estimate', async () => {
        // The calculator leaves its default (400) in that field; a 608-teacher
        // chain with calls unticked is a valid request.
        const res = await quotePOST(makeRequest({
            headers: { 'x-forwarded-for': '203.0.113.7' },
            body: { ...validQuote, estimate: { ...validQuote.estimate, includeParentCalls: false, teachers: 608, students: 400 } },
        }));
        expect(res.status).toBe(200);
    });

    it('403s when Turnstile is configured and no token is sent', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'secret';
        const res = await quotePOST(makeRequest({ headers: { 'x-forwarded-for': '203.0.113.7' }, body: validQuote }));
        expect(res.status).toBe(403);
    });

    it('429s past the per-IP limit', async () => {
        process.env.QUOTE_IP_DAILY_LIMIT = '1';
        try {
            const headers = { 'x-forwarded-for': '203.0.113.7' };
            expect((await quotePOST(makeRequest({ headers, body: validQuote }))).status).toBe(200);
            const res = await quotePOST(makeRequest({ headers, body: validQuote }));
            expect(res.status).toBe(429);
            expect((await body(res)).code).toBe('RATE_LIMITED');
        } finally {
            delete process.env.QUOTE_IP_DAILY_LIMIT;
        }
    });
});

describe('SahayakAI-admin routes reject everyone else', () => {
    const calls: Array<[string, (headers: Record<string, string>) => Promise<Response>]> = [
        ['GET requests', (h) => adminRequestsGET(makeRequest({ method: 'GET', headers: h }))],
        ['POST decision', (h) => adminDecisionPOST(makeRequest({ headers: h, body: { decision: 'approve' } }), params({ uid: 'newbie' }))],
        ['GET quotes', (h) => adminQuotesGET(makeRequest({ method: 'GET', headers: h }))],
        ['PATCH quotes', (h) => adminQuotesPATCH(makeRequest({ method: 'PATCH', headers: h, body: { id: 'q1', status: 'contacted' } }))],
        ['GET users', (h) => adminUsersGET(makeRequest({ method: 'GET', url: 'https://example.test/api/x?q=new@example.test', headers: h }))],
        ['POST users', (h) => adminUsersPOST(makeRequest({ headers: h, body: { uid: 'newbie', state: 'active', reason: 'x' } }))],
        ['GET flags', (h) => adminFlagsGET(makeRequest({ method: 'GET', headers: h }))],
        ['POST pilot-orgs', (h) => pilotOrgsPOST(makeRequest({ headers: h, body: {} }))],
        ['POST pilot-org action', (h) => pilotOrgActionPOST(makeRequest({ headers: h, body: { action: 'expire' } }), params({ orgId: 'org1' }))],
    ];

    it.each(calls)('%s: 401 without a caller, 403 for a non-admin, and no state change', async (_name, call) => {
        seedPilotOrg();
        db.seed('access_requests/newbie', { uid: 'newbie', status: 'pending' });
        const before = JSON.stringify([...db.store.entries()]);
        expect((await call({})).status).toBe(401);
        expect((await call(TEACHER)).status).toBe(403);
        // A school admin is not a SahayakAI admin.
        expect((await call(SCHOOL_ADMIN)).status).toBe(403);
        expect(JSON.stringify([...db.store.entries()])).toBe(before);
        expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
    });
});

describe('admin decisions and manual access', () => {
    beforeEach(async () => {
        await requestPOST(makeRequest({ headers: TEACHER, body: validRequest }));
    });

    it('lists pending requests and approves one', async () => {
        const list = await body(await adminRequestsGET(makeRequest({ method: 'GET', url: 'https://example.test/api/x?status=pending', headers: ADMIN })));
        expect(list.requests).toHaveLength(1);
        expect(list.requests[0]).toMatchObject({ uid: 'newbie', email: 'new@example.test', status: 'pending' });

        const res = await adminDecisionPOST(
            makeRequest({ headers: ADMIN, body: { decision: 'approve', state: 'pilot', expiresInDays: 30, note: 'verified by phone' } }),
            params({ uid: 'newbie' }),
        );
        expect(await body(res)).toEqual({ ok: true });
        expect(auth.claims('newbie')).toMatchObject({ access: 'pilot' });
        expect(db.read('access_requests/newbie')).toMatchObject({ status: 'approved', decidedBy: 'sys-admin', grantedState: 'pilot' });
    });

    it('400s a bad decision, state or status filter', async () => {
        expect((await adminDecisionPOST(makeRequest({ headers: ADMIN, body: { decision: 'maybe' } }), params({ uid: 'newbie' }))).status).toBe(400);
        expect((await adminDecisionPOST(makeRequest({ headers: ADMIN, body: { decision: 'approve', state: 'legacy' } }), params({ uid: 'newbie' }))).status).toBe(400);
        expect((await adminRequestsGET(makeRequest({ method: 'GET', url: 'https://example.test/api/x?status=all', headers: ADMIN }))).status).toBe(400);
        expect(auth.claims('newbie')).not.toHaveProperty('access');
    });

    it('sets a state by hand with a mandatory reason, and looks the account up', async () => {
        expect((await adminUsersPOST(makeRequest({ headers: ADMIN, body: { uid: 'newbie', state: 'blocked' } }))).status).toBe(400);
        expect((await adminUsersPOST(makeRequest({ headers: ADMIN, body: { uid: 'newbie', state: 'superuser', reason: 'x' } }))).status).toBe(400);
        expect((await adminUsersPOST(makeRequest({ headers: ADMIN, body: { uid: 'ghost', state: 'active', reason: 'x' } }))).status).toBe(404);
        expect((await adminUsersPOST(makeRequest({ headers: ADMIN, body: { uid: 'sys-admin', state: 'blocked', reason: 'oops' } }))).status).toBe(400);

        const ok = await adminUsersPOST(makeRequest({ headers: ADMIN, body: { uid: 'newbie', state: 'blocked', reason: 'competitor account' } }));
        expect(await body(ok)).toEqual({ ok: true });
        expect(auth.claims('newbie')).toMatchObject({ access: 'blocked' });

        const found = await body(await adminUsersGET(makeRequest({ method: 'GET', url: 'https://example.test/api/x?q=New@Example.test', headers: ADMIN })));
        expect(found.users).toEqual([expect.objectContaining({ uid: 'newbie', email: 'new@example.test', accessState: 'blocked' })]);
        const none = await body(await adminUsersGET(makeRequest({ method: 'GET', url: 'https://example.test/api/x?q=nobody@example.test', headers: ADMIN })));
        expect(none.users).toEqual([]);
    });

    it('updates a quote status and lists quotes without the IP hash', async () => {
        const created = await body(await quotePOST(makeRequest({ headers: { 'x-forwarded-for': '203.0.113.7' }, body: validQuote })));
        expect(await body(await adminQuotesPATCH(makeRequest({ method: 'PATCH', headers: ADMIN, body: { id: created.id, status: 'contacted' } })))).toEqual({ ok: true });
        const list = await body(await adminQuotesGET(makeRequest({ method: 'GET', url: 'https://example.test/api/x?status=contacted', headers: ADMIN })));
        expect(list.quotes).toHaveLength(1);
        expect(list.quotes[0]).not.toHaveProperty('ipHash');
        expect((await adminQuotesPATCH(makeRequest({ method: 'PATCH', headers: ADMIN, body: { id: 'missing', status: 'closed' } }))).status).toBe(404);
        expect((await adminQuotesPATCH(makeRequest({ method: 'PATCH', headers: ADMIN, body: { id: created.id, status: 'won' } }))).status).toBe(400);
    });

    it('provisions a pilot school and returns its id', async () => {
        const res = await pilotOrgsPOST(makeRequest({
            headers: ADMIN,
            body: {
                name: 'St. Example School', type: 'school', adminEmail: 'principal@example.test',
                seats: 40, pilotDays: 14, verification: { affiliationNumber: '2430001', method: 'landline call' },
            },
        }));
        expect(res.status).toBe(200);
        const { orgId } = await body(res);
        expect(db.read(`organizations/${orgId}`)).toMatchObject({ status: 'pilot', createdBy: 'sys-admin' });

        const action = await pilotOrgActionPOST(makeRequest({ headers: ADMIN, body: { action: 'convert' } }), params({ orgId }));
        expect(await body(action)).toEqual({ ok: true });
        expect(db.read(`organizations/${orgId}`)?.status).toBe('active');
        expect((await pilotOrgActionPOST(makeRequest({ headers: ADMIN, body: { action: 'delete' } }), params({ orgId }))).status).toBe(400);
        expect((await pilotOrgActionPOST(makeRequest({ headers: ADMIN, body: { action: 'expire' } }), params({ orgId: 'missing' }))).status).toBe(404);
    });
});

describe('join links and joining', () => {
    beforeEach(() => seedPilotOrg());

    it('only the school admin or a SahayakAI admin may manage links', async () => {
        const ctx = () => params({ orgId: 'org1' });
        expect((await joinLinksPOST(makeRequest({ body: {} }), ctx())).status).toBe(401);
        expect((await joinLinksPOST(makeRequest({ headers: TEACHER, body: {} }), ctx())).status).toBe(403);
        expect((await joinLinksGET(makeRequest({ method: 'GET', headers: TEACHER }), ctx())).status).toBe(403);
        expect((await joinLinksDELETE(makeRequest({ method: 'DELETE', url: 'https://example.test/api/x?id=abc', headers: TEACHER }), ctx())).status).toBe(403);
        // A plain teacher member is not an admin of the school either.
        db.seed('organizations/org1/members/newbie', { userId: 'newbie', role: 'teacher' });
        expect((await joinLinksPOST(makeRequest({ headers: TEACHER, body: {} }), ctx())).status).toBe(403);

        expect((await joinLinksPOST(makeRequest({ headers: SCHOOL_ADMIN, body: {} }), ctx())).status).toBe(200);
        expect((await joinLinksPOST(makeRequest({ headers: ADMIN, body: {} }), ctx())).status).toBe(200);
    });

    it('creates, lists (without hash or code), redeems and revokes', async () => {
        const ctx = () => params({ orgId: 'org1' });
        const created = await body(await joinLinksPOST(
            makeRequest({ headers: { ...SCHOOL_ADMIN, host: 'www.sahayakai.com' }, body: { maxUses: 2, expiresInDays: 7 } }),
            ctx(),
        ));
        expect(created).toMatchObject({ maxUses: 2 });
        expect(created.url).toBe(`https://www.sahayakai.com/join/${created.code}`);
        expect(typeof created.expiresAt).toBe('string');

        const list = await body(await joinLinksGET(makeRequest({ method: 'GET', headers: SCHOOL_ADMIN }), ctx()));
        expect(list.links).toEqual([expect.objectContaining({ id: created.id, uses: 0, maxUses: 2, revoked: false })]);
        expect(JSON.stringify(list)).not.toMatch(/tokenHash|code/);

        expect((await joinPOST(makeRequest({ body: { code: created.code, acceptTerms: true } }))).status).toBe(401);
        expect((await joinPOST(makeRequest({ headers: TEACHER, body: { code: created.code } }))).status).toBe(400);
        const joined = await joinPOST(makeRequest({ headers: TEACHER, body: { code: created.code, acceptTerms: true } }));
        expect(joined.status).toBe(200);
        const json = await body(joined);
        expect(json).toMatchObject({ ok: true, orgId: 'org1', orgName: 'St. Example School', state: 'pilot' });
        expect(typeof json.expiresAt).toBe('string');
        expect(Object.keys(json).sort()).toEqual(['expiresAt', 'ok', 'orgId', 'orgName', 'state']);

        const revoke = await joinLinksDELETE(
            makeRequest({ method: 'DELETE', url: `https://example.test/api/x?id=${created.id}`, headers: SCHOOL_ADMIN }),
            ctx(),
        );
        expect(await body(revoke)).toEqual({ ok: true });
        auth.add({ uid: 'second', email: 'second@example.test', creationTime: '2026-12-06T00:00:00.000Z' });
        const afterRevoke = await joinPOST(makeRequest({ headers: { 'x-user-id': 'second' }, body: { code: created.code, acceptTerms: true } }));
        expect(afterRevoke.status).toBe(404);
        expect((await joinLinksDELETE(makeRequest({ method: 'DELETE', url: 'https://example.test/api/x', headers: SCHOOL_ADMIN }), ctx())).status).toBe(400);
    });

    it('a school admin cannot manage another school\'s links', async () => {
        seedPilotOrg('org2');
        db.seed('organizations/org2/members/admin1', { userId: 'admin1', role: 'teacher' });
        db.seed('organizations/org2/members/other', { userId: 'other', role: 'admin' });
        const res = await joinLinksPOST(makeRequest({ headers: SCHOOL_ADMIN, body: {} }), params({ orgId: 'org2' }));
        expect(res.status).toBe(403);
    });
});

describe('/api/jobs/access-expiry', () => {
    afterEach(() => {
        delete process.env.CRON_SECRET;
    });

    it('503s without CRON_SECRET and 401s a wrong bearer', async () => {
        expect((await expiryPOST(makeRequest({}) as never)).status).toBe(503);
        process.env.CRON_SECRET = 'cron-secret';
        expect((await expiryPOST(makeRequest({}) as never)).status).toBe(401);
        expect((await expiryPOST(makeRequest({ headers: { authorization: 'Bearer nope' } }) as never)).status).toBe(401);
    });

    it('expires due pilots and reports counts', async () => {
        process.env.CRON_SECRET = 'cron-secret';
        db.seed('organizations/org1', {
            name: 'Lapsed School', type: 'school', adminUserId: 'admin1', plan: 'gold',
            totalSeats: 5, usedSeats: 1, status: 'pilot', pilotEndsAt: new Date(Date.now() - DAY),
        });
        db.seed('organizations/org1/members/admin1', { userId: 'admin1', role: 'admin' });
        db.seed('users/admin1', { organizationId: 'org1', accessState: 'pilot', planType: 'gold' });

        const res = await expiryPOST(makeRequest({ headers: { authorization: 'Bearer cron-secret' } }) as never);
        expect(res.status).toBe(200);
        const json = await body(res);
        expect(json).toMatchObject({ ok: true, organizations: { organizations: 1, failed: 0 }, anomalies: { flagged: 0 } });
        expect(db.read('organizations/org1')?.status).toBe('expired');
        expect(auth.claims('admin1')).toMatchObject({ access: 'pending', planType: 'free' });
    });
});
