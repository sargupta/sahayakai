/**
 * POST /api/user/delete-account
 *
 * DPDP Act Section 12(3) — Right to erasure.
 *
 * Flow:
 * 1. Cancel active Razorpay subscription (if any)
 * 2. Initiate 30-day grace period for data export
 * 3. Schedule deletion of: user profile, content, usage counters, connections, conversations
 * 4. After grace period (handled by export-reminder job): anonymize + purge PII
 * 5. Firebase Auth account deleted immediately (user can't log in)
 *
 * The user must confirm by sending { confirm: true } in the body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    if (!body.confirm) {
      return NextResponse.json(
        { error: 'Must send { confirm: true } to delete account' },
        { status: 400 }
      );
    }

    const { getDb } = await import('@/lib/firebase-admin');
    const { getAuth } = await import('firebase-admin/auth');
    const db = await getDb();
    const auth = getAuth();

    // 1. Cancel active Razorpay subscription if any
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (userData?.razorpaySubscriptionId) {
      try {
        const { getRazorpay } = await import('@/lib/razorpay');
        const razorpay = getRazorpay();
        await razorpay.subscriptions.cancel(userData.razorpaySubscriptionId, true); // immediate
      } catch (err) {
        // Subscription may already be cancelled — log but don't block
        logger.warn('Failed to cancel Razorpay subscription during account deletion', 'ACCOUNT_DELETE', {
          userId, subscriptionId: userData.razorpaySubscriptionId, error: String(err),
        });
      }
    }

    // 2. Mark for grace period (30 days for data export)
    const gracePeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.collection('users').doc(userId).update({
      'deletion.requested': true,
      'deletion.requestedAt': new Date().toISOString(),
      'deletion.gracePeriodEnd': gracePeriodEnd.toISOString(),
      'deletion.dataExported': false,
      'cancellation.gracePeriodStart': new Date().toISOString(),
      'cancellation.gracePeriodEnd': gracePeriodEnd.toISOString(),
      'cancellation.dataExported': false,
      'cancellation.remindersSent': 0,
      planType: 'free',
      updatedAt: new Date(),
    });

    // 3. Remove from any organization
    if (userData?.organizationId) {
      try {
        const { removeTeacher } = await import('@/lib/organization');
        await removeTeacher(userData.organizationId, userId);
      } catch {
        // Best effort
      }
    }

    // 4. Remove connections (best effort)
    try {
      const connections = await db.collection('connections')
        .where('uids', 'array-contains', userId)
        .limit(200)
        .get();
      const batch = db.batch();
      for (const doc of connections.docs) {
        batch.delete(doc.ref);
      }
      if (!connections.empty) await batch.commit();
    } catch {
      // Best effort
    }

    // 5. Delete Firebase Auth account (immediate — user can't log back in)
    try {
      await auth.deleteUser(userId);
    } catch (err) {
      logger.error('Failed to delete Firebase Auth user', err, 'ACCOUNT_DELETE', { userId });
      // Don't fail the request — Firestore is marked for deletion
    }

    // 6. Schedule the actual data purge (export-reminder job handles this
    //    via the cancellation.gracePeriodEnd check — it anonymizes after 30 days)

    logger.info('Account deletion initiated', 'ACCOUNT_DELETE', {
      userId,
      gracePeriodEnd: gracePeriodEnd.toISOString(),
    });

    return NextResponse.json({
      status: 'deletion_scheduled',
      message: 'Your account has been scheduled for deletion. You have 30 days to export your data.',
      gracePeriodEnd: gracePeriodEnd.toISOString(),
      exportUrl: '/api/export',
    });

  } catch (error) {
    logger.error('Account deletion failed', error, 'ACCOUNT_DELETE', { userId });
    return NextResponse.json({ error: 'Failed to process account deletion' }, { status: 500 });
  }
}
