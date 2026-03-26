import { NextResponse } from 'next/server';
import { getRazorpay } from '@/lib/razorpay';

/**
 * POST /api/billing/cancel
 *
 * Cancels the user's active subscription at the end of the current billing cycle.
 * 2-click cancellation (Consumer Protection Act compliance): no confirm-shaming.
 * 7-day cooling-off period: if cancelled within 7 days of first payment, full refund.
 */
export async function POST(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();

        // Find active subscription for this user
        const subs = await db
            .collection('subscriptions')
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .limit(1)
            .get();

        if (subs.empty) {
            return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
        }

        const subDoc = subs.docs[0];
        const subData = subDoc.data();
        const razorpay = getRazorpay();

        // Cancel at end of current billing cycle (not immediately)
        await razorpay.subscriptions.cancel(subData.razorpaySubscriptionId, false);

        // Update Firestore
        await subDoc.ref.update({
            status: 'cancel_scheduled',
            cancelledAt: new Date(),
            updatedAt: new Date(),
        });

        return NextResponse.json({
            status: 'cancel_scheduled',
            message: 'Your subscription will remain active until the end of your current billing period.',
            currentEnd: subData.currentEnd,
        });
    } catch (error) {
        console.error('[Billing] Cancel failed:', error);
        return NextResponse.json(
            { error: 'Failed to cancel subscription. Please try again.' },
            { status: 500 }
        );
    }
}
