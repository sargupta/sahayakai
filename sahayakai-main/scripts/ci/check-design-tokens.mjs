#!/usr/bin/env node
/**
 * Gate 11: design-token ratchet (changed files).
 *
 * Phase 0 of the design-system roadmap (docs/design proposals 00/02):
 * every color and type size must come from the token system
 * (globals.css CSS vars + tailwind.config.ts). Like Gate 5 (console.log),
 * this is a RATCHET — PRs fail only on banned patterns in .tsx files the
 * change touches, so the legacy backlog never blocks unrelated work.
 *
 * Banned in src/**\/*.tsx (tests excluded):
 *   1. Raw hex colors        — #abc / #aabbcc / #aabbccdd literals.
 *      Tokens live in globals.css / tailwind.config.ts (never scanned:
 *      they are not .tsx).
 *   2. `orange-*` Tailwind classes — the palette tone is saffron; use
 *      primary/saffron token classes.
 *   3. Arbitrary px font sizes — text-[NNpx]; use the type scale
 *      (.type-* utilities or text-xs..text-3xl).
 *   4. Raw Tailwind palette classes — bg-red-500, text-green-600, etc.
 *      Status UI has tokens now: success / warning / info (+ destructive),
 *      mapped in tailwind.config.ts to globals.css HSL vars.
 *
 * REPO-WIDE BUDGET (in addition to the per-PR added-lines ratchet):
 * total banned-pattern hits across src/**\/*.tsx are compared to the
 * committed scripts/ci/design-tokens-budget.json { maxHits }. Over budget
 * FAILS in every mode — even a PR whose own added lines are clean — so the
 * backlog can never silently grow via merges/renames. Under budget prints
 * a ::notice:: to ratchet maxHits down.
 *
 * Escape hatch: a line containing `design-token-allow` is skipped
 * (e.g. Next's metadata themeColor, which requires a literal hex).
 *
 * Usage:
 *   BASE_SHA=<sha|ref> node scripts/ci/check-design-tokens.mjs
 *     -> scans files changed since BASE_SHA; exits 1 on any added-line hit
 *        or a repo-wide budget breach.
 *   node scripts/ci/check-design-tokens.mjs   (no BASE_SHA)
 *     -> full-repo backlog report; exits 1 only on a budget breach.
 *
 * Works from either the repo root or sahayakai-main/ (resolves paths
 * against the git toplevel).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BANNED = [
  {
    name: 'raw hex color (use a token from globals.css / tailwind.config.ts)',
    re: /#[0-9a-fA-F]{3,8}\b/,
  },
  {
    name: 'orange-* Tailwind class (use primary/saffron token classes)',
    re: /\borange-(?:50|[1-9]0{2}|950)\b/,
  },
  {
    name: 'arbitrary px font size text-[NNpx] (use the type scale)',
    re: /\btext-\[\d+(?:\.\d+)?px\]/,
  },
  {
    name: 'raw Tailwind palette class (use tokens: success/warning/info/destructive, primary/saffron, muted)',
    re: /\b(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|decoration|accent|caret|shadow)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(?:50|[1-9]00|950)\b/,
  },
];

const ALLOW_MARKER = 'design-token-allow';

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();
}

const repoRoot = git(['rev-parse', '--show-toplevel']);
// The app may live at the repo root or in sahayakai-main/ (monorepo CI).
const appPrefix = existsSync(join(repoRoot, 'sahayakai-main', 'src'))
  ? 'sahayakai-main/'
  : '';

function isTarget(file) {
  if (!file.startsWith(`${appPrefix}src/`)) return false;
  if (!file.endsWith('.tsx')) return false;
  if (/(^|\/)__(tests|mocks)__\//.test(file)) return false;
  return true;
}

function scanFile(relPath) {
  const abs = join(repoRoot, relPath);
  if (!existsSync(abs)) return []; // deleted/renamed away
  const hits = [];
  const lines = readFileSync(abs, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    for (const { name, re } of BANNED) {
      const m = line.match(re);
      if (m) hits.push({ file: relPath, line: i + 1, rule: name, match: m[0] });
    }
  });
  return hits;
}

const baseSha = process.env.BASE_SHA;

let files;
let addedLinesByFile = null;
if (baseSha) {
  files = git(['diff', '--name-only', `${baseSha}...HEAD`], { cwd: repoRoot })
    .split('\n')
    .filter(Boolean)
    .filter(isTarget);
  if (files.length === 0) {
    console.log('OK — no relevant .tsx files changed.');
    // Budget still applies (merges/renames can grow the backlog without
    // this diff touching any .tsx file).
    process.exit(checkBudget() ? 0 : 1);
  }
  // Ratchet on ADDED LINES only. A whole-file scan would fail PRs that
  // merely touch files carrying legacy debt (measured: 82 legacy hits in
  // ~20 files at gate introduction) — the burn-down is a tranche, not a
  // per-PR toll. Parse `git diff -U0` hunks into per-file added-line sets.
  addedLinesByFile = new Map();
  const diff = git(['diff', '-U0', `${baseSha}...HEAD`, '--', ...files.map((f) => f)], { cwd: repoRoot });
  let current = null;
  for (const line of diff.split('\n')) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      current = fileMatch[1];
      if (!addedLinesByFile.has(current)) addedLinesByFile.set(current, new Set());
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk && current) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let i = 0; i < count; i++) addedLinesByFile.get(current).add(start + i);
    }
  }
} else {
  files = git(['ls-files', `${appPrefix}src/**/*.tsx`], { cwd: repoRoot })
    .split('\n')
    .filter(Boolean)
    .filter(isTarget);
}

/**
 * Repo-wide budget: total banned-pattern hits across ALL target .tsx files
 * vs scripts/ci/design-tokens-budget.json { maxHits }. Runs in every mode.
 * Returns true when within budget (printing a ratchet notice when under).
 */
function checkBudget() {
  const budgetPath = join(repoRoot, `${appPrefix}scripts/ci/design-tokens-budget.json`);
  let budget;
  try {
    budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
  } catch (err) {
    console.error(`::error::Gate 11 — cannot read budget file ${budgetPath}: ${err.message}`);
    return false;
  }
  if (!Number.isInteger(budget.maxHits)) {
    console.error(`::error::Gate 11 — budget file lacks an integer maxHits field.`);
    return false;
  }
  const allFiles = git(['ls-files', `${appPrefix}src/**/*.tsx`], { cwd: repoRoot })
    .split('\n')
    .filter(Boolean)
    .filter(isTarget);
  const total = allFiles.flatMap(scanFile).length;
  if (total > budget.maxHits) {
    console.error(
      `::error::Gate 11 — repo-wide design-token debt is OVER budget: ${total} hits > maxHits ${budget.maxHits}. ` +
      'The backlog may never grow. Convert the offending styles to tokens (or, for true literals, add `design-token-allow` with a justification).'
    );
    return false;
  }
  if (total < budget.maxHits) {
    console.log(
      `::notice::Gate 11 — repo-wide design-token debt went DOWN: ${total} hits < maxHits ${budget.maxHits}. ` +
      'Ratchet the budget: set maxHits to the new total in sahayakai-main/scripts/ci/design-tokens-budget.json in this PR.'
    );
  } else {
    console.log(`Budget OK — ${total} repo-wide hit(s), at maxHits ${budget.maxHits}.`);
  }
  return true;
}

let hits = files.flatMap(scanFile);
if (addedLinesByFile) {
  hits = hits.filter((h) => addedLinesByFile.get(h.file)?.has(h.line));
}

if (baseSha) {
  if (hits.length > 0) {
    console.error(
      `::error::Gate 11 — ${hits.length} banned design-token pattern(s) on lines this change ADDS:`
    );
    for (const h of hits) {
      console.error(`  ${h.file}:${h.line}  [${h.rule}]  "${h.match}"`);
    }
    console.error(
      'Use tokens (globals.css vars / tailwind.config.ts classes), or append `design-token-allow` with a justification for true literals.'
    );
    checkBudget(); // still report budget state before failing
    process.exit(1);
  }
  const budgetOk = checkBudget();
  console.log(`OK — ${files.length} changed .tsx file(s), no banned design-token patterns.`);
  if (!budgetOk) process.exit(1);
} else {
  // Backlog mode (push/dispatch): report per-pattern debt; only a budget
  // breach blocks.
  const byFile = new Set(hits.map((h) => h.file));
  console.log(
    `::warning::design-token legacy backlog: ${hits.length} banned pattern(s) across ${byFile.size} file(s) (target: 0).`
  );
  if (!checkBudget()) process.exit(1);
}
