#!/usr/bin/env node
/**
 * F17 — Board compliance static audit.
 *
 * Scans the AI flow + data layer to assert structural board coverage. Exits
 * non-zero if any of the 8 target boards is silently routed to a CBSE-shaped
 * fallback for exam-paper generation, or if lesson-plan-generator lacks a
 * `board` input parameter.
 *
 * Run:
 *   node qa/forensics/repros/F17-board-static-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '../../..');
const TARGET_BOARDS = ['CBSE', 'ICSE', 'KSEEB', 'TNSCERT', 'WBBSE', 'MSBSHSE', 'UPMSP', 'APSCERT', 'TSBIE'];

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), 'utf8');
}

const failures = [];

// 1. Lesson-plan flow must expose `board` in its input schema.
const lessonSrc = read('src/ai/flows/lesson-plan-generator.ts');
const lessonSchemaBlock = lessonSrc.match(/LessonPlanInputSchema\s*=\s*z\.object\(\{[\s\S]*?\}\)/)?.[0] ?? '';
if (!/\bboard\s*:/.test(lessonSchemaBlock)) {
  failures.push({
    id: 'F17-A1',
    severity: 'P0',
    msg: 'LessonPlanInputSchema does not declare a `board` field — lesson plans cannot be board-aligned.',
  });
}

// 2. Exam-paper blueprints must cover all 8 target boards.
const bpSrc = read('src/ai/data/board-blueprints.ts');
const boardsInRegistry = new Set(
  [...bpSrc.matchAll(/board:\s*'([^']+)'/g)].map(m => m[1])
);
for (const b of TARGET_BOARDS) {
  if (!boardsInRegistry.has(b)) {
    failures.push({
      id: `F17-A2-${b}`,
      severity: 'P0',
      msg: `No blueprint for board "${b}" in src/ai/data/board-blueprints.ts → exam-paper flow will use CBSE-shaped fallback.`,
    });
  }
}

// 3. Fallback message must NOT silently route to a CBSE pattern (we look for
//    the giveaway phrase 'MCQ, short answer, long answer, and case study').
const examSrc = read('src/ai/flows/exam-paper-generator.ts');
if (/MCQ,\s*short answer,\s*long answer,\s*and case study/i.test(examSrc)) {
  failures.push({
    id: 'F17-A3',
    severity: 'P0',
    msg: 'Unknown-board fallback in exam-paper-generator.ts hard-codes a CBSE pattern (MCQ+SA+LA+case-study).',
  });
}

// 4. PYQ corpus board coverage.
const pyqDir = path.join(ROOT, 'src/ai/data/pyq');
const counts = {};
for (const f of fs.readdirSync(pyqDir)) {
  if (!f.endsWith('.json')) continue;
  const raw = fs.readFileSync(path.join(pyqDir, f), 'utf8');
  for (const m of raw.matchAll(/"board"\s*:\s*"([^"]+)"/g)) {
    counts[m[1]] = (counts[m[1]] ?? 0) + 1;
  }
}
for (const b of TARGET_BOARDS.filter(b => b !== 'CBSE')) {
  // Allow generous fuzzy matches (e.g. "Karnataka SSLC" for KSEEB).
  const hit = Object.keys(counts).some(k => k.toLowerCase().includes(b.toLowerCase()));
  if (!hit) {
    failures.push({
      id: `F17-A4-${b}`,
      severity: 'P1',
      msg: `PYQ corpus has 0 questions for board "${b}" — RAG grounding impossible.`,
    });
  }
}

// 5. Syllabus reference oracle present?
if (!fs.existsSync(path.join(ROOT, 'qa/syllabus-reference/syllabus.json'))) {
  failures.push({
    id: 'F17-A5',
    severity: 'P1',
    msg: 'qa/syllabus-reference/syllabus.json missing — no offline ground truth for board claims.',
  });
}

const report = { date: new Date().toISOString(), failures };
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length ? 1 : 0);
