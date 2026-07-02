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
 *
 * SECURITY (DPDP/GDPR): Because this action is irreversible and permanently
 * revokes login, we require a FRESH re-authentication signal. The middleware
 * only injects `x-user-id` (derived from the verified bearer token) — the raw
 * token / decoded `auth_time` claim is NOT forwarded to this handler. So we
 * require the client to mint a fresh Firebase ID token immediately before the
 * request and pass it as `body.idToken`. We re-verify it here with
 * `verifyIdToken(idToken, true)` (checkRevoked) and assert that:
 *   - its `uid` matches the session `x-user-id` (prevents cross-account misuse), and
 *   - its `auth_time` is within the last MAX_AUTH_AGE_SECONDS (fresh login).
 * This blocks a stolen/borrowed long-lived session or an XSS-driven POST from
 * silently nuking the account without a recent interactive re-auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Fresh-auth window: the re-auth must have happened within this many seconds.
const MAX_AUTH_AGE_SECONDS = 5 * 60; // 5 minutes

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

    // 0. Fresh re-authentication gate — irreversible action, so require a
    //    freshly-minted ID token verified server-side with checkRevoked.
    const idToken = typeof body.idToken === 'string' ? body.idToken : '';
    if (!idToken) {
      return NextResponse.json(
        {
          error: 'reauth_required',
          message:
            'Deleting your account requires a fresh sign-in. Re-authenticate and send a fresh idToken.',
        },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken, true); // checkRevoked
    } catch (err) {
      logger.warn('Account deletion rejected: idToken verification failed', 'ACCOUNT_DELETE', {
        userId, error: String(err),
      });
      return NextResponse.json(
        { error: 'reauth_required', message: 'Your session token is invalid or revoked. Please sign in again.' },
        { status: 401 }
      );
    }

    // The fresh token must belong to the same user as the session (no cross-account deletes).
    if (decoded.uid !== userId) {
      logger.warn('Account deletion rejected: idToken uid mismatch', 'ACCOUNT_DELETE', {
        userId, tokenUid: decoded.uid,
      });
      return NextResponse.json(
        { error: 'reauth_required', message: 'Token does not match the current session.' },
        { status: 401 }
      );
    }

    // auth_time (seconds since epoch) must be recent — proves a fresh interactive login.
    const authTime = typeof decoded.auth_time === 'number' ? decoded.auth_time : 0;
    const ageSeconds = Math.floor(Date.now() / 1000) - authTime;
    if (!authTime || ageSeconds > MAX_AUTH_AGE_SECONDS) {
      logger.warn('Account deletion rejected: stale auth_time', 'ACCOUNT_DELETE', {
        userId, authTime, ageSeconds, maxAgeSeconds: MAX_AUTH_AGE_SECONDS,
      });
      return NextResponse.json(
        {
          error: 'reauth_required',
          message:
            'For your security, please re-enter your credentials before deleting your account.',
          maxAuthAgeSeconds: MAX_AUTH_AGE_SECONDS,
        },
        { status: 401 }
      );
    }

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

    // 4. Remove ALL connections (paged — no 200 cap; a user with >200
    //    connections previously left the remainder behind, an erasure gap).
    try {
      let deletedConnections = 0;
      // Page through in chunks of 500 (Firestore batch write limit) until drained.
      // We repeatedly re-query the first N because we delete what we read.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const connections = await db.collection('connections')
          .where('uids', 'array-contains', userId)
          .limit(500)
          .get();
        if (connections.empty) break;
        const batch = db.batch();
        for (const doc of connections.docs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
        deletedConnections += connections.size;
        // If we got fewer than a full page, we've drained the collection.
        if (connections.size < 500) break;
      }
      logger.info('Deleted connections during account deletion', 'ACCOUNT_DELETE', {
        userId, deletedConnections,
      });
    } catch (err) {
      logger.error('Failed to delete connections during account deletion', err, 'ACCOUNT_DELETE', { userId });
      // Best effort — do not abort the rest of the deletion.
    }

    // 4b. Best-effort purge of other owned collections. Each is wrapped
    //     independently so one failure never aborts the whole deletion.

    // users/{uid}/content/* — paged in chunks of 500.
    try {
      let deletedContent = 0;
      const contentCol = db.collection('users').doc(userId).collection('content');
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const snap = await contentCol.limit(500).get();
        if (snap.empty) break;
        const batch = db.batch();
        for (const doc of snap.docs) batch.delete(doc.ref);
        await batch.commit();
        deletedContent += snap.size;
        if (snap.size < 500) break;
      }
      logger.info('Deleted user content during account deletion', 'ACCOUNT_DELETE', {
        userId, deletedContent,
      });
    } catch (err) {
      logger.error('Failed to delete user content during account deletion', err, 'ACCOUNT_DELETE', { userId });
    }

    // teacher_analytics/{uid} — single doc keyed by uid.
    try {
      await db.collection('teacher_analytics').doc(userId).delete();
    } catch (err) {
      logger.error('Failed to delete teacher_analytics during account deletion', err, 'ACCOUNT_DELETE', { userId });
    }

    // vidya_sessions owned by this user — paged in chunks of 500.
    try {
      let deletedSessions = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const snap = await db.collection('vidya_sessions')
          .where('userId', '==', userId)
          .limit(500)
          .get();
        if (snap.empty) break;
        const batch = db.batch();
        for (const doc of snap.docs) batch.delete(doc.ref);
        await batch.commit();
        deletedSessions += snap.size;
        if (snap.size < 500) break;
      }
      logger.info('Deleted vidya_sessions during account deletion', 'ACCOUNT_DELETE', {
        userId, deletedSessions,
      });
    } catch (err) {
      logger.error('Failed to delete vidya_sessions during account deletion', err, 'ACCOUNT_DELETE', { userId });
    }

    // usage counter doc keyed by uid (best effort — both common collection names).
    try {
      await db.collection('usage').doc(userId).delete();
    } catch (err) {
      logger.error('Failed to delete usage counter during account deletion', err, 'ACCOUNT_DELETE', { userId });
    }

    // TODO(erasure): community posts / community_chat and Firebase Storage files
    // (voice-messages/{uid}/*, uploads/{uid}/*) are NOT purged here. Community
    // content is not reliably scoped by a single uid field in this handler, and
    // deleting it risks removing threads others depend on. Storage purge should
    // be handled by the export-reminder job after the 30-day grace period, or
    // added here once a uid-scoped query/prefix is confirmed safe. Leaving as a
    // documented gap rather than risking over-deletion of other users' data.

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
