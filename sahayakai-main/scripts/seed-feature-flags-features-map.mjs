/**
 * Belt-and-suspenders seed for `system_config/feature_flags.features`.
 *
 * The Firestore doc may pre-exist from sidecar flag seeders without a
 * `features` map. Production callsites (e.g. /api/assistant,
 * /api/community/persona-pulse) read `cfg.features[name]` via
 * `isFeatureEnabled()` and crash on `undefined`. The fix in
 * `src/lib/feature-flags.ts` adds optional-chaining, but this script
 * ensures the field is always present (empty map = all features
 * default-on, matching the docstring contract).
 *
 * Usage:
 *   node scripts/seed-feature-flags-features-map.mjs        # write if missing
 *   node scripts/seed-feature-flags-features-map.mjs --dry  # inspect only
 *   node scripts/seed-feature-flags-features-map.mjs --force # overwrite
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'sahayakai-b4248' });
const db = getFirestore();

const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');

const docRef = db.collection('system_config').doc('feature_flags');
const snap = await docRef.get();

console.log(`Doc ${docRef.path} ${snap.exists ? 'exists' : 'missing'}`);

const data = snap.exists ? (snap.data() || {}) : {};
const hasFeatures = data.features !== undefined && data.features !== null;

console.log(`features field present: ${hasFeatures}`);
if (hasFeatures) {
  const keys = Object.keys(data.features);
  console.log(`features keys: ${keys.length === 0 ? '(empty)' : keys.join(', ')}`);
}

if (hasFeatures && !FORCE) {
  console.log('Nothing to do (use --force to overwrite with empty map).');
  process.exit(0);
}

if (DRY) {
  console.log('--dry: would write features = {}');
  process.exit(0);
}

await docRef.set({ features: {} }, { merge: true });
const after = await docRef.get();
const afterFeatures = (after.data() || {}).features;
console.log(`\n✓ Wrote features = {}. Now present: ${afterFeatures !== undefined}`);
