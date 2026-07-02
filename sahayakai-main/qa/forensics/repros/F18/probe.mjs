#!/usr/bin/env node
/**
 * F18 grade-band live probe harness.
 *
 * Runs the 12-probe matrix (4 bands × 3 flows) against a live Sahayak deployment.
 * Without ID_TOKEN env var, exits 0 with a STATIC_ONLY marker so the harness
 * doubles as a CI smoke + an ad-hoc forensic tool.
 *
 * Env:
 *   ID_TOKEN     — required for live mode. Get via:
 *                   gcloud auth print-identity-token \
 *                     --impersonate-service-account=$(gcloud config get-value account)
 *   SAHAYAK_BASE — required for live mode. e.g.
 *                   https://sahayakai-hotfix-resilience-...run.app
 *   PROBE_USER   — optional; defaults to "f18-forensic-user".
 *
 * Output:
 *   qa/forensics/repros/F18/run-<timestamp>/{matrix.json,raw/*.json,findings.json}
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ID_TOKEN = process.env.ID_TOKEN;
const SAHAYAK_BASE = process.env.SAHAYAK_BASE;
const PROBE_USER = process.env.PROBE_USER || 'f18-forensic-user';

const MATRIX = [
  // Primary
  { band: 'primary', flow: 'lesson-plan', body: { topic: 'Plants around us', gradeLevels: ['Class 3'], subject: 'Science', language: 'English' } },
  { band: 'primary', flow: 'quiz',        body: { topic: 'Plants around us', gradeLevel: 'Class 3', subject: 'Science', language: 'English', questionTypes: ['mcq', 'short-answer'] } },
  { band: 'primary', flow: 'parent-message', body: { studentName: 'Aarav', className: 'Class 3A', subject: 'Science', reason: 'poor_performance', parentLanguage: 'English' } },

  // Middle
  { band: 'middle',  flow: 'lesson-plan', body: { topic: 'Integers', gradeLevels: ['Class 7'], subject: 'Math', language: 'English' } },
  { band: 'middle',  flow: 'quiz',        body: { topic: 'Integers', gradeLevel: 'Class 7', subject: 'Math', language: 'English', questionTypes: ['mcq', 'short-answer'] } },
  { band: 'middle',  flow: 'parent-message', body: { studentName: 'Riya', className: 'Class 7B', subject: 'Math', reason: 'poor_performance', parentLanguage: 'English' } },

  // Secondary
  { band: 'secondary', flow: 'lesson-plan', body: { topic: 'Light - Reflection and Refraction', gradeLevels: ['Class 10'], subject: 'Science', language: 'English' } },
  { band: 'secondary', flow: 'quiz',        body: { topic: 'Light - Reflection and Refraction', gradeLevel: 'Class 10', subject: 'Science', language: 'English', questionTypes: ['mcq', 'short-answer', 'long-answer'] } },
  { band: 'secondary', flow: 'parent-message', body: { studentName: 'Karan', className: 'Class 10C', subject: 'Science', reason: 'consecutive_absences', parentLanguage: 'English', consecutiveAbsentDays: 4 } },

  // Senior
  { band: 'senior', flow: 'lesson-plan', body: { topic: 'Electrostatics', gradeLevels: ['Class 12'], subject: 'Physics', language: 'English' } },
  { band: 'senior', flow: 'quiz',        body: { topic: 'Electrostatics', gradeLevel: 'Class 12', subject: 'Physics', language: 'English', questionTypes: ['mcq', 'long-answer'] } },
  { band: 'senior', flow: 'parent-message', body: { studentName: 'Diya', className: 'Class 12A', subject: 'Physics', reason: 'poor_performance', parentLanguage: 'English' } },
];

const ROUTE = {
  'lesson-plan':    '/api/ai/lesson-plan',
  'quiz':           '/api/ai/quiz',
  'parent-message': '/api/ai/parent-message',
};

function staticOnly() {
  console.log(JSON.stringify({
    status: 'STATIC_ONLY',
    reason: 'ID_TOKEN or SAHAYAK_BASE not set; live probes skipped.',
    matrix_size: MATRIX.length,
    next_step: 'Set ID_TOKEN and SAHAYAK_BASE to execute live probes.',
  }, null, 2));
  process.exit(0);
}

if (!ID_TOKEN || !SAHAYAK_BASE) staticOnly();

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(__dirname, `run-${ts}`);
fs.mkdirSync(path.join(runDir, 'raw'), { recursive: true });

const findings = [];

async function probe(entry) {
  const url = SAHAYAK_BASE.replace(/\/$/, '') + ROUTE[entry.flow];
  const t0 = Date.now();
  let status = 0;
  let body = null;
  let err = null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ID_TOKEN}`,
        'x-user-id': PROBE_USER,
      },
      body: JSON.stringify(entry.body),
    });
    status = res.status;
    const text = await res.text();
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
  } catch (e) {
    err = e.message;
  }
  const elapsedMs = Date.now() - t0;
  const raw = { entry, status, elapsedMs, err, body };
  const tag = `${entry.band}-${entry.flow}`;
  fs.writeFileSync(path.join(runDir, 'raw', `${tag}.json`), JSON.stringify(raw, null, 2));
  console.error(`[${tag}] status=${status} elapsedMs=${elapsedMs}${err ? ' err=' + err : ''}`);
  return raw;
}

// Heuristic auditors — fire findings based on response inspection.
function auditLessonPlan(band, body) {
  const out = [];
  const text = JSON.stringify(body || {}).toLowerCase();
  if (band === 'primary') {
    const abstractTerms = ['hypothesis', 'derivation', 'theorem', 'inquiry-based investigation'];
    if (abstractTerms.some(t => text.includes(t))) {
      out.push({ id: 'F18-06', evidence: abstractTerms.filter(t => text.includes(t)) });
    }
  }
  if (band === 'senior' && (text.includes('story') || text.includes('riddle'))) {
    out.push({ id: 'F18-02', evidence: 'story/riddle framing in senior secondary' });
  }
  return out;
}
function auditQuiz(band, body) {
  const out = [];
  const qs = body?.questions || body?.quiz?.questions || [];
  if (band === 'middle' && qs.length < 10) out.push({ id: 'F18-01', evidence: `count=${qs.length} < 10` });
  if ((band === 'secondary' || band === 'senior') && qs.length < 15) {
    out.push({ id: 'F18-01', evidence: `count=${qs.length} < 15` });
  }
  const text = JSON.stringify(body || {}).toLowerCase();
  if (band === 'secondary' && !/(board|cbse|icse)/i.test(text)) {
    out.push({ id: 'F18-05', evidence: 'no board references for Class 10' });
  }
  if (band === 'senior' && !/(neet|jee|competitive)/i.test(text)) {
    out.push({ id: 'F18-05', evidence: 'no NEET/JEE references for Class 12 Science' });
  }
  return out;
}
function auditParentMessage(band, body) {
  const out = [];
  const msg = (body?.message || '').toLowerCase();
  if (band === 'secondary' && !/board/i.test(msg)) {
    out.push({ id: 'F18-04', evidence: 'Class 10 message lacks board-year context' });
  }
  if (band === 'senior' && !/(college|admission|competitive|future)/i.test(msg)) {
    out.push({ id: 'F18-04', evidence: 'Class 12 message lacks college/admissions context' });
  }
  return out;
}

const auditors = { 'lesson-plan': auditLessonPlan, 'quiz': auditQuiz, 'parent-message': auditParentMessage };

const matrixResults = [];
for (const entry of MATRIX) {
  const r = await probe(entry);
  const local = auditors[entry.flow](entry.band, r.body);
  for (const f of local) findings.push({ band: entry.band, flow: entry.flow, ...f });
  matrixResults.push({ band: entry.band, flow: entry.flow, status: r.status, findings: local });
}

fs.writeFileSync(path.join(runDir, 'matrix.json'), JSON.stringify(matrixResults, null, 2));
fs.writeFileSync(path.join(runDir, 'findings.json'), JSON.stringify({ findings, run_dir: runDir }, null, 2));

console.log(JSON.stringify({ status: 'OK', run_dir: runDir, finding_count: findings.length }, null, 2));
