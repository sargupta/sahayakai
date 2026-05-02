/**
 * Tests for GET /api/auth/profile-check
 *
 * Verifies:
 * - Returns { exists: true } when profile has schoolName
 * - Returns { exists: false } when profile is missing
 * - Returns HTTP 500 on Firestore errors (not 200 with exists:false)
 * - Returns 400 when uid query param is missing
 */

import { NextResponse } from 'next/server';

const mockGetUser = jest.fn();

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { getUser: (...args: any[]) => mockGetUser(...args) },
}));
jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ── Spy on NextResponse.json to capture response body + status ───────────────

const jsonSpy = jest.spyOn(NextResponse, 'json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(uid?: string): Request {
    const base = 'http://localhost:3000/api/auth/profile-check';
    const url = uid ? `${base}?uid=${uid}` : base;
    return new Request(url, { method: 'GET' });
}

/** Extract the body and status from the last NextResponse.json() call */
function lastJsonCall(): { body: any; status: number } {
    const calls = jsonSpy.mock.calls;
    const lastCall = calls[calls.length - 1];
    const body = lastCall[0];
    const opts = lastCall[1] as { status?: number } | undefined;
    return { body, status: opts?.status ?? 200 };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/auth/profile-check', () => {
    let GET: (req: Request) => Promise<Response>;

    beforeAll(async () => {
        const mod = await import('@/app/api/auth/profile-check/route');
        GET = mod.GET;
    });

    beforeEach(() => jest.clearAllMocks());

    it('returns 400 when uid query param is missing', async () => {
        const res = await GET(makeRequest());
        expect(res.status).toBe(400);
        const { body, status } = lastJsonCall();
        expect(status).toBe(400);
        expect(body.error).toBe('UID required');
    });

    it('returns { exists: true } when profile has schoolName', async () => {
        mockGetUser.mockResolvedValue({
            uid: 'user-123',
            schoolName: 'Delhi Public School',
            email: 'teacher@example.com',
        });

        const res = await GET(makeRequest('user-123'));
        expect(res.status).toBe(200);
        const { body } = lastJsonCall();
        expect(body.exists).toBe(true);
        expect(mockGetUser).toHaveBeenCalledWith('user-123');
    });

    it('returns { exists: false } when profile does not exist', async () => {
        mockGetUser.mockResolvedValue(null);

        const res = await GET(makeRequest('nonexistent-uid'));
        expect(res.status).toBe(200);
        const { body } = lastJsonCall();
        expect(body.exists).toBe(false);
    });

    // Bug fix (auth pipeline review, 2026-04-30):
    //
    // The previous behaviour conflated "user has a profile doc" with "user
    // completed onboarding". Returning teachers without a `schoolName`
    // (signed up before the field existed, bailed mid-onboarding, profile
    // edit cleared it) got bounced to /onboarding on EVERY login,
    // never reaching the dashboard.
    //
    // Corrected contract:
    //   - `exists` = "Firestore user doc is present at all"
    //   - `onboardingComplete` = "schoolName is set" (separate UX surface)
    //
    // Auth-context only redirects to /onboarding when `exists === false`,
    // so returning users now reach the dashboard regardless of schoolName.
    it('returns { exists: true, onboardingComplete: false } when profile exists but schoolName is empty', async () => {
        mockGetUser.mockResolvedValue({
            uid: 'user-456',
            schoolName: '',
            email: 'teacher@example.com',
        });

        const res = await GET(makeRequest('user-456'));
        expect(res.status).toBe(200);
        const { body } = lastJsonCall();
        expect(body.exists).toBe(true);
        expect(body.onboardingComplete).toBe(false);
    });

    it('returns { exists: true, onboardingComplete: false } when profile exists but schoolName is undefined', async () => {
        mockGetUser.mockResolvedValue({
            uid: 'user-789',
            email: 'teacher@example.com',
        });

        const res = await GET(makeRequest('user-789'));
        expect(res.status).toBe(200);
        const { body } = lastJsonCall();
        expect(body.exists).toBe(true);
        expect(body.onboardingComplete).toBe(false);
    });

    it('returns { exists: true, onboardingComplete: true } when profile has schoolName', async () => {
        mockGetUser.mockResolvedValue({
            uid: 'user-321',
            schoolName: 'Government Primary School, Raichur',
            email: 'teacher@example.com',
        });

        const res = await GET(makeRequest('user-321'));
        expect(res.status).toBe(200);
        const { body } = lastJsonCall();
        expect(body.exists).toBe(true);
        expect(body.onboardingComplete).toBe(true);
    });

    it('returns HTTP 500 when Firestore throws an error (not 200 with exists:false)', async () => {
        mockGetUser.mockRejectedValue(new Error('Firestore unavailable'));

        const res = await GET(makeRequest('user-error'));
        // BUG FIX verification: must be 500, NOT 200 with { exists: false }
        expect(res.status).toBe(500);
        const { body, status } = lastJsonCall();
        expect(status).toBe(500);
        expect(body.error).toBe('Internal error');
        expect(body).not.toHaveProperty('exists');
    });
});
