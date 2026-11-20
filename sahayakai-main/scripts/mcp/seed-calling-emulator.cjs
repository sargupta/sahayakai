// Seed (or --reset) the Calling MCP demo data in the LOCAL Firestore emulator ONLY.
// Usage (see docs/mcp/calling/DEV_DEMO_DATA.md):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node scripts/mcp/seed-calling-emulator.cjs --teacher-uid <uid> --teacher-name "<name>" --phone +91XXXXXXXXXX
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node scripts/mcp/seed-calling-emulator.cjs --teacher-uid <uid> --reset
// Shapes copied from src/lib/organization.ts (Organization, OrgMember) and
// src/types/attendance.ts (ClassRecord, Student). Refuses to run without the emulator.
const host = process.env.FIRESTORE_EMULATOR_HOST || '';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
  console.error('REFUSING: FIRESTORE_EMULATOR_HOST must point at the local emulator.');
  process.exit(2);
}
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'sahayakai-b4248' }); // emulator namespace only; no credentials used
const db = admin.firestore();

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const TEACHER_UID = arg('--teacher-uid');
const TEACHER_NAME = arg('--teacher-name') || 'Demo Teacher';
const PHONE = arg('--phone');
if (!TEACHER_UID || (!process.argv.includes('--reset') && !/^\+[1-9]\d{7,14}$/.test(PHONE || ''))) {
  console.error('Usage: --teacher-uid <uid> [--teacher-name <name>] --phone <E.164>  |  --teacher-uid <uid> --reset');
  process.exit(2);
}
const ORG_ID = 'mcp-calling-dev-org';
const CLASS_ID = 'mcp-calling-demo-class-7';
const STUDENT_ID = 'mcp-demo-student';
const now = new Date();
const iso = now.toISOString();

const paths = [
  `organizations/${ORG_ID}/members/${TEACHER_UID}`,
  `organizations/${ORG_ID}`,
  `classes/${CLASS_ID}/students/${STUDENT_ID}`,
  `classes/${CLASS_ID}`,
  `users/${TEACHER_UID}`,
];

(async () => {
  if (process.argv.includes('--reset')) {
    for (const p of paths) await db.doc(p).delete();
    const out = await db.collection('parent_outreach').where('teacherUid', '==', TEACHER_UID).get();
    for (const d of out.docs) await d.ref.delete();
    const keys = await db.collection('mcp_api_keys').where('orgId', '==', ORG_ID).get();
    for (const d of keys.docs) await d.ref.delete();
    console.log(`reset: removed ${paths.length} seed docs, ${out.size} outreach, ${keys.size} keys (emulator ${host})`);
    return;
  }
  // The teacher profile fields the existing routes read: planType (hasAdvancedPlan), displayName, organizationId.
  await db.doc(`users/${TEACHER_UID}`).set({ uid: TEACHER_UID, displayName: TEACHER_NAME, planType: 'premium', organizationId: ORG_ID, updatedAt: iso });
  await db.doc(`organizations/${ORG_ID}`).set({
    name: 'MCP Calling Dev School', type: 'school', adminUserId: TEACHER_UID, plan: 'premium',
    totalSeats: 5, usedSeats: 1, createdAt: now, updatedAt: now,
  });
  await db.doc(`organizations/${ORG_ID}/members/${TEACHER_UID}`).set({ userId: TEACHER_UID, role: 'admin', joinedAt: now, invitedBy: TEACHER_UID });
  await db.doc(`classes/${CLASS_ID}`).set({
    id: CLASS_ID, teacherUid: TEACHER_UID, name: 'Class 7 - MCP Calling Demo', subject: 'Science', gradeLevel: 'Class 7',
    academicYear: '2026-27', studentCount: 1, createdAt: iso, updatedAt: iso,
  });
  await db.doc(`classes/${CLASS_ID}/students/${STUDENT_ID}`).set({
    id: STUDENT_ID, classId: CLASS_ID, rollNumber: 1, name: 'MCP Demo Student',
    parentPhone: PHONE, parentLanguage: 'English', createdAt: iso, updatedAt: iso,
  });
  for (const p of paths) {
    const s = await db.doc(p).get();
    if (!s.exists) throw new Error(`missing after seed: ${p}`);
  }
  console.log(`seeded ${paths.length} docs in emulator ${host}: org=${ORG_ID} class=${CLASS_ID} student=${STUDENT_ID} teacher=${TEACHER_UID}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
