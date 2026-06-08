#!/usr/bin/env ts-node
/**
 * Backfill the `onboardingCompleted: true` Firebase Auth custom claim onto every
 * EXISTING user whose stored Firestore profile already meets the completion
 * threshold — so they pass the middleware onboarding gate (ONBOARDING_GATE_ENABLED)
 * without being forced to re-onboard once it is re-enabled.
 *
 * Usage:
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/backfill-onboarding-claim.ts            # dry-run (default)
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/backfill-onboarding-claim.ts --apply    # write claims
 *
 * Rules:
 *  - Score each user doc with the SAME app function (computeProfileCompletion /
 *    PROFILE_COMPLETE_THRESHOLD from src/lib/profile-completion.ts). The user doc
 *    IS the profile object passed in.
 *  - Only stamp users with score >= PROFILE_COMPLETE_THRESHOLD.
 *  - Merge-set the claim: read existing customClaims, spread them, add
 *    onboardingCompleted:true. NEVER clobber planType/orgId/orgRole/etc.
 *  - Idempotent: skip the write if onboardingCompleted is already true.
 *  - Users in Firestore but missing in Auth (auth/user-not-found) are counted
 *    as skipped and the run continues.
 *  - uid mapping: prefer the doc's `uid` field if present, else fall back to the
 *    Firestore doc id (mirrors backfill-profile-from-auth.ts which denormalizes uid).
 */
import { getDb, getAuthInstance } from '../src/lib/firebase-admin';
import { computeProfileCompletion, PROFILE_COMPLETE_THRESHOLD } from '../src/lib/profile-completion';

const PAGE_SIZE = 500;
const PAUSE_EVERY = 50;      // brief pause every N Auth writes to respect rate limits
const PAUSE_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apply = process.argv.includes('--apply');
  const mode = apply ? 'APPLY' : 'DRY-RUN';
  console.error(`[backfill-claim] mode=${mode}`);

  const db = await getDb();
  const auth = await getAuthInstance();

  let scanned = 0;
  let eligible = 0;        // score >= threshold
  let alreadyClaimed = 0;  // eligible AND onboardingCompleted already true
  let newlyStamped = 0;    // eligible, not yet claimed, (would be) stamped
  let belowThreshold = 0;  // score < threshold
  let errorsSkipped = 0;   // auth-missing or other per-user errors
  let writesSincePause = 0;

  // Cursor pagination — never load the whole collection into memory.
  let lastDocId: string | null = null;
  for (;;) {
    let query = db.collection('users').orderBy('__name__').limit(PAGE_SIZE);
    if (lastDocId) query = query.startAfter(lastDocId);
    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      scanned++;
      const data = doc.data() as Record<string, unknown>;
      const uid = typeof data.uid === 'string' && data.uid.trim() ? data.uid : doc.id;

      const score = computeProfileCompletion(data);
      if (score < PROFILE_COMPLETE_THRESHOLD) {
        belowThreshold++;
        continue;
      }
      eligible++;

      let authUser;
      try {
        authUser = await auth.getUser(uid);
      } catch (err: any) {
        if (err?.code === 'auth/user-not-found') {
          console.error(`[backfill-claim] skip (auth missing) uid=${uid} score=${score}`);
        } else {
          console.error(`[backfill-claim] skip (auth error) uid=${uid}: ${err?.message || err}`);
        }
        errorsSkipped++;
        continue;
      }

      const existing = (authUser.customClaims || {}) as Record<string, unknown>;
      if (existing.onboardingCompleted === true) {
        alreadyClaimed++;
        continue;
      }

      newlyStamped++;
      if (!apply) {
        console.error(
          `[backfill-claim] DRY-RUN would stamp uid=${uid} score=${score} ` +
            `keepClaims=${JSON.stringify(existing)}`,
        );
        continue;
      }

      try {
        await auth.setCustomUserClaims(uid, { ...existing, onboardingCompleted: true });
        console.error(`[backfill-claim] stamped uid=${uid} score=${score}`);
        writesSincePause++;
        if (writesSincePause >= PAUSE_EVERY) {
          await sleep(PAUSE_MS);
          writesSincePause = 0;
        }
      } catch (err: any) {
        console.error(`[backfill-claim] write error uid=${uid}: ${err?.message || err}`);
        errorsSkipped++;
        newlyStamped--;
      }
    }

    lastDocId = snap.docs[snap.docs.length - 1].id;
    if (snap.size < PAGE_SIZE) break;
  }

  console.error('\n=== SUMMARY ===');
  console.error(`mode                 : ${mode}`);
  console.error(`threshold            : ${PROFILE_COMPLETE_THRESHOLD}`);
  console.error(`total scanned        : ${scanned}`);
  console.error(`eligible (>=thresh)  : ${eligible}`);
  console.error(`already claimed      : ${alreadyClaimed}`);
  console.error(`${apply ? 'newly stamped' : 'would stamp'}        : ${newlyStamped}`);
  console.error(`below threshold      : ${belowThreshold}`);
  console.error(`errors/skipped       : ${errorsSkipped}`);
  if (!apply) console.error('\n[backfill-claim] DRY-RUN — no writes performed. Re-run with --apply to commit.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
