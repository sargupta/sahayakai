#!/usr/bin/env node
/**
 * F16 lesson-plan forensic probe.
 *
 * Generates a lesson plan for a (subject, class, chapter) triple and writes the
 * raw response to stdout for manual inspection (curriculum alignment, factual
 * accuracy, notation, age-appropriateness, learning-objective coverage).
 *
 * Auth: requires a Firebase ID token in $SAHAYAK_ID_TOKEN (e.g.
 *   gcloud auth print-identity-token
 *   --impersonate-service-account="<sa>@sahayakai-b4248.iam.gserviceaccount.com"
 *
 * Usage:
 *   node probe-lesson-plan.mjs --subject="Mathematics" --grade="Class 10" \
 *        --chapter="Quadratic Equations" --topic="Quadratic Equations"
 */
import { argv, env, exit } from 'node:process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolveBase } from '../_qa-base.mjs';

const args = Object.fromEntries(argv.slice(2).map(s => {
  const m = s.match(/^--([^=]+)=(.*)$/);
  return m ? [m[1], m[2]] : [s.replace(/^--/, ''), true];
}));

const BASE = resolveBase();
const TOKEN = env.SAHAYAK_ID_TOKEN;
if (!TOKEN) { console.error('SAHAYAK_ID_TOKEN env var required'); exit(2); }

const subject = args.subject || 'Mathematics';
const grade = args.grade || 'Class 10';
const chapter = args.chapter || '';
const topic = args.topic || chapter || subject;

const body = {
  topic,
  gradeLevels: [grade],
  subject,
  language: args.language || 'English',
  resourceLevel: 'low',
  difficultyLevel: 'standard',
  useRuralContext: true,
  ...(chapter ? { ncertChapter: { number: Number(args.chapterNum||0)||1, title: chapter, subject, learningOutcomes: [] } } : {}),
};

const res = await fetch(`${BASE}/api/ai/lesson-plan`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify(body),
});
const text = await res.text();
mkdirSync('./out', { recursive: true });
const stem = `${subject}-${grade}-${(chapter||topic).replace(/\W+/g,'_')}`.replace(/\s+/g,'_');
writeFileSync(`./out/${stem}.json`, text);
console.log(`status=${res.status} bytes=${text.length} → out/${stem}.json`);
