#!/usr/bin/env node
/**
 * CI gate: reject PRs whose commit messages reference --no-verify
 * (a strong signal that pre-commit hooks were bypassed).
 *
 * Usage: node scripts/ci/check-no-verify-bypass.mjs <base-sha> <head-sha>
 * Env fallback: BASE_SHA, HEAD_SHA
 */
import { execFileSync } from 'node:child_process';

const baseSha = process.argv[2] || process.env.BASE_SHA;
const headSha = process.argv[3] || process.env.HEAD_SHA || 'HEAD';

const SHA_RE = /^[A-Za-z0-9_./-]+$/;
function safeRef(ref, label) {
  if (!ref) return null;
  if (!SHA_RE.test(ref)) {
    console.error(`[no-verify-check] refusing unsafe ${label}: ${ref}`);
    process.exit(2);
  }
  return ref;
}

const base = safeRef(baseSha, 'BASE_SHA');
const head = safeRef(headSha, 'HEAD_SHA') || 'HEAD';

if (!base) {
  console.error('[no-verify-check] BASE_SHA missing — skipping (treat as pass).');
  process.exit(0);
}

let log;
try {
  log = execFileSync(
    'git',
    ['log', '--format=%B%n--CCD-BOUNDARY--', `${base}..${head}`],
    { encoding: 'utf8' },
  );
} catch (err) {
  console.error('[no-verify-check] git log failed:', err.message);
  process.exit(2);
}

const commits = log.split('--CCD-BOUNDARY--').map((c) => c.trim()).filter(Boolean);
const offenders = [];

for (const msg of commits) {
  if (/--no-verify\b/i.test(msg) || /\bskip[\s-]?hooks?\b/i.test(msg)) {
    offenders.push(msg.split('\n')[0]);
  }
}

if (offenders.length > 0) {
  console.error('\n[no-verify-check] FAIL — commits reference pre-commit bypass:');
  for (const o of offenders) console.error(`  - ${o}`);
  console.error('\nPolicy: hooks must run. Re-author the commits without --no-verify.');
  process.exit(1);
}

console.log(`[no-verify-check] PASS — ${commits.length} commits clean.`);
