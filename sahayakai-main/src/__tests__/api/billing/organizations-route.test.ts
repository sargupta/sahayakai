/**
 * F7-001: POST /api/organizations admin-only gate.
 *
 * Free user trying to create a premium org with 500 seats must be rejected
 * with 403. No Firestore write. No custom-claim update.
 */

// ── Mocks ───────────────────────────────────────────────────────────────────

const setCustomUserClaimsMock = jest.fn();
const userUpdateMock = jest.fn();
const orgSetMock = jest.fn();
const memberSetMock = jest.fn();

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (col: string) => {
            if (col === 'organizations') {
                return {
                    doc: (_id?: string) => ({
                        id: 'org_test_1',
                        set: orgSetMock,
                        collection: (_sub: string) => ({
                            doc: (_id: string) => ({
                                set: memberSetMock,
                            }),
                        }),
                    }),
                };
            }
            if (col === 'users') {
                return {
                    doc: (_uid: string) => ({
                        update: userUpdateMock,
                        get: async () => ({ data: () => ({ role: 'teacher' }) }), // not admin
                    }),
                };
            }
            return { doc: () => ({ update: jest.fn(), set: jest.fn() }) };
        },
    }),
}));

jest.mock('firebase-admin/auth', () => ({
    getAuth: () => ({ setCustomUserClaims: setCustomUserClaimsMock }),
}));

// Default: caller is NOT admin
const isAdminMock = jest.fn().mockResolvedValue(false);
jest.mock('@/lib/auth-utils', () => ({
    isAdmin: (uid: string) => isAdminMock(uid),
    validateAdmin: jest.fn(),
}));

// dbAdapter is touched by isAdmin under the hood — keep this just in case
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { getUser: jest.fn().mockResolvedValue({ role: 'teacher' }) },
}));

import { POST } from '@/app/api/organizations/route';

function makeReq(body: unknown, headers: Record<string, string> = {}) {
    // Work around the jest.setup.ts polyfill that drops headers from Request init.
    const headerMap = new Map<string, string>(
        Object.entries({ 'content-type': 'application/json', ...headers })
    );
    return {
        url: 'http://test.local/api/organizations',
        method: 'POST',
        headers: {
            get: (name: string) => headerMap.get(name.toLowerCase()) ?? headerMap.get(name) ?? null,
        },
        json: async () => body,
    } as unknown as Request;
}

beforeEach(() => {
    setCustomUserClaimsMock.mockReset();
    userUpdateMock.mockReset();
    orgSetMock.mockReset();
    memberSetMock.mockReset();
    isAdminMock.mockReset().mockResolvedValue(false);
});

describe('POST /api/organizations (F7-001 admin-only gate)', () => {
    test('free user requesting premium org with 500 seats → 403, no writes, no claim change', async () => {
        const req = makeReq(
            { name: 'Free User School', type: 'school', plan: 'premium', totalSeats: 500 },
            { 'x-user-id': 'freeuser_uid' }
        );

        const res = await POST(req);
        expect(res.status).toBe(403);

        // Critical: no Firestore writes, no custom-claim mutation
        expect(orgSetMock).not.toHaveBeenCalled();
        expect(memberSetMock).not.toHaveBeenCalled();
        expect(userUpdateMock).not.toHaveBeenCalled();
        expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
    });

    test('unauthenticated → 401', async () => {
        const req = makeReq({ name: 'X', type: 'school', plan: 'gold', totalSeats: 10 }, {});
        const res = await POST(req);
        expect(res.status).toBe(401);
        expect(orgSetMock).not.toHaveBeenCalled();
    });

    test('admin can create org but planType is NOT granted without razorpayPaymentId', async () => {
        isAdminMock.mockResolvedValue(true);

        const req = makeReq(
            { name: 'Test School', type: 'school', plan: 'gold', totalSeats: 10, adminUserId: 'teacher_uid' },
            { 'x-user-id': 'admin_uid' }
        );

        const res = await POST(req);
        expect(res.status).toBe(200);

        expect(orgSetMock).toHaveBeenCalled();
        expect(memberSetMock).toHaveBeenCalled();
        // The user update should NOT include planType (no payment reference)
        const allUserUpdateCalls = userUpdateMock.mock.calls;
        for (const call of allUserUpdateCalls) {
            expect(call[0]).not.toHaveProperty('planType');
        }
        // Custom claim must not be set without payment
        expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
    });

    test('admin WITH razorpayPaymentId grants the plan', async () => {
        isAdminMock.mockResolvedValue(true);

        const req = makeReq(
            {
                name: 'Test School',
                type: 'school',
                plan: 'premium',
                totalSeats: 20,
                adminUserId: 'school_admin_uid',
                razorpayPaymentId: 'pay_verified_xyz',
            },
            { 'x-user-id': 'admin_uid' }
        );

        const res = await POST(req);
        expect(res.status).toBe(200);

        // The user update SHOULD include planType
        const planTypeWrite = userUpdateMock.mock.calls.find(([arg]: any) => arg && 'planType' in arg);
        expect(planTypeWrite).toBeTruthy();
        expect(planTypeWrite[0].planType).toBe('premium');

        expect(setCustomUserClaimsMock).toHaveBeenCalledWith(
            'school_admin_uid',
            expect.objectContaining({ planType: 'premium', orgRole: 'admin' })
        );
    });
});
