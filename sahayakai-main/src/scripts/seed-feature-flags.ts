/**
 * Seed the initial feature_flags document in Firestore.
 * Run once: npx tsx src/scripts/seed-feature-flags.ts
 *
 * Safe to re-run — uses merge so it won't overwrite existing values.
 */

import { initializeFirebase } from '@/lib/firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

async function main() {
  await initializeFirebase();
  const db = getFirestore();

  await db.doc('system_config/feature_flags').set({
    billingKillSwitch: true,           // start safe: everything free
    maintenanceMode: false,
    maintenanceMessage: '',
    subscriptionEnabled: false,        // flip to true when ready
    subscriptionRolloutPercent: 0,     // start at 0%, ramp to 10 → 50 → 100
    subscriptionAllowlist: [],         // add test UIDs here first
    features: {
      // Example toggles — add more as needed
      // lesson_plan: { enabled: true },
      // visual_aid: { enabled: true },
      // video_storyteller: { enabled: true },
    },
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'seed-script',
  }, { merge: true });

  console.log('Seeded system_config/feature_flags');
}

main().catch(err => { console.error(err); process.exit(1); });
