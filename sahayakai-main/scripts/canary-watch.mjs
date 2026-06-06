#!/usr/bin/env node
/**
 * canary-watch.mjs — Track 5 long-running canary monitor.
 *
 * Watches feature-flagged ADK sidecar agents while traffic is at canary
 * (any %). Polls `agent_shadow_diffs/{date}/{agent}/...` every poll-interval,
 * computes per-agent gates (5xx rate / latency ratio / semantic drift),
 * prints a rolling 5-minute summary, and emits a final GO/NO-GO per agent.
 *
 * Pure observation: NEVER touches `system_config/feature_flags`, NEVER
 * deploys, NEVER mutates traffic. If a gate trips, the human flips the
 * flag back — this monitor only signals.
 *
 * Usage:
 *   node scripts/canary-watch.mjs \
 *     --mode=preview \
 *     --agents=lessonPlan,quiz \
 *     --duration=30m \
 *     --poll-interval=60s \
 *     --max-error-rate=0.05 \
 *     --max-latency-multiplier=1.3 \
 *     --max-semantic-drift=0.10
 *
 * Auth:
 *   gcloud auth application-default login \
 *     --impersonate-service-account=firebase-adminsdk-fbsvc@sahayakai-b4248.iam.gserviceaccount.com
 *   (or set GOOGLE_APPLICATION_CREDENTIALS to a SA key)
 *
 * Output:
 *   - Live console summary every 5 minutes
 *   - Final markdown report → qa/results/canary-watch/<ISO>.md
 *
 * Tests:
 *   src/__tests__/scripts/canary-watch.test.ts covers the pure gate logic
 *   (evaluateGates / quantile / cosine) without Firestore or Cloud Logging.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SELF_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SELF_PATH), '..');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ID = 'sahayakai-b4248';
const IMPERSONATE_SA = 'firebase-adminsdk-fbsvc@sahayakai-b4248.iam.gserviceaccount.com';

const MODE_SERVICE = {
  preview: 'sahayakai-preview',
  prod: 'sahayakai-hotfix-resilience',
};

/** Map camelCase agent flag key → Firestore subcollection name. */
const AGENT_FLAG_TO_SUBCOLLECTION = {
  lessonPlan: 'lesson-plan',
  quiz: 'quiz',
  examPaper: 'exam-paper',
  instantAnswer: 'instant-answer',
  rubric: 'rubric',
  teacherTraining: 'teacher-training',
  videoStoryteller: 'video-storyteller',
  virtualFieldTrip: 'virtual-field-trip',
  visualAid: 'visual-aid',
  voiceToText: 'voice-to-text',
  worksheet: 'worksheet',
  parentMessage: 'parent-message',
  avatarGenerator: 'avatar-generator',
  assessmentScanner: 'assessment-scanner',
  assignmentAssessor: 'assignment-assessor',
  communityPersonaMessage: 'community-persona-message',
  vidya: 'vidya',
};

const SEMANTIC_DRIFT_FIELD_THRESHOLD = 0.15; // per-cell cosine drift cutoff
const SUMMARY_BLOCK_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/** Parse durations like "30m", "2h", "45s" → milliseconds. */
export function parseDuration(s) {
  if (typeof s !== 'string') throw new Error('duration must be a string');
  const m = s.match(/^(\d+)(ms|s|m|h)$/);
  if (!m) throw new Error(`bad duration: ${s}`);
  const n = Number(m[1]);
  switch (m[2]) {
    case 'ms': return n;
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
  }
  throw new Error(`bad unit: ${s}`);
}

/** Cosine similarity for equal-length numeric vectors. */
export function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Linear-interpolated quantile. q ∈ [0,1]. Returns null if empty. */
export function quantile(values, q) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Bucket a list of shadow-diff docs into per-agent metrics.
 *
 * @param {Array<{
 *   sidecarOk?: boolean,
 *   sidecarError?: string | null,
 *   sidecarStatus?: number | null,
 *   sidecarLatencyMs?: number,
 *   genkitLatencyMs?: number,
 * }>} docs
 */
export function bucketDocs(docs) {
  const m = {
    total: docs.length,
    sidecarOk: 0,
    sidecar5xx: 0,
    sidecar4xx: 0,
    sidecarOtherErr: 0,
    sidecarLatencies: [],
    genkitLatencies: [],
    bothOkDocs: [],
  };
  for (const d of docs) {
    if (Number.isFinite(d.sidecarLatencyMs)) m.sidecarLatencies.push(d.sidecarLatencyMs);
    if (Number.isFinite(d.genkitLatencyMs)) m.genkitLatencies.push(d.genkitLatencyMs);
    if (d.sidecarOk === true) {
      m.sidecarOk += 1;
      if (d.genkit && d.sidecar) m.bothOkDocs.push(d);
      continue;
    }
    // Classify failure. Prefer explicit sidecarStatus; fall back to error
    // string heuristic so older shadow-diff schemas still bucket sensibly.
    const status = Number(d.sidecarStatus);
    if (Number.isFinite(status) && status >= 500) {
      m.sidecar5xx += 1;
    } else if (Number.isFinite(status) && status >= 400) {
      m.sidecar4xx += 1;
    } else {
      const err = String(d.sidecarError || '').toLowerCase();
      if (/5\d\d|timeout|unavailable|internal|deadline/.test(err)) m.sidecar5xx += 1;
      else if (/4\d\d|invalid|bad request|unauthor|forbidden/.test(err)) m.sidecar4xx += 1;
      else m.sidecarOtherErr += 1;
    }
  }
  return m;
}

/**
 * Compute drift fraction from sampled both-success cells.
 *
 * @param {Array<{genkitText?: string, sidecarText?: string, cosine?: number}>} samples
 * @returns {{ driftFraction: number, sampled: number, drifted: number }}
 */
export function computeDriftFraction(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return { driftFraction: 0, sampled: 0, drifted: 0 };
  }
  let drifted = 0;
  for (const s of samples) {
    const cos = Number(s.cosine);
    if (!Number.isFinite(cos)) continue;
    // "semantic divergence" > 0.15 ⇔ (1 - cos) > 0.15 ⇔ cos < 0.85
    if ((1 - cos) > SEMANTIC_DRIFT_FIELD_THRESHOLD) drifted += 1;
  }
  return {
    driftFraction: drifted / samples.length,
    sampled: samples.length,
    drifted,
  };
}

/**
 * Pure gate evaluator. Given an agent's window metrics + drift + thresholds,
 * returns a verdict + reasons.
 *
 * @param {{
 *   metrics: ReturnType<typeof bucketDocs>,
 *   sidecarP95?: number | null,
 *   genkitP95?: number | null,
 *   drift?: { driftFraction: number, sampled: number },
 *   thresholds: {
 *     maxErrorRate: number,
 *     maxLatencyMultiplier: number,
 *     maxSemanticDrift: number,
 *     minSamples?: number,
 *   },
 *   latencyCheckSkipped?: boolean,
 * }} args
 */
export function evaluateGates(args) {
  const { metrics, sidecarP95, genkitP95, drift, thresholds, latencyCheckSkipped } = args;
  const minSamples = thresholds.minSamples ?? 5;
  const reasons = [];

  if (metrics.total === 0) {
    return { verdict: 'INSUFFICIENT_SIGNAL', reasons: ['no traffic in window'], gates: {} };
  }

  // Gate 1: error rate (5xx only — 4xx is client-driven, don't fail canary).
  const errorRate = metrics.total === 0 ? 0 : metrics.sidecar5xx / metrics.total;
  const errorRatePass = errorRate <= thresholds.maxErrorRate;
  if (!errorRatePass) {
    reasons.push(
      `5xx rate ${(errorRate * 100).toFixed(2)}% > ${(thresholds.maxErrorRate * 100).toFixed(2)}% (${metrics.sidecar5xx}/${metrics.total})`,
    );
  }

  // Gate 2: latency ratio. Skip cleanly if Cloud Logging was slow OR if
  // either p95 is missing (e.g. all-error window).
  let latencyRatio = null;
  let latencyPass = true;
  if (latencyCheckSkipped) {
    reasons.push('latency check skipped (Cloud Logging slow)');
  } else if (
    Number.isFinite(sidecarP95) && Number.isFinite(genkitP95) && genkitP95 > 0
  ) {
    latencyRatio = sidecarP95 / genkitP95;
    latencyPass = latencyRatio <= thresholds.maxLatencyMultiplier;
    if (!latencyPass) {
      reasons.push(
        `latency ratio ${latencyRatio.toFixed(2)} > ${thresholds.maxLatencyMultiplier} (sidecar p95=${sidecarP95.toFixed(0)}ms vs genkit p95=${genkitP95.toFixed(0)}ms)`,
      );
    }
  }

  // Gate 3: semantic drift.
  let driftPass = true;
  if (drift && drift.sampled >= minSamples) {
    driftPass = drift.driftFraction <= thresholds.maxSemanticDrift;
    if (!driftPass) {
      reasons.push(
        `semantic drift ${(drift.driftFraction * 100).toFixed(1)}% > ${(thresholds.maxSemanticDrift * 100).toFixed(1)}% (${drift.drifted}/${drift.sampled} cells)`,
      );
    }
  }

  const allPass = errorRatePass && latencyPass && driftPass;
  return {
    verdict: allPass ? 'GO' : 'NO_GO',
    reasons,
    gates: {
      errorRate, errorRatePass,
      latencyRatio, latencyPass,
      driftFraction: drift?.driftFraction ?? null, driftPass,
    },
  };
}

/** Parse `--key=val` and `--key val` CLI args. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[a.slice(2)] = next; i += 1; }
      else { out[a.slice(2)] = 'true'; }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Firestore + Cloud Logging adapters (only loaded when running as CLI)
// ---------------------------------------------------------------------------

async function initFirestore() {
  const admin = (await import('firebase-admin')).default;
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  return admin.firestore();
}

/**
 * Query a single agent's shadow-diff docs in [windowStart, windowEnd).
 * Walks today + yesterday date-bucket docs (UTC) to handle window straddling.
 */
async function fetchShadowDiffs(db, subcollection, windowStart, windowEnd) {
  const dateOf = (d) => d.toISOString().slice(0, 10);
  const days = new Set([dateOf(windowStart), dateOf(windowEnd)]);
  const out = [];
  for (const day of days) {
    try {
      const snap = await db
        .collection('agent_shadow_diffs')
        .doc(day)
        .collection(subcollection)
        .where('createdAt', '>=', windowStart)
        .where('createdAt', '<', windowEnd)
        .get();
      for (const d of snap.docs) out.push({ id: d.id, ...d.data() });
    } catch (err) {
      console.warn(`[fetch] ${subcollection}/${day} error: ${err.message}`);
    }
  }
  return out;
}

/**
 * Sanity-check 5xx count from Cloud Logging. Best-effort; on timeout returns
 * null and the caller skips the latency gate that cycle.
 *
 * @returns {{ count5xx: number } | null}
 */
function queryCloudLogging5xx(service, windowStart, windowEnd, timeoutMs = 15_000) {
  const filter = [
    `resource.type=cloud_run_revision`,
    `resource.labels.service_name=${service}`,
    `httpRequest.status>=500`,
    `timestamp>="${windowStart.toISOString()}"`,
    `timestamp<"${windowEnd.toISOString()}"`,
  ].join(' AND ');
  const r = spawnSync(
    'gcloud',
    [
      'logging', 'read', filter,
      '--limit=1000', '--format=value(timestamp)',
      `--project=${PROJECT_ID}`,
      `--impersonate-service-account=${IMPERSONATE_SA}`,
    ],
    { timeout: timeoutMs, encoding: 'utf8' },
  );
  if (r.status !== 0) return null;
  const lines = r.stdout.split('\n').filter((l) => l.trim().length > 0);
  return { count5xx: lines.length };
}

// ---------------------------------------------------------------------------
// Embedding (Gemini). Falls back to a deterministic mock so the monitor still
// emits a drift signal in CI / offline contexts (mock cosine ≈ 1 for exact
// string match, ≈ 0 otherwise — still useful for "did the text change at all").
// ---------------------------------------------------------------------------

async function makeEmbedder() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('[embed] no GEMINI_API_KEY — using deterministic mock embedder');
    return async (text) => {
      // 32-dim hash-derived vector. Same text → same vector.
      const crypto = await import('node:crypto');
      const h = crypto.createHash('sha256').update(String(text)).digest();
      const v = new Array(32);
      for (let i = 0; i < 32; i++) v[i] = (h[i] - 128) / 128;
      return v;
    };
  }
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    return async (text) => {
      const res = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: [{ role: 'user', parts: [{ text: String(text).slice(0, 8000) }] }],
      });
      return res.embeddings?.[0]?.values || [];
    };
  } catch (err) {
    console.warn(`[embed] @google/genai unavailable (${err.message}) — mock embedder`);
    return async () => [];
  }
}

/** Extract a "primary text" blob from a shadow-diff doc's genkit/sidecar payload. */
function extractText(blob) {
  if (blob == null) return '';
  if (typeof blob === 'string') return blob;
  // Try common fields; fall back to JSON.stringify so we still hash *something*.
  const candidates = ['text', 'content', 'output', 'response', 'answer', 'plan', 'message'];
  for (const k of candidates) {
    if (typeof blob[k] === 'string' && blob[k].length > 0) return blob[k];
  }
  try { return JSON.stringify(blob).slice(0, 8000); } catch { return ''; }
}

async function sampleDrift(bothOkDocs, embed, sampleSize = 5) {
  const recent = [...bothOkDocs].sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  }).slice(0, sampleSize);
  const samples = [];
  for (const d of recent) {
    const gt = extractText(d.genkit);
    const st = extractText(d.sidecar);
    if (!gt || !st) continue;
    try {
      const [gv, sv] = await Promise.all([embed(gt), embed(st)]);
      samples.push({ cosine: cosine(gv, sv) });
    } catch (err) {
      console.warn(`[embed] sample failed: ${err.message}`);
    }
  }
  return samples;
}

// ---------------------------------------------------------------------------
// CLI main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.mode || 'preview';
  if (!MODE_SERVICE[mode]) {
    console.error(`bad --mode=${mode}. Want preview|prod`);
    process.exit(2);
  }
  const service = MODE_SERVICE[mode];
  const agentFlags = String(args.agents || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (agentFlags.length === 0) {
    console.error('--agents=lessonPlan,quiz,... required');
    process.exit(2);
  }
  for (const a of agentFlags) {
    if (!AGENT_FLAG_TO_SUBCOLLECTION[a]) {
      console.error(`unknown agent flag: ${a}. Known: ${Object.keys(AGENT_FLAG_TO_SUBCOLLECTION).join(', ')}`);
      process.exit(2);
    }
  }
  const durationMs = parseDuration(args.duration || '30m');
  const pollIntervalMs = parseDuration(args['poll-interval'] || '60s');
  const thresholds = {
    maxErrorRate: Number(args['max-error-rate'] ?? '0.05'),
    maxLatencyMultiplier: Number(args['max-latency-multiplier'] ?? '1.3'),
    maxSemanticDrift: Number(args['max-semantic-drift'] ?? '0.10'),
  };

  console.log(`[canary-watch] mode=${mode} service=${service} agents=${agentFlags.join(',')}`);
  console.log(`[canary-watch] duration=${args.duration || '30m'} poll=${args['poll-interval'] || '60s'} thresholds=${JSON.stringify(thresholds)}`);

  const db = await initFirestore();
  const embed = await makeEmbedder();

  // Per-agent rolling ledger across the entire run.
  const ledger = Object.fromEntries(agentFlags.map((a) => [a, {
    totalDocs: 0,
    total5xx: 0,
    total4xx: 0,
    totalOk: 0,
    sidecarLatencies: [],
    genkitLatencies: [],
    driftSamples: [],
    pollFailures: [],
    cloudLogging5xx: 0,
  }]));

  const runStart = new Date();
  const runEnd = new Date(runStart.getTime() + durationMs);
  let nextSummary = new Date(runStart.getTime() + SUMMARY_BLOCK_MS);

  let stopping = false;
  const onSig = () => { console.log('\n[canary-watch] SIGINT — emitting partial report'); stopping = true; };
  process.on('SIGINT', onSig);

  while (!stopping && new Date() < runEnd) {
    const windowStart = new Date(Date.now() - pollIntervalMs);
    const windowEnd = new Date();

    for (const flag of agentFlags) {
      const sub = AGENT_FLAG_TO_SUBCOLLECTION[flag];
      const docs = await fetchShadowDiffs(db, sub, windowStart, windowEnd);
      const m = bucketDocs(docs);

      // Cloud Logging sanity (fail-soft).
      const cl = queryCloudLogging5xx(service, windowStart, windowEnd);
      if (cl) ledger[flag].cloudLogging5xx += cl.count5xx;

      ledger[flag].totalDocs += m.total;
      ledger[flag].total5xx += m.sidecar5xx;
      ledger[flag].total4xx += m.sidecar4xx;
      ledger[flag].totalOk += m.sidecarOk;
      ledger[flag].sidecarLatencies.push(...m.sidecarLatencies);
      ledger[flag].genkitLatencies.push(...m.genkitLatencies);

      if (m.bothOkDocs.length > 0) {
        const samples = await sampleDrift(m.bothOkDocs, embed);
        ledger[flag].driftSamples.push(...samples);
      }
    }

    // 5-min summary block.
    if (new Date() >= nextSummary) {
      printSummary(ledger, thresholds);
      nextSummary = new Date(nextSummary.getTime() + SUMMARY_BLOCK_MS);
    }

    // Sleep until next poll.
    const sleepMs = Math.max(0, pollIntervalMs - (Date.now() - windowEnd.getTime()));
    await new Promise((r) => setTimeout(r, sleepMs));
  }

  process.off('SIGINT', onSig);
  const report = buildReport(ledger, thresholds, {
    mode, service, agentFlags, runStart, runEnd: new Date(),
    pollIntervalMs, durationMs, partial: stopping,
  });
  const outPath = writeReport(report);
  console.log(`[canary-watch] report → ${outPath}`);
  for (const flag of agentFlags) {
    const v = report.perAgent[flag].verdict;
    console.log(`[canary-watch] ${flag}: ${v}`);
  }
  // Exit code: 0 if all GO, 1 if any NO_GO, 2 if all INSUFFICIENT_SIGNAL.
  const verdicts = agentFlags.map((f) => report.perAgent[f].verdict);
  if (verdicts.includes('NO_GO')) process.exit(1);
  if (verdicts.every((v) => v === 'INSUFFICIENT_SIGNAL')) process.exit(2);
  process.exit(0);
}

function printSummary(ledger, thresholds) {
  console.log(`\n[summary @ ${new Date().toISOString()}]`);
  for (const [flag, L] of Object.entries(ledger)) {
    const sP95 = quantile(L.sidecarLatencies, 0.95);
    const gP95 = quantile(L.genkitLatencies, 0.95);
    const ratio = sP95 && gP95 ? (sP95 / gP95).toFixed(2) : 'n/a';
    const errRate = L.totalDocs === 0 ? 0 : (L.total5xx / L.totalDocs);
    const drift = computeDriftFraction(L.driftSamples);
    console.log(
      `  ${flag.padEnd(22)} docs=${L.totalDocs} 5xx=${L.total5xx} 4xx=${L.total4xx} `
      + `err=${(errRate * 100).toFixed(2)}%/${(thresholds.maxErrorRate * 100).toFixed(0)}% `
      + `ratio=${ratio}/${thresholds.maxLatencyMultiplier} `
      + `drift=${(drift.driftFraction * 100).toFixed(1)}%/${(thresholds.maxSemanticDrift * 100).toFixed(0)}% `
      + `(${drift.sampled} samples)`,
    );
  }
}

function buildReport(ledger, thresholds, meta) {
  const perAgent = {};
  for (const [flag, L] of Object.entries(ledger)) {
    const sP95 = quantile(L.sidecarLatencies, 0.95);
    const gP95 = quantile(L.genkitLatencies, 0.95);
    const drift = computeDriftFraction(L.driftSamples);
    const m = {
      total: L.totalDocs,
      sidecarOk: L.totalOk,
      sidecar5xx: L.total5xx,
      sidecar4xx: L.total4xx,
      sidecarOtherErr: 0,
      sidecarLatencies: L.sidecarLatencies,
      genkitLatencies: L.genkitLatencies,
      bothOkDocs: [],
    };
    const gates = evaluateGates({
      metrics: m,
      sidecarP95: sP95, genkitP95: gP95,
      drift,
      thresholds,
    });
    perAgent[flag] = { ...gates, sidecarP95: sP95, genkitP95: gP95, drift, cloudLogging5xx: L.cloudLogging5xx };
  }
  return { meta, thresholds, perAgent };
}

function writeReport(report) {
  const dir = path.join(REPO_ROOT, 'qa/results/canary-watch');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = report.meta.runStart.toISOString().replace(/[:.]/g, '-');
  const md = renderReportMd(report);
  const mdPath = path.join(dir, `${stamp}.md`);
  fs.writeFileSync(mdPath, md);
  fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify(report, null, 2));
  return mdPath;
}

function renderReportMd(report) {
  const { meta, thresholds, perAgent } = report;
  const lines = [];
  lines.push(`# Canary Watch Report${meta.partial ? ' (PARTIAL — SIGINT)' : ''}`);
  lines.push('');
  lines.push(`- mode: \`${meta.mode}\` (\`${meta.service}\`)`);
  lines.push(`- window: ${meta.runStart.toISOString()} → ${meta.runEnd.toISOString()}`);
  lines.push(`- agents: ${meta.agentFlags.join(', ')}`);
  lines.push(`- poll-interval: ${Math.round(meta.pollIntervalMs / 1000)}s`);
  lines.push('');
  lines.push(`## Thresholds`);
  lines.push(`- max 5xx rate: ${(thresholds.maxErrorRate * 100).toFixed(2)}%`);
  lines.push(`- max latency multiplier (sidecar p95 / genkit p95): ${thresholds.maxLatencyMultiplier}`);
  lines.push(`- max semantic drift fraction: ${(thresholds.maxSemanticDrift * 100).toFixed(2)}%`);
  lines.push('');
  lines.push(`## Verdicts`);
  lines.push('');
  lines.push('| agent | verdict | docs | 5xx | 4xx | err% | sidecar p95 | genkit p95 | ratio | drift% | reasons |');
  lines.push('|-------|---------|------|-----|-----|------|-------------|------------|-------|--------|---------|');
  for (const [flag, r] of Object.entries(perAgent)) {
    const m = r.gates;
    const errPct = (m.errorRate * 100).toFixed(2);
    const ratio = m.latencyRatio == null ? 'n/a' : m.latencyRatio.toFixed(2);
    const driftPct = m.driftFraction == null ? 'n/a' : (m.driftFraction * 100).toFixed(1);
    const sP95 = r.sidecarP95 == null ? 'n/a' : Math.round(r.sidecarP95);
    const gP95 = r.genkitP95 == null ? 'n/a' : Math.round(r.genkitP95);
    const reasons = r.reasons.length ? r.reasons.join('; ') : '';
    lines.push(`| ${flag} | **${r.verdict}** | ${r.drift?.sampled ?? 0} samples | — | — | ${errPct} | ${sP95} | ${gP95} | ${ratio} | ${driftPct} | ${reasons} |`);
  }
  lines.push('');
  lines.push(`## Cloud Logging sanity (5xx count from \`gcloud logging read\`)`);
  lines.push('');
  for (const [flag, r] of Object.entries(perAgent)) {
    lines.push(`- \`${flag}\`: ${r.cloudLogging5xx} 5xx in Cloud Logging`);
  }
  lines.push('');
  return lines.join('\n');
}

// Only run main when invoked as CLI (not when imported by tests).
const isCli = process.argv[1] && path.resolve(process.argv[1]) === SELF_PATH;
if (isCli) {
  main().catch((err) => {
    console.error('[canary-watch] FATAL', err);
    process.exit(3);
  });
}
