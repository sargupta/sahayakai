/**
 * H21: src/server/payments.ts unit tests.
 *
 *  - price-table drift guard against plan-config (single source of truth)
 *  - amount validation (org path + subscription path)
 *  - applyPaymentOnce transactional get-then-create idempotency
 */

jest.mock('@/lib/razorpay', () => ({
    RAZORPAY_PLANS: {
        pro_monthly: 'plan_pro_m',
        pro_annual: 'plan_pro_a',
        gold_monthly: '',
        gold_annual: 'plan_gold_a',
        premium_monthly: '',
        premium_annual: '',
    },
}));

// In-memory ledger for applyPaymentOnce tests
let ledgerStore: Record<string, any> = {};
const grantMock = jest.fn();

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (col: string) => ({
            doc: (id: string) => ({
                id,
                path: `${col}/${id}`,
                get: async () => ({ exists: id in ledgerStore, data: () => ledgerStore[id] }),
                create: async (data: any) => {
                    if (id in ledgerStore) {
                        const e: any = new Error('ALREADY_EXISTS');
                        e.code = 6;
                        throw e;
                    }
                    ledgerStore[id] = data;
                },
            }),
        }),
        runTransaction: async (fn: (tx: any) => Promise<any>) => {
            const tx = {
                get: async (ref: any) => ref.get(),
                update: jest.fn(),
                set: jest.fn(),
                create: (ref: any, data: any) => {
                    if (ref.id in ledgerStore) {
                        const e: any = new Error('ALREADY_EXISTS');
                        e.code = 6;
                        throw e;
                    }
                    ledgerStore[ref.id] = data;
                },
            };
            return fn(tx);
        },
    }),
}));

import {
    EXPECTED_PLAN_AMOUNT_PAISE,
    GOLD_VOLUME_TIERS_PAISE,
    expectedOrgAmountPaise,
    validateOrgPaymentAmount,
    validateSubscriptionChargeAmount,
    applyPaymentOnce,
    recordRejectedPayment,
} from '@/server/payments';
import { getPlanPaise, PLAN_PRICING } from '@/lib/plan-config';

beforeEach(() => {
    ledgerStore = {};
    grantMock.mockReset();
});

// ── Drift guard ─────────────────────────────────────────────────────────────

describe('price table drift guard (payments.ts ↔ plan-config.ts)', () => {
    test('pro paise match getPlanPaise (canonical pricing-page source)', () => {
        expect(EXPECTED_PLAN_AMOUNT_PAISE.pro_monthly).toBe(getPlanPaise('pro', 'monthly'));
        expect(EXPECTED_PLAN_AMOUNT_PAISE.pro_annual).toBe(getPlanPaise('pro', 'annual'));
    });

    test('gold volume ladder matches PLAN_PRICING.gold.annual.volumeTiers', () => {
        const canonical = PLAN_PRICING.gold.annual.volumeTiers;
        expect(GOLD_VOLUME_TIERS_PAISE.length).toBe(canonical.length);
        canonical.forEach((tier, i) => {
            expect(GOLD_VOLUME_TIERS_PAISE[i].minSeats).toBe(tier.minSeats);
            expect(GOLD_VOLUME_TIERS_PAISE[i].maxSeats).toBe(tier.maxSeats);
            expect(GOLD_VOLUME_TIERS_PAISE[i].paisePerSeat).toBe(
                tier.rupees === null ? null : tier.rupees * 100
            );
        });
    });
});

// ── Amount validation ───────────────────────────────────────────────────────

describe('expectedOrgAmountPaise', () => {
    test('gold volume tiers', () => {
        expect(expectedOrgAmountPaise('gold', 20)).toBe(20 * 299_900);
        expect(expectedOrgAmountPaise('gold', 49)).toBe(49 * 299_900);
        expect(expectedOrgAmountPaise('gold', 50)).toBe(50 * 249_900);
        expect(expectedOrgAmountPaise('gold', 100)).toBe(100 * 199_900);
        expect(expectedOrgAmountPaise('gold', 250)).toBeUndefined(); // custom quote
    });

    test('gold below 20 seats billed at tier-1 rate (founder policy)', () => {
        expect(expectedOrgAmountPaise('gold', 5)).toBe(5 * 299_900);
    });

    test('premium = custom quote, no fixed price', () => {
        expect(expectedOrgAmountPaise('premium', 100)).toBeUndefined();
    });
});

describe('validateOrgPaymentAmount', () => {
    test('exact gold amount ok + verified', () => {
        expect(
            validateOrgPaymentAmount({ plan: 'gold', totalSeats: 20, amountPaise: 20 * 299_900, currency: 'INR' })
        ).toMatchObject({ ok: true, verified: true, expectedPaise: 20 * 299_900 });
    });

    test('mismatched amount rejected', () => {
        expect(
            validateOrgPaymentAmount({ plan: 'gold', totalSeats: 20, amountPaise: 100, currency: 'INR' })
        ).toMatchObject({ ok: false, reason: 'AMOUNT_MISMATCH' });
    });

    test('premium accepted but unverified (custom quote)', () => {
        expect(
            validateOrgPaymentAmount({ plan: 'premium', totalSeats: 40, amountPaise: 123_456, currency: 'INR' })
        ).toMatchObject({ ok: true, verified: false, expectedPaise: null });
    });

    test('zero / negative / NaN amounts rejected', () => {
        for (const amountPaise of [0, -5, NaN]) {
            expect(
                validateOrgPaymentAmount({ plan: 'premium', totalSeats: 40, amountPaise, currency: 'INR' }).ok
            ).toBe(false);
        }
    });

    test('non-INR rejected', () => {
        expect(
            validateOrgPaymentAmount({ plan: 'gold', totalSeats: 20, amountPaise: 20 * 299_900, currency: 'USD' }).ok
        ).toBe(false);
    });
});

describe('validateSubscriptionChargeAmount', () => {
    test('pro monthly exact ok; annual exact ok', () => {
        expect(
            validateSubscriptionChargeAmount({ planId: 'plan_pro_m', planType: 'pro', amountPaise: 19_900, currency: 'INR' })
        ).toMatchObject({ ok: true, verified: true });
        expect(
            validateSubscriptionChargeAmount({ planId: 'plan_pro_a', planType: 'pro', amountPaise: 199_900, currency: 'INR' })
        ).toMatchObject({ ok: true, verified: true });
    });

    test('pro with wrong amount rejected', () => {
        expect(
            validateSubscriptionChargeAmount({ planId: 'plan_pro_m', planType: 'pro', amountPaise: 100, currency: 'INR' })
        ).toMatchObject({ ok: false, reason: 'AMOUNT_MISMATCH', expectedPaise: 19_900 });
    });

    test('pro with unresolvable cadence fails CLOSED', () => {
        expect(
            validateSubscriptionChargeAmount({ planId: 'plan_unknown', planType: 'pro', amountPaise: 19_900, currency: 'INR' })
        ).toMatchObject({ ok: false, reason: 'UNKNOWN_PRO_CADENCE' });
    });

    test('gold subscription accepted but unverified (quantity-based, sales-assisted)', () => {
        expect(
            validateSubscriptionChargeAmount({ planId: 'plan_gold_a', planType: 'gold', amountPaise: 5_998_000, currency: 'INR' })
        ).toMatchObject({ ok: true, verified: false });
    });
});

// ── Ledger idempotency ──────────────────────────────────────────────────────

const entry = {
    uid: 'u1',
    amountPaise: 19_900,
    currency: 'INR',
    planType: 'pro',
    source: 'razorpay-webhook' as const,
    amountVerified: true,
    expectedPaise: 19_900,
};

describe('applyPaymentOnce', () => {
    test('first application runs grant + creates ledger doc', async () => {
        const result = await applyPaymentOnce({ paymentId: 'pay_a', entry, grant: grantMock });
        expect(result).toBe('applied');
        expect(grantMock).toHaveBeenCalledTimes(1);
        expect(ledgerStore['pay_a']).toMatchObject({ ...entry, status: 'applied' });
    });

    test('replay is a no-op: grant NOT run, ledger untouched', async () => {
        await applyPaymentOnce({ paymentId: 'pay_a', entry, grant: grantMock });
        grantMock.mockClear();

        const result = await applyPaymentOnce({
            paymentId: 'pay_a',
            entry: { ...entry, uid: 'attacker' },
            grant: grantMock,
        });
        expect(result).toBe('replay');
        expect(grantMock).not.toHaveBeenCalled();
        expect(ledgerStore['pay_a'].uid).toBe('u1'); // original entry preserved
    });

    test('unsafe payment ids are rejected before touching Firestore', async () => {
        for (const bad of ['', 'a/b', '..', 'x'.repeat(200), 'pay$1']) {
            await expect(
                applyPaymentOnce({ paymentId: bad, entry, grant: grantMock })
            ).rejects.toThrow(/Invalid payment id/);
        }
        expect(grantMock).not.toHaveBeenCalled();
    });
});

describe('recordRejectedPayment', () => {
    test('writes a rejected audit doc; never overwrites an applied one', async () => {
        await recordRejectedPayment('pay_r', entry, 'AMOUNT_MISMATCH');
        expect(ledgerStore['pay_r']).toMatchObject({ status: 'rejected', rejectReason: 'AMOUNT_MISMATCH' });

        ledgerStore['pay_done'] = { status: 'applied', uid: 'u1' };
        await recordRejectedPayment('pay_done', entry, 'AMOUNT_MISMATCH');
        expect(ledgerStore['pay_done'].status).toBe('applied'); // untouched
    });
});
