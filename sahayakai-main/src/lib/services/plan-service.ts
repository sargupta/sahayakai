import { getAuthInstance, getDb } from '@/lib/firebase-admin';

export type PlanType = 'free' | 'pro' | 'gold' | 'premium';

/**
 * Sets the user's planType as a Firebase custom claim AND updates Firestore.
 *
 * Call this from any server-side plan-change handler (payment webhook,
 * admin action, etc.). The custom claim is embedded in the next JWT the
 * client mints — middleware reads it as `x-user-plan` with zero extra I/O.
 *
 * Client must call `auth.currentUser.getIdToken(true)` after plan change
 * to pick up the new claim (see `forceTokenRefresh` in get-auth-token.ts).
 */
export async function setUserPlan(uid: string, plan: PlanType): Promise<void> {
  const [authInstance, db] = await Promise.all([getAuthInstance(), getDb()]);

  // 1. Set Firebase custom claim (appears in JWT after next token refresh)
  await authInstance.setCustomUserClaims(uid, { planType: plan });

  // 2. Mirror to Firestore (source of truth for queries, dashboards, etc.)
  await db.collection('users').doc(uid).update({ planType: plan });
}

/**
 * Reads the current plan from Firestore (useful for migration scripts
 * that need to backfill custom claims for existing users).
 */
export async function getUserPlan(uid: string): Promise<PlanType> {
  const db = await getDb();
  const snap = await db.collection('users').doc(uid).get();
  const data = snap.data();
  const plan = data?.planType;
  const VALID: PlanType[] = ['pro', 'gold', 'premium'];
  if (VALID.includes(plan)) return plan as PlanType;
  return 'free';
}

/**
 * One-time migration: backfill custom claims for all existing users
 * whose Firestore profile has a planType but no corresponding claim.
 * Safe to run multiple times — idempotent.
 */
export async function backfillPlanClaims(): Promise<{ updated: number; skipped: number }> {
  const [authInstance, db] = await Promise.all([getAuthInstance(), getDb()]);
  const snapshot = await db.collection('users').get();
  let updated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const plan = doc.data().planType;
    if (!plan || !['free', 'pro', 'institution'].includes(plan)) {
      skipped++;
      continue;
    }

    try {
      const userRecord = await authInstance.getUser(doc.id);
      if (userRecord.customClaims?.planType === plan) {
        skipped++;
        continue;
      }
      await authInstance.setCustomUserClaims(doc.id, {
        ...userRecord.customClaims,
        planType: plan,
      });
      updated++;
    } catch {
      skipped++;
    }
  }

  return { updated, skipped };
}
