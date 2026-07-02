import { NextResponse } from 'next/server';
import { verifyWebhookSignature, resolvePlanTypeFromPlanId } from '@/lib/razorpay';

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
        // Any throw from signature verification (malformed signature, secret missing,
        // crypto error) is treated as invalid signature — return 401 so Razorpay
        // does NOT retry. 5xx would trigger retry storms on permanently-bad input.
        console.error('[Webhook] Signature verification error:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
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
            // F5-005 fix: atomic compare-and-set on the status flip.
            // Without the transaction, two concurrent Razorpay retries of
            // the same failed event could both observe `status === 'failed'`,
            // both flip to 'processing', and both run the side-effect
            // pipeline (subscription update, custom-claim set, fan-out).
            // Today's effects are idempotent, but this is a latent risk —
            // any future non-idempotent step (e.g. a credit grant) would
            // double up. The transaction guarantees exactly one retrier
            // wins the flip; everyone else gets `already_processed`.
            const wonTheFlip = await db.runTransaction(async (tx) => {
                const existing = await tx.get(eventRef);
                const existingStatus = existing.data()?.status;
                if (existingStatus === 'failed') {
                    tx.update(eventRef, { status: 'processing', retriedAt: new Date() });
                    return true;
                }
                // 'processing' or 'completed' — safe to skip
                return false;
            });
            if (!wonTheFlip) {
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
                let userId: string | undefined = subscription.notes?.userId;
                const isPublic = subscription.notes?.isPublic === 'true';
                const noteEmail: string | undefined = subscription.notes?.email;

                // Public checkout path: if no userId in notes (F7-005 — we no
                // longer create users pre-payment), look up or create here.
                // Doing it here means: payment is verified by HMAC, money has
                // moved, attacker can't squat an email by abandoning checkout.
                if (!userId && isPublic && noteEmail) {
                    try {
                        const { getAuth } = await import('firebase-admin/auth');
                        const auth = getAuth();
                        try {
                            const existing = await auth.getUserByEmail(noteEmail);
                            userId = existing.uid;
                        } catch (lookupErr: any) {
                            if (lookupErr?.code === 'auth/user-not-found') {
                                const created = await auth.createUser({
                                    email: noteEmail,
                                    emailVerified: false,
                                    disabled: false,
                                });
                                userId = created.uid;
                                await db.collection('users').doc(userId).set({
                                    email: noteEmail,
                                    planType: 'free',
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                    source: 'public-checkout-webhook',
                                }, { merge: true });
                                // Link the subscription doc to the new user
                                await db.collection('subscriptions').doc(subscription.id).set(
                                    { userId, updatedAt: new Date() },
                                    { merge: true }
                                );
                            } else {
                                throw lookupErr;
                            }
                        }
                    } catch (createErr) {
                        console.error('[Webhook] Failed to create public-checkout user:', createErr);
                        throw new Error('PUBLIC_USER_CREATE_FAILED');
                    }
                }

                if (!userId) {
                    console.error('[Webhook] subscription.charged missing userId in notes');
                    break;
                }

                // Resolve plan STRICTLY from subscription.plan_id → RAZORPAY_PLANS env map.
                // Earlier code used a substring check on `notes.planKey` ("includes('gold')")
                // which is forgeable from any caller that creates a subscription with a
                // crafted planKey. The plan_id, by contrast, is the immutable Razorpay
                // plan reference. (F7-003)
                const planType = resolvePlanTypeFromPlanId(subscription.plan_id);
                if (!planType) {
                    console.error(
                        `[Webhook] Unknown plan_id ${subscription.plan_id} for subscription ${subscription.id} — refusing to grant plan.`
                    );
                    throw new Error(`UNKNOWN_PLAN_ID: ${subscription.plan_id}`);
                }

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
                let userId: string | undefined = subscription.notes?.userId;

                // Public-checkout subscriptions never backfill notes.userId, so
                // resolving from notes alone silently no-ops here and the user
                // keeps their paid plan after payments stop (H20). Fall back to
                // the subscription id: the subscription.charged handler links
                // `subscriptions/{subscription.id}.userId` (and stamps
                // `users.subscriptionId`), so we can recover the owner from
                // either side.
                if (!userId) {
                    try {
                        const subSnap = await db.collection('subscriptions').doc(subscription.id).get();
                        userId = subSnap.exists ? (subSnap.get('userId') as string | undefined) : undefined;
                    } catch (lookupErr) {
                        console.error(
                            `[Webhook] subscriptions lookup failed for ${subscription.id}:`,
                            lookupErr
                        );
                    }
                }
                if (!userId) {
                    try {
                        const usersSnap = await db
                            .collection('users')
                            .where('subscriptionId', '==', subscription.id)
                            .limit(1)
                            .get();
                        userId = usersSnap.empty ? undefined : usersSnap.docs[0].id;
                    } catch (lookupErr) {
                        console.error(
                            `[Webhook] users lookup by subscriptionId failed for ${subscription.id}:`,
                            lookupErr
                        );
                    }
                }

                if (!userId) {
                    console.warn(
                        `[Webhook] ${event.event} for ${subscription.id} — could not resolve userId from notes, subscriptions doc, or users query; skipping downgrade.`
                    );
                    break;
                }

                // F7-006: subscription.cancelled means user opted out for the
                // NEXT cycle — they've already paid for the current one and
                // are entitled to access through `current_end`. Immediate
                // downgrade would rob them of the period they paid for.
                // subscription.halted = payments stopped failing — downgrade now.
                const isCancelled = event.event === 'subscription.cancelled';
                const nowSec = Math.floor(Date.now() / 1000);
                const paidUntilSec = typeof subscription.current_end === 'number' ? subscription.current_end : 0;
                const stillInPaidPeriod = isCancelled && paidUntilSec > nowSec;

                const subRef = db.collection('subscriptions').doc(subscription.id);
                const userRef = db.collection('users').doc(userId);

                if (stillInPaidPeriod) {
                    // Mark scheduled-cancel — keep paid plan until current_end.
                    // Reconciliation cron (D2) will downgrade after paidUntil expires.
                    await db.runTransaction(async (tx) => {
                        tx.update(subRef, {
                            status: subscription.status,             // 'cancelled' on Razorpay
                            cancelledAt: new Date(),
                            paidUntil: new Date(paidUntilSec * 1000),
                            scheduledDowngradeAt: new Date(paidUntilSec * 1000),
                            updatedAt: new Date(),
                        });
                        tx.update(userRef, {
                            planCancelScheduled: true,
                            planExpiresAt: new Date(paidUntilSec * 1000),
                            updatedAt: new Date(),
                        });
                    });
                    console.log(
                        `[Webhook] subscription.cancelled honored for ${userId} — plan stays until ${new Date(paidUntilSec * 1000).toISOString()}`
                    );
                } else {
                    // halted, or cancelled past current_end — downgrade now atomically.
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
                }
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
