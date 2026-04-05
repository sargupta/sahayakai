import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * GET /api/billing/callback
 *
 * Razorpay redirects here after checkout. This page does NOT provision access —
 * provisioning happens via webhooks only (subscription.charged event).
 * This page just shows a "thank you, processing" message.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const subscriptionId = searchParams.get('razorpay_subscription_id');
    const paymentId = searchParams.get('razorpay_payment_id');
    const signature = searchParams.get('razorpay_signature');

    if (!subscriptionId || !paymentId || !signature) {
        // Redirect to pricing with error
        return NextResponse.redirect(new URL('/pricing?status=error', request.url));
    }

    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${paymentId}|${subscriptionId}`)
        .digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        console.error('[Billing] Invalid callback signature');
        return NextResponse.redirect(new URL('/pricing?status=error', request.url));
    }

    // Update subscription status in Firestore (non-blocking — webhook will do the real provisioning)
    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();
        await db.collection('subscriptions').doc(subscriptionId).update({
            lastPaymentId: paymentId,
            callbackVerified: true,
            updatedAt: new Date(),
        });
    } catch (err) {
        console.error('[Billing] Callback Firestore update failed:', err);
        // Don't fail — webhook will handle it
    }

    // Redirect to success page
    return NextResponse.redirect(new URL('/pricing?status=success', request.url));
}
