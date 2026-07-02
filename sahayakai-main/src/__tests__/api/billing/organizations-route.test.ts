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

// H21 (commit 966ae0bb4): createOrganization now verifies the payment id
// against Razorpay server-side and only grants the plan when the payment
// is `captured` with amount > 0 (fail-closed to the webhook otherwise).
// Default: verification fails (unmocked fetch rejects) — individual tests
// stage a captured payment when they exercise the grant path.
const razorpayFetchMock = jest.fn();
jest.mock('@/lib/razorpay', () => ({
    getRazorpay: () => ({ payments: { fetch: razorpayFetchMock } }),
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
    razorpayFetchMock.mockReset().mockRejectedValue(new Error('razorpay not staged'));
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

    test('admin WITH verified (captured) razorpayPaymentId grants the plan', async () => {
        isAdminMock.mockResolvedValue(true);
        // H21: the grant only happens after server-side verification says
        // the payment is captured with a positive amount.
        razorpayFetchMock.mockResolvedValue({ status: 'captured', amount: 49900 });

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

    // H21 (commit 966ae0bb4): the mere presence of a payment id is NOT proof
    // of payment. Unverifiable / non-captured payments must fail closed —
    // org is created, but the plan flip is deferred to the webhook.
    test('admin with UNVERIFIED razorpayPaymentId does NOT grant the plan (fail closed)', async () => {
        isAdminMock.mockResolvedValue(true);
        razorpayFetchMock.mockResolvedValue({ status: 'created', amount: 49900 });

        const req = makeReq(
            {
                name: 'Test School',
                type: 'school',
                plan: 'premium',
                totalSeats: 20,
                adminUserId: 'school_admin_uid',
                razorpayPaymentId: 'pay_not_captured',
            },
            { 'x-user-id': 'admin_uid' }
        );

        const res = await POST(req);
        expect(res.status).toBe(200);

        // Org + membership are still written (seat tooling needs them)…
        expect(orgSetMock).toHaveBeenCalled();
        expect(memberSetMock).toHaveBeenCalled();
        // …but no planType write and no custom claim without a captured payment.
        for (const call of userUpdateMock.mock.calls) {
            expect(call[0]).not.toHaveProperty('planType');
        }
        expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
    });
});
