#!/usr/bin/env node
/**
 * Gate 9: i18n ratchet.
 *
 * Three measurements, one committed baseline:
 *   1. missingKeys       — keys the UI passes to t() that are absent from AT
 *                          LEAST ONE src/locales/*.json file (the runtime shows
 *                          English for a key a locale lacks). Includes the keys
 *                          of dynamic t() calls, read from the code constants
 *                          scripts/i18n-dynamic-keys.json names. Measured by
 *                          scripts/find-missing-i18n-keys.mjs (stdout line
 *                          "MISSING (used but not defined): N").
 *   2. unregisteredDynamicCalls — t(<not a string literal>) calls with no entry
 *                          in scripts/i18n-dynamic-keys.json, so their keys
 *                          cannot be checked (same script, line
 *                          "UNREGISTERED DYNAMIC t() CALLS: N").
 *   3. hardcodedStrings  — hard-coded user-visible strings in the audited
 *                          marketing/community scope. Measured by
 *                          scripts/audit-i18n-source.sh in COUNT_ONLY=1 mode
 *                          (prints a single integer, always exits 0).
 * A registry entry that no longer matches the code ("REGISTRY ERRORS: N") is
 * never debt: any error fails the gate outright.
 *
 * The key scanner parses src/ with the `typescript` package, so CI installs
 * dependencies (npm ci) before this gate runs.
 * Class gate for the scanner: src/__tests__/scripts/i18n-key-extractor.test.ts.
 *
 * Baseline: scripts/ci/i18n-baseline.json { missingKeys, unregisteredDynamicCalls, hardcodedStrings }.
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

// execFileSync kills the child past maxBuffer (Node default: 1 MB). Same cap
// as every CI child call, so a verbose measurement can never crash the gate.
// Class gate: src/__tests__/scripts/ci-git-max-buffer.test.ts.
const CHILD_MAX_BUFFER = 256 * 1024 * 1024;

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
for (const key of ['missingKeys', 'unregisteredDynamicCalls', 'hardcodedStrings']) {
  if (!Number.isInteger(baseline[key])) {
    console.error(`::error::Gate 9 — baseline is missing integer field "${key}".`);
    process.exit(1);
  }
}

// --- Measurements 1 and 2: missing keys, unregistered dynamic calls -------
let missingKeys;
let unregisteredDynamicCalls;
let registryErrors;
{
  // --no-write keeps the committed scripts/i18n-missing-keys.json snapshot
  // untouched — a gate run must never dirty the working tree.
  const out = execFileSync(process.execPath, ['scripts/find-missing-i18n-keys.mjs', '--no-write'], {
    cwd: APP_ROOT,
    encoding: 'utf8',
    maxBuffer: CHILD_MAX_BUFFER,
  });
  const count = (re, what) => {
    const m = out.match(re);
    if (!m) {
      console.error(`::error::Gate 9 — could not parse the ${what} count from find-missing-i18n-keys.mjs output.`);
      console.error(out);
      process.exit(1);
    }
    return Number(m[1]);
  };
  missingKeys = count(/^MISSING \(used but not defined\): (\d+)$/m, 'missing-keys');
  unregisteredDynamicCalls = count(/^UNREGISTERED DYNAMIC t\(\) CALLS: (\d+)$/m, 'unregistered dynamic t() call');
  registryErrors = count(/^REGISTRY ERRORS: (\d+)$/m, 'registry error');
  if (registryErrors > 0) {
    const lines = (out.split('## Registry errors')[1] ?? '').split('\n').filter((l) => l.startsWith('- '));
    fail(`scripts/i18n-dynamic-keys.json does not match the code (${registryErrors} error(s)):\n${lines.join('\n')}`);
  }
}

// --- Measurement 2: hard-coded user-visible strings ----------------------
let hardcodedStrings;
{
  const out = execFileSync('bash', ['scripts/audit-i18n-source.sh'], {
    cwd: APP_ROOT,
    encoding: 'utf8',
    env: { ...process.env, COUNT_ONLY: '1' },
    maxBuffer: CHILD_MAX_BUFFER,
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
console.log(`  unregisteredDynamicCalls: ${unregisteredDynamicCalls} (baseline ${baseline.unregisteredDynamicCalls})`);
console.log(`  hardcodedStrings:  ${hardcodedStrings} (baseline ${baseline.hardcodedStrings})`);

if (missingKeys > baseline.missingKeys) {
  fail(
    `missing i18n keys went UP: ${missingKeys} > baseline ${baseline.missingKeys}. ` +
    `Every key must be in every src/locales/<language>.json ` +
    `(run node scripts/find-missing-i18n-keys.mjs for the list and the locales each key lacks).`
  );
}
if (unregisteredDynamicCalls > baseline.unregisteredDynamicCalls) {
  fail(
    `dynamic t() calls without a registry entry went UP: ${unregisteredDynamicCalls} > baseline ${baseline.unregisteredDynamicCalls}. ` +
    `Declare where each one's keys come from in scripts/i18n-dynamic-keys.json ` +
    `(node scripts/find-missing-i18n-keys.mjs lists them).`
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
if (unregisteredDynamicCalls < baseline.unregisteredDynamicCalls) improvements.push(`unregisteredDynamicCalls ${baseline.unregisteredDynamicCalls} -> ${unregisteredDynamicCalls}`);
if (hardcodedStrings < baseline.hardcodedStrings) improvements.push(`hardcodedStrings ${baseline.hardcodedStrings} -> ${hardcodedStrings}`);
if (improvements.length > 0) {
  console.log(
    `::notice::Gate 9 — i18n debt went DOWN (${improvements.join(', ')}). ` +
    `Ratchet the baseline: update sahayakai-main/scripts/ci/i18n-baseline.json to the new counts in this PR.`
  );
} else {
  console.log('OK — i18n counts at baseline.');
}
