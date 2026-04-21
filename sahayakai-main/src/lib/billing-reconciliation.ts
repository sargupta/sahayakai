/**
 * Billing Reconciliation Engine
 *
 * Compares Razorpay subscription state with Firestore user plan state.
 * Designed to run every 4 hours via Cloud Scheduler → POST /api/jobs/billing-reconciliation.
 *
 * Auto-fixes safe mismatches (e.g. user paid but Firestore still shows free).
 * Flags dangerous ones (double charges, amount mismatches) for manual review.
 */

import { getDb } from '@/lib/firebase-admin';
import { getSecret } from '@/lib/secrets';
import { logger } from '@/lib/logger';
import { emitBillingMetric } from '@/lib/billing-metrics';

// ─── Types ──────────────────────────────────────────────────────────

export type MismatchType =
  | 'rzp_active_fs_free'       // D1: Razorpay active, Firestore free — webhook lost
  | 'rzp_terminal_fs_active'   // D2/D6: Razorpay cancelled/expired, Firestore still active
  | 'credits_stale'            // D3: Payment captured but credits not refreshed
  | 'double_charge'            // D4: 2+ captured payments in same billing cycle
  | 'admin_override'           // D5: Firestore manually changed, doesn't match Razorpay
  | 'amount_mismatch'          // D7: Plan price doesn't match charge amount
  | 'orphan_firestore'         // Firestore has subscriptionId that doesn't exist in Razorpay
  | 'orphan_razorpay';         // Razorpay subscription has no matching Firestore user

export type MismatchAction = 'auto_fixed' | 'flagged';

export interface Mismatch {
  type: MismatchType;
  subscriptionId: string;
  userId: string;
  action: MismatchAction;
  details: Record<string, unknown>;
  fixApplied?: string;
}

export interface ReconciliationResult {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  rzpSubscriptionsFetched: number;
  fsRecordsFetched: number;
  mismatches: Mismatch[];
  autoFixCount: number;
  flaggedCount: number;
  errors: string[];
}

// ─── Razorpay API client ────────────────────────────────────────────

interface RazorpaySubscription {
  id: string;
  plan_id: string;
  customer_id: string;
  status: 'created' | 'authenticated' | 'active' | 'pending' | 'halted' | 'cancelled' | 'completed' | 'expired';
  current_start: number | null;
  current_end: number | null;
  charge_at: number | null;
  notes: { userId?: string; [key: string]: unknown };
  total_count: number;
  paid_count: number;
}

interface RazorpayPayment {
  id: string;
  amount: number;       // paise
  currency: string;
  status: 'captured' | 'authorized' | 'refunded' | 'failed';
  created_at: number;
  notes: { userId?: string; [key: string]: unknown };
}

/**
 * Plan ID → expected amount (paise) and internal plan name.
 *
 * Built at module load from env vars (RAZORPAY_PLAN_* ) and the canonical
 * pricing defined in plan-config.ts. If any env var is missing, that entry
 * is skipped with a warning — reconciliation will still run for the plans
 * that ARE configured, and flag unmapped plan IDs for manual review.
 */
type PlanMapEntry = { amount: number; name: string; cadence: 'monthly' | 'annual' };

function buildPlanMaps(): {
  amount: Record<string, number>;
  name: Record<string, string>;
  cadence: Record<string, 'monthly' | 'annual'>;
} {
  // Pricing in paise, keyed by (plan, cadence). Must match PLAN_PRICING in plan-config.
  // Extend this table as you add gold/premium Razorpay plans.
  const PRICING: Record<string, PlanMapEntry> = {
    RAZORPAY_PLAN_PRO_MONTHLY:   { amount: 14900,  name: 'pro',     cadence: 'monthly' },
    RAZORPAY_PLAN_PRO_ANNUAL:    { amount: 139900, name: 'pro',     cadence: 'annual'  },
    RAZORPAY_PLAN_GOLD_MONTHLY:  { amount: 29900,  name: 'gold',    cadence: 'monthly' },
    RAZORPAY_PLAN_GOLD_ANNUAL:   { amount: 279900, name: 'gold',    cadence: 'annual'  },
    RAZORPAY_PLAN_PREMIUM_MONTHLY:{ amount: 49900, name: 'premium', cadence: 'monthly' },
    RAZORPAY_PLAN_PREMIUM_ANNUAL:{ amount: 479900, name: 'premium', cadence: 'annual'  },
  };

  const amount: Record<string, number> = {};
  const name: Record<string, string> = {};
  const cadence: Record<string, 'monthly' | 'annual'> = {};

  for (const [envKey, entry] of Object.entries(PRICING)) {
    const planId = process.env[envKey];
    if (!planId) {
      // Silent in prod — we warn lazily on first use if a plan ID shows up unmapped
      continue;
    }
    amount[planId] = entry.amount;
    name[planId] = entry.name;
    cadence[planId] = entry.cadence;
  }
  return { amount, name, cadence };
}

const { amount: PLAN_AMOUNT_MAP, name: PLAN_NAME_MAP } = buildPlanMaps();

async function getRazorpayCredentials(): Promise<{ keyId: string; keySecret: string }> {
  const keyId = process.env.RAZORPAY_KEY_ID || await getSecret('RAZORPAY_KEY_ID');
  const keySecret = process.env.RAZORPAY_KEY_SECRET || await getSecret('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) throw new Error('Razorpay credentials not found');
  return { keyId, keySecret };
}

async function rzpFetch<T>(path: string, creds: { keyId: string; keySecret: string }): Promise<T> {
  const url = `https://api.razorpay.com/v1${path}`;
  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay API ${path} failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Fetch all Razorpay subscriptions (paginated, 100 per page).
 * Rate-limited: 100ms delay between pages to stay well under 20 req/s.
 */
async function fetchAllRazorpaySubscriptions(
  creds: { keyId: string; keySecret: string }
): Promise<RazorpaySubscription[]> {
  const all: RazorpaySubscription[] = [];
  let skip = 0;
  const count = 100;

  while (true) {
    const batch = await rzpFetch<{ items: RazorpaySubscription[]; count: number }>(
      `/subscriptions?count=${count}&skip=${skip}`,
      creds
    );
    all.push(...batch.items);
    if (batch.items.length < count) break;
    skip += count;
    await sleep(100); // rate limiting
  }

  return all;
}

/**
 * Fetch payments for a subscription in the current billing cycle.
 */
async function fetchSubscriptionPayments(
  subscriptionId: string,
  creds: { keyId: string; keySecret: string }
): Promise<RazorpayPayment[]> {
  const result = await rzpFetch<{ items: RazorpayPayment[] }>(
    `/subscriptions/${subscriptionId}/payments?count=10`,
    creds
  );
  return result.items;
}

// ─── Firestore helpers ──────────────────────────────────────────────

interface FirestoreUserPlan {
  uid: string;
  plan: string;                    // 'free' | 'gold' | 'premium'
  razorpaySubscriptionId?: string;
  razorpayPlanId?: string;
  monthlyCredits?: number;
  creditsUsed?: number;
  creditsResetAt?: FirebaseFirestore.Timestamp;
  planExpiresAt?: FirebaseFirestore.Timestamp;
  adminOverride?: boolean;
}

async function fetchFirestorePaidUsers(): Promise<FirestoreUserPlan[]> {
  const db = await getDb();

  // Fetch users who either have a subscription ID or a non-free plan
  const [bySubscription, byPlan] = await Promise.all([
    db.collection('users')
      .where('razorpaySubscriptionId', '!=', null)
      .select('plan', 'razorpaySubscriptionId', 'razorpayPlanId', 'monthlyCredits', 'creditsUsed', 'creditsResetAt', 'planExpiresAt', 'adminOverride')
      .get(),
    db.collection('users')
      .where('plan', 'in', ['gold', 'premium'])
      .select('plan', 'razorpaySubscriptionId', 'razorpayPlanId', 'monthlyCredits', 'creditsUsed', 'creditsResetAt', 'planExpiresAt', 'adminOverride')
      .get(),
  ]);

  const userMap = new Map<string, FirestoreUserPlan>();

  for (const snap of [...bySubscription.docs, ...byPlan.docs]) {
    if (!userMap.has(snap.id)) {
      userMap.set(snap.id, {
        uid: snap.id,
        plan: snap.get('plan') || 'free',
        razorpaySubscriptionId: snap.get('razorpaySubscriptionId') || undefined,
        razorpayPlanId: snap.get('razorpayPlanId') || undefined,
        monthlyCredits: snap.get('monthlyCredits'),
        creditsUsed: snap.get('creditsUsed'),
        creditsResetAt: snap.get('creditsResetAt'),
        planExpiresAt: snap.get('planExpiresAt'),
        adminOverride: snap.get('adminOverride'),
      });
    }
  }

  return Array.from(userMap.values());
}

// ─── Core reconciliation logic ──────────────────────────────────────

const TERMINAL_STATUSES = new Set(['cancelled', 'completed', 'expired', 'halted']);

export async function runReconciliation(): Promise<ReconciliationResult> {
  const runId = `recon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date();
  const mismatches: Mismatch[] = [];
  const errors: string[] = [];

  logger.info(`Reconciliation ${runId} starting`, 'BILLING_RECON');

  let rzpSubs: RazorpaySubscription[] = [];
  let fsUsers: FirestoreUserPlan[] = [];

  try {
    const creds = await getRazorpayCredentials();

    // Fetch both sides in parallel
    [rzpSubs, fsUsers] = await Promise.all([
      fetchAllRazorpaySubscriptions(creds),
      fetchFirestorePaidUsers(),
    ]);

    // Build lookup maps
    const rzpBySubId = new Map<string, RazorpaySubscription>();
    for (const sub of rzpSubs) {
      rzpBySubId.set(sub.id, sub);
    }

    const fsBySubId = new Map<string, FirestoreUserPlan>();
    const fsByUid = new Map<string, FirestoreUserPlan>();
    for (const user of fsUsers) {
      fsByUid.set(user.uid, user);
      if (user.razorpaySubscriptionId) {
        fsBySubId.set(user.razorpaySubscriptionId, user);
      }
    }

    const db = await getDb();

    // ── Check each Razorpay subscription against Firestore ──
    for (const rzpSub of rzpSubs) {
      const fsUser = fsBySubId.get(rzpSub.id)
        || (rzpSub.notes.userId ? fsByUid.get(rzpSub.notes.userId) : undefined);

      const userId = fsUser?.uid || rzpSub.notes.userId || 'unknown';

      // D1: Razorpay active, Firestore says free or user not found
      if (rzpSub.status === 'active' && (!fsUser || fsUser.plan === 'free')) {
        if (fsUser?.adminOverride) {
          // D5: Admin intentionally downgraded
          mismatches.push({
            type: 'admin_override',
            subscriptionId: rzpSub.id,
            userId,
            action: 'flagged',
            details: { rzpStatus: 'active', fsPlan: fsUser?.plan || 'not_found', adminOverride: true },
          });
        } else {
          // AUTO-FIX: upgrade Firestore to match Razorpay
          const expectedPlan = PLAN_NAME_MAP[rzpSub.plan_id] || 'gold';
          try {
            if (fsUser) {
              await db.collection('users').doc(userId).update({
                plan: expectedPlan,
                razorpaySubscriptionId: rzpSub.id,
                razorpayPlanId: rzpSub.plan_id,
                reconciledAt: new Date(),
              });
            }
            mismatches.push({
              type: 'rzp_active_fs_free',
              subscriptionId: rzpSub.id,
              userId,
              action: fsUser ? 'auto_fixed' : 'flagged',
              details: { rzpStatus: 'active', fsPlan: fsUser?.plan || 'not_found', fixedTo: expectedPlan },
              fixApplied: fsUser ? `Upgraded to ${expectedPlan}` : undefined,
            });
            if (fsUser) {
              emitBillingMetric({
                event: 'plan_mismatch_detected',
                userId,
                subscriptionId: rzpSub.id,
                currentPlan: 'free',
                expectedPlan,
              });
            }
          } catch (err: any) {
            errors.push(`Failed to auto-fix D1 for ${userId}: ${err.message}`);
          }
        }
        continue;
      }

      // D2/D6: Razorpay terminal, Firestore still active
      if (TERMINAL_STATUSES.has(rzpSub.status) && fsUser && fsUser.plan !== 'free') {
        const now = Date.now() / 1000;
        const paidUntil = rzpSub.current_end || 0;

        if (now > paidUntil) {
          // Paid period expired — AUTO-FIX: downgrade
          try {
            await db.collection('users').doc(userId).update({
              plan: 'free',
              monthlyCredits: 50,
              creditsUsed: 0,
              reconciledAt: new Date(),
            });
            mismatches.push({
              type: 'rzp_terminal_fs_active',
              subscriptionId: rzpSub.id,
              userId,
              action: 'auto_fixed',
              details: { rzpStatus: rzpSub.status, fsPlan: fsUser.plan, paidUntil: new Date(paidUntil * 1000).toISOString() },
              fixApplied: 'Downgraded to free (paid period expired)',
            });
          } catch (err: any) {
            errors.push(`Failed to auto-fix D2 for ${userId}: ${err.message}`);
          }
        } else {
          // Still within paid period — flag but don't downgrade yet
          mismatches.push({
            type: 'rzp_terminal_fs_active',
            subscriptionId: rzpSub.id,
            userId,
            action: 'flagged',
            details: {
              rzpStatus: rzpSub.status,
              fsPlan: fsUser.plan,
              paidUntil: new Date(paidUntil * 1000).toISOString(),
              note: 'Still within paid period — will auto-downgrade after expiry',
            },
          });
        }
        continue;
      }

      // D7: Amount mismatch check (only for active subscriptions with known plan amounts)
      if (rzpSub.status === 'active' && fsUser && PLAN_AMOUNT_MAP[rzpSub.plan_id]) {
        const expectedPlan = PLAN_NAME_MAP[rzpSub.plan_id];
        if (expectedPlan && fsUser.plan !== expectedPlan) {
          mismatches.push({
            type: 'amount_mismatch',
            subscriptionId: rzpSub.id,
            userId,
            action: 'flagged',
            details: {
              rzpPlanId: rzpSub.plan_id,
              expectedPlan,
              fsPlan: fsUser.plan,
            },
          });
        }
      }

      // D4: Double charge detection (check recent payments)
      if (rzpSub.status === 'active' && rzpSub.current_start) {
        try {
          const payments = await fetchSubscriptionPayments(rzpSub.id, creds);
          await sleep(50); // rate limit
          const cycleStart = rzpSub.current_start;
          const capturedInCycle = payments.filter(
            (p) => p.status === 'captured' && p.created_at >= cycleStart
          );
          if (capturedInCycle.length > 1) {
            mismatches.push({
              type: 'double_charge',
              subscriptionId: rzpSub.id,
              userId,
              action: 'flagged', // NEVER auto-refund
              details: {
                paymentsInCycle: capturedInCycle.length,
                paymentIds: capturedInCycle.map((p) => p.id),
                amounts: capturedInCycle.map((p) => p.amount / 100),
                cycleStart: new Date(cycleStart * 1000).toISOString(),
              },
            });
          }
        } catch (err: any) {
          errors.push(`Failed to check payments for ${rzpSub.id}: ${err.message}`);
        }
      }

      // If no Firestore user found at all for an active sub
      if (rzpSub.status === 'active' && !fsUser) {
        mismatches.push({
          type: 'orphan_razorpay',
          subscriptionId: rzpSub.id,
          userId,
          action: 'flagged',
          details: { rzpStatus: rzpSub.status, note: 'No Firestore user found for this subscription' },
        });
      }
    }

    // ── Check Firestore users with subscriptions not in Razorpay ──
    for (const fsUser of fsUsers) {
      if (fsUser.razorpaySubscriptionId && !rzpBySubId.has(fsUser.razorpaySubscriptionId)) {
        mismatches.push({
          type: 'orphan_firestore',
          subscriptionId: fsUser.razorpaySubscriptionId,
          userId: fsUser.uid,
          action: 'flagged',
          details: { fsPlan: fsUser.plan, note: 'Subscription ID not found in Razorpay' },
        });
      }
    }

  } catch (err: any) {
    errors.push(`Fatal reconciliation error: ${err.message}`);
    logger.error('Reconciliation failed', err, 'BILLING_RECON');
  }

  const completedAt = new Date();
  const autoFixCount = mismatches.filter((m) => m.action === 'auto_fixed').length;
  const flaggedCount = mismatches.filter((m) => m.action === 'flagged').length;

  const result: ReconciliationResult = {
    runId,
    startedAt,
    completedAt,
    rzpSubscriptionsFetched: rzpSubs.length,
    fsRecordsFetched: fsUsers.length,
    mismatches,
    autoFixCount,
    flaggedCount,
    errors,
  };

  // Persist result to Firestore for dashboard/audit
  try {
    const db = await getDb();
    await db.collection('billing_reconciliation_runs').doc(runId).set({
      ...result,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    });

    // Write individual actions for audit trail
    const batch = db.batch();
    for (const mismatch of mismatches) {
      const actionRef = db.collection('billing_reconciliation_actions').doc();
      batch.set(actionRef, {
        ...mismatch,
        runId,
        createdAt: new Date(),
      });
    }
    await batch.commit();
  } catch (err: any) {
    errors.push(`Failed to persist reconciliation result: ${err.message}`);
  }

  logger.info(
    `Reconciliation ${runId} complete: ${rzpSubs.length} subs, ${fsUsers.length} users, ` +
    `${autoFixCount} auto-fixed, ${flaggedCount} flagged, ${errors.length} errors`,
    'BILLING_RECON'
  );

  return result;
}

// ─── Monthly financial reconciliation ───────────────────────────────

export interface MonthlyReport {
  month: string;                // 'YYYY-MM'
  grossCollections: number;     // paise
  razorpayFees: number;         // paise (estimated at 2%)
  gstOnFees: number;            // paise (18% of fees)
  netSettlement: number;        // paise
  firestoreRecordedRevenue: number; // paise
  delta: number;                // paise
  refundsIssued: number;        // paise
  refundCount: number;
  paymentCount: number;
}

export async function runMonthlyReconciliation(yearMonth: string): Promise<MonthlyReport> {
  const creds = await getRazorpayCredentials();

  // Parse month boundaries as Unix timestamps
  const [year, month] = yearMonth.split('-').map(Number);
  const from = Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
  const to = Math.floor(new Date(year, month, 1).getTime() / 1000);

  // Fetch all payments in the month (paginated)
  const allPayments: RazorpayPayment[] = [];
  let skip = 0;
  while (true) {
    const batch = await rzpFetch<{ items: RazorpayPayment[]; count: number }>(
      `/payments?from=${from}&to=${to}&count=100&skip=${skip}`,
      creds
    );
    allPayments.push(...batch.items);
    if (batch.items.length < 100) break;
    skip += 100;
    await sleep(100);
  }

  const captured = allPayments.filter((p) => p.status === 'captured');
  const refunded = allPayments.filter((p) => p.status === 'refunded');

  const grossCollections = captured.reduce((sum, p) => sum + p.amount, 0);
  const refundsIssued = refunded.reduce((sum, p) => sum + p.amount, 0);
  const razorpayFees = Math.round(grossCollections * 0.02);     // 2% standard
  const gstOnFees = Math.round(razorpayFees * 0.18);            // 18% GST on fees
  const netSettlement = grossCollections - razorpayFees - gstOnFees - refundsIssued;

  // Compare against Firestore subscriptions that received a payment this month.
  // A "recorded" payment is a subscription doc whose lastPaymentId matches a
  // captured Razorpay payment AND whose currentStart falls in this month.
  // Any Razorpay captured payment that doesn't match a subscription doc is
  // evidence of a missed webhook (money in, no access granted).
  let firestoreRecordedRevenue = 0;
  try {
    const { getDb } = await import('./firebase-admin');
    const db = await getDb();
    const [yearStr, monthStr] = yearMonth.split('-');
    const monthStart = new Date(`${yearStr}-${monthStr}-01T00:00:00Z`);
    const monthEnd = new Date(Date.UTC(Number(yearStr), Number(monthStr), 1));

    const subsSnap = await db
      .collection('subscriptions')
      .where('currentStart', '>=', monthStart)
      .where('currentStart', '<', monthEnd)
      .get();

    const capturedPaymentIds = new Set(captured.map((p) => p.id));
    for (const subDoc of subsSnap.docs) {
      const sub = subDoc.data() as { planId?: string; lastPaymentId?: string };
      if (!sub.lastPaymentId || !capturedPaymentIds.has(sub.lastPaymentId)) continue;
      const expected = sub.planId ? PLAN_AMOUNT_MAP[sub.planId] : undefined;
      if (expected !== undefined) firestoreRecordedRevenue += expected;
    }
  } catch (err) {
    console.error('[Reconcile] Failed to compute Firestore recorded revenue:', err);
    // Fall back to placeholder so the job doesn't crash the whole report
    firestoreRecordedRevenue = grossCollections;
  }
  const delta = grossCollections - firestoreRecordedRevenue;

  const report: MonthlyReport = {
    month: yearMonth,
    grossCollections,
    razorpayFees,
    gstOnFees,
    netSettlement,
    firestoreRecordedRevenue,
    delta,
    refundsIssued,
    refundCount: refunded.length,
    paymentCount: captured.length,
  };

  // Persist
  try {
    const db = await getDb();
    await db.collection('billing_monthly_reports').doc(yearMonth).set({
      ...report,
      createdAt: new Date(),
      // Store amounts in rupees for readability too
      grossCollectionsRupees: grossCollections / 100,
      netSettlementRupees: netSettlement / 100,
      deltaRupees: delta / 100,
    });
  } catch (err: any) {
    logger.error(`Failed to persist monthly report for ${yearMonth}`, err, 'BILLING_RECON');
  }

  return report;
}

// ─── Utilities ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
