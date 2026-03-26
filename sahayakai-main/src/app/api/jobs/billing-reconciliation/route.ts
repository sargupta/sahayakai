/**
 * POST /api/jobs/billing-reconciliation
 *
 * Triggered every 4 hours by Cloud Scheduler. Compares Razorpay subscription
 * state with Firestore user plan state and auto-fixes safe mismatches.
 *
 * Also supports:
 *   ?mode=monthly&month=2026-03  — run monthly financial reconciliation
 *   ?mode=status                 — get last reconciliation run result (GET)
 *
 * Setup:
 *   gcloud scheduler jobs create http sahayakai-billing-recon
 *     --schedule "0 0,4,8,12,16,20 * * *"
 *     --uri "https://YOUR-APP/api/jobs/billing-reconciliation"
 *     --http-method POST
 *     --location asia-southeast1
 *     --time-zone "Asia/Kolkata"
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const maxDuration = 300; // 5 minutes — enough for 10K+ subscriptions

export async function POST(request: NextRequest) {
  // Auth: verify CRON_SECRET (Cloud Scheduler sets this as a header)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const mode = request.nextUrl.searchParams.get('mode') || 'reconcile';

  try {
    if (mode === 'monthly') {
      const month = request.nextUrl.searchParams.get('month');
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 });
      }

      const { runMonthlyReconciliation } = await import('@/lib/billing-reconciliation');
      const report = await runMonthlyReconciliation(month);

      return NextResponse.json({
        ok: true,
        report: {
          month: report.month,
          grossCollections: `₹${(report.grossCollections / 100).toLocaleString('en-IN')}`,
          razorpayFees: `₹${(report.razorpayFees / 100).toLocaleString('en-IN')}`,
          gstOnFees: `₹${(report.gstOnFees / 100).toLocaleString('en-IN')}`,
          netSettlement: `₹${(report.netSettlement / 100).toLocaleString('en-IN')}`,
          delta: `₹${(report.delta / 100).toLocaleString('en-IN')}`,
          refunds: `₹${(report.refundsIssued / 100).toLocaleString('en-IN')} (${report.refundCount} txns)`,
          payments: report.paymentCount,
        },
      });
    }

    // Default: run 4-hourly reconciliation
    const { runReconciliation } = await import('@/lib/billing-reconciliation');
    const result = await runReconciliation();

    // Send alerts for critical issues
    if (result.mismatches.some((m) => m.type === 'double_charge')) {
      logger.error(
        `CRITICAL: Double charge detected in reconciliation ${result.runId}`,
        new Error('Double charge'),
        'BILLING_RECON_ALERT'
      );
      // TODO: integrate PagerDuty/Slack webhook here
    }

    if (result.mismatches.filter((m) => m.type === 'rzp_active_fs_free').length > 5) {
      logger.error(
        `WARNING: ${result.mismatches.filter((m) => m.type === 'rzp_active_fs_free').length} webhook-lost mismatches — webhook system may be down`,
        new Error('Webhook system failure suspected'),
        'BILLING_RECON_ALERT'
      );
    }

    return NextResponse.json({
      ok: true,
      runId: result.runId,
      durationMs: result.completedAt.getTime() - result.startedAt.getTime(),
      rzpSubscriptions: result.rzpSubscriptionsFetched,
      fsRecords: result.fsRecordsFetched,
      autoFixed: result.autoFixCount,
      flagged: result.flaggedCount,
      errors: result.errors.length,
      mismatches: result.mismatches.map((m) => ({
        type: m.type,
        userId: m.userId,
        action: m.action,
        fix: m.fixApplied || null,
      })),
    });
  } catch (error) {
    logger.error('Billing reconciliation job failed', error, 'BILLING_RECON');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/jobs/billing-reconciliation?mode=status
 *
 * Returns the last reconciliation run result for dashboard display.
 */
export async function GET(request: NextRequest) {
  try {
    const { getDb } = await import('@/lib/firebase-admin');
    const db = await getDb();

    const lastRun = await db.collection('billing_reconciliation_runs')
      .orderBy('startedAt', 'desc')
      .limit(1)
      .get();

    if (lastRun.empty) {
      return NextResponse.json({ ok: true, lastRun: null, message: 'No reconciliation runs yet' });
    }

    const data = lastRun.docs[0].data();

    // Also fetch recent flagged items that need attention
    const flagged = await db.collection('billing_reconciliation_actions')
      .where('action', '==', 'flagged')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    return NextResponse.json({
      ok: true,
      lastRun: {
        runId: data.runId,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        durationMs: data.durationMs,
        rzpSubscriptions: data.rzpSubscriptionsFetched,
        fsRecords: data.fsRecordsFetched,
        autoFixed: data.autoFixCount,
        flagged: data.flaggedCount,
        errors: data.errors?.length || 0,
      },
      pendingFlags: flagged.docs.map((d) => {
        const item = d.data();
        return {
          id: d.id,
          type: item.type,
          userId: item.userId,
          subscriptionId: item.subscriptionId,
          details: item.details,
          createdAt: item.createdAt,
        };
      }),
    });
  } catch (error) {
    logger.error('Failed to fetch reconciliation status', error, 'BILLING_RECON');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
