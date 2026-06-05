// Re-verify lesson-plan Odia parity after writer-prompt fix.
//
// Drives several Odia cells through the staging sidecar, fetches the
// sidecar response from agent_shadow_diffs, and rewrites the
// qa/sidecar-runs/lesson-plan/or-*.json files. Then the user can re-run
// score-parity.mjs to confirm the regression is gone.
//
// Usage:
//   node scripts/lesson-plan-odia-reverify.mjs
//
// Auth: gcloud auth application-default login.

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const ROOT = '/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main';
const BASE = 'https://sahayakai-preview-zwydpvyuca-as.a.run.app';
const PROJECT_ID = 'sahayakai-b4248';
const WEB_API_KEY = 'AIzaSyBKgCKW4e6YpM4HHIgAhwhJwmyQ0wRGCtw';
const UID = 'phase2-collector';
const DATE_BUCKET = new Date().toISOString().slice(0, 10);
const SIDECAR_ROOT = path.join(ROOT, 'qa/sidecar-runs/lesson-plan');

const CELLS = [
    { id: 'g3-math-fractions', gradeLabel: 'Class 3', subject: 'Mathematics', topic: 'Fractions' },
    { id: 'g3-science-watercycle', gradeLabel: 'Class 3', subject: 'Science', topic: 'Water Cycle' },
];
const LANG = { code: 'or', name: 'Odia' };

const app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
    serviceAccountId: 'firebase-adminsdk-fbsvc@sahayakai-b4248.iam.gserviceaccount.com',
});
const db = admin.firestore();

let idToken;
async function mintIdToken() {
    const ct = await app.auth().createCustomToken(UID, { planType: 'premium' });
    const r = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
        { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: ct, returnSecureToken: true }) }
    );
    const j = await r.json();
    if (!j.idToken) throw new Error('mint: ' + JSON.stringify(j));
    return j.idToken;
}

async function call(cell) {
    const body = {
        userId: UID,
        topic: cell.topic,
        subject: cell.subject,
        gradeLevels: [cell.gradeLabel],
        language: LANG.name,
        resourceLevel: 'medium',
        difficultyLevel: 'standard',
        useRuralContext: false,
    };
    const t0 = Date.now();
    const r = await fetch(BASE + '/api/ai/lesson-plan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
    const txt = await r.text();
    return { status: r.status, body: txt, t0, t1: Date.now() };
}

async function fetchSidecarDoc(t0, t1) {
    const lo = new Date(t0 - 1000);
    const hi = new Date(t1 + 60_000);
    const ref = db.collection('agent_shadow_diffs').doc(DATE_BUCKET).collection('lesson-plan');
    const snap = await ref.where('createdAt', '>=', lo).where('createdAt', '<=', hi).orderBy('createdAt', 'asc').get();
    const docs = snap.docs.filter(d => d.data().uid === UID).map(d => ({
        id: d.id,
        createdAt_ms: d.data().createdAt.toMillis(),
        sidecar: d.data().sidecar,
        sidecarOk: d.data().sidecarOk,
        sidecarError: d.data().sidecarError,
    }));
    if (!docs.length) return null;
    docs.sort((a, b) => Math.abs(a.createdAt_ms - t1) - Math.abs(b.createdAt_ms - t1));
    return docs[0];
}

console.log('Lesson-plan Odia reverify — date bucket', DATE_BUCKET);
idToken = await mintIdToken();

const ENVELOPE_META = new Set(['sidecarVersion', 'latencyMs', 'modelUsed', 'groundingUsed']);
for (const cell of CELLS) {
    console.log(`\n→ or-${cell.id}`);
    const res = await call(cell);
    console.log(`  preview status=${res.status} latency=${res.t1 - res.t0}ms`);
    if (res.status !== 200) {
        console.log('  body:', res.body.slice(0, 400));
        continue;
    }
    // Wait for shadow_diff write
    await new Promise(r => setTimeout(r, 8000));
    let doc = await fetchSidecarDoc(res.t0, res.t1);
    let tries = 0;
    while (!doc && tries < 6) {
        await new Promise(r => setTimeout(r, 10000));
        doc = await fetchSidecarDoc(res.t0, res.t1);
        tries++;
    }
    if (!doc) { console.log('  no shadow_diff doc found'); continue; }
    console.log(`  shadow_diff doc=${doc.id} sidecarOk=${doc.sidecarOk}`);
    if (!doc.sidecarOk || !doc.sidecar) {
        console.log(`  sidecarError=${doc.sidecarError}`);
        continue;
    }
    const cleaned = {};
    for (const [k, v] of Object.entries(doc.sidecar)) {
        if (!ENVELOPE_META.has(k)) cleaned[k] = v;
    }
    const out = path.join(SIDECAR_ROOT, `or-${cell.id}.json`);
    fs.writeFileSync(out, JSON.stringify(cleaned, null, 2));
    console.log(`  wrote ${out}`);
    // print primary text snapshot
    const primary = (cleaned.title || '') + '\n' + (cleaned.objectives || []).join('\n');
    const latin = [...primary].filter(c => /[A-Za-z]/.test(c)).length;
    const oriya = [...primary].filter(c => c >= '଀' && c <= '୿').length;
    console.log(`  primary text: latin=${latin} oriya=${oriya}`);
    console.log(`  title: ${cleaned.title}`);
    for (const o of cleaned.objectives || []) console.log(`  obj: ${o}`);
}

process.exit(0);
