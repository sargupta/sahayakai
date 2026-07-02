#!/usr/bin/env node
/**
 * F16 quiz forensic probe. Sister to probe-lesson-plan.mjs.
 *
 * Usage:
 *   SAHAYAK_ID_TOKEN=$(gcloud auth print-identity-token \
 *     --impersonate-service-account=<sa>) \
 *   node probe-quiz.mjs --subject=Physics --grade="Class 11" \
 *        --topic="Units and Measurements" --numQuestions=10
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

const body = {
  topic: args.topic || 'Photosynthesis',
  numQuestions: Number(args.numQuestions || 5),
  gradeLevel: args.grade || 'Class 7',
  subject: args.subject || 'Science',
  language: args.language || 'English',
  questionTypes: ['multiple-choice'],
};

const res = await fetch(`${BASE}/api/ai/quiz`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify(body),
});
const text = await res.text();
mkdirSync('./out', { recursive: true });
const stem = `quiz-${(body.subject)}-${body.gradeLevel}-${String(body.topic).replace(/\W+/g,'_')}`;
writeFileSync(`./out/${stem}.json`, text);
console.log(`status=${res.status} bytes=${text.length} → out/${stem}.json`);
