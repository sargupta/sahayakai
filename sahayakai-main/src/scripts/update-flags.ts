/**
 * Admin CLI for updating feature flags without deployment.
 *
 * Usage:
 *   npx tsx src/scripts/update-flags.ts --kill-switch true
 *   npx tsx src/scripts/update-flags.ts --subscription true --rollout 50
 *   npx tsx src/scripts/update-flags.ts --maintenance true --message "Upgrading billing"
 *   npx tsx src/scripts/update-flags.ts --feature lesson_plan --enabled false
 *   npx tsx src/scripts/update-flags.ts --show  (print current config)
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY env var or gcloud auth.
 */

import { initializeFirebase } from '@/lib/firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

async function main() {
  const args = process.argv.slice(2);

  await initializeFirebase();
  const db = getFirestore();
  const docRef = db.doc('system_config/feature_flags');

  // --show: print current config
  if (args.includes('--show')) {
    const snap = await docRef.get();
    if (!snap.exists) {
      console.log('No feature_flags document exists. Run with flags to create one.');
    } else {
      console.log(JSON.stringify(snap.data(), null, 2));
    }
    return;
  }

  const updates: Record<string, any> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'cli',
  };

  // Parse args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--kill-switch':
        updates.billingKillSwitch = next === 'true';
        i++;
        break;
      case '--subscription':
        updates.subscriptionEnabled = next === 'true';
        i++;
        break;
      case '--rollout':
        updates.subscriptionRolloutPercent = parseInt(next, 10);
        i++;
        break;
      case '--maintenance':
        updates.maintenanceMode = next === 'true';
        i++;
        break;
      case '--message':
        updates.maintenanceMessage = next;
        i++;
        break;
      case '--feature': {
        const featureName = next;
        const enabledArg = args[i + 2];
        const enabledVal = args[i + 3];
        if (enabledArg === '--enabled') {
          updates[`features.${featureName}.enabled`] = enabledVal === 'true';
          i += 3;
        } else {
          console.error(`Expected --enabled after --feature ${featureName}`);
          process.exit(1);
        }
        break;
      }
    }
  }

  if (Object.keys(updates).length <= 2) {
    console.log('No flags specified. Use --kill-switch, --subscription, --rollout, --maintenance, --feature, or --show');
    return;
  }

  await docRef.set(updates, { merge: true });
  console.log('Updated feature flags:', JSON.stringify(updates, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
