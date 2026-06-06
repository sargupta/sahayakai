// Lane F run-4: validate dispatcher input-normalisation fix.
// Same UID + auth chain as run-3; payload field names corrected against
// Genkit Zod schemas so the Next.js route accepts the body and the
// dispatcher can forward to the Python sidecar.
//
// Run before/after the dispatcher normalisation patch to confirm:
//   1. Each route returns 2xx instead of 400 (Zod) or 422 (Pydantic).
//   2. Latency and shape are recorded for parity scoring.

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const BASE = process.env.SAHAYAKAI_BASE_URL
  || 'https://sahayakai-preview-zwydpvyuca-as.a.run.app';
const PROJECT_ID = 'sahayakai-b4248';
const WEB_API_KEY = 'AIzaSyBKgCKW4e6YpM4HHIgAhwhJwmyQ0wRGCtw';
const UID = 'qa-lane-f-run4';
const OUT_DIR = '/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/qa/results/lane-F';
fs.mkdirSync(OUT_DIR, { recursive: true });

const app = admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: PROJECT_ID,
  serviceAccountId: 'firebase-adminsdk-fbsvc@sahayakai-b4248.iam.gserviceaccount.com',
});

const ct = await app.auth().createCustomToken(UID, {
  planType: 'premium',
  role: 'teacher',
  state: 'Karnataka',
  district: 'Bengaluru',
});
const tr = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
  { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) },
);
const trJson = await tr.json();
const idToken = trJson.idToken;
if (!idToken) {
  console.error('Failed to mint ID token:', trJson);
  process.exit(1);
}
console.log(`[auth] minted idToken for uid=${UID}`);

try {
  const db = admin.firestore();
  await db.collection('users').doc(UID).set({
    uid: UID, planType: 'premium', role: 'teacher',
    state: 'Karnataka', district: 'Bengaluru',
    subjects: ['math', 'science'],
    onboardingCompleted: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
} catch (e) {
  console.warn('[seed] profile write failed:', e?.message || e);
}

const STUB_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Payloads use the SAME field names the Genkit Zod schemas declare.
// Languages mix display names AND ISO codes — the dispatcher's
// `toIsoLanguage()` normalises both before forwarding to the sidecar.
const ROUTES = [
  { id: 'lesson-plan', path: '/api/ai/lesson-plan', payloads: [
    { userId: UID, topic: 'Fractions', subject: 'Mathematics', gradeLevels: ['Class 3'], language: 'English', resourceLevel: 'medium', difficultyLevel: 'standard', useRuralContext: false },
    { userId: UID, topic: 'Photosynthesis', subject: 'Science', gradeLevels: ['Class 7'], language: 'Hindi', resourceLevel: 'medium', difficultyLevel: 'standard', useRuralContext: false },
    { userId: UID, topic: 'Democracy', subject: 'Social Studies', gradeLevels: ['Class 10'], language: 'Kannada', resourceLevel: 'medium', difficultyLevel: 'standard', useRuralContext: false },
  ]},
  { id: 'quiz', path: '/api/ai/quiz', payloads: [
    { userId: UID, topic: 'Fractions', subject: 'Mathematics', gradeLevel: 'Class 3', language: 'English', numQuestions: 5, questionTypes: ['multiple_choice'] },
    { userId: UID, topic: 'Photosynthesis', subject: 'Science', gradeLevel: 'Class 7', language: 'Hindi', numQuestions: 5, questionTypes: ['multiple_choice'] },
    { userId: UID, topic: 'Indian Constitution', subject: 'Social Studies', gradeLevel: 'Class 10', language: 'English', numQuestions: 5, questionTypes: ['multiple_choice'] },
  ]},
  { id: 'worksheet', path: '/api/ai/worksheet', payloads: [
    { userId: UID, prompt: 'Create a Mathematics worksheet on Fractions for Class 3.', imageDataUri: STUB_PNG, gradeLevel: 'Class 3', language: 'English' },
    { userId: UID, prompt: 'Create a Science worksheet on Photosynthesis for Class 7.', imageDataUri: STUB_PNG, gradeLevel: 'Class 7', language: 'Hindi' },
    { userId: UID, prompt: 'Create a Social Studies worksheet on Democracy for Class 10.', imageDataUri: STUB_PNG, gradeLevel: 'Class 10', language: 'Kannada' },
  ]},
  { id: 'rubric', path: '/api/ai/rubric', payloads: [
    { userId: UID, assignmentDescription: 'essay on the water cycle', gradeLevel: 'Class 5', language: 'English' },
    { userId: UID, assignmentDescription: 'lab report on plant growth', gradeLevel: 'Class 8', language: 'English' },
    { userId: UID, assignmentDescription: 'short story about a village fair', gradeLevel: 'Class 6', language: 'Hindi' },
  ]},
  { id: 'exam-paper', path: '/api/ai/exam-paper', payloads: [
    { userId: UID, board: 'CBSE', gradeLevel: 'Class 8', subject: 'Mathematics', chapters: ['fractions', 'ratio and proportion'], maxMarks: 50, duration: 90, language: 'English' },
    { userId: UID, board: 'CBSE', gradeLevel: 'Class 10', subject: 'Science', chapters: ['light', 'electricity'], maxMarks: 80, duration: 180, language: 'English' },
    { userId: UID, board: 'CBSE', gradeLevel: 'Class 7', subject: 'Social Studies', chapters: ['medieval india'], maxMarks: 40, duration: 60, language: 'Hindi' },
  ]},
  { id: 'visual-aid', path: '/api/ai/visual-aid', payloads: [
    { userId: UID, prompt: 'water cycle diagram', gradeLevel: 'Class 5', language: 'English' },
    { userId: UID, prompt: 'parts of a flower', gradeLevel: 'Class 6', language: 'English' },
    { userId: UID, prompt: 'solar system', gradeLevel: 'Class 4', language: 'Hindi' },
  ]},
  { id: 'virtual-field-trip', path: '/api/ai/virtual-field-trip', payloads: [
    { userId: UID, topic: 'Taj Mahal', gradeLevel: 'Class 7', language: 'English' },
    { userId: UID, topic: 'Hampi ruins', gradeLevel: 'Class 8', language: 'English' },
    { userId: UID, topic: 'Sundarbans mangroves', gradeLevel: 'Class 6', language: 'Bengali' },
  ]},
  { id: 'teacher-training', path: '/api/ai/teacher-training', payloads: [
    { userId: UID, question: 'How do I manage classroom discipline with 40 students?', language: 'English' },
    { userId: UID, question: 'How do I teach first-generation learners inclusively?', language: 'English' },
    { userId: UID, question: 'How do I run activity-based math instruction?', language: 'Hindi' },
  ]},
  { id: 'instant-answer', path: '/api/ai/instant-answer', payloads: [
    { userId: UID, question: 'What is photosynthesis?', language: 'English' },
    { userId: UID, question: 'How does a rainbow form?', language: 'English' },
    { userId: UID, question: 'भारत के पहले प्रधानमंत्री कौन थे?', language: 'Hindi' },
  ]},
  { id: 'parent-message', path: '/api/ai/parent-message', payloads: [
    { userId: UID, studentName: 'Ravi', className: 'Class 6A', subject: 'Mathematics', reason: 'consecutive_absences', reasonContext: 'absent for two days', parentLanguage: 'English' },
    { userId: UID, studentName: 'Anita', className: 'Class 7B', subject: 'Mathematics', reason: 'positive_feedback', reasonContext: 'top scorer in last math test', parentLanguage: 'English' },
    { userId: UID, studentName: 'Suresh', className: 'Class 5C', subject: 'Mathematics', reason: 'poor_performance', reasonContext: 'recent assessment performance', parentLanguage: 'Hindi' },
  ]},
  { id: 'video-storyteller', path: '/api/ai/video-storyteller', payloads: [
    { userId: UID, subject: 'Science', gradeLevel: 'Class 5', topic: 'water cycle', language: 'English' },
    { userId: UID, subject: 'Social Studies', gradeLevel: 'Class 7', topic: 'mughal empire', language: 'English' },
    { userId: UID, subject: 'Mathematics', gradeLevel: 'Class 3', topic: 'fractions for beginners', language: 'Hindi' },
  ]},
];

async function call(p, body, timeoutMs = 120000) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + p, {
      method: 'POST',
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const tx = await r.text();
    let j;
    try { j = JSON.parse(tx); } catch { j = tx; }
    return { status: r.status, body: j, ms: Date.now() - t0 };
  } catch (e) {
    return { status: 0, body: { err: String(e) }, ms: Date.now() - t0 };
  } finally {
    clearTimeout(to);
  }
}

const results = [];
const startTs = new Date().toISOString();
console.log(`[start] ${startTs}`);

async function pool(items, n, w) {
  const q = items.slice();
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) await w(q.shift()); }));
}

const jobs = [];
for (const route of ROUTES) {
  route.payloads.forEach((p, i) => jobs.push({ route, payloadIdx: i, payload: p }));
}

await pool(jobs, 3, async ({ route, payloadIdx, payload }) => {
  console.log(`-> ${route.id} #${payloadIdx + 1}`);
  const r = await call(route.path, payload);
  const sample = typeof r.body === 'string' ? r.body.slice(0, 300) : JSON.stringify(r.body).slice(0, 300);
  console.log(`<- ${route.id} #${payloadIdx + 1} status=${r.status} ms=${r.ms}`);
  results.push({ route: route.id, path: route.path, payloadIdx, status: r.status, ms: r.ms, sample });
});

const endTs = new Date().toISOString();
console.log(`[end] ${endTs}`);

fs.writeFileSync(
  path.join(OUT_DIR, 'f-run4-traffic.json'),
  JSON.stringify({ uid: UID, start: startTs, end: endTs, results }, null, 2),
);

const byRoute = {};
for (const r of results) {
  if (!byRoute[r.route]) byRoute[r.route] = { total: 0, ok: 0, statuses: {} };
  byRoute[r.route].total++;
  if (r.status >= 200 && r.status < 300) byRoute[r.route].ok++;
  byRoute[r.route].statuses[r.status] = (byRoute[r.route].statuses[r.status] || 0) + 1;
}
console.log('\n=== Per-route HTTP summary ===');
for (const [route, s] of Object.entries(byRoute)) {
  console.log(`${route.padEnd(22)} ok=${s.ok}/${s.total} statuses=${JSON.stringify(s.statuses)}`);
}

process.exit(0);
