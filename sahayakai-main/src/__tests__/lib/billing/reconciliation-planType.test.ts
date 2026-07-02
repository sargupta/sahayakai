/**
 * F7-002: billing-reconciliation must read AND write `users.planType`.
 *
 * Scenario: Razorpay says user has an active subscription, Firestore
 * `users.planType` is 'free'. Reconciliation should:
 *   1. Detect the mismatch (D1 — rzp_active_fs_free)
 *   2. Auto-fix by writing planType (NOT 'plan')
 *   3. Sync the Firebase custom claim
 */

const userUpdateMock = jest.fn();
const setCustomUserClaimsMock = jest.fn();
const batchSetMock = jest.fn();
const reportSetMock = jest.fn();
const runSetMock = jest.fn();
const actionRefDocMock = jest.fn(() => ({ id: 'action_x' }));

// Captured queries so we can assert reconciliation no longer queries `users.plan`.
const whereCalls: Array<{ field: string; op: string; value: any }> = [];

const fakeUserDocs = [
    // The paid user whose Firestore is stuck on free
    {
        id: 'stuck_user_uid',
        get: (field: string) => {
            const data: Record<string, any> = {
                planType: 'free',
                razorpaySubscriptionId: 'sub_active_xyz',
                razorpayPlanId: 'plan_pro_monthly_id',
            };
            return data[field];
        },
    },
];

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (col: string) => {
            if (col === 'users') {
                return {
                    where(field: string, op: string, value: any) {
                        whereCalls.push({ field, op, value });
                        return this;
                    },
                    select() { return this; },
                    get: async () => ({ docs: fakeUserDocs }),
                    doc: (_uid: string) => ({ update: userUpdateMock }),
                };
            }
            if (col === 'billing_reconciliation_runs') {
                return { doc: () => ({ set: runSetMock }) };
            }
            if (col === 'billing_reconciliation_actions') {
                return { doc: actionRefDocMock };
            }
            if (col === 'billing_monthly_reports') {
                return { doc: () => ({ set: reportSetMock }) };
            }
            return { doc: () => ({}) };
        },
        batch: () => ({ set: batchSetMock, commit: async () => undefined }),
        // F12-P2-10 lease mutex: acquireLease/releaseLease use db.doc + db.runTransaction.
        doc: (_path: string) => ({
            get: async () => ({ exists: false, data: () => undefined }),
        }),
        runTransaction: async (fn: (tx: any) => Promise<any>) => fn({
            get: async (ref: any) =>
                ref?.get ? ref.get() : { exists: false, data: () => undefined },
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        }),
    }),
}));

jest.mock('firebase-admin/auth', () => ({
    getAuth: () => ({ setCustomUserClaims: setCustomUserClaimsMock }),
}));

jest.mock('@/lib/secrets', () => ({ getSecret: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock('@/lib/billing-metrics', () => ({ emitBillingMetric: jest.fn() }));

// Set env BEFORE module load — PLAN_NAME_MAP is built at import time.
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_PLAN_PRO_MONTHLY = 'plan_pro_monthly_id';

beforeEach(() => {
    userUpdateMock.mockReset();
    setCustomUserClaimsMock.mockReset();
    batchSetMock.mockReset();
    runSetMock.mockReset();
    actionRefDocMock.mockClear();
    whereCalls.length = 0;

    (global as any).fetch = jest.fn(async (url: string) => {
        if (url.includes('/subscriptions?')) {
            return {
                ok: true,
                json: async () => ({
                    items: [
                        {
                            id: 'sub_active_xyz',
                            plan_id: 'plan_pro_monthly_id',
                            customer_id: 'cust_1',
                            status: 'active',
                            current_start: Math.floor(Date.now() / 1000) - 86400,
                            current_end: Math.floor(Date.now() / 1000) + 86400 * 25,
                            charge_at: null,
                            notes: { userId: 'stuck_user_uid' },
                            total_count: 12,
                            paid_count: 1,
                        },
                    ],
                    count: 1,
                }),
            };
        }
        // Payments fetch — return single captured payment so no double-charge flag
        return {
            ok: true,
            json: async () => ({
                items: [
                    {
                        id: 'pay_1',
                        amount: 14900,
                        currency: 'INR',
                        status: 'captured',
                        created_at: Math.floor(Date.now() / 1000) - 86400,
                        notes: {},
                    },
                ],
            }),
        };
    });
});

async function loadAndRun(): Promise<any> {
    let result: any;
    await jest.isolateModulesAsync(async () => {
        const mod = await import('@/lib/billing-reconciliation');
        result = await mod.runReconciliation();
    });
    return result;
}

describe('F7-002: billing-reconciliation reads/writes planType', () => {
    test('charged-but-Firestore-stuck scenario → detects + auto-fixes planType', async () => {
        const result = await loadAndRun();

        // 1. Mismatch detected and auto-fixed
        const d1 = result.mismatches.find((m) => m.type === 'rzp_active_fs_free');
        expect(d1).toBeTruthy();
        expect(d1!.action).toBe('auto_fixed');
        expect(d1!.userId).toBe('stuck_user_uid');

        // 2. The Firestore update writes planType (NOT 'plan')
        expect(userUpdateMock).toHaveBeenCalled();
        const writeArg = userUpdateMock.mock.calls[0][0];
        expect(writeArg).toHaveProperty('planType');
        expect(writeArg.planType).toBe('pro');
        expect(writeArg).not.toHaveProperty('plan'); // no orphan field

        // 3. Custom claim synced
        expect(setCustomUserClaimsMock).toHaveBeenCalledWith(
            'stuck_user_uid',
            expect.objectContaining({ planType: 'pro' })
        );
    });

    test('does not query users by the legacy `plan` field as the canonical source', async () => {
        await loadAndRun();
        // The canonical query is on `planType`. A legacy `plan` query is allowed as a
        // defense-in-depth fallback only — but the planType query MUST appear.
        const planTypeQuery = whereCalls.find((c) => c.field === 'planType');
        expect(planTypeQuery).toBeTruthy();
        expect(planTypeQuery!.op).toBe('in');
        expect(planTypeQuery!.value).toEqual(expect.arrayContaining(['pro', 'gold', 'premium']));
    });
});
