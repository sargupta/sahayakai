import { NextResponse } from 'next/server';
import { getRazorpay, RAZORPAY_PLANS, type RazorpayPlanKey } from '@/lib/razorpay';

/**
 * POST /api/billing/create-public-subscription
 *
 * Anonymous checkout — no Firebase auth required. Used by the /pricing page
 * when a visitor clicks "Start Pro" without being signed in. Flow:
 *
 *   1. Visitor enters email on pricing page
 *   2. This route looks up or lazily creates a Firebase user with that email
 *      (no password yet — passwordless, set via magic link post-payment)
 *   3. Creates a Razorpay subscription with { userId, email, planKey, isPublic }
 *      in notes so the webhook can provision access
 *   4. Returns the Razorpay hosted short_url for checkout
 *   5. Webhook `subscription.charged` upgrades planType=pro and — because
 *      `isPublic` is set — sends a passwordless sign-in link to `email`
 *      so the visitor can reach their new Pro account
 *
 * IMPORTANT: this endpoint intentionally has NO auth. Rate-limited only by
 * Razorpay's own abuse controls on subscription creation and by the client
 * typing in a valid email address. Do not log the email at INFO level.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
    try {
        const { email: rawEmail, planKey } = (await request.json()) as {
            email?: string;
            planKey?: RazorpayPlanKey;
        };

        const email = rawEmail?.trim().toLowerCase();
        if (!email || !EMAIL_RE.test(email)) {
            return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
        }

        if (!planKey || !(planKey in RAZORPAY_PLANS)) {
            return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
        }

        const planId = RAZORPAY_PLANS[planKey];
        if (!planId) {
            return NextResponse.json({ error: 'Plan is not configured yet. Please try again later.' }, { status: 500 });
        }

        // --- Look up EXISTING Firebase user only — do NOT create here ---
        //
        // SECURITY (F7-005): Pre-payment user creation lets an attacker squat
        // arbitrary email addresses by hitting this endpoint and abandoning
        // checkout. When the real owner later signs up, the squatter already
        // owns the UID. User creation now happens in the webhook AFTER
        // `subscription.charged` confirms payment.
        const { getAuthInstance, getDb } = await import('@/lib/firebase-admin');
        const auth = await getAuthInstance();

        let existingUserId: string | null = null;
        try {
            const existing = await auth.getUserByEmail(email);
            existingUserId = existing.uid;
        } catch (err: any) {
            if (err?.code !== 'auth/user-not-found') {
                throw err;
            }
            // No existing user — leave existingUserId null. Webhook will create on payment.captured.
        }

        const db = await getDb();

        // --- Create the Razorpay subscription ---
        // Notes carry email so the webhook can look up / create the user on
        // payment.captured. userId is only set when we already have one.
        const razorpay = getRazorpay();
        const subscriptionNotes: Record<string, string> = {
            email,
            planKey,
            isPublic: 'true', // webhook uses this to trigger magic link
        };
        if (existingUserId) subscriptionNotes.userId = existingUserId;

        const subscription = await razorpay.subscriptions.create({
            plan_id: planId,
            total_count: planKey.includes('annual') ? 1 : 12,
            customer_notify: 1,
            notes: subscriptionNotes,
        });

        await db.collection('subscriptions').doc(subscription.id).set({
            razorpaySubscriptionId: subscription.id,
            userId: existingUserId,            // null until webhook creates
            email,
            planKey,
            status: subscription.status || 'created',
            shortUrl: subscription.short_url,
            isPublic: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return NextResponse.json({
            subscriptionId: subscription.id,
            shortUrl: subscription.short_url,
            isNewUser: existingUserId === null,
        });
    } catch (error) {
        console.error('[Billing] Public subscription creation failed:', error);
        return NextResponse.json(
            { error: 'Could not start checkout. Please try again or contact contact@sargvision.com.' },
            { status: 500 }
        );
    }
}
