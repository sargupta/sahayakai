#!/usr/bin/env node
/**
 * Gate 9: i18n ratchet.
 *
 * Two measurements, one committed baseline:
 *   1. missingKeys       — t("...") keys used in src/ but absent from every
 *                          src/locales/*.json dictionary. Measured by the
 *                          existing scripts/find-missing-i18n-keys.mjs
 *                          (its stdout line "MISSING (used but not defined): N").
 *   2. hardcodedStrings  — hard-coded user-visible strings in the audited
 *                          marketing/community scope. Measured by
 *                          scripts/audit-i18n-source.sh in COUNT_ONLY=1 mode
 *                          (prints a single integer, always exits 0).
 *
 * Baseline: scripts/ci/i18n-baseline.json { missingKeys, hardcodedStrings }.
 * Ratchet semantics (same model as Gates 5/11):
 *   count >  baseline  -> ::error::  + exit 1  (the PR regressed i18n)
 *   count <  baseline  -> ::notice:: suggesting the baseline be ratcheted down
 *   count == baseline  -> OK
 *
 * Run from sahayakai-main/ (the scripts it shells out to resolve src/
 * against cwd):
 *   node scripts/ci/check-i18n-ratchet.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '..', '..'); // sahayakai-main/
const BASELINE_PATH = path.join(HERE, 'i18n-baseline.json');

function fail(msg) {
  console.error(`::error::Gate 9 — ${msg}`);
  process.exitCode = 1;
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch (err) {
  console.error(`::error::Gate 9 — cannot read baseline ${BASELINE_PATH}: ${err.message}`);
  process.exit(1);
}
for (const key of ['missingKeys', 'hardcodedStrings']) {
  if (!Number.isInteger(baseline[key])) {
    console.error(`::error::Gate 9 — baseline is missing integer field "${key}".`);
    process.exit(1);
  }
}

// --- Measurement 1: missing t() keys -------------------------------------
let missingKeys;
{
  // --no-write keeps the committed scripts/i18n-missing-keys.json snapshot
  // untouched — a gate run must never dirty the working tree.
  const out = execFileSync(process.execPath, ['scripts/find-missing-i18n-keys.mjs', '--no-write'], {
    cwd: APP_ROOT,
    encoding: 'utf8',
  });
  const m = out.match(/^MISSING \(used but not defined\): (\d+)$/m);
  if (!m) {
    console.error('::error::Gate 9 — could not parse missing-keys count from find-missing-i18n-keys.mjs output.');
    console.error(out);
    process.exit(1);
  }
  missingKeys = Number(m[1]);
}

// --- Measurement 2: hard-coded user-visible strings ----------------------
let hardcodedStrings;
{
  const out = execFileSync('bash', ['scripts/audit-i18n-source.sh'], {
    cwd: APP_ROOT,
    encoding: 'utf8',
    env: { ...process.env, COUNT_ONLY: '1' },
  });
  const trimmed = out.trim();
  if (!/^\d+$/.test(trimmed)) {
    console.error('::error::Gate 9 — audit-i18n-source.sh COUNT_ONLY=1 did not print a single integer.');
    console.error(out);
    process.exit(1);
  }
  hardcodedStrings = Number(trimmed);
}

// --- Compare against the ratchet baseline --------------------------------
console.log(`Gate 9 — i18n ratchet`);
console.log(`  missingKeys:       ${missingKeys} (baseline ${baseline.missingKeys})`);
console.log(`  hardcodedStrings:  ${hardcodedStrings} (baseline ${baseline.hardcodedStrings})`);

if (missingKeys > baseline.missingKeys) {
  fail(
    `missing i18n keys went UP: ${missingKeys} > baseline ${baseline.missingKeys}. ` +
    `New t("...") keys must be added to every src/locales/<language>.json ` +
    `(see scripts/i18n-missing-keys.json for the current list).`
  );
}
if (hardcodedStrings > baseline.hardcodedStrings) {
  fail(
    `hard-coded user-visible strings went UP: ${hardcodedStrings} > baseline ${baseline.hardcodedStrings}. ` +
    `Wrap new strings in t("...") — run scripts/audit-i18n-source.sh locally for the line list.`
  );
}

if (process.exitCode === 1) {
  process.exit(1);
}

const improvements = [];
if (missingKeys < baseline.missingKeys) improvements.push(`missingKeys ${baseline.missingKeys} -> ${missingKeys}`);
if (hardcodedStrings < baseline.hardcodedStrings) improvements.push(`hardcodedStrings ${baseline.hardcodedStrings} -> ${hardcodedStrings}`);
if (improvements.length > 0) {
  console.log(
    `::notice::Gate 9 — i18n debt went DOWN (${improvements.join(', ')}). ` +
    `Ratchet the baseline: update sahayakai-main/scripts/ci/i18n-baseline.json to the new counts in this PR.`
  );
} else {
  console.log('OK — i18n counts at baseline.');
}
