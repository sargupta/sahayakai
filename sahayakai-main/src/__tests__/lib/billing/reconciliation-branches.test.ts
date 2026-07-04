/**
 * Branch coverage for src/lib/billing-reconciliation.ts — the money-path
 * engine gated at 80% per-path coverage (jest.config.ts).
 *
 * Complements reconciliation-planType.test.ts (D1 happy path) with:
 *   - lease mutex (held / acquire-failure / release)
 *   - D2/D6 terminal-status downgrade (expired vs still-paid)
 *   - D4 double-charge detection + payments-fetch failure
 *   - D5 admin override, D7 amount mismatch, unknown_plan_id
 *   - orphan_firestore, fatal-error path, persistence failure
 *   - pagination + getSecret credential fallback
 *   - runMonthlyReconciliation (happy + Firestore-failure fallback)
 */

const userUpdateMock = jest.fn();
const setCustomUserClaimsMock = jest.fn();
const runSetMock = jest.fn();
const monthlyReportSetMock = jest.fn();
const getSecretMock = jest.fn();

// Stateful lease doc shared by acquire/release transactions.
const leaseState: { doc: Record<string, any> | undefined; txThrows: boolean } = {
    doc: undefined,
    txThrows: false,
};

// Per-test knobs
const dbState: {
    userDocs: any[];
    subscriptionDocs: any[];
    runSetThrows: boolean;
} = { userDocs: [], subscriptionDocs: [], runSetThrows: false };

function makeUserDoc(id: string, fields: Record<string, any>) {
    return { id, get: (f: string) => fields[f] };
}

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (col: string) => {
            if (col === 'users') {
                return {
                    where() { return this; },
                    select() { return this; },
                    get: async () => ({ docs: dbState.userDocs }),
                    doc: () => ({ update: userUpdateMock }),
                };
            }
            if (col === 'billing_reconciliation_runs') {
                return {
                    doc: () => ({
                        set: (...args: any[]) => {
                            if (dbState.runSetThrows) throw new Error('persist failed');
                            return runSetMock(...args);
                        },
                    }),
                };
            }
            if (col === 'billing_reconciliation_actions') {
                return { doc: () => ({ id: 'action_x' }) };
            }
            if (col === 'billing_monthly_reports') {
                return { doc: () => ({ set: monthlyReportSetMock }) };
            }
            if (col === 'subscriptions') {
                return {
                    where() { return this; },
                    get: async () => ({ docs: dbState.subscriptionDocs }),
                };
            }
            return { doc: () => ({}) };
        },
        batch: () => ({ set: jest.fn(), commit: async () => undefined }),
        doc: (path: string) => ({ __path: path }),
        runTransaction: async (fn: (tx: any) => Promise<any>) => {
            if (leaseState.txThrows) throw new Error('tx unavailable');
            return fn({
                get: async () =>
                    leaseState.doc
                        ? { exists: true, data: () => leaseState.doc }
                        : { exists: false, data: () => undefined },
                set: (_ref: any, data: any) => { leaseState.doc = data; },
                delete: () => { leaseState.doc = undefined; },
            });
        },
    }),
}));

jest.mock('firebase-admin/auth', () => ({
    getAuth: () => ({ setCustomUserClaims: setCustomUserClaimsMock }),
}));
jest.mock('@/lib/secrets', () => ({ getSecret: (...args: any[]) => getSecretMock(...args) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock('@/lib/billing-metrics', () => ({ emitBillingMetric: jest.fn() }));

// PLAN_NAME_MAP is built at import time — env must exist before module load.
const PRO_MONTHLY_ID = 'plan_pro_monthly_id';
const PRO_MONTHLY_PAISE = 19900; // canonical: plan-config.ts PLAN_PRICING.pro.monthly

const now = () => Math.floor(Date.now() / 1000);

function makeSub(overrides: Partial<Record<string, any>> = {}) {
    return {
        id: 'sub_1',
        plan_id: PRO_MONTHLY_ID,
        customer_id: 'cust_1',
        status: 'active',
        current_start: now() - 86400,
        current_end: now() + 86400 * 25,
        charge_at: null,
        notes: { userId: 'user_1' },
        total_count: 12,
        paid_count: 1,
        ...overrides,
    };
}

function mockFetch(routes: {
    subscriptionPages?: any[][];
    payments?: any[] | 'fail';
    monthlyPaymentPages?: any[][];
}) {
    let subPage = 0;
    let monthlyPage = 0;
    (global as any).fetch = jest.fn(async (url: string) => {
        if (url.includes('/subscriptions?')) {
            const pages = routes.subscriptionPages ?? [[]];
            const items = pages[Math.min(subPage, pages.length - 1)] ?? [];
            subPage += 1;
            return { ok: true, json: async () => ({ items, count: items.length }) };
        }
        if (url.match(/\/subscriptions\/[^/]+\/payments/)) {
            if (routes.payments === 'fail') {
                return { ok: false, status: 500, text: async () => 'boom' };
            }
            return { ok: true, json: async () => ({ items: routes.payments ?? [] }) };
        }
        if (url.includes('/payments?from=')) {
            const pages = routes.monthlyPaymentPages ?? [[]];
            const items = pages[Math.min(monthlyPage, pages.length - 1)] ?? [];
            monthlyPage += 1;
            return { ok: true, json: async () => ({ items }) };
        }
        return { ok: false, status: 404, text: async () => 'not found' };
    });
}

async function loadModule(): Promise<typeof import('@/lib/billing-reconciliation')> {
    let mod: any;
    await jest.isolateModulesAsync(async () => {
        mod = await import('@/lib/billing-reconciliation');
    });
    return mod;
}

beforeEach(() => {
    // resetAllMocks (not clearAllMocks): mockRejectedValue implementations set
    // inside individual tests must not leak into the next test.
    jest.resetAllMocks();
    userUpdateMock.mockResolvedValue(undefined);
    setCustomUserClaimsMock.mockResolvedValue(undefined);
    leaseState.doc = undefined;
    leaseState.txThrows = false;
    dbState.userDocs = [];
    dbState.subscriptionDocs = [];
    dbState.runSetThrows = false;
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
    process.env.RAZORPAY_PLAN_PRO_MONTHLY = PRO_MONTHLY_ID;
    getSecretMock.mockResolvedValue(undefined);
});

describe('lease mutex (F12-P2-10)', () => {
    test('skips the run when another run holds a fresh lease', async () => {
        leaseState.doc = { runId: 'other_run', acquiredAt: Date.now() };
        mockFetch({ subscriptionPages: [[makeSub()]] });

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        expect(result.errors).toEqual(['lease_held_by_another_run']);
        expect(result.rzpSubscriptionsFetched).toBe(0);
        expect((global as any).fetch).not.toHaveBeenCalled();
        // Lease untouched — still owned by the other run
        expect(leaseState.doc?.runId).toBe('other_run');
    });

    test('steals an expired lease, then releases its own on completion', async () => {
        leaseState.doc = { runId: 'crashed_run', acquiredAt: Date.now() - 20 * 60 * 1000 };
        mockFetch({ subscriptionPages: [[]] });

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        expect(result.errors).toEqual([]);
        expect(leaseState.doc).toBeUndefined(); // released
    });

    test('fails closed (skips run) when the lease transaction errors', async () => {
        leaseState.txThrows = true;
        mockFetch({ subscriptionPages: [[makeSub()]] });

        const mod = await loadModule();
        const result = await mod.runReconciliation();
        expect(result.errors).toEqual(['lease_held_by_another_run']);
    });
});

describe('mismatch detection branches', () => {
    test('D5: admin override on a free user with active Razorpay sub → flagged, never auto-fixed', async () => {
        dbState.userDocs = [makeUserDoc('user_1', {
            planType: 'free',
            razorpaySubscriptionId: 'sub_1',
            adminOverride: true,
        })];
        mockFetch({ subscriptionPages: [[makeSub()]] });

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        const m = result.mismatches.find((x) => x.type === 'admin_override');
        expect(m).toBeTruthy();
        expect(m!.action).toBe('flagged');
        expect(userUpdateMock).not.toHaveBeenCalled();
    });

    test('unknown plan_id → flagged, NOT auto-coerced', async () => {
        dbState.userDocs = [makeUserDoc('user_1', {
            planType: 'free',
            razorpaySubscriptionId: 'sub_1',
        })];
        mockFetch({ subscriptionPages: [[makeSub({ plan_id: 'plan_mystery' })]] });

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        const m = result.mismatches.find((x) => x.type === 'unknown_plan_id');
        expect(m).toBeTruthy();
        expect(m!.action).toBe('flagged');
        expect(userUpdateMock).not.toHaveBeenCalled();
    });

    test('D1 claim-sync failure is recorded but does not abort the fix', async () => {
        dbState.userDocs = [makeUserDoc('user_1', {
            planType: 'free',
            razorpaySubscriptionId: 'sub_1',
        })];
        setCustomUserClaimsMock.mockRejectedValue(new Error('auth down'));
        mockFetch({ subscriptionPages: [[makeSub()]], payments: [] });

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        expect(result.mismatches.find((x) => x.type === 'rzp_active_fs_free')?.action).toBe('auto_fixed');
        expect(result.errors.some((e) => e.includes('Failed to set claim on auto-fix D1'))).toBe(true);
    });

    test('D1 Firestore update failure is recorded as an error', async () => {
        dbState.userDocs = [makeUserDoc('user_1', {
            planType: 'free',
            razorpaySubscriptionId: 'sub_1',
        })];
        userUpdateMock.mockRejectedValue(new Error('write denied'));
        mockFetch({ subscriptionPages: [[makeSub()]], payments: [] });

        const mod = await loadModule();
        const result = await mod.runReconciliation();
        expect(result.errors.some((e) => e.includes('Failed to auto-fix D1'))).toBe(true);
    });

    test('D2: terminal sub past paid period → auto-downgrade to free + claim sync', async () => {
        dbState.userDocs = [makeUserDoc('user_1', {
            planType: 'pro',
            razorpaySubscriptionId: 'sub_1',
        })];
        mockFetch({
            subscriptionPages: [[makeSub({ status: 'cancelled', current_end: now() - 3600 })]],
        });

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        const m = result.mismatches.find((x) => x.type === 'rzp_terminal_fs_active');
        expect(m).toBeTruthy();
        expect(m!.action).toBe('auto_fixed');
        expect(userUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            planType: 'free',
            monthlyCredits: 50,
            creditsUsed: 0,
        }));
        expect(setCustomUserClaimsMock).toHaveBeenCalledWith('user_1', { planType: 'free' });
    });

    test('D2: terminal sub still within paid period → flagged, no downgrade', async () => {
        dbState.userDocs = [makeUserDoc('user_1', {
            planType: 'pro',
            razorpaySubscriptionId: 'sub_1',
        })];
        mockFetch({
            subscriptionPages: [[makeSub({ status: 'cancelled', current_end: now() + 86400 * 10 })]],
        });

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        const m = result.mismatches.find((x) => x.type === 'rzp_terminal_fs_active');
        expect(m).toBeTruthy();
        expect(m!.action).toBe('flagged');
        expect(userUpdateMock).not.toHaveBeenCalled();
    });

    test('D2: downgrade write failure lands in errors', async () => {
        dbState.userDocs = [makeUserDoc('user_1', {
            planType: 'pro',
            razorpaySubscriptionId: 'sub_1',
        })];
        userUpdateMock.mockRejectedValue(new Error('write denied'));
        mockFetch({
            subscriptionPages: [[makeSub({ status: 'expired', current_end: now() - 3600 })]],
        });

        const mod = await loadModule();
        const result = await mod.runReconciliation();
        expect(result.errors.some((e) => e.includes('Failed to auto-fix D2'))).toBe(true);
    });

    test('D7: active sub whose plan does not match Firestore planType → amount_mismatch flagged', async () => {
        dbState.userDocs = [makeUserDoc('user_1', {
            planType: 'gold', // paid, so D1 does not swallow it; mismatched vs pro plan_id
            razorpaySubscriptionId: 'sub_1',
        })];
        mockFetch({ subscriptionPages: [[makeSub()]], payments: [] });

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        const m = result.mismatches.find((x) => x.type === 'amount_mismatch');
        expect(m).toBeTruthy();
        expect(m!.action).toBe('flagged');
        expect(m!.details).toMatchObject({ expectedPlan: 'pro', fsPlan: 'gold' });
    });

    test('D4: two captured payments in the same cycle → double_charge flagged (never auto-refunded)', async () => {
        dbState.userDocs = [makeUserDoc('user_1', {
            planType: 'pro',
            razorpaySubscriptionId: 'sub_1',
        })];
        const cycleStart = now() - 86400;
        mockFetch({
            subscriptionPages: [[makeSub({ current_start: cycleStart })]],
            payments: [
                { id: 'pay_1', amount: PRO_MONTHLY_PAISE, currency: 'INR', status: 'captured', created_at: cycleStart + 10, notes: {} },
                { id: 'pay_2', amount: PRO_MONTHLY_PAISE, currency: 'INR', status: 'captured', created_at: cycleStart + 20, notes: {} },
                { id: 'pay_old', amount: PRO_MONTHLY_PAISE, currency: 'INR', status: 'captured', created_at: cycleStart - 999, notes: {} },
                { id: 'pay_fail', amount: PRO_MONTHLY_PAISE, currency: 'INR', status: 'failed', created_at: cycleStart + 30, notes: {} },
            ],
        });

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        const m = result.mismatches.find((x) => x.type === 'double_charge');
        expect(m).toBeTruthy();
        expect(m!.action).toBe('flagged');
        expect(m!.details.paymentIds).toEqual(['pay_1', 'pay_2']);
    });

    test('D4: payments-fetch failure is recorded, run continues', async () => {
        dbState.userDocs = [makeUserDoc('user_1', {
            planType: 'pro',
            razorpaySubscriptionId: 'sub_1',
        })];
        mockFetch({ subscriptionPages: [[makeSub()]], payments: 'fail' });

        const mod = await loadModule();
        const result = await mod.runReconciliation();
        expect(result.errors.some((e) => e.includes('Failed to check payments for sub_1'))).toBe(true);
    });

    test('orphan_firestore: Firestore subscription id missing from Razorpay → flagged', async () => {
        dbState.userDocs = [makeUserDoc('user_1', {
            planType: 'pro',
            razorpaySubscriptionId: 'sub_ghost',
        })];
        mockFetch({ subscriptionPages: [[]] });

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        const m = result.mismatches.find((x) => x.type === 'orphan_firestore');
        expect(m).toBeTruthy();
        expect(m!.subscriptionId).toBe('sub_ghost');
        expect(m!.userId).toBe('user_1');
    });
});

describe('run plumbing', () => {
    test('missing credentials → fatal error captured, run still completes and releases lease', async () => {
        delete process.env.RAZORPAY_KEY_ID;
        delete process.env.RAZORPAY_KEY_SECRET;
        getSecretMock.mockResolvedValue(undefined);
        mockFetch({});

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        expect(result.errors.some((e) => e.includes('Fatal reconciliation error'))).toBe(true);
        expect(leaseState.doc).toBeUndefined();
    });

    test('falls back to Secret Manager for credentials and paginates subscriptions', async () => {
        delete process.env.RAZORPAY_KEY_ID;
        delete process.env.RAZORPAY_KEY_SECRET;
        getSecretMock.mockImplementation(async (name: string) =>
            name === 'RAZORPAY_KEY_ID' ? 'secret_key_id' : 'secret_key_secret');

        // Full page of 100 'created' subs (no branch work) then an empty page.
        const fullPage = Array.from({ length: 100 }, (_, i) =>
            makeSub({ id: `sub_${i}`, status: 'created', notes: {} }));
        mockFetch({ subscriptionPages: [fullPage, []] });

        const mod = await loadModule();
        const result = await mod.runReconciliation();

        expect(result.rzpSubscriptionsFetched).toBe(100);
        expect(getSecretMock).toHaveBeenCalledWith('RAZORPAY_KEY_ID');
        const subFetches = ((global as any).fetch as jest.Mock).mock.calls
            .filter(([u]: [string]) => u.includes('/subscriptions?'));
        expect(subFetches).toHaveLength(2);
    }, 15000);

    test('Razorpay API error surfaces as a fatal reconciliation error', async () => {
        (global as any).fetch = jest.fn(async () => ({
            ok: false, status: 500, text: async () => 'internal error',
        }));

        const mod = await loadModule();
        const result = await mod.runReconciliation();
        expect(result.errors.some((e) => e.includes('Razorpay API'))).toBe(true);
    });

    test('result-persistence failure is appended to errors, not thrown', async () => {
        dbState.runSetThrows = true;
        mockFetch({ subscriptionPages: [[]] });

        const mod = await loadModule();
        const result = await mod.runReconciliation();
        expect(result.errors.some((e) => e.includes('Failed to persist reconciliation result'))).toBe(true);
    });
});

describe('runMonthlyReconciliation', () => {
    const capturedPayment = (id: string, amount: number) => ({
        id, amount, currency: 'INR', status: 'captured', created_at: now(), notes: {},
    });

    test('computes gross/fees/GST/net and matches Firestore-recorded revenue', async () => {
        dbState.subscriptionDocs = [
            { data: () => ({ planId: PRO_MONTHLY_ID, lastPaymentId: 'pay_1' }) },   // counted
            { data: () => ({ planId: PRO_MONTHLY_ID, lastPaymentId: 'pay_none' }) }, // not captured → skipped
            { data: () => ({ planId: PRO_MONTHLY_ID }) },                            // no lastPaymentId → skipped
        ];
        mockFetch({
            monthlyPaymentPages: [[
                capturedPayment('pay_1', PRO_MONTHLY_PAISE),
                capturedPayment('pay_2', PRO_MONTHLY_PAISE),
                { id: 'ref_1', amount: 5000, currency: 'INR', status: 'refunded', created_at: now(), notes: {} },
            ]],
        });

        const mod = await loadModule();
        const report = await mod.runMonthlyReconciliation('2026-06');

        const gross = 2 * PRO_MONTHLY_PAISE;
        const fees = Math.round(gross * 0.02);
        const gst = Math.round(fees * 0.18);
        expect(report).toMatchObject({
            month: '2026-06',
            grossCollections: gross,
            razorpayFees: fees,
            gstOnFees: gst,
            netSettlement: gross - fees - gst - 5000,
            firestoreRecordedRevenue: PRO_MONTHLY_PAISE, // only pay_1 matched a sub doc
            delta: gross - PRO_MONTHLY_PAISE,
            refundsIssued: 5000,
            refundCount: 1,
            paymentCount: 2,
        });
        expect(monthlyReportSetMock).toHaveBeenCalledWith(expect.objectContaining({
            grossCollectionsRupees: gross / 100,
        }));
    });

    test('falls back to gross when the Firestore revenue query fails (delta 0, job survives)', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        dbState.subscriptionDocs = null as any; // force .docs iteration failure
        mockFetch({ monthlyPaymentPages: [[capturedPayment('pay_1', PRO_MONTHLY_PAISE)]] });

        const mod = await loadModule();
        const report = await mod.runMonthlyReconciliation('2026-06');

        expect(report.firestoreRecordedRevenue).toBe(PRO_MONTHLY_PAISE);
        expect(report.delta).toBe(0);
        consoleErrorSpy.mockRestore();
    });
});
