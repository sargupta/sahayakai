#!/usr/bin/env node
/**
 * LOCAL EMULATOR ONLY: make accounts administrators of the local demo schools, so a team member
 * who signed in with their own Google account (instead of the dev token) can use school calls.
 *
 *   node scripts/sampark/make-local-admins.mjs              every account that has signed in here
 *   node scripts/sampark/make-local-admins.mjs <uid> ...    only these accounts
 *
 * Schools: sargvision-local (the Sargvision test class), riya-test-local and hillview-demo.
 * Writes `organizations/<school>/members/<uid> { role: 'admin' }` (the members doc decides admin
 * rights, src/server/sampark/auth.ts) and, when missing, `users/<uid>.organizationId`.
 *
 * Refuses unless it talks to the Firestore EMULATOR of a `demo-*` project: it can never touch a real
 * database. Real calls still ring only allow-listed roster numbers, within the daily caps.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST?.trim() || '127.0.0.1:8080';
const project = process.env.GCLOUD_PROJECT?.trim() || 'demo-sahayakai';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !project.startsWith('demo-')) {
    console.error(`refusing: needs the local Firestore emulator and a demo-* project (got ${host}, ${project})`);
    process.exit(1);
}
process.env.FIRESTORE_EMULATOR_HOST = host;
initializeApp({ projectId: project });
const db = getFirestore();

const SCHOOLS = ['sargvision-local', 'riya-test-local', 'hillview-demo'];
const given = process.argv.slice(2).filter((a) => /^[A-Za-z0-9_-]{6,128}$/.test(a));
const uids = given.length ? given : (await db.collection('users').listDocuments()).map((d) => d.id);
if (!uids.length) {
    console.log('No accounts have signed in to this local app yet. Sign in at http://localhost:3000, then run this again.');
    process.exit(0);
}
const now = new Date().toISOString();
for (const school of SCHOOLS) {
    const org = db.collection('organizations').doc(school);
    if (!(await org.get()).exists) continue;
    for (const uid of uids) {
        await org.collection('members').doc(uid).set({ userId: uid, role: 'admin', joinedAt: now, invitedBy: 'make-local-admins' }, { merge: true });
    }
    console.log(`${school}: ${uids.length} admin(s)`);
}
for (const uid of uids) {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists || !snap.get('organizationId')) await ref.set({ uid, organizationId: 'sargvision-local', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
console.log(`accounts: ${uids.map((u) => `${u.slice(0, 6)}…`).join(', ')}`);
