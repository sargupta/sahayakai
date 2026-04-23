import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/razorpay';

/**
 * POST /api/webhooks/razorpay
 *
 * Handles all Razorpay subscription lifecycle events.
 * CRITICAL: Provision access on `subscription.charged` ONLY (not `subscription.activated`).
 * UPI mandate registration fires `activated` but no money has moved yet.
 *
 * Idempotent via `webhook_events` collection — safe to receive the same event twice.
 */
export async function POST(request: Request) {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify HMAC-SHA256 signature
    try {
        if (!verifyWebhookSignature(body, signature)) {
            console.error('[Webhook] Invalid Razorpay signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
    } catch (err) {
        console.error('[Webhook] Signature verification error:', err);
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 500 });
    }

    const event = JSON.parse(body);
    // Use payment ID for uniqueness — subscription ID alone collides across billing cycles
    const paymentId = event.payload?.payment?.entity?.id;
    const subscriptionId = event.payload?.subscription?.entity?.id;
    const eventId = event.event + '_' + (paymentId || subscriptionId || Date.now());

    const { getDb } = await import('@/lib/firebase-admin');
    const db = await getDb();

    // Idempotency check — use create() which fails if doc exists (prevents TOCTOU race)
    const eventRef = db.collection('webhook_events').doc(eventId);
    try {
        await eventRef.create({
            event: event.event,
            status: 'processing',
            receivedAt: new Date(),
        });
    } catch (err: any) {
        // Doc already exists — check if previous attempt failed (retry allowed) or succeeded (skip)
        if (err.code === 6 /* ALREADY_EXISTS */) {
            const existing = await eventRef.get();
            const existingStatus = existing.data()?.status;
            // Allow retry for previously failed events (e.g. transient Firestore error)
            if (existingStatus === 'failed') {
                await eventRef.update({ status: 'processing', retriedAt: new Date() });
            } else {
                // 'processing' or 'completed' — safe to skip
                return NextResponse.json({ status: 'already_processed' });
            }
        } else {
            throw err;
        }
    }

    try {
        switch (event.event) {
            case 'subscription.charged': {
                // PROVISION ACCESS — this is the only event where money has moved
                const subscription = event.payload.subscription.entity;
                const payment = event.payload.payment.entity;
                const userId = subscription.notes?.userId;
                const isPublic = subscription.notes?.isPublic === 'true';
                const noteEmail: string | undefined = subscription.notes?.email;

                if (!userId) {
                    console.error('[Webhook] subscription.charged missing userId in notes');
                    break;
                }

                // Resolve plan from subscription notes or default to pro
                const planType = subscription.notes?.planKey?.includes('premium') ? 'premium'
                    : subscription.notes?.planKey?.includes('gold') ? 'gold' : 'pro';

                // Atomically update both subscription and user docs. Previously these were
                // two separate writes — if the users update failed, the user paid but stayed
                // on the free plan with no auto-recovery.
                const subRef = db.collection('subscriptions').doc(subscription.id);
                const userRef = db.collection('users').doc(userId);
                await db.runTransaction(async (tx) => {
                    tx.update(subRef, {
                        status: 'active',
                        lastPaymentId: payment.id,
                        currentStart: new Date(subscription.current_start * 1000),
                        currentEnd: new Date(subscription.current_end * 1000),
                        updatedAt: new Date(),
                    });
                    tx.update(userRef, {
                        planType,
                        subscriptionId: subscription.id,
                        updatedAt: new Date(),
                    });
                });

                // Set custom claim so middleware can read plan from JWT.
                // If this fails, throw so the event is marked 'failed' and can be retried
                // manually — the user has the plan in Firestore already, but their JWT
                // will still show old plan until claim is set + token refreshed.
                try {
                    const { getAuth } = await import('firebase-admin/auth');
                    await getAuth().setCustomUserClaims(userId, { planType });
                } catch (claimErr) {
                    console.error(`[Webhook] Custom claim failed for ${userId}:`, claimErr);
                    throw new Error(`CLAIM_SET_FAILED: ${userId}`);
                }

                console.log(`[Webhook] Provisioned ${planType} for user ${userId}, payment ${payment.id}`);

                // Public checkout: send a passwordless sign-in link so the
                // anonymous buyer can actually reach their new Pro account.
                // Falls back gracefully if email delivery fails — the charge
                // still completes and the user can request a login link later.
                // Magic link is stored in Firestore so admins/support can
                // resend it manually until SMTP/SES delivery is wired.
                if (isPublic && noteEmail) {
                    try {
                        const { getAuth } = await import('firebase-admin/auth');
                        const origin = process.env.PUBLIC_APP_URL || 'https://sahayakai.com';
                        const actionCodeSettings = {
                            url: `${origin}/?welcome=pro`,
                            handleCodeInApp: true,
                        };
                        const link = await getAuth().generateSignInWithEmailLink(
                            noteEmail,
                            actionCodeSettings
                        );
                        await db.collection('pendingSignInLinks').doc(userId).set(
                            {
                                email: noteEmail,
                                link,
                                planType,
                                subscriptionId: subscription.id,
                                createdAt: new Date(),
                            },
                            { merge: true }
                        );
                        console.log(
                            `[Webhook] Magic sign-in link generated for public buyer ${noteEmail} (user ${userId})`
                        );
                    } catch (linkErr) {
                        // Don't throw — the payment + plan are already provisioned
                        // atomically above. Magic link delivery is the only thing
                        // affected; admin can manually resend from Firestore.
                        console.error(
                            `[Webhook] Failed to generate magic link for public buyer ${noteEmail}:`,
                            linkErr
                        );
                    }
                }
                break;
            }

            case 'subscription.halted':
            case 'subscription.cancelled': {
                const subscription = event.payload.subscription.entity;
                const userId = subscription.notes?.userId;

                if (!userId) break;

                // Atomic downgrade — both writes must succeed or both roll back
                const subRef = db.collection('subscriptions').doc(subscription.id);
                const userRef = db.collection('users').doc(userId);
                await db.runTransaction(async (tx) => {
                    tx.update(subRef, { status: subscription.status, updatedAt: new Date() });
                    tx.update(userRef, { planType: 'free', updatedAt: new Date() });
                });

                try {
                    const { getAuth } = await import('firebase-admin/auth');
                    await getAuth().setCustomUserClaims(userId, { planType: 'free' });
                } catch (claimErr) {
                    console.error(`[Webhook] Downgrade claim failed for ${userId}:`, claimErr);
                    throw new Error(`CLAIM_SET_FAILED: ${userId}`);
                }

                console.log(`[Webhook] Downgraded user ${userId} to free (${event.event})`);
                break;
            }

            case 'subscription.pending': {
                // Payment is being retried — show warning but don't revoke access yet
                const subscription = event.payload.subscription.entity;
                await db.collection('subscriptions').doc(subscription.id).update({
                    status: 'pending',
                    updatedAt: new Date(),
                });
                break;
            }

            case 'subscription.paused':
            case 'subscription.resumed': {
                const subscription = event.payload.subscription.entity;
                await db.collection('subscriptions').doc(subscription.id).update({
                    status: subscription.status,
                    updatedAt: new Date(),
                });
                break;
            }

            default:
                console.log(`[Webhook] Unhandled event: ${event.event}`);
        }

        await eventRef.update({ status: 'completed', completedAt: new Date() });
        return NextResponse.json({ status: 'ok' });
    } catch (err) {
        console.error(`[Webhook] Error processing ${event.event}:`, err);
        await eventRef.update({
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
}
