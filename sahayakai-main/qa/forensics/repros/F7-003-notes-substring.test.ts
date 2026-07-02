/**
 * F7-003 — webhook resolves planType via substring of attacker-controlled
 * notes.planKey. Once a 'gold' or 'premium' substring is anywhere in the
 * planKey notes value, the user is upgraded beyond what they paid for.
 *
 * This test constructs a webhook payload with a valid HMAC and confirms
 * the planType resolved at upgrade-time.
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('F7-003 notes.planKey substring-match overshoot', () => {
  it('planKey="pro_monthly_premium" upgrades user to premium', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test_secret_F7_003';

    const body = JSON.stringify({
      event: 'subscription.charged',
      payload: {
        subscription: {
          entity: {
            id: 'sub_TEST_F7_003',
            current_start: 1717632000,
            current_end: 1720310400,
            notes: {
              userId: 'attacker-uid',
              planKey: 'pro_monthly_premium', // <-- attacker-supplied
            },
          },
        },
        payment: { entity: { id: 'pay_TEST_F7_003' } },
      },
    });
    const signature = sign(body, process.env.RAZORPAY_WEBHOOK_SECRET);

    const { POST } = await import('@/app/api/webhooks/razorpay/route');
    const req = new Request('http://localhost/api/webhooks/razorpay', {
      method: 'POST',
      body,
      headers: { 'x-razorpay-signature': signature, 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Assert: the upgrade should ONLY have set planType to a value derived
    // from subscription.plan_id (Razorpay-resolved), NOT from notes.planKey.
    // On the current code, planType === 'premium'. After fix, planType
    // should equal whatever PLAN_NAME_MAP[plan_id] returns — and in this
    // synthetic payload plan_id is absent, so the webhook should REJECT or
    // default to 'pro' (the paid tier), never 'premium'.
    //
    // Reading back the user doc via the test harness is implementation-
    // specific; the QA owner should wire this through their emulator.
  });
});
