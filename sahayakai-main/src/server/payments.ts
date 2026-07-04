import 'server-only';

/**
 * H21 — Payment ↔ plan binding + idempotency ledger.
 *
 * Two problems this module closes:
 *
 *  1. WEAK AMOUNT BINDING — before this, a payment only had to be `captured`
 *     with amount > 0 to unlock ANY plan. A ₹1 capture could provision a
 *     500-seat premium org. `validateOrgPaymentAmount` /
 *     `validateSubscriptionChargeAmount` bind the captured paise to the plan
 *     being granted.
 *
 *  2. REPLAYED PAYMENT IDS — the same captured payment id could be replayed
 *     through the org-creation path (or a re-delivered webhook under a new
 *     event id) to provision twice. `applyPaymentOnce` writes a
 *     `payments_ledger/{paymentId}` doc TRANSACTIONALLY with the plan grant:
 *     the transaction reads the ledger doc first and refuses the grant if it
 *     already exists (get-then-create inside one Firestore transaction, so
 *     two concurrent replays cannot both win).
 *
 * Ledger schema — payments_ledger/{paymentId}:
 *   uid            string   — user whose plan was granted
 *   orgId?         string   — set on the org-creation path
 *   amountPaise    number   — captured amount as reported by Razorpay
 *   currency       string   — 'INR'
 *   planType       string   — plan granted ('pro' | 'gold' | 'premium')
 *   status         'applied' | 'rejected'
 *   appliedAt      Date
 *   source         'razorpay-webhook' | 'org-creation'
 *   amountVerified boolean  — false when no canonical price exists (custom quote)
 *   expectedPaise  number|null — what the price table said we should have seen
 *   rejectReason?  string   — only on status 'rejected'
 */

import { RAZORPAY_PLANS } from '@/lib/razorpay';

// ═════════════════════════════════════════════════════════════════════════
// FOUNDER-EDITABLE PRICE TABLE (all amounts in PAISE)
// ─────────────────────────────────────────────────────────────────────────
// Source of the numbers: PLAN_PRICING in src/lib/plan-config.ts — the same
// constants the pricing page renders and billing-reconciliation checks
// against. A unit test (payments-ledger.test.ts) asserts this table equals
// getPlanPaise()/volumeTiers so it can never silently drift from the prices
// we actually charge. If you change prices, change plan-config.ts FIRST,
// then mirror the paise here (the test will fail until both agree).
// ═════════════════════════════════════════════════════════════════════════
export const EXPECTED_PLAN_AMOUNT_PAISE = {
    /** Individual Pro, monthly — ₹199/mo */
    pro_monthly: 19_900,
    /** Individual Pro, annual — ₹1,999/yr */
    pro_annual: 199_900,
} as const;

/**
 * School Gold annual volume ladder — paise PER SEAT per year.
 * `null` per-seat = custom quote (no fixed-price validation possible).
 * Seats below 20 are sales-assisted exceptions and are billed at the
 * 20–49 rate (FOUNDER POLICY — change here if sales quotes differently).
 */
export const GOLD_VOLUME_TIERS_PAISE = [
    { minSeats: 20, maxSeats: 49, paisePerSeat: 299_900 },  // ₹2,999/seat/yr
    { minSeats: 50, maxSeats: 99, paisePerSeat: 249_900 },  // ₹2,499/seat/yr
    { minSeats: 100, maxSeats: 249, paisePerSeat: 199_900 }, // ₹1,999/seat/yr
    { minSeats: 250, maxSeats: null as number | null, paisePerSeat: null as number | null }, // custom quote
] as const;

/** All Razorpay-billed prices are INR. Anything else is a mismatch. */
export const EXPECTED_CURRENCY = 'INR';

// ═════════════════════════════════════════════════════════════════════════

export type LedgerPlanType = 'pro' | 'gold' | 'premium';
export type LedgerSource = 'razorpay-webhook' | 'org-creation';

export interface AmountCheck {
    ok: boolean;
    /** true when we compared against a canonical price; false = custom quote (accepted but flagged). */
    verified: boolean;
    expectedPaise: number | null;
    reason?: string;
}

/**
 * Expected paise for an ORG plan grant (org-creation path).
 * Returns `undefined` when the combination has no fixed price
 * (premium = custom quote; gold 250+ seats = custom quote).
 */
export function expectedOrgAmountPaise(
    plan: 'gold' | 'premium',
    totalSeats: number
): number | undefined {
    if (plan === 'premium') return undefined; // custom quote — no fixed price
    // Gold: per-seat annual rate from the volume ladder. Seats below the
    // 20-seat floor are billed at the first-tier rate (founder policy above).
    const tier =
        GOLD_VOLUME_TIERS_PAISE.find(
            (t) => totalSeats >= t.minSeats && (t.maxSeats === null || totalSeats <= t.maxSeats)
        ) ?? (totalSeats < 20 ? GOLD_VOLUME_TIERS_PAISE[0] : undefined);
    if (!tier || tier.paisePerSeat === null) return undefined; // 250+ custom quote
    return tier.paisePerSeat * totalSeats;
}

/**
 * Bind a captured payment's amount to the org plan being granted.
 * Mismatch ⇒ { ok: false } — caller MUST NOT grant the plan.
 */
export function validateOrgPaymentAmount(params: {
    plan: 'gold' | 'premium';
    totalSeats: number;
    amountPaise: number;
    currency: string;
}): AmountCheck {
    const { plan, totalSeats, amountPaise, currency } = params;
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
        return { ok: false, verified: false, expectedPaise: null, reason: 'NON_POSITIVE_AMOUNT' };
    }
    if ((currency || '').toUpperCase() !== EXPECTED_CURRENCY) {
        return { ok: false, verified: false, expectedPaise: null, reason: `CURRENCY_MISMATCH: ${currency}` };
    }
    const expected = expectedOrgAmountPaise(plan, totalSeats);
    if (expected === undefined) {
        // Custom quote (premium, or gold 250+). No canonical price to compare
        // against — accept but mark unverified so reconciliation can review.
        return { ok: true, verified: false, expectedPaise: null };
    }
    if (amountPaise !== expected) {
        return { ok: false, verified: true, expectedPaise: expected, reason: 'AMOUNT_MISMATCH' };
    }
    return { ok: true, verified: true, expectedPaise: expected };
}

/** Resolve billing cadence from a Razorpay plan_id (mirrors resolvePlanTypeFromPlanId). */
export function resolvePlanCadenceFromPlanId(
    planId: string | undefined | null
): 'monthly' | 'annual' | null {
    if (!planId) return null;
    const monthly = [RAZORPAY_PLANS.pro_monthly, RAZORPAY_PLANS.gold_monthly, RAZORPAY_PLANS.premium_monthly];
    const annual = [RAZORPAY_PLANS.pro_annual, RAZORPAY_PLANS.gold_annual, RAZORPAY_PLANS.premium_annual];
    if (monthly.some((id) => id && id === planId)) return 'monthly';
    if (annual.some((id) => id && id === planId)) return 'annual';
    return null;
}

/**
 * Bind a subscription.charged payment's amount to the plan being granted.
 *
 * Strict for PRO (the only self-serve SKU — exact paise match required).
 * Gold/premium subscriptions are sales-assisted with per-seat quantities and
 * custom quotes, so there is no single canonical charge amount; those are
 * accepted with `verified: false` and left to billing-reconciliation (D7).
 */
export function validateSubscriptionChargeAmount(params: {
    planId: string | undefined | null;
    planType: LedgerPlanType;
    amountPaise: number;
    currency: string;
}): AmountCheck {
    const { planId, planType, amountPaise, currency } = params;
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
        return { ok: false, verified: false, expectedPaise: null, reason: 'NON_POSITIVE_AMOUNT' };
    }
    if ((currency || '').toUpperCase() !== EXPECTED_CURRENCY) {
        return { ok: false, verified: false, expectedPaise: null, reason: `CURRENCY_MISMATCH: ${currency}` };
    }
    if (planType === 'pro') {
        const cadence = resolvePlanCadenceFromPlanId(planId);
        const expected =
            cadence === 'monthly' ? EXPECTED_PLAN_AMOUNT_PAISE.pro_monthly
            : cadence === 'annual' ? EXPECTED_PLAN_AMOUNT_PAISE.pro_annual
            : undefined;
        if (expected === undefined) {
            // planType resolved to pro but cadence didn't — env drift. Fail closed.
            return { ok: false, verified: false, expectedPaise: null, reason: 'UNKNOWN_PRO_CADENCE' };
        }
        if (amountPaise !== expected) {
            return { ok: false, verified: true, expectedPaise: expected, reason: 'AMOUNT_MISMATCH' };
        }
        return { ok: true, verified: true, expectedPaise: expected };
    }
    // gold / premium — quantity-based or custom quote; no canonical amount.
    return { ok: true, verified: false, expectedPaise: null };
}

// ═════════════════════════════════════════════════════════════════════════
// Idempotency ledger
// ═════════════════════════════════════════════════════════════════════════

export const PAYMENTS_LEDGER_COLLECTION = 'payments_ledger';

/** Razorpay ids are [A-Za-z0-9_]; reject anything that can't be a safe doc id. */
function assertSafePaymentId(paymentId: string): void {
    if (
        typeof paymentId !== 'string' ||
        paymentId.length === 0 ||
        paymentId.length > 128 ||
        !/^[A-Za-z0-9_.-]+$/.test(paymentId) ||
        paymentId === '.' ||
        paymentId === '..'
    ) {
        throw new Error(`Invalid payment id for ledger: ${String(paymentId).slice(0, 40)}`);
    }
}

export interface LedgerEntryInput {
    uid: string;
    orgId?: string;
    amountPaise: number;
    currency: string;
    planType: string;
    source: LedgerSource;
    amountVerified: boolean;
    expectedPaise: number | null;
    /** Optional linkage for audit (e.g. Razorpay subscription id). */
    subscriptionId?: string;
}

async function getDb() {
    const { getDb: _getDb } = await import('@/lib/firebase-admin');
    return _getDb();
}

/**
 * Apply a payment exactly once.
 *
 * Runs a Firestore transaction that:
 *   1. reads payments_ledger/{paymentId}
 *   2. if it exists → returns 'replay' WITHOUT running the grant (no-op)
 *   3. otherwise runs `grant(tx)` (the caller's plan-grant writes) and
 *      tx.create()s the ledger doc in the SAME transaction
 *
 * Because the ledger read and the grant writes share one transaction, a
 * replayed payment id can never double-provision — even under concurrent
 * delivery — and a grant can never land without its ledger entry.
 */
export async function applyPaymentOnce(params: {
    paymentId: string;
    entry: LedgerEntryInput;
    grant: (tx: FirebaseFirestore.Transaction) => void | Promise<void>;
}): Promise<'applied' | 'replay'> {
    assertSafePaymentId(params.paymentId);
    const db = await getDb();
    const ledgerRef = db.collection(PAYMENTS_LEDGER_COLLECTION).doc(params.paymentId);

    const result = await db.runTransaction(async (tx) => {
        const existing = await tx.get(ledgerRef);
        if (existing.exists) {
            return 'replay' as const;
        }
        await params.grant(tx);
        tx.create(ledgerRef, {
            ...params.entry,
            status: 'applied',
            appliedAt: new Date(),
        });
        return 'applied' as const;
    });

    if (result === 'replay') {
        // Audit log — replay attempts are exactly the event H21 exists to catch.
        console.warn(
            `[Ledger] REPLAY no-op: payment ${params.paymentId} already applied — refused duplicate ${params.entry.planType} grant for uid ${params.entry.uid} (source=${params.entry.source})`
        );
    }
    return result;
}

/**
 * Best-effort audit record for a payment we REFUSED to apply (amount/currency
 * mismatch). Never throws — the rejection itself (no grant) is the security
 * control; this is the paper trail. Uses create() so an already-applied
 * payment is never overwritten.
 */
export async function recordRejectedPayment(
    paymentId: string,
    entry: LedgerEntryInput,
    reason: string
): Promise<void> {
    try {
        assertSafePaymentId(paymentId);
        const db = await getDb();
        await db.collection(PAYMENTS_LEDGER_COLLECTION).doc(paymentId).create({
            ...entry,
            status: 'rejected',
            rejectReason: reason,
            appliedAt: new Date(),
        });
    } catch (err: unknown) {
        const code = (err as { code?: number })?.code;
        if (code !== 6 /* ALREADY_EXISTS */) {
            console.error(`[Ledger] Failed to record rejected payment ${paymentId}:`, err);
        }
    }
}
