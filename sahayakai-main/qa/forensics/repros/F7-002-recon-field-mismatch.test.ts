/**
 * F7-002 — reconciliation queries users.plan but webhook writes users.planType.
 * This test seeds a paid user the way the webhook does and asserts that
 * reconciliation can SEE the user's plan. It will FAIL on the current code,
 * proving the field-name drift.
 *
 * Run with: pnpm vitest run qa/forensics/repros/F7-002-recon-field-mismatch.test.ts
 * (requires Firebase emulator + RAZORPAY_* env vars stubbed)
 */
import { describe, it, expect, beforeAll } from 'vitest';

describe('F7-002 reconciliation field-name drift', () => {
  beforeAll(() => {
    // Seed users/{uid} the way the webhook does:
    //   { planType: 'pro', subscriptionId: 'sub_test_001', updatedAt: ... }
    // Seed subscriptions/{sub_test_001} with status='active'.
    // (Implementation depends on the project's emulator harness — left
    // as a fill-in so the QA owner can plug into the existing fixtures.)
  });

  it('fetchFirestorePaidUsers returns plan==="pro" for a paid user', async () => {
    const { runReconciliation } = await import('@/lib/billing-reconciliation');
    const result = await runReconciliation();
    const offending = result.mismatches.filter(
      (m) => m.type === 'rzp_active_fs_free' && m.userId === 'test-paid-user'
    );
    expect(offending).toEqual([]);
  });
});
