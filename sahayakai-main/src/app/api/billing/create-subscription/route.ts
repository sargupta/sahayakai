import { NextResponse } from 'next/server';
import { getRazorpay, RAZORPAY_PLANS, type RazorpayPlanKey } from '@/lib/razorpay';

/**
 * POST /api/billing/create-subscription
 *
 * Creates a Razorpay subscription and returns the short_url for redirect checkout.
 * Redirect checkout (not popup) works on 100% of devices including budget Android Go.
 */
export async function POST(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { planKey } = await request.json() as { planKey: RazorpayPlanKey };

        const planId = RAZORPAY_PLANS[planKey];
        if (!planId) {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }

        const razorpay = getRazorpay();

        const subscription = await razorpay.subscriptions.create({
            plan_id: planId,
            total_count: planKey.includes('annual') ? 1 : 12, // annual = 1 charge, monthly = 12 cycles
            customer_notify: 1,
            notes: {
                userId,
                planKey,
            },
        });

        // Store subscription in Firestore for tracking
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();
        await db.collection('subscriptions').doc(subscription.id).set({
            razorpaySubscriptionId: subscription.id,
            userId,
            planKey,
            status: subscription.status || 'created',
            shortUrl: subscription.short_url,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return NextResponse.json({
            subscriptionId: subscription.id,
            shortUrl: subscription.short_url,
        });
    } catch (error) {
        console.error('[Billing] Create subscription failed:', error);
        return NextResponse.json(
            { error: 'Failed to create subscription. Please try again.' },
            { status: 500 }
        );
    }
}
