#!/usr/bin/env node
/**
 * score-parity.mjs
 *
 * Parallel-B: parity scoring harness. Compares Genkit baseline responses
 * against ADK-Python sidecar responses for a given agent across all
 * recorded fixture cells.
 *
 * Usage:
 *   node scripts/score-parity.mjs \
 *     --agent lesson-plan \
 *     --genkit-dir qa/baseline-runs/lesson-plan \
 *     --sidecar-dir qa/sidecar-runs/lesson-plan
 *
 * The script works without any sidecar running — it operates purely on
 * recorded JSON files. Phase 2 will run the sidecar to populate
 * --sidecar-dir, then re-run this harness.
 *
 * Outputs:
 *   qa/parity-scores/<agent>.md   — human-readable table
 *   qa/parity-scores/<agent>.json — machine-readable for downstream tools
 *
 * Embedding cache: qa/embedding-cache/<sha256>.json so reruns are fast.
 *
 * Promotion criterion (per cell):
 *   structural=1 AND semantic>=0.85 AND script>=0.90 AND bleed=false
 * Promotion criterion (per agent):
 *   ≥95% of cells pass
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';

// ---------------------------------------------------------------------------
// Unicode script lookup
// ---------------------------------------------------------------------------

/**
 * Unicode block ranges per language. For Latin we restrict to the printable
 * ASCII range — that's what en lesson plans actually emit. The check is
 * "what fraction of letter/script characters fall in the expected block?".
 * Whitespace, digits, and punctuation are ignored so they don't dilute the
 * signal (an English-padded Tamil response should still score 0% native if
 * the substance is in English).
 */
export const SCRIPT_RANGES = {
  en: [[0x0020, 0x007e]],
  hi: [[0x0900, 0x097f]],
  mr: [[0x0900, 0x097f]],
  bn: [[0x0980, 0x09ff]],
  ta: [[0x0b80, 0x0bff]],
  te: [[0x0c00, 0x0c7f]],
  kn: [[0x0c80, 0x0cff]],
  ml: [[0x0d00, 0x0d7f]],
  gu: [[0x0a80, 0x0aff]],
  pa: [[0x0a00, 0x0a7f]],
  or: [[0x0b00, 0x0b7f]],
};

/**
 * Non-Latin Indic scripts we check for cross-bleed. If a Bengali cell has
 * >10% Tamil chars that's a "Pongal-in-Bengali" leak.
 */
const INDIC_SCRIPTS = ['hi', 'bn', 'ta', 'te', 'kn', 'ml', 'gu', 'pa', 'or'];

function isLatinLetter(cp) {
  return (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a);
}

function inRanges(cp, ranges) {
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

/**
 * Fraction of "script-bearing" characters that fall in the expected block
 * for `lang`. Whitespace, ASCII digits, punctuation, and characters outside
 * any known script are excluded from the denominator. For English the
 * denominator is Latin letters only.
 */
export function scriptCoverage(text, lang) {
  if (!text) return { coverage: 0, total: 0, hits: 0 };
  const ranges = SCRIPT_RANGES[lang];
  if (!ranges) throw new Error(`unknown lang: ${lang}`);
  let total = 0;
  let hits = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    // Skip whitespace, control, ASCII digits, ASCII punctuation
    if (cp <= 0x2f) continue;
    if (cp >= 0x3a && cp <= 0x40) continue;
    if (cp >= 0x5b && cp <= 0x60) continue;
    if (cp >= 0x7b && cp <= 0x7f) continue;
    // Is this a script-bearing character?
    let scriptBearing = false;
    if (lang === 'en') {
      if (isLatinLetter(cp)) scriptBearing = true;
    } else {
      // For non-Latin langs the denominator is "any letter-like char"
      // we recognize — either Latin letters or any Indic block.
      if (isLatinLetter(cp)) scriptBearing = true;
      for (const indic of INDIC_SCRIPTS) {
        if (inRanges(cp, SCRIPT_RANGES[indic])) {
          scriptBearing = true;
          break;
        }
      }
    }
    if (!scriptBearing) continue;
    total += 1;
    if (inRanges(cp, ranges)) hits += 1;
  }
  return { coverage: total === 0 ? 0 : hits / total, total, hits };
}

/**
 * Detect mixed-script bleed: characters from a non-expected non-Latin
 * Indic script. Returns {bleed: true, scripts: ['ta'], fraction: 0.18}
 * if >10% of script-bearing chars are in some other Indic block.
 */
export function detectBleed(text, lang) {
  if (!text) return { bleed: false, scripts: [], fraction: 0 };
  const expected = SCRIPT_RANGES[lang];
  const counts = {};
  let total = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x2f) continue;
    if (cp >= 0x3a && cp <= 0x40) continue;
    if (cp >= 0x5b && cp <= 0x60) continue;
    if (cp >= 0x7b && cp <= 0x7f) continue;
    let isScript = false;
    if (isLatinLetter(cp)) isScript = true;
    for (const indic of INDIC_SCRIPTS) {
      if (inRanges(cp, SCRIPT_RANGES[indic])) {
        isScript = true;
        break;
      }
    }
    if (!isScript) continue;
    total += 1;
    // Already in expected? skip
    if (expected && inRanges(cp, expected)) continue;
    // Otherwise: which script does this char belong to?
    for (const indic of INDIC_SCRIPTS) {
      if (indic === lang || (lang === 'mr' && indic === 'hi')) continue;
      if (inRanges(cp, SCRIPT_RANGES[indic])) {
        counts[indic] = (counts[indic] || 0) + 1;
        break;
      }
    }
  }
  if (total === 0) return { bleed: false, scripts: [], fraction: 0 };
  const offenders = [];
  let maxFraction = 0;
  for (const [script, n] of Object.entries(counts)) {
    const f = n / total;
    if (f > 0.10) offenders.push(script);
    if (f > maxFraction) maxFraction = f;
  }
  return { bleed: offenders.length > 0, scripts: offenders, fraction: maxFraction };
}

// ---------------------------------------------------------------------------
// Field traversal
// ---------------------------------------------------------------------------

/**
 * Walks an object and yields { path, value } for every string-valued leaf.
 * Path uses dot/bracket notation: e.g. `objectives[0]`, `keyVocabulary[2].term`.
 */
export function* walkStrings(node, prefix = '') {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    if (node.trim().length > 0) yield { path: prefix || '$', value: node };
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      yield* walkStrings(node[i], `${prefix}[${i}]`);
    }
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const childPath = prefix ? `${prefix}.${k}` : k;
      yield* walkStrings(v, childPath);
    }
  }
}

/**
 * Resolve a path string back to a value inside an object. Returns
 * undefined if any step is missing. Mirrors the path format emitted by
 * walkStrings so we can match Genkit field paths against sidecar fields.
 */
export function getByPath(obj, p) {
  if (p === '$') return typeof obj === 'string' ? obj : undefined;
  const tokens = [];
  let i = 0;
  while (i < p.length) {
    if (p[i] === '.') { i++; continue; }
    if (p[i] === '[') {
      const close = p.indexOf(']', i);
      tokens.push(Number(p.slice(i + 1, close)));
      i = close + 1;
    } else {
      let j = i;
      while (j < p.length && p[j] !== '.' && p[j] !== '[') j++;
      tokens.push(p.slice(i, j));
      i = j;
    }
  }
  let cur = obj;
  for (const t of tokens) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[t];
  }
  return cur;
}

// ---------------------------------------------------------------------------
// Embeddings + cosine
// ---------------------------------------------------------------------------

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

/**
 * Returns an embedder. If `apiKey` is provided, calls Gemini
 * text-embedding-004 via @google/genai. Otherwise returns a deterministic
 * mock embedder so the harness still runs offline / in CI.
 *
 * The mock embedder is *not* semantic — it hashes the text — so semantic
 * scores from a mock run are only meaningful when the texts are byte-equal
 * (cosine=1) or random (cosine≈0). Real runs require GEMINI_API_KEY.
 */
export async function makeEmbedder({ apiKey, cacheDir, mock = false } = {}) {
  await fs.promises.mkdir(cacheDir, { recursive: true });

  if (mock || !apiKey) {
    return async function mockEmbed(text) {
      const h = sha256(text);
      // 32-dim deterministic "embedding" derived from the hash.
      const v = new Array(32);
      for (let i = 0; i < 32; i++) {
        const byte = parseInt(h.slice(i * 2, i * 2 + 2), 16);
        v[i] = (byte - 128) / 128;
      }
      return v;
    };
  }

  // Lazy import — keeps the script runnable in environments without
  // @google/genai installed (e.g. some CI shapes).
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  return async function geminiEmbed(text) {
    const key = sha256(`text-embedding-004:${text}`);
    const cachePath = path.join(cacheDir, `${key}.json`);
    try {
      const cached = await fs.promises.readFile(cachePath, 'utf8');
      return JSON.parse(cached);
    } catch { /* miss */ }
    const res = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });
    const vec = res.embeddings?.[0]?.values || [];
    await fs.promises.writeFile(cachePath, JSON.stringify(vec));
    return vec;
  };
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

export function makeValidator(schemaJson) {
  // Schemas are emitted by dump-zod-schemas.mjs as
  //   { "$ref": "#/definitions/Foo", "definitions": { Foo: {...} } }
  // wrapped under .output. Unwrap when needed.
  const schema = schemaJson.output ?? schemaJson;
  const ajv = new Ajv({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

// ---------------------------------------------------------------------------
// Primary-text field lookup (for native-script + bleed checks)
// ---------------------------------------------------------------------------

/**
 * Per-agent primary text field used for script+bleed checks. Field names
 * are dot/bracket paths matching walkStrings output. For paths that
 * include an array, we concatenate every match.
 */
export const PRIMARY_TEXT_FIELDS = {
  'lesson-plan': ['mainContent', 'title', 'objectives'],
  'quiz': ['questions[*].question', 'questions[*].options[*]'],
  'exam-paper': ['sections[*].questions[*].question'],
  'worksheet': ['sections[*].content'],
  'rubric': ['criteria[*].description'],
  'instant-answer': ['answer'],
  'visual-aid': ['title', 'description'],
  'assessment-scanner': ['feedback'],
  'assignment-assessor': ['feedback'],
  'parent-message': ['message'],
  'parent-call': ['script'],
  'community-persona-message': ['message'],
  'teacher-training': ['content'],
  'video-storyteller': ['narrative'],
  'virtual-field-trip': ['narrative'],
  'voice-to-text': ['transcript'],
  'vidya': ['response'],
  'avatar-generator': ['prompt'],
};

/**
 * Pull all primary-text values from a response object, matching the
 * agent's PRIMARY_TEXT_FIELDS spec. `[*]` means "every element of this
 * array". Returns concatenated string for script/bleed analysis.
 */
export function extractPrimaryText(obj, agent) {
  const specs = PRIMARY_TEXT_FIELDS[agent] || [];
  const out = [];
  for (const spec of specs) {
    collectByPattern(obj, spec.split('.'), 0, out);
  }
  return out.join('\n');
}

function collectByPattern(node, tokens, idx, out) {
  if (node === null || node === undefined) return;
  if (idx >= tokens.length) {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) {
      // Terminal array: dump all string-valued elements.
      for (const el of node) {
        if (typeof el === 'string') out.push(el);
      }
    }
    return;
  }
  const tok = tokens[idx];
  // Handle "name[*]" — split into "name" then "*"
  const bracketIdx = tok.indexOf('[');
  if (bracketIdx > 0) {
    const name = tok.slice(0, bracketIdx);
    const rest = tok.slice(bracketIdx); // "[*]" or "[0]"
    if (typeof node === 'object' && !Array.isArray(node)) {
      collectByPattern(node[name], [rest, ...tokens.slice(idx + 1)], 0, out);
    }
    return;
  }
  if (tok === '[*]') {
    if (Array.isArray(node)) {
      for (const el of node) {
        collectByPattern(el, tokens, idx + 1, out);
      }
    }
    return;
  }
  if (typeof node === 'object' && !Array.isArray(node)) {
    collectByPattern(node[tok], tokens, idx + 1, out);
  }
}

// ---------------------------------------------------------------------------
// Per-cell scoring
// ---------------------------------------------------------------------------

/**
 * Score one cell (one matched filename in both dirs).
 *
 * Returns:
 *   {
 *     cell, lang,
 *     structural: 0|1,
 *     structuralErrors: [],
 *     semantic: number,           // mean cosine across matched string fields
 *     semanticFields: number,     // how many fields contributed
 *     script: number,             // native-script coverage 0..1
 *     bleed: boolean,
 *     bleedScripts: string[],
 *     verdict: 'PASS' | 'FAIL',
 *     failReasons: string[],
 *   }
 */
export async function scoreCell({
  cell,
  lang,
  agent,
  genkitResponse,
  sidecarResponse,
  validator,
  embed,
}) {
  const out = {
    cell,
    lang,
    structural: 0,
    structuralErrors: [],
    semantic: 0,
    semanticFields: 0,
    script: 0,
    bleed: false,
    bleedScripts: [],
    verdict: 'FAIL',
    failReasons: [],
  };

  // (1) Structural validity of the sidecar response against baseline schema.
  if (validator) {
    const ok = validator(sidecarResponse);
    out.structural = ok ? 1 : 0;
    if (!ok) {
      out.structuralErrors = (validator.errors || []).map(
        (e) => `${e.instancePath || '/'} ${e.message}`,
      );
      out.failReasons.push('structural');
    }
  } else {
    out.structural = 1; // no schema = skip the check
  }

  // (2) Field-by-field semantic similarity.
  const sims = [];
  for (const { path: p, value: gv } of walkStrings(genkitResponse)) {
    const sv = getByPath(sidecarResponse, p);
    if (typeof sv !== 'string' || sv.trim().length === 0) {
      sims.push(0); // missing field => zero similarity
      continue;
    }
    if (gv === sv) {
      sims.push(1);
      continue;
    }
    const [ga, sa] = await Promise.all([embed(gv), embed(sv)]);
    sims.push(cosine(ga, sa));
  }
  out.semanticFields = sims.length;
  out.semantic = sims.length === 0 ? 0 : sims.reduce((a, b) => a + b, 0) / sims.length;
  if (out.semantic < 0.85) out.failReasons.push('semantic');

  // (3) Native-script coverage on primary text.
  const primary = extractPrimaryText(sidecarResponse, agent);
  const { coverage } = scriptCoverage(primary, lang);
  out.script = coverage;
  if (coverage < 0.90) out.failReasons.push('script');

  // (4) Mixed-script bleed.
  const bleed = detectBleed(primary, lang);
  out.bleed = bleed.bleed;
  out.bleedScripts = bleed.scripts;
  if (bleed.bleed) out.failReasons.push('bleed');

  out.verdict = out.failReasons.length === 0 ? 'PASS' : 'FAIL';
  return out;
}

// ---------------------------------------------------------------------------
// Cell metadata
// ---------------------------------------------------------------------------

/**
 * Derive language code from a fixture filename. Convention:
 *   <agent>__<lang>__<rest>.json  e.g. lesson-plan__bn__class5-water.json
 *   <agent>-<lang>-<rest>.json
 * Falls back to 'en' if no recognized code is found. We accept any
 * code present in SCRIPT_RANGES.
 */
export function langFromFilename(name) {
  const stem = name.replace(/\.json$/, '');
  const parts = stem.split(/__|-/);
  for (const p of parts) {
    if (SCRIPT_RANGES[p]) return p;
  }
  return 'en';
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) { args[key] = true; }
      else { args[key] = next; i++; }
    }
  }
  return args;
}

async function readJson(p) {
  return JSON.parse(await fs.promises.readFile(p, 'utf8'));
}

async function tryReadJson(p) {
  try { return await readJson(p); } catch { return null; }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const agent = args.agent;
  const genkitDir = args['genkit-dir'];
  const sidecarDir = args['sidecar-dir'];
  if (!agent || !genkitDir || !sidecarDir) {
    console.error('Usage: score-parity.mjs --agent <name> --genkit-dir <path> --sidecar-dir <path>');
    process.exit(2);
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const schemaPath = path.join(repoRoot, 'qa', 'baseline-schemas', `${agent}.json`);
  const schemaJson = await tryReadJson(schemaPath);
  const validator = schemaJson ? makeValidator(schemaJson) : null;
  if (!schemaJson) {
    console.warn(`[warn] no schema at ${schemaPath} — skipping structural check`);
  }

  const cacheDir = path.join(repoRoot, 'qa', 'embedding-cache');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const embed = await makeEmbedder({
    apiKey,
    cacheDir,
    mock: !apiKey || args['mock-embed'],
  });
  if (!apiKey) {
    console.warn('[warn] no GEMINI_API_KEY — using mock embedder. Semantic scores will be meaningless except for byte-identical text.');
  }

  const genkitFiles = (await fs.promises.readdir(genkitDir)).filter((f) => f.endsWith('.json'));
  const sidecarFiles = new Set(
    (await fs.promises.readdir(sidecarDir)).filter((f) => f.endsWith('.json')),
  );
  const cells = genkitFiles.filter((f) => sidecarFiles.has(f));

  const results = [];
  for (const file of cells) {
    const genkit = await readJson(path.join(genkitDir, file));
    const sidecar = await readJson(path.join(sidecarDir, file));
    const lang = langFromFilename(file);
    const row = await scoreCell({
      cell: file,
      lang,
      agent,
      genkitResponse: genkit,
      sidecarResponse: sidecar,
      validator,
      embed,
    });
    results.push(row);
  }

  const passing = results.filter((r) => r.verdict === 'PASS').length;
  const total = results.length;
  const passRate = total === 0 ? 0 : passing / total;
  const ready = passRate >= 0.95;

  const outDir = path.join(repoRoot, 'qa', 'parity-scores');
  await fs.promises.mkdir(outDir, { recursive: true });

  const md = renderMarkdown({ agent, results, passRate, ready });
  await fs.promises.writeFile(path.join(outDir, `${agent}.md`), md);
  await fs.promises.writeFile(
    path.join(outDir, `${agent}.json`),
    JSON.stringify({ agent, passRate, ready, results }, null, 2),
  );

  console.log(`[score-parity] agent=${agent} cells=${total} pass=${passing} rate=${(passRate * 100).toFixed(1)}% ready=${ready}`);
  if (!ready) {
    const failing = results.filter((r) => r.verdict !== 'PASS');
    for (const r of failing) {
      console.log(`  FAIL ${r.cell} reasons=${r.failReasons.join(',')}`);
    }
  }
  process.exit(ready ? 0 : 1);
}

function renderMarkdown({ agent, results, passRate, ready }) {
  const lines = [];
  lines.push(`# Parity scores — ${agent}`);
  lines.push('');
  lines.push(`- Cells scored: ${results.length}`);
  lines.push(`- Pass rate: ${(passRate * 100).toFixed(1)}%`);
  lines.push(`- Canary-ready: ${ready ? 'YES' : 'NO'}`);
  lines.push('');
  lines.push('| Cell | Lang | Structural | Semantic | Script | Bleed | Verdict |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of results) {
    const semantic = r.semantic.toFixed(3);
    const script = (r.script * 100).toFixed(1) + '%';
    const bleed = r.bleed ? `YES (${r.bleedScripts.join(',')})` : 'no';
    lines.push(`| ${r.cell} | ${r.lang} | ${r.structural ? '1' : '0'} | ${semantic} | ${script} | ${bleed} | ${r.verdict} |`);
  }
  const failing = results.filter((r) => r.verdict !== 'PASS');
  if (failing.length > 0) {
    lines.push('');
    lines.push('## Failures');
    for (const r of failing) {
      lines.push(`- **${r.cell}** — ${r.failReasons.join(', ')}${r.structuralErrors.length ? `\n  - schema: ${r.structuralErrors.slice(0, 3).join('; ')}` : ''}`);
    }
  }
  return lines.join('\n') + '\n';
}

// Only run main when invoked as a script, not when imported by tests.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
