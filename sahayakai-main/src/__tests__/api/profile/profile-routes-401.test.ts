/**
 * Tranche 5 route-shell tests for the /api/profile/** boundary (migrated from
 * src/app/actions/profile.ts). Every route must reject requests that reach
 * the handler without the middleware-verified `x-user-id` header (401)
 * BEFORE touching the service layer, and must Zod-validate bodies (400).
 */

const serviceMocks = {
    getProfileData: jest.fn(),
    getPublicProfileAction: jest.fn(),
    addCertificationAction: jest.fn(),
    updateProfileAction: jest.fn(),
    markChecklistItemAction: jest.fn(),
    lookupSchoolDominantLocationAction: jest.fn(),
    getDailyCostsAction: jest.fn(),
};
jest.mock('@/server/profile', () => serviceMocks);
jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Spy on NextResponse.json to capture response bodies (the jest Response
// polyfill does not carry bodies through `res.json()` — repo convention,
// see profile-check.test.ts).
import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');
function lastJsonBody(): any {
    return jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][0];
}

function makeRequest({
    userId = 'test-uid',
    body = undefined as unknown,
    search = '',
    invalidJson = false,
} = {}) {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        headers: { get: (k: string) => headers.get(k) ?? null },
        nextUrl: { searchParams: new URLSearchParams(search) },
        json: async () => {
            if (invalidJson) throw new SyntaxError('bad json');
            return body;
        },
    } as any;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('GET/PUT /api/profile', () => {
    let GET: any, PUT: any;
    beforeAll(async () => {
        ({ GET, PUT } = await import('@/app/api/profile/route'));
    });

    it('GET returns 401 without x-user-id and never calls the service', async () => {
        const res = await GET(makeRequest({ userId: '' }));
        expect(res.status).toBe(401);
        expect(serviceMocks.getProfileData).not.toHaveBeenCalled();
    });

    it('GET forwards the compat uid param and returns service data', async () => {
        serviceMocks.getProfileData.mockResolvedValue({ profile: { id: 'u1' }, certifications: [] });
        const res = await GET(makeRequest({ search: 'uid=u1' }));
        expect(res.status).toBe(200);
        expect(serviceMocks.getProfileData).toHaveBeenCalledWith('u1');
        expect(lastJsonBody()).toEqual({ profile: { id: 'u1' }, certifications: [] });
    });

    it('GET maps a Forbidden mismatch to 403 with the original message', async () => {
        serviceMocks.getProfileData.mockRejectedValue(
            new Error("Forbidden: cannot read another user's profile via this action"),
        );
        const res = await GET(makeRequest({ search: 'uid=other' }));
        expect(res.status).toBe(403);
        expect(lastJsonBody().error).toMatch(/Forbidden/);
    });

    it('PUT returns 401 without x-user-id', async () => {
        const res = await PUT(makeRequest({ userId: '', body: { uid: 'u1', data: {} } }));
        expect(res.status).toBe(401);
        expect(serviceMocks.updateProfileAction).not.toHaveBeenCalled();
    });

    it('PUT returns 400 on malformed body', async () => {
        const res = await PUT(makeRequest({ invalidJson: true }));
        expect(res.status).toBe(400);
        expect(serviceMocks.updateProfileAction).not.toHaveBeenCalled();
    });

    it('PUT forwards (uid, data) to the service and returns its result', async () => {
        serviceMocks.updateProfileAction.mockResolvedValue({ profileCompletionLevel: 55 });
        const res = await PUT(makeRequest({ body: { uid: 'u1', data: { displayName: 'A' } } }));
        expect(res.status).toBe(200);
        expect(serviceMocks.updateProfileAction).toHaveBeenCalledWith('u1', { displayName: 'A' });
        expect(lastJsonBody()).toEqual({ profileCompletionLevel: 55 });
    });

    it('PUT keeps the F11-3 prereq rejection message (400)', async () => {
        serviceMocks.updateProfileAction.mockRejectedValue(
            new Error("Cannot advance onboardingPhase to 'exploring' — missing prerequisites: state"),
        );
        const res = await PUT(makeRequest({ body: { uid: 'u1', data: { onboardingPhase: 'exploring' } } }));
        expect(res.status).toBe(400);
        expect(lastJsonBody().error).toMatch(/missing prerequisites/);
    });

    it('PUT returns 400 with the exact no-writable-fields message', async () => {
        serviceMocks.updateProfileAction.mockRejectedValue(
            new Error('No writable fields in update payload'),
        );
        const res = await PUT(makeRequest({ body: { uid: 'u1', data: { isAdmin: true } } }));
        expect(res.status).toBe(400);
        expect(lastJsonBody().error).toBe('No writable fields in update payload');
    });
});

describe('GET /api/profile/public/[uid]', () => {
    let GET: any;
    beforeAll(async () => {
        ({ GET } = await import('@/app/api/profile/public/[uid]/route'));
    });

    it('returns 401 without x-user-id', async () => {
        const res = await GET(makeRequest({ userId: '' }), { params: Promise.resolve({ uid: 'u2' }) });
        expect(res.status).toBe(401);
        expect(serviceMocks.getPublicProfileAction).not.toHaveBeenCalled();
    });

    it('forwards the path uid to the service', async () => {
        serviceMocks.getPublicProfileAction.mockResolvedValue({ profile: { id: 'u2' }, certifications: [] });
        const res = await GET(makeRequest(), { params: Promise.resolve({ uid: 'u2' }) });
        expect(res.status).toBe(200);
        expect(serviceMocks.getPublicProfileAction).toHaveBeenCalledWith('u2');
    });
});

describe('POST /api/profile/certifications', () => {
    let POST: any;
    beforeAll(async () => {
        ({ POST } = await import('@/app/api/profile/certifications/route'));
    });

    it('returns 401 without x-user-id', async () => {
        const res = await POST(makeRequest({ userId: '', body: { certName: 'B.Ed' } }));
        expect(res.status).toBe(401);
        expect(serviceMocks.addCertificationAction).not.toHaveBeenCalled();
    });

    it('returns 400 when certName is missing (historic message)', async () => {
        const res = await POST(makeRequest({ body: { issuingBody: 'NCTE' } }));
        expect(res.status).toBe(400);
        expect(lastJsonBody().error).toBe('Missing required field: certName');
        expect(serviceMocks.addCertificationAction).not.toHaveBeenCalled();
    });

    it('forwards a valid payload to the service', async () => {
        serviceMocks.addCertificationAction.mockResolvedValue(undefined);
        const res = await POST(makeRequest({ body: { certName: 'B.Ed', issuingBody: 'NCTE', issueDate: '2024-01-01' } }));
        expect(res.status).toBe(200);
        expect(serviceMocks.addCertificationAction).toHaveBeenCalledWith({
            certName: 'B.Ed', issuingBody: 'NCTE', issueDate: '2024-01-01',
        });
    });
});

describe('POST /api/profile/checklist', () => {
    let POST: any;
    beforeAll(async () => {
        ({ POST } = await import('@/app/api/profile/checklist/route'));
    });

    it('returns 401 without x-user-id', async () => {
        const res = await POST(makeRequest({ userId: '', body: { uid: 'u1', itemId: 'first-quiz' } }));
        expect(res.status).toBe(401);
        expect(serviceMocks.markChecklistItemAction).not.toHaveBeenCalled();
    });

    it('returns 400 for an over-long item id', async () => {
        const res = await POST(makeRequest({ body: { uid: 'u1', itemId: 'x'.repeat(65) } }));
        expect(res.status).toBe(400);
        expect(serviceMocks.markChecklistItemAction).not.toHaveBeenCalled();
    });

    it('keeps the service-level invalid-id rejection (400, exact message)', async () => {
        serviceMocks.markChecklistItemAction.mockRejectedValue(new Error('Invalid checklist item id'));
        const res = await POST(makeRequest({ body: { uid: 'u1', itemId: 'bad id!' } }));
        expect(res.status).toBe(400);
        expect(lastJsonBody().error).toBe('Invalid checklist item id');
    });
});

describe('GET /api/profile/school-location', () => {
    let GET: any;
    beforeAll(async () => {
        ({ GET } = await import('@/app/api/profile/school-location/route'));
    });

    it('returns 401 without x-user-id (directory is not anonymous)', async () => {
        const res = await GET(makeRequest({ userId: '', search: 'schoolName=KV%20AGRA' }));
        expect(res.status).toBe(401);
        expect(serviceMocks.lookupSchoolDominantLocationAction).not.toHaveBeenCalled();
    });

    it('wraps the service result', async () => {
        serviceMocks.lookupSchoolDominantLocationAction.mockResolvedValue({
            state: 'Uttar Pradesh', district: 'Agra', matchCount: 5,
        });
        const res = await GET(makeRequest({ search: 'schoolName=KV+AGRA' }));
        expect(res.status).toBe(200);
        expect(lastJsonBody()).toEqual({
            result: { state: 'Uttar Pradesh', district: 'Agra', matchCount: 5 },
        });
    });
});

describe('GET /api/profile/daily-costs', () => {
    let GET: any;
    beforeAll(async () => {
        ({ GET } = await import('@/app/api/profile/daily-costs/route'));
    });

    it('returns 401 without x-user-id', async () => {
        const res = await GET(makeRequest({ userId: '' }));
        expect(res.status).toBe(401);
        expect(serviceMocks.getDailyCostsAction).not.toHaveBeenCalled();
    });

    it('returns 403 when the service admin gate rejects', async () => {
        serviceMocks.getDailyCostsAction.mockRejectedValue(new Error('User is not an admin'));
        const res = await GET(makeRequest({ search: 'days=1' }));
        expect(res.status).toBe(403);
    });

    it('clamps days and returns cost data for admins', async () => {
        serviceMocks.getDailyCostsAction.mockResolvedValue([{ date: '2026-07-01', cost: 1.23 }]);
        const res = await GET(makeRequest({ search: 'days=1' }));
        expect(res.status).toBe(200);
        expect(serviceMocks.getDailyCostsAction).toHaveBeenCalledWith(1);
    });
});
