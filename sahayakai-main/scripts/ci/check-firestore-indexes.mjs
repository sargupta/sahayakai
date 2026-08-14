#!/usr/bin/env node
/**
 * Gate 12: Firestore index drift.
 *
 * Static scan of Firestore query call sites vs firestore.indexes.json, so a
 * query that needs an index the file doesn't declare is caught at PR time —
 * not as a runtime FAILED_PRECONDITION in prod (the fcm_tokens purge and the
 * assessments batch rollup both hit exactly that class of bug).
 *
 * Scanned: src/server/**, src/app/api/**, src/lib/** (.ts only; tests,
 * mocks and .test/.spec files excluded). Comments are stripped before
 * scanning so commented-out queries never count.
 *
 * Two signature kinds:
 *   1. collectionGroup('X')          -> `collectionGroup:X`
 *      Covered when firestore.indexes.json has ANY entry for X with
 *      queryScope COLLECTION_GROUP — a composite index entry or a
 *      fieldOverrides index.
 *   2. Composite chains — a single chained expression with >=2 .where() on
 *      distinct field literals, or .where() + .orderBy() on different
 *      fields -> `composite:<scope>:<collection>:where=a,b:orderBy=c`
 *      Covered when some composite index for that collection has a fieldPath
 *      set that is a SUPERSET of the chain's fields (scope `group` chains
 *      additionally require queryScope COLLECTION_GROUP).
 *
 * RATCHET (same model as Gates 5/9/11): pre-existing unmatched signatures
 * live in scripts/ci/firestore-queries-baseline.json and never block; only
 * NEW unmatched signatures fail. A signature that stops being unmatched
 * prints a ::notice:: to ratchet the baseline down.
 *
 * Per-line escape hatch: a `firestore-index-allow` comment marker on any
 * line of the chain skips that chain (e.g. queries guarded by try/catch
 * fallbacks, or indexes created manually in the console).
 *
 * If BASE_SHA is set and the PR diff touches firestore.indexes.json, a
 * ::warning:: reminds the author that index changes must be DEPLOYED
 * (firebase deploy --only firestore:indexes) to UAT and prod — merging the
 * JSON alone changes nothing.
 *
 * Usage (from sahayakai-main/ or the repo root):
 *   node scripts/ci/check-firestore-indexes.mjs
 *   BASE_SHA=<sha> node scripts/ci/check-firestore-indexes.mjs
 *   node scripts/ci/check-firestore-indexes.mjs --print-unmatched   (seeding)
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '..', '..'); // sahayakai-main/
const BASELINE_PATH = path.join(HERE, 'firestore-queries-baseline.json');
const INDEXES_PATH = path.join(APP_ROOT, 'firestore.indexes.json');
const ALLOW_MARKER = 'firestore-index-allow';
const SCAN_ROOTS = ['src/server', 'src/app/api', 'src/lib'];
const PRINT_UNMATCHED = process.argv.includes('--print-unmatched');

// ---------------------------------------------------------------- files ----

function isExcluded(p) {
  return /(^|\/)__(tests|mocks)__(\/|$)/.test(p) || /\.(test|spec)\.ts$/.test(p);
}

function collectFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__mocks__') continue;
      out.push(...collectFiles(p));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      if (!isExcluded(p)) out.push(p);
    }
  }
  return out;
}

// ------------------------------------------------------------- scanning ----

/**
 * Replace comment bodies with spaces (offsets preserved) so commented-out
 * queries are never scanned. String/template contents are left intact.
 */
function stripComments(src) {
  const out = src.split('');
  let i = 0;
  let state = 'code'; // code | line | block | squote | dquote | template
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c === '/' && next === '*') { state = 'block'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c === "'") state = 'squote';
      else if (c === '"') state = 'dquote';
      else if (c === '`') state = 'template';
      i++;
    } else if (state === 'line') {
      if (c === '\n') state = 'code';
      else out[i] = ' ';
      i++;
    } else if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c !== '\n') out[i] = ' ';
      i++;
    } else { // inside a string/template
      if (c === '\\') { i += 2; continue; }
      if (
        (state === 'squote' && (c === "'" || c === '\n')) ||
        (state === 'dquote' && (c === '"' || c === '\n')) ||
        (state === 'template' && c === '`')
      ) state = 'code';
      i++;
    }
  }
  return out.join('');
}

/** Parse balanced (...) starting at `start` (which must be '('). */
function readParens(src, start) {
  let depth = 0;
  let i = start;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; i++; continue; }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return { args: src.slice(start + 1, i), end: i + 1 };
    }
    i++;
  }
  return null; // unbalanced — bail on this chain
}

function firstStringLiteral(args) {
  const m = args.match(/^\s*['"`]([^'"`\n]+)['"`]/);
  return m ? m[1] : null;
}

/**
 * Firestore indexes are declared per collection ID, so a path-style
 * reference like `groups/${gid}/posts` maps to collection ID `posts`.
 */
function collectionId(name) {
  const segments = name.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? name;
}

/**
 * Extract query chains from one file. A chain starts at
 * .collection('lit') / .collectionGroup('lit') and follows chained
 * `.method(...)` segments. A subsequent .collection() (subcollection via
 * .doc()) resets the accumulated where/orderBy context.
 */
function extractChains(src) {
  const clean = stripComments(src);
  const lines = src.split('\n');
  const lineOf = (idx) => clean.slice(0, idx).split('\n').length; // 1-based
  const chains = [];
  const consumed = [];
  const startRe = /\.(collectionGroup|collection)\s*\(/g;
  let m;
  while ((m = startRe.exec(clean)) !== null) {
    if (consumed.some(([a, b]) => m.index >= a && m.index < b)) continue;
    let chain = null;
    let i = m.index;
    const chainStart = m.index;
    // Walk `.ident(args)` segments from the chain start.
    while (true) {
      const seg = clean.slice(i).match(/^\.\s*([A-Za-z_$][\w$]*)\s*(\()/);
      if (!seg) break;
      const parenAt = i + seg[0].length - 1;
      const parsed = readParens(clean, parenAt);
      if (!parsed) break;
      const method = seg[1];
      const { args } = parsed;
      if (method === 'collection' || method === 'collectionGroup') {
        const name = firstStringLiteral(args);
        if (name) {
          if (chain) chains.push(chain); // flush prior context (subcollection reset)
          chain = {
            collection: collectionId(name),
            scope: method === 'collectionGroup' ? 'group' : 'collection',
            whereFields: new Set(),
            orderByFields: [],
            startLine: lineOf(i),
            endLine: lineOf(parsed.end),
          };
        } else if (chain) {
          chain.endLine = lineOf(parsed.end);
        }
      } else if (chain) {
        if (method === 'where') {
          const f = firstStringLiteral(args);
          if (f) chain.whereFields.add(f);
        } else if (method === 'orderBy') {
          const f = firstStringLiteral(args);
          if (f) chain.orderByFields.push(f);
        }
        chain.endLine = lineOf(parsed.end);
      }
      i = parsed.end;
      // Skip whitespace between segments so `.a()\n  .b()` chains connect.
      while (i < clean.length && /\s/.test(clean[i])) i++;
      if (clean[i] !== '.') break;
    }
    consumed.push([chainStart, i]);
    if (chain) chains.push(chain);
  }
  // Apply the per-line escape marker (checked against ORIGINAL source lines).
  return chains.filter((c) => {
    for (let ln = c.startLine; ln <= c.endLine; ln++) {
      if ((lines[ln - 1] ?? '').includes(ALLOW_MARKER)) return false;
    }
    return true;
  });
}

// ------------------------------------------------------------- indexes -----

const indexesFile = JSON.parse(readFileSync(INDEXES_PATH, 'utf8'));
const compositeIndexes = (indexesFile.indexes ?? []).map((ix) => ({
  collection: ix.collectionGroup,
  scope: ix.queryScope,
  fields: new Set((ix.fields ?? []).map((f) => f.fieldPath)),
}));
const groupScopedCollections = new Set(
  compositeIndexes.filter((ix) => ix.scope === 'COLLECTION_GROUP').map((ix) => ix.collection)
);
for (const ov of indexesFile.fieldOverrides ?? []) {
  if ((ov.indexes ?? []).some((ix) => ix.queryScope === 'COLLECTION_GROUP')) {
    groupScopedCollections.add(ov.collectionGroup);
  }
}

function compositeCovered(chain, fields) {
  return compositeIndexes.some(
    (ix) =>
      ix.collection === chain.collection &&
      (chain.scope !== 'group' || ix.scope === 'COLLECTION_GROUP') &&
      [...fields].every((f) => ix.fields.has(f))
  );
}

// ----------------------------------------------------------------- scan ----

const unmatched = new Map(); // signature -> [file:line, ...]

for (const root of SCAN_ROOTS) {
  for (const file of collectFiles(path.join(APP_ROOT, root))) {
    const rel = path.relative(APP_ROOT, file);
    const src = readFileSync(file, 'utf8');
    if (!src.includes('.collection')) continue;
    for (const chain of extractChains(src)) {
      const at = `${rel}:${chain.startLine}`;
      // (1) collectionGroup name coverage.
      if (chain.scope === 'group' && !groupScopedCollections.has(chain.collection)) {
        const sig = `collectionGroup:${chain.collection}`;
        if (!unmatched.has(sig)) unmatched.set(sig, []);
        unmatched.get(sig).push(at);
      }
      // (2) composite signature coverage.
      const wf = [...chain.whereFields].sort();
      const ob = chain.orderByFields.filter((f) => !chain.whereFields.has(f));
      const isComposite = wf.length >= 2 || (wf.length >= 1 && ob.length >= 1);
      if (!isComposite) continue;
      const fields = new Set([...wf, ...ob]);
      if (!compositeCovered(chain, fields)) {
        const sig =
          `composite:${chain.scope}:${chain.collection}` +
          `:where=${wf.join(',')}` +
          (ob.length ? `:orderBy=${ob.join(',')}` : '');
        if (!unmatched.has(sig)) unmatched.set(sig, []);
        unmatched.get(sig).push(at);
      }
    }
  }
}

// -------------------------------------------------------------- ratchet ----

if (PRINT_UNMATCHED) {
  console.log(JSON.stringify([...unmatched.keys()].sort(), null, 2));
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch (err) {
  console.error(`::error::Gate 12 — cannot read baseline ${BASELINE_PATH}: ${err.message}`);
  process.exit(1);
}
const baselineSigs = new Set(baseline.unmatched ?? []);

const newSigs = [...unmatched.keys()].filter((s) => !baselineSigs.has(s)).sort();
const clearedSigs = [...baselineSigs].filter((s) => !unmatched.has(s)).sort();

console.log(
  `Gate 12 — firestore index drift: ${unmatched.size} unmatched signature(s) ` +
  `(baseline carries ${baselineSigs.size}).`
);

// PR-context warning: firestore.indexes.json changed -> the index must be
// DEPLOYED, not just merged.
const baseSha = process.env.BASE_SHA;
if (baseSha) {
  try {
    const changed = execFileSync(
      'git',
      ['diff', '--name-only', `${baseSha}...HEAD`],
      { cwd: APP_ROOT, encoding: 'utf8' }
    );
    if (changed.split('\n').some((f) => f.endsWith('firestore.indexes.json'))) {
      console.log(
        '::warning::Gate 12 — this PR changes firestore.indexes.json. Merging does NOT create the index: ' +
        'deploy it to UAT and prod (firebase deploy --only firestore:indexes) and wait for the build to finish ' +
        'before shipping code that relies on it.'
      );
    }
  } catch {
    console.log('::warning::Gate 12 — could not diff against BASE_SHA to check firestore.indexes.json changes.');
  }
}

if (newSigs.length > 0) {
  console.error(`::error::Gate 12 — ${newSigs.length} NEW Firestore query signature(s) with no matching index in firestore.indexes.json:`);
  for (const sig of newSigs) {
    console.error(`  ${sig}`);
    for (const loc of unmatched.get(sig)) console.error(`    at ${loc}`);
  }
  console.error(
    'Add the required index to sahayakai-main/firestore.indexes.json (and deploy it), ' +
    `or append a \`// ${ALLOW_MARKER}: <reason>\` comment on the query line if the index exists outside the file.`
  );
  process.exit(1);
}

if (clearedSigs.length > 0) {
  console.log(
    `::notice::Gate 12 — ${clearedSigs.length} baseline signature(s) no longer unmatched: ${clearedSigs.join('; ')}. ` +
    'Ratchet down: remove them from sahayakai-main/scripts/ci/firestore-queries-baseline.json in this PR.'
  );
} else {
  console.log('OK — no new unmatched Firestore query signatures.');
}
