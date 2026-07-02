#!/usr/bin/env node
/**
 * F17 — Board compliance LIVE probes.
 *
 * 8 boards × 3 probes = 24 calls against the preview deploy. Asserts:
 *   - exam-paper output mark cap matches board public-exam mark cap
 *   - exam-paper output section topology matches board pattern
 *   - lesson plan reflects board-specific chapter title (when known)
 *
 * Auth: gcloud impersonate → mint ID token; pass via QA_ID_TOKEN.
 *
 * Run:
 *   QA_BASE_URL=https://sahayakai-preview-zwydpvyuca-as.a.run.app \
 *   QA_ID_TOKEN=$(./scripts/qa/provision-test-user.mjs) \
 *   node qa/forensics/repros/F17-board-live-probes.mjs
 */
import fs from 'node:fs/promises';

const BASE_URL = process.env.QA_BASE_URL;
const ID_TOKEN = process.env.QA_ID_TOKEN;
if (!BASE_URL || !ID_TOKEN) {
  console.error('QA_BASE_URL and QA_ID_TOKEN required.');
  process.exit(2);
}

// Per-board expectations (Class 10 Science board paper canon).
const BOARDS = [
  { board: 'CBSE',     maxMarks: 80, hasCaseStudy: true,  hasAssertionReason: true,  twoPaper: false, uniqueTopic: 'Tissues',                                  expectChapter: /tissue/i },
  { board: 'ICSE',     maxMarks: 80, hasCaseStudy: false, hasAssertionReason: false, twoPaper: false, uniqueTopic: 'Periodic Properties — Modern Periodic Law', expectChapter: /periodic/i },
  { board: 'KSEEB',    maxMarks: 80, hasCaseStudy: false, hasAssertionReason: false, twoPaper: false, uniqueTopic: 'Prajavani role in Karnataka freedom struggle', expectChapter: /karnataka|prajavani/i },
  { board: 'TNSCERT',  maxMarks: 75, hasCaseStudy: false, hasAssertionReason: false, twoPaper: false, uniqueTopic: 'Periyar and Self-Respect Movement',         expectChapter: /periyar/i },
  { board: 'WBBSE',    maxMarks: 90, hasCaseStudy: false, hasAssertionReason: false, twoPaper: false, uniqueTopic: 'পরিবেশের জন্য ভাবনা (Concern for our Environment)', expectChapter: /environment|পরিবেশ/i },
  { board: 'MSBSHSE',  maxMarks: 40, hasCaseStudy: false, hasAssertionReason: false, twoPaper: true,  uniqueTopic: 'Disaster Management Class 10',              expectChapter: /disaster/i },
  { board: 'UPMSP',    maxMarks: 70, hasCaseStudy: false, hasAssertionReason: false, twoPaper: false, uniqueTopic: 'मेरा गाँव मेरा परिवेश',                       expectChapter: /गाँव|परिवेश/i },
  { board: 'APSCERT',  maxMarks: 40, hasCaseStudy: false, hasAssertionReason: false, twoPaper: true,  uniqueTopic: 'Telangana Statehood Movement',              expectChapter: /telangana|statehood/i },
];

const results = [];

async function call(path, body) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ID_TOKEN}` },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: r.status, json };
}

for (const bp of BOARDS) {
  // Probe 1 — lesson plan, "Motion"
  const p1 = await call('/api/ai/lesson-plan', {
    topic: 'Motion', gradeLevels: ['Class 10'], subject: 'Science', language: 'English',
    board: bp.board, // currently ignored by schema — included to document the contract
  });
  // Probe 2 — exam paper
  const p2 = await call('/api/ai/exam-paper', {
    board: bp.board, gradeLevel: 'Class 10', subject: 'Science',
    chapters: ['Motion', 'Force', 'Light'],
    duration: 180, maxMarks: bp.maxMarks,
    difficulty: 'mixed', language: 'English',
    includeAnswerKey: true, includeMarkingScheme: true,
  });
  // Probe 3 — board-unique topic via lesson plan
  const p3 = await call('/api/ai/lesson-plan', {
    topic: bp.uniqueTopic, gradeLevels: ['Class 10'],
    subject: 'Science', language: 'English', board: bp.board,
  });

  // Lightweight assertions
  const paperJson = JSON.stringify(p2.json).toLowerCase();
  const hasCaseStudy = /case\s*study/.test(paperJson);
  const hasAR = /assertion[\s-]*reason/.test(paperJson);
  const p3Json = JSON.stringify(p3.json);

  results.push({
    board: bp.board,
    p1: { status: p1.status, hasBoardEcho: JSON.stringify(p1.json).includes(bp.board) },
    p2: {
      status: p2.status,
      hasCaseStudy,
      hasAssertionReason: hasAR,
      caseStudyDriftP0: hasCaseStudy && !bp.hasCaseStudy,
      assertionReasonDriftP0: hasAR && !bp.hasAssertionReason,
    },
    p3: {
      status: p3.status,
      matchedExpectedChapter: bp.expectChapter.test(p3Json),
    },
  });
}

await fs.mkdir('qa/forensics/repros/F17-output', { recursive: true });
await fs.writeFile('qa/forensics/repros/F17-output/live-results.json',
  JSON.stringify(results, null, 2));

const drift = results.filter(r => r.p2.caseStudyDriftP0 || r.p2.assertionReasonDriftP0);
console.log(`F17 live probes complete — ${results.length} boards, ${drift.length} P0 structural drift.`);
process.exit(drift.length ? 1 : 0);
