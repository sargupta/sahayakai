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
 *
 * Escape hatch: a line containing `design-token-allow` is skipped
 * (e.g. Next's metadata themeColor, which requires a literal hex).
 *
 * Usage:
 *   BASE_SHA=<sha|ref> node scripts/ci/check-design-tokens.mjs
 *     -> scans files changed since BASE_SHA; exits 1 on any hit.
 *   node scripts/ci/check-design-tokens.mjs   (no BASE_SHA)
 *     -> full-repo backlog report; always exits 0 (warn-only).
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
if (baseSha) {
  files = git(['diff', '--name-only', `${baseSha}...HEAD`], { cwd: repoRoot })
    .split('\n')
    .filter(Boolean)
    .filter(isTarget);
  if (files.length === 0) {
    console.log('OK — no relevant .tsx files changed.');
    process.exit(0);
  }
} else {
  files = git(['ls-files', `${appPrefix}src/**/*.tsx`], { cwd: repoRoot })
    .split('\n')
    .filter(Boolean)
    .filter(isTarget);
}

const hits = files.flatMap(scanFile);

if (baseSha) {
  if (hits.length > 0) {
    console.error(
      `::error::Gate 11 — ${hits.length} banned design-token pattern(s) in files this change touches:`
    );
    for (const h of hits) {
      console.error(`  ${h.file}:${h.line}  [${h.rule}]  "${h.match}"`);
    }
    console.error(
      'Use tokens (globals.css vars / tailwind.config.ts classes), or append `design-token-allow` with a justification for true literals.'
    );
    process.exit(1);
  }
  console.log(`OK — ${files.length} changed .tsx file(s), no banned design-token patterns.`);
} else {
  // Backlog mode (push/dispatch): report, never block.
  const byFile = new Set(hits.map((h) => h.file));
  console.log(
    `::warning::design-token legacy backlog: ${hits.length} banned pattern(s) across ${byFile.size} file(s) (target: 0).`
  );
}
