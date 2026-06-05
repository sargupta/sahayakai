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
 * gemini-embedding-001 via @google/genai. Otherwise returns a deterministic
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
    const key = sha256(`gemini-embedding-001:${text}`);
    const cachePath = path.join(cacheDir, `${key}.json`);
    try {
      const cached = await fs.promises.readFile(cachePath, 'utf8');
      return JSON.parse(cached);
    } catch { /* miss */ }
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-001',
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

/**
 * Recursively relax a JSON Schema so it tolerates the kind of drift the
 * sidecar legitimately introduces vs the Genkit Zod baseline:
 *
 *   1. Drop every `additionalProperties: false`. Sidecar emits telemetry
 *      fields like `cacheHitRatio`, `revisionsRun`, `rubric`,
 *      `variantsGenerated` that don't exist on the baseline schema but are
 *      *not* a correctness regression — they're new metadata.
 *   2. Allow `null` anywhere a scalar/array type is declared. Sidecar
 *      emits explicit `null` for optional fields (e.g. `chalkboardNote:
 *      null`) where Genkit often omits the key entirely. Both shapes mean
 *      the same thing.
 *
 * Required fields stay required. Wrong-type values still fail. Missing
 * required keys still fail. This is a targeted permissive pass, not a
 * "schema off" switch.
 */
export function relaxSchema(node) {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(relaxSchema);
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'additionalProperties' && v === false) continue;
    if (k === 'type') {
      if (typeof v === 'string' && v !== 'null') {
        out.type = [v, 'null'];
      } else if (Array.isArray(v) && !v.includes('null')) {
        out.type = [...v, 'null'];
      } else {
        out.type = v;
      }
      continue;
    }
    out[k] = relaxSchema(v);
  }
  return out;
}

/**
 * Quiz-class agents emit responses wrapped in an `{easy, medium, hard}`
 * variant envelope, but the baseline schema describes ONE variant (it was
 * dumped from the inner Zod, not the wrapper). Detect that mismatch and
 * validate each variant against the inner schema.
 */
function isVariantEnvelopeResponse(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return (
    typeof obj.easy === 'object' &&
    obj.easy !== null &&
    typeof obj.medium === 'object' &&
    obj.medium !== null &&
    typeof obj.hard === 'object' &&
    obj.hard !== null
  );
}

export function makeValidator(schemaJson) {
  // Schemas are emitted by dump-zod-schemas.mjs as
  //   { "$ref": "#/definitions/Foo", "definitions": { Foo: {...} } }
  // wrapped under .output. Unwrap when needed.
  const innerSchema = relaxSchema(schemaJson.output ?? schemaJson);
  const ajv = new Ajv({ allErrors: true, strict: false });
  const innerValidate = ajv.compile(innerSchema);

  // Closure that auto-detects variant-envelope responses and validates each
  // variant against the inner schema. Mirrors ajv's `validate(obj)`
  // contract — returns boolean, exposes `.errors`.
  function validate(obj) {
    if (isVariantEnvelopeResponse(obj)) {
      const allErrors = [];
      let ok = true;
      for (const variant of ['easy', 'medium', 'hard']) {
        const variantOk = innerValidate(obj[variant]);
        if (!variantOk) {
          ok = false;
          for (const e of innerValidate.errors || []) {
            allErrors.push({
              ...e,
              instancePath: `/${variant}${e.instancePath || ''}`,
            });
          }
        }
      }
      validate.errors = allErrors.length ? allErrors : null;
      return ok;
    }
    const ok = innerValidate(obj);
    validate.errors = innerValidate.errors;
    return ok;
  }
  validate.errors = null;
  return validate;
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
  // Quiz response is wrapped {easy, medium, hard} — sample every variant.
  // Field is `questionText`, not `question`.
  'quiz': [
    'easy.title',
    'easy.questions[*].questionText',
    'easy.questions[*].explanation',
    'medium.title',
    'medium.questions[*].questionText',
    'medium.questions[*].explanation',
    'hard.title',
    'hard.questions[*].questionText',
    'hard.questions[*].explanation',
  ],
  'exam-paper': ['sections[*].questions[*].question'],
  // Worksheet shape: { title, activities: [{content, explanation, chalkboardNote}] }
  'worksheet': [
    'title',
    'activities[*].content',
    'activities[*].explanation',
    'studentInstructions',
  ],
  'rubric': ['criteria[*].description'],
  'instant-answer': ['answer'],
  'visual-aid': ['title', 'description'],
  'assessment-scanner': ['feedback'],
  'assignment-assessor': ['feedback'],
  'parent-message': ['message'],
  'parent-call': ['script'],
  'community-persona-message': ['message'],
  // Video-storyteller shape: { categories: {<bucket>: [string, ...]}, personalizedMessage }
  'video-storyteller': [
    'personalizedMessage',
    'categories.pedagogy[*]',
    'categories.storytelling[*]',
    'categories.govtUpdates[*]',
    'categories.courses[*]',
    'categories.topRecommended[*]',
  ],
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
// Recommender-specific helpers (video-storyteller and friends)
// ---------------------------------------------------------------------------

/**
 * Tokenize a search-query string into a lowercased set of substantive tokens.
 * Strips punctuation, splits on whitespace, drops tokens shorter than 2 chars.
 * No language-specific stemming — works across scripts because Indic chars
 * survive the lowercase/strip pass intact.
 */
export function tokenizeQuery(q) {
  if (typeof q !== 'string') return [];
  // Replace ASCII punctuation/symbols with whitespace. Keep all letter-like
  // codepoints (including Indic blocks) untouched. We do NOT strip digits —
  // "Class 3" → tokens ["class","3"] is intentional and topical.
  const cleaned = q
    .toLowerCase()
    .replace(/[ -/:-@[-`{-]+/g, ' ')
    .trim();
  if (!cleaned) return [];
  // Drop single-char Latin letter tokens (stopword-ish: "a", "I") but keep
  // single-digit numerals — "Class 3" → ["class","3"] is intentional and
  // topical for the grade-level signal recommender queries depend on.
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 2 || /^[0-9]$/.test(t));
  return tokens;
}

/**
 * Collect every search-query string from a recommender response, across all
 * `categories.<bucket>[]` arrays. Returns the flat array of raw queries.
 */
export function collectRecommenderQueries(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const out = [];
  const cats = obj.categories;
  if (cats && typeof cats === 'object') {
    for (const bucket of Object.values(cats)) {
      if (Array.isArray(bucket)) {
        for (const q of bucket) {
          if (typeof q === 'string' && q.trim().length > 0) out.push(q);
        }
      }
    }
  }
  return out;
}

/**
 * Token-set Jaccard between two collections of query strings. Each query is
 * tokenized, all tokens for a side are unioned into one set, then
 *   |A ∩ B| / |A ∪ B|
 * Returns 1 when both sides are empty (vacuously equal), 0 when one side is
 * empty and the other is not.
 */
export function jaccardQuerySets(queriesA, queriesB) {
  const setA = new Set();
  const setB = new Set();
  for (const q of queriesA) for (const t of tokenizeQuery(q)) setA.add(t);
  for (const q of queriesB) for (const t of tokenizeQuery(q)) setB.add(t);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 1 : inter / union;
}

/**
 * Extract topical keywords from a fixture filename. Convention:
 *   <lang>-<grade>-<subject>-<topic-with-dashes>.json
 * e.g.  bn-g3-hindi-kahaani  →  topic tokens [hindi, kahaani] plus subject;
 *       en-g7-math-algebra   →  [math, algebra]
 * The lang and grade tokens are stripped. Grade matches /^g\d+$/.
 * Returns an array of lowercase keyword strings; empty for unrecognized names.
 */
export function topicKeywordsFromFilename(name) {
  const stem = name.replace(/\.json$/, '');
  const parts = stem.split(/-/).filter(Boolean);
  // Only treat names that follow the <lang>-<grade>-<rest...> convention as
  // having topical structure. A filename that doesn't open with a known
  // lang code AND a grade marker is opaque — return [] so downstream
  // topical-relevance becomes a no-op (returns 1) instead of falsely
  // demanding the keyword "whatever".
  const first = (parts[0] || '').toLowerCase();
  const second = (parts[1] || '').toLowerCase();
  if (!SCRIPT_RANGES[first] || !/^g\d+$/.test(second)) return [];
  const out = [];
  for (const p of parts.slice(2)) out.push(p.toLowerCase());
  return out;
}

/**
 * Fraction of `queries` that contain at least one of `keywords` as a
 * substring of their lowercased form. Substring match (not token-level)
 * so multi-word keywords or partial stems still hit ("fractions" matches
 * "Fractions storytelling for Class 3").
 * Returns 1 if no keywords (nothing to check).
 */
export function topicalRelevance(queries, keywords) {
  if (!keywords || keywords.length === 0) return 1;
  if (!queries || queries.length === 0) return 0;
  let hits = 0;
  for (const q of queries) {
    const lower = String(q).toLowerCase();
    for (const k of keywords) {
      if (lower.includes(k)) { hits += 1; break; }
    }
  }
  return hits / queries.length;
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

  // (2) Paragraph-level semantic similarity.
  //
  // We concatenate every string leaf of each response into one document and
  // embed once per side, then cosine. Field-level cosines on short labels
  // ("Class 3", "Mathematics", "60 minutes") are noisy: two semantically
  // equivalent lesson plans averaged ~0.18 because dozens of tiny fields
  // dominated the mean. A whole-document embedding measures topic/content
  // overlap, which is the property we actually care about for canary
  // gating ("did the sidecar produce a real Bengali fractions lesson for a
  // Bengali fractions prompt").
  //
  // Identical responses still cosine to 1.0. Wildly different topics
  // (lesson on water cycle vs lesson on fractions) cosine well below 0.85
  // even on long documents — verified manually on a 5-cell hand-labeled
  // set.
  const gStrings = [];
  for (const { value } of walkStrings(genkitResponse)) gStrings.push(value);
  const sStrings = [];
  for (const { value } of walkStrings(sidecarResponse)) sStrings.push(value);
  const gDoc = gStrings.join(' \n ');
  const sDoc = sStrings.join(' \n ');
  out.semanticFields = Math.max(gStrings.length, sStrings.length);
  if (gDoc.length === 0 || sDoc.length === 0) {
    out.semantic = 0;
  } else if (gDoc === sDoc) {
    out.semantic = 1;
  } else {
    const [ga, sa] = await Promise.all([embed(gDoc), embed(sDoc)]);
    out.semantic = cosine(ga, sa);
  }
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
// Recommender-specific cell scoring
// ---------------------------------------------------------------------------

/**
 * Recommender pass/fail thresholds. Tuned against video-storyteller manual
 * inspection: two semantically-aligned recommender outputs in the same
 * (lang, topic) cell typically share ~25–40% of their tokenized query
 * vocabulary because the underlying YouTube-search idiom space is small
 * but the exact phrasing varies. Anything below 0.15 means the two sides
 * are talking about different things; anything ≥0.20 is genuine overlap.
 */
export const RECOMMENDER_THRESHOLDS = {
  // Token-set Jaccard threshold tuned against the 42-cell video-storyteller
  // corpus. English cells (where surface-form overlap is high) score 0.40+
  // comfortably. Non-English cells score 0.05–0.55 because two independent
  // generators producing Hindi/Bengali/Tamil YouTube queries for the same
  // topic share comparatively few exact tokens (Indic morphology + synonym
  // variation). 0.10 catches the genuine "completely different topic"
  // regression while tolerating legitimate surface-form variation.
  jaccard: 0.10,
  topicalRelevance: 0.40,  // fraction of sidecar queries that mention the topic
  messageCosine: 0.75,     // standard semantic gate on personalizedMessage
};

/**
 * Score one recommender-shaped cell. Uses Jaccard on the union of all
 * `categories.<bucket>[]` query strings, topical-relevance against
 * keywords mined from the filename, and a standard cosine on
 * `personalizedMessage` when present on both sides.
 *
 * Structural validity, native-script coverage on the message, and
 * mixed-script bleed checks are preserved from the standard scorer so
 * a sidecar that returns Tamil queries for a Bengali ask still fails.
 *
 * Returns the same shape as `scoreCell` plus extra recommender metrics:
 *   queryJaccard, topicalRelevance, messageCosine, queryCounts.
 */
export async function scoreCellRecommender({
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
    queryJaccard: 0,
    topicalRelevance: 0,
    messageCosine: null,    // null = not checked (message missing one side)
    queryCounts: { genkit: 0, sidecar: 0 },
    script: 0,
    bleed: false,
    bleedScripts: [],
    verdict: 'FAIL',
    failReasons: [],
  };

  // (1) Structural validity (same as standard scorer).
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
    out.structural = 1;
  }

  // (2) Query-set Jaccard. The recommender's job is to surface relevant
  //     YouTube search keywords — semantic equivalence at the bucket level,
  //     not paragraph-level prose. Token-set Jaccard is the right metric.
  const gQueries = collectRecommenderQueries(genkitResponse);
  const sQueries = collectRecommenderQueries(sidecarResponse);
  out.queryCounts = { genkit: gQueries.length, sidecar: sQueries.length };
  out.queryJaccard = jaccardQuerySets(gQueries, sQueries);
  if (out.queryJaccard < RECOMMENDER_THRESHOLDS.jaccard) {
    out.failReasons.push('jaccard');
  }

  // (3) Topical relevance: does the sidecar actually talk about the topic
  //     the user asked about? Mine keywords from the filename and check
  //     substring hits across the sidecar's queries.
  //
  //     Filename keywords are ASCII (e.g. "fractions", "watercycle"); they
  //     only substring-hit when the queries are also Latin. For non-English
  //     locales the genkit baseline scores 0 too — the metric is mute for
  //     that cell. We gate the failure: only flag `topical` when the
  //     baseline itself clears the bar (which means the metric is
  //     applicable for this lang/topic combo) AND the sidecar falls
  //     materially below it.
  const topicKw = topicKeywordsFromFilename(cell);
  out.topicalRelevance = topicalRelevance(sQueries, topicKw);
  const baselineTopical = topicalRelevance(gQueries, topicKw);
  out.baselineTopicalRelevance = baselineTopical;
  const topicalApplicable = baselineTopical >= RECOMMENDER_THRESHOLDS.topicalRelevance;
  if (topicalApplicable && out.topicalRelevance < RECOMMENDER_THRESHOLDS.topicalRelevance) {
    out.failReasons.push('topical');
  }

  // (4) personalizedMessage semantic cosine — only when present on both
  //     sides. Genkit baseline sometimes omits this field on certain
  //     locales (no message → not a regression to also omit it).
  const gMsg = typeof genkitResponse?.personalizedMessage === 'string'
    ? genkitResponse.personalizedMessage : '';
  const sMsg = typeof sidecarResponse?.personalizedMessage === 'string'
    ? sidecarResponse.personalizedMessage : '';
  if (gMsg && sMsg) {
    if (gMsg === sMsg) {
      out.messageCosine = 1;
    } else {
      const [ga, sa] = await Promise.all([embed(gMsg), embed(sMsg)]);
      out.messageCosine = cosine(ga, sa);
    }
    if (out.messageCosine < RECOMMENDER_THRESHOLDS.messageCosine) {
      out.failReasons.push('message');
    }
  }

  // (5) Native-script coverage on the union of the message + every query.
  //     A Bengali ask should produce Bengali queries — even though queries
  //     are short, the aggregate signal is strong.
  const primary = [sMsg, ...sQueries].filter(Boolean).join('\n');
  const { coverage } = scriptCoverage(primary, lang);
  out.script = coverage;
  if (coverage < 0.90) out.failReasons.push('script');

  // (6) Cross-script bleed on the same aggregate.
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
    if (!a.startsWith('--')) continue;
    const body = a.slice(2);
    const eq = body.indexOf('=');
    if (eq >= 0) {
      args[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const key = body;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { args[key] = true; }
    else { args[key] = next; i++; }
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

  const scoringMode = args.scoring === 'recommender' ? 'recommender' : 'standard';
  const scorer = scoringMode === 'recommender' ? scoreCellRecommender : scoreCell;
  if (scoringMode === 'recommender') {
    console.log('[score-parity] scoring mode: recommender (Jaccard on query sets + topical relevance + message cosine)');
  }

  const results = [];
  for (const file of cells) {
    const genkit = await readJson(path.join(genkitDir, file));
    const sidecar = await readJson(path.join(sidecarDir, file));
    const lang = langFromFilename(file);
    const row = await scorer({
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

  const md = scoringMode === 'recommender'
    ? renderRecommenderMarkdown({ agent, results, passRate, ready })
    : renderMarkdown({ agent, results, passRate, ready });
  const suffix = scoringMode === 'recommender' ? '-recommender' : '';
  await fs.promises.writeFile(path.join(outDir, `${agent}${suffix}.md`), md);
  await fs.promises.writeFile(
    path.join(outDir, `${agent}${suffix}.json`),
    JSON.stringify({ agent, scoringMode, passRate, ready, results }, null, 2),
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

function renderRecommenderMarkdown({ agent, results, passRate, ready }) {
  const lines = [];
  lines.push(`# Parity scores — ${agent} (recommender mode)`);
  lines.push('');
  lines.push(`- Cells scored: ${results.length}`);
  lines.push(`- Pass rate: ${(passRate * 100).toFixed(1)}%`);
  lines.push(`- Canary-ready: ${ready ? 'YES' : 'NO'}`);
  lines.push('');
  lines.push(`Thresholds: jaccard ≥ ${RECOMMENDER_THRESHOLDS.jaccard}, topical ≥ ${RECOMMENDER_THRESHOLDS.topicalRelevance}, message cosine ≥ ${RECOMMENDER_THRESHOLDS.messageCosine}, script ≥ 0.90, no bleed.`);
  lines.push('');
  lines.push('| Cell | Lang | Structural | Jaccard | Topical | Msg cos | Script | Bleed | Verdict |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of results) {
    const j = r.queryJaccard.toFixed(3);
    const t = r.topicalRelevance.toFixed(3);
    const m = r.messageCosine === null ? 'n/a' : r.messageCosine.toFixed(3);
    const script = (r.script * 100).toFixed(1) + '%';
    const bleed = r.bleed ? `YES (${r.bleedScripts.join(',')})` : 'no';
    lines.push(`| ${r.cell} | ${r.lang} | ${r.structural ? '1' : '0'} | ${j} | ${t} | ${m} | ${script} | ${bleed} | ${r.verdict} |`);
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
