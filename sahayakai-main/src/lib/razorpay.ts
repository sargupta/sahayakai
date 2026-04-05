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
} as const;

export type RazorpayPlanKey = keyof typeof RAZORPAY_PLANS;

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
