/**
 * ADK migration — preview shadow flip.
 *
 * Sets every dispatchable AI flow's sidecar mode to `shadow` @ 100%.
 * Shadow mode runs Genkit (serves) + sidecar (parallel fire-and-forget);
 * user sees no change. Parity diffs land in Firestore collection
 * `agent_shadow_diffs` for offline scoring.
 *
 * Usage:
 *   node scripts/adk-shadow-flip.mjs           # write shadow @ 100%
 *   node scripts/adk-shadow-flip.mjs --off     # revert all to off
 *   node scripts/adk-shadow-flip.mjs --dry     # just print, don't write
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'sahayakai-b4248' });
const db = getFirestore();

const REVERT = process.argv.includes('--off');
const DRY = process.argv.includes('--dry');
const MODE = REVERT ? 'off' : 'shadow';
const PERCENT = REVERT ? 0 : 100;

const FLAGS = [
  'parentCall',
  'lessonPlan',
  'vidya',
  'quiz',
  'examPaper',
  'visualAid',
  'worksheet',
  'rubric',
  'teacherTraining',
  'virtualFieldTrip',
  'instantAnswer',
  'parentMessage',
  'videoStoryteller',
  'avatar',
  'voiceToText',
  'assessmentScanner',
  'communityPersonaMessage',
  'assignmentAssessor',
];

const update = {};
for (const flag of FLAGS) {
  update[`${flag}SidecarMode`] = MODE;
  update[`${flag}SidecarPercent`] = PERCENT;
}

console.log(`Mode: ${MODE} @ ${PERCENT}%`);
console.log(`Flows: ${FLAGS.length}`);
console.log(`Fields: ${Object.keys(update).length}`);

if (DRY) {
  console.log('--dry: not writing.');
  console.log(JSON.stringify(update, null, 2));
  process.exit(0);
}

const docRef = db.collection('system_config').doc('feature_flags');
const before = await docRef.get();
console.log(`\nDoc ${docRef.path} ${before.exists ? 'exists' : 'will be created'}`);

await docRef.set(update, { merge: true });

const after = await docRef.get();
const data = after.data() || {};
const sample = FLAGS.slice(0, 3).map(f => `${f}: ${data[`${f}SidecarMode`]}@${data[`${f}SidecarPercent`]}%`);
console.log(`\n✓ Wrote. Sample: ${sample.join(', ')}`);
