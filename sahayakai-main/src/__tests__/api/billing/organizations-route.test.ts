/**
 * F7-001: POST /api/organizations admin-only gate.
 * H21: payment amount↔plan binding + payments_ledger idempotency.
 *
 * Free user trying to create a premium org with 500 seats must be rejected
 * with 403. No Firestore write. No custom-claim update.
 *
 * Plan grants only happen for a captured Razorpay payment whose amount
 * matches the plan's price table, applied exactly once per payment id.
 */

// ── Mocks ───────────────────────────────────────────────────────────────────

const setCustomUserClaimsMock = jest.fn();
const userUpdateMock = jest.fn();
const orgSetMock = jest.fn();
const memberSetMock = jest.fn();
const ledgerCreateMock = jest.fn();

// In-memory payments_ledger — lets replay tests pre-seed an applied payment.
let ledgerStore: Record<string, any> = {};

function makeLedgerRef(id: string) {
    return {
        id,
        get: async () => ({ exists: id in ledgerStore, data: () => ledgerStore[id] }),
        create: async (data: any) => {
            if (id in ledgerStore) {
                const e: any = new Error('ALREADY_EXISTS');
                e.code = 6;
                throw e;
            }
            ledgerStore[id] = data;
            ledgerCreateMock(id, data);
        },
    };
}

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
            if (col === 'payments_ledger') {
                return { doc: (id: string) => makeLedgerRef(id) };
            }
            return { doc: () => ({ update: jest.fn(), set: jest.fn() }) };
        },
        runTransaction: async (fn: (tx: any) => Promise<any>) => {
            const tx = {
                get: async (ref: any) => ref.get(),
                update: (ref: any, data: any) => {
                    ref.update(data);
                },
                set: (ref: any, data: any) => {
                    ref.set?.(data);
                },
                create: (ref: any, data: any) => {
                    if (ref.id in ledgerStore) {
                        const e: any = new Error('ALREADY_EXISTS');
                        e.code = 6;
                        throw e;
                    }
                    ledgerStore[ref.id] = data;
                    ledgerCreateMock(ref.id, data);
                },
            };
            return fn(tx);
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
// RAZORPAY_PLANS is consumed by src/server/payments.ts (cadence resolution).
const razorpayFetchMock = jest.fn();
jest.mock('@/lib/razorpay', () => ({
    getRazorpay: () => ({ payments: { fetch: razorpayFetchMock } }),
    RAZORPAY_PLANS: {
        pro_monthly: 'plan_pro_m',
        pro_annual: 'plan_pro_a',
        gold_monthly: '',
        gold_annual: '',
        premium_monthly: '',
        premium_annual: '',
    },
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
    ledgerCreateMock.mockReset();
    ledgerStore = {};
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
        // No ledger entry — nothing was applied
        expect(ledgerCreateMock).not.toHaveBeenCalled();
    });

    test('admin WITH verified (captured) razorpayPaymentId grants the plan + writes ledger', async () => {
        isAdminMock.mockResolvedValue(true);
        // H21: the grant only happens after server-side verification says
        // the payment is captured with a positive amount. Premium is a
        // custom quote — no fixed price — so any positive INR amount is
        // accepted, flagged amountVerified: false in the ledger.
        razorpayFetchMock.mockResolvedValue({ status: 'captured', amount: 49900, currency: 'INR' });

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

        // H21: ledger doc created transactionally with the grant
        expect(ledgerCreateMock).toHaveBeenCalledTimes(1);
        const [ledgerId, ledgerDoc] = ledgerCreateMock.mock.calls[0];
        expect(ledgerId).toBe('pay_verified_xyz');
        expect(ledgerDoc).toMatchObject({
            uid: 'school_admin_uid',
            orgId: 'org_test_1',
            amountPaise: 49900,
            currency: 'INR',
            planType: 'premium',
            status: 'applied',
            source: 'org-creation',
            amountVerified: false, // premium = custom quote, no canonical price
        });
    });

    // H21 (commit 966ae0bb4): the mere presence of a payment id is NOT proof
    // of payment. Unverifiable / non-captured payments must fail closed —
    // org is created, but the plan flip is deferred to the webhook.
    test('admin with UNVERIFIED razorpayPaymentId does NOT grant the plan (fail closed)', async () => {
        isAdminMock.mockResolvedValue(true);
        razorpayFetchMock.mockResolvedValue({ status: 'created', amount: 49900, currency: 'INR' });

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

describe('POST /api/organizations (H21 amount binding + ledger idempotency)', () => {
    test('gold org: captured payment with WRONG amount → NO grant, rejected ledger entry', async () => {
        isAdminMock.mockResolvedValue(true);
        // Gold 20 seats = 20 × ₹2,999 = 5,998,000 paise. A ₹499 capture must not unlock it.
        razorpayFetchMock.mockResolvedValue({ status: 'captured', amount: 49900, currency: 'INR' });

        const req = makeReq(
            {
                name: 'Cheap School',
                type: 'school',
                plan: 'gold',
                totalSeats: 20,
                adminUserId: 'gold_admin_uid',
                razorpayPaymentId: 'pay_wrong_amount',
            },
            { 'x-user-id': 'admin_uid' }
        );

        const res = await POST(req);
        expect(res.status).toBe(200); // org still created — plan flip deferred

        for (const call of userUpdateMock.mock.calls) {
            expect(call[0]).not.toHaveProperty('planType');
        }
        expect(setCustomUserClaimsMock).not.toHaveBeenCalled();

        // Audit trail: rejected ledger doc, not an applied one
        expect(ledgerStore['pay_wrong_amount']).toMatchObject({
            status: 'rejected',
            rejectReason: 'AMOUNT_MISMATCH',
            expectedPaise: 20 * 299_900,
            amountPaise: 49900,
        });
    });

    test('gold org: captured payment with EXACT tier amount → grant applied once', async () => {
        isAdminMock.mockResolvedValue(true);
        razorpayFetchMock.mockResolvedValue({ status: 'captured', amount: 20 * 299_900, currency: 'INR' });

        const req = makeReq(
            {
                name: 'Paid School',
                type: 'school',
                plan: 'gold',
                totalSeats: 20,
                adminUserId: 'gold_admin_uid',
                razorpayPaymentId: 'pay_gold_exact',
            },
            { 'x-user-id': 'admin_uid' }
        );

        const res = await POST(req);
        expect(res.status).toBe(200);

        const planTypeWrite = userUpdateMock.mock.calls.find(([arg]: any) => arg && 'planType' in arg);
        expect(planTypeWrite[0].planType).toBe('gold');
        expect(ledgerStore['pay_gold_exact']).toMatchObject({
            status: 'applied',
            amountVerified: true,
            expectedPaise: 20 * 299_900,
        });
    });

    test('REPLAYED payment id → no second grant, no claim, replay is a no-op', async () => {
        isAdminMock.mockResolvedValue(true);
        razorpayFetchMock.mockResolvedValue({ status: 'captured', amount: 20 * 299_900, currency: 'INR' });

        // Payment already applied (e.g. via a previous org creation or the webhook)
        ledgerStore['pay_replayed'] = {
            uid: 'someone_else',
            planType: 'gold',
            status: 'applied',
        };

        const req = makeReq(
            {
                name: 'Replay School',
                type: 'school',
                plan: 'gold',
                totalSeats: 20,
                adminUserId: 'replay_admin_uid',
                razorpayPaymentId: 'pay_replayed',
            },
            { 'x-user-id': 'admin_uid' }
        );

        const res = await POST(req);
        expect(res.status).toBe(200); // org shell still created

        // No plan flip, no claim — replayed payment must not double-provision.
        for (const call of userUpdateMock.mock.calls) {
            expect(call[0]).not.toHaveProperty('planType');
        }
        expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
        // Ledger untouched (no overwrite of the original application)
        expect(ledgerStore['pay_replayed'].uid).toBe('someone_else');
        expect(ledgerCreateMock).not.toHaveBeenCalled();
    });

    test('non-INR currency → NO grant', async () => {
        isAdminMock.mockResolvedValue(true);
        razorpayFetchMock.mockResolvedValue({ status: 'captured', amount: 20 * 299_900, currency: 'USD' });

        const req = makeReq(
            {
                name: 'FX School',
                type: 'school',
                plan: 'gold',
                totalSeats: 20,
                adminUserId: 'fx_admin_uid',
                razorpayPaymentId: 'pay_usd',
            },
            { 'x-user-id': 'admin_uid' }
        );

        const res = await POST(req);
        expect(res.status).toBe(200);
        for (const call of userUpdateMock.mock.calls) {
            expect(call[0]).not.toHaveProperty('planType');
        }
        expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
        expect(ledgerStore['pay_usd']?.status).toBe('rejected');
    });
});
