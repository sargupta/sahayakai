import 'server-only';
import Razorpay from 'razorpay';

/**
 * Razorpay singleton client.
 *
 * Env vars required:
 *   RAZORPAY_KEY_ID       — from Razorpay dashboard
 *   RAZORPAY_KEY_SECRET   — from Razorpay dashboard
 *   RAZORPAY_WEBHOOK_SECRET — separate from key_secret, set in Razorpay webhook config
 */

let _instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
    if (_instance) return _instance;

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
        throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
    }

    _instance = new Razorpay({ key_id, key_secret });
    return _instance;
}

/** Plan IDs — create these in Razorpay dashboard (test mode first). */
export const RAZORPAY_PLANS = {
    pro_monthly: process.env.RAZORPAY_PLAN_PRO_MONTHLY || '',
    pro_annual: process.env.RAZORPAY_PLAN_PRO_ANNUAL || '',
    gold_monthly: process.env.RAZORPAY_PLAN_GOLD_MONTHLY || '',
    gold_annual: process.env.RAZORPAY_PLAN_GOLD_ANNUAL || '',
    premium_monthly: process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY || '',
    premium_annual: process.env.RAZORPAY_PLAN_PREMIUM_ANNUAL || '',
} as const;

export type RazorpayPlanKey = keyof typeof RAZORPAY_PLANS;

export type PlanType = 'pro' | 'gold' | 'premium';

/**
 * Resolve our internal plan tier strictly from a Razorpay plan_id.
 *
 * SECURITY: The webhook MUST derive planType from `subscription.plan_id` —
 * NOT from `notes.planKey` (which is forgeable substring data on the
 * subscription create call). plan_id is the immutable Razorpay reference.
 * Returns null for unknown plan_ids — callers MUST treat that as an error
 * and refuse to grant access (F7-003).
 */
export function resolvePlanTypeFromPlanId(planId: string | undefined | null): PlanType | null {
    if (!planId) return null;
    const map: Record<string, PlanType> = {};
    const pairs: Array<[string, PlanType]> = [
        [RAZORPAY_PLANS.pro_monthly, 'pro'],
        [RAZORPAY_PLANS.pro_annual, 'pro'],
        [RAZORPAY_PLANS.gold_monthly, 'gold'],
        [RAZORPAY_PLANS.gold_annual, 'gold'],
        [RAZORPAY_PLANS.premium_monthly, 'premium'],
        [RAZORPAY_PLANS.premium_annual, 'premium'],
    ];
    for (const [id, tier] of pairs) {
        if (id) map[id] = tier;
    }
    return map[planId] || null;
}

/** Verify Razorpay webhook signature using HMAC-SHA256. */
export function verifyWebhookSignature(
    body: string,
    signature: string
): boolean {
    const crypto = require('crypto');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET not set');

    const expected = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
