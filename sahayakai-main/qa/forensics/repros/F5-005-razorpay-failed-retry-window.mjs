#!/usr/bin/env node
/**
 * F5-005 Repro: Razorpay webhook 'failed' → retry-window double-process.
 *
 * Bug: src/app/api/webhooks/razorpay/route.ts:54-67
 *
 *   if (err.code === 6 /* ALREADY_EXISTS *\/) {
 *     const existing = await eventRef.get();
 *     const existingStatus = existing.data()?.status;
 *     if (existingStatus === 'failed') {
 *       await eventRef.update({ status: 'processing', retriedAt: ... });   // <-- not atomic
 *     } else {
 *       return { status: 'already_processed' };
 *     }
 *   }
 *
 * Sequence:
 *   - Initial webhook fails (e.g. Firestore blip) → status='failed'
 *   - Razorpay retries 5 times (their standard policy)
 *   - Retry-1 and Retry-2 arrive within a few ms of each other (their
 *     retry pump batches when prior attempts queue up)
 *   - Both read status='failed' → both update to 'processing' → both
 *     run the handler:
 *       - subscription.charged → runs the same plan update twice
 *         (idempotent at the data-shape level — same planType, same
 *         subscriptionId — but setCustomUserClaims runs twice, magic-
 *         link generation runs twice creating 2 pendingSignInLinks
 *         entries... wait — uses .set merge — actually idempotent.)
 *       - subscription.cancelled → flips planType to 'free' twice (idempotent)
 *
 * Severity: P2
 *   - No double-charge (Razorpay never charges twice for one webhook)
 *   - No data corruption (all writes are idempotent at the value level)
 *   - 2× custom-claim API call (rate limit risk under sustained retry storm)
 *   - 2× magic-link generation: each generateSignInWithEmailLink call
 *     burns a Firebase Auth API quota slot AND if pendingSignInLinks
 *     used a deterministic id (it does: doc(userId)) — idempotent.
 *
 * Fix: atomic CAS via transaction:
 *   await db.runTransaction(async (tx) => {
 *     const snap = await tx.get(eventRef);
 *     if (snap.data()?.status !== 'failed') throw new AlreadyClaimed();
 *     tx.update(eventRef, { status: 'processing', retriedAt: ... });
 *   });
 */
console.log(JSON.stringify({
  test: 'F5-005 razorpay failed-retry double-process window',
  affected: ['src/app/api/webhooks/razorpay/route.ts:54-67'],
  severity: 'P2',
  symptom: 'concurrent retries of a previously-failed event both proceed; idempotent payloads mask the race today but a future non-idempotent side-effect would double-fire',
  fix: 'CAS the failed→processing flip inside runTransaction',
}, null, 2));
