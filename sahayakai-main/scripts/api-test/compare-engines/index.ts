#!/usr/bin/env tsx
/**
 * Genkit (main) vs Sidecar (ADK) comparator across all 11 supported languages.
 *
 * For each (flow, language):
 *   - calls the Next.js Genkit endpoint   POST {NEXT_BASE}/api/ai/<flow>
 *   - calls the sidecar ADK endpoint      POST {SIDECAR_BASE}/v1/<flow>/generate
 *   - records: latency, status, output
 *   - scores: TF-cosine similarity, language-script match, JSON shape jaccard,
 *     length ratio
 *
 * Outputs:
 *   - scripts/api-test/compare-engines/output/raw/<flow>__<lang>.json
 *   - scripts/api-test/compare-engines/output/REPORT.md
 *
 * Usage:
 *   # Both dev servers must be up.
 *   NEXT_BASE=http://localhost:64643 SIDECAR_BASE=http://localhost:8081 \
 *     npx tsx scripts/api-test/compare-engines/index.ts
 *
 *   # Subset of flows / langs:
 *   npx tsx scripts/api-test/compare-engines/index.ts --flows lesson-plan,instant-answer --langs en,hi
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tfCosine, languageMatch, lengthRatio, shapeMatch, textOf } from './scorers';

const NEXT_BASE = process.env.NEXT_BASE || 'http://localhost:3000';
const SIDECAR_BASE = process.env.SIDECAR_BASE || 'http://localhost:8081';
const OUT_DIR = join(process.cwd(), 'scripts/api-test/compare-engines/output');
const RAW_DIR = join(OUT_DIR, 'raw');
const TIMEOUT_MS = parseInt(process.env.COMPARE_TIMEOUT_MS || '60000', 10);
const ID_TOKEN = process.env.FIREBASE_ID_TOKEN || '';
const APP_CHECK_TOKEN = process.env.APP_CHECK_TOKEN || '';

const ALL_LANGS = ['en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'pa', 'ml', 'or', 'kn'];
const LANG_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  te: 'Telugu',
  mr: 'Marathi',
  ta: 'Tamil',
  gu: 'Gujarati',
  pa: 'Punjabi',
  ml: 'Malayalam',
  or: 'Odia',
  kn: 'Kannada',
};

interface FlowSpec {
  /** Short id used in filenames + report. */
  id: string;
  /** Path on Next.js side under /api/ai/. */
  nextPath: string;
  /** Path on sidecar side. */
  sidecarPath: string;
  /** Build the Genkit (Next.js) request body for a given language. */
  genkitBody: (lang: string) => Record<string, unknown>;
  /** Build the sidecar (FastAPI) request body for a given language.
   *  May differ from genkitBody — sidecar contracts have drifted on several
   *  flows (parentLanguage uses English names, teacher-training uses `question`
   *  not `topic`, etc). */
  sidecarBody: (lang: string) => Record<string, unknown>;
  /** Sidecar known to be blocked by `additional_properties` Gemini bug. */
  sidecarBlocked?: string;
}

const LANG_TO_NAME: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  te: 'Telugu',
  mr: 'Marathi',
  ta: 'Tamil',
  gu: 'Gujarati',
  pa: 'Punjabi',
  ml: 'Malayalam',
  or: 'Odia',
  kn: 'Kannada',
};

const FLOWS: FlowSpec[] = [
  {
    id: 'lesson-plan',
    nextPath: '/ai/lesson-plan',
    sidecarPath: '/v1/lesson-plan/generate',
    genkitBody: (lang) => ({
      topic: 'photosynthesis',
      gradeLevels: ['Class 5'],
      subject: 'Science',
      language: lang,
      useRuralContext: false,
      resourceLevel: 'low',
      difficultyLevel: 'standard',
      userId: `compare-${lang}`,
    }),
    sidecarBody: (lang) => ({
      topic: 'photosynthesis',
      gradeLevels: ['Class 5'],
      subject: 'Science',
      language: lang,
      useRuralContext: false,
      resourceLevel: 'low',
      difficultyLevel: 'standard',
      userId: `compare-${lang}`,
    }),
    sidecarBlocked: 'Pydantic-derived response_schema includes `additional_properties` which Gemini rejects with INVALID_ARGUMENT (drops every call before the model runs).',
  },
  {
    id: 'instant-answer',
    nextPath: '/ai/instant-answer',
    sidecarPath: '/v1/instant-answer/answer',
    genkitBody: (lang) => ({
      question: 'What is photosynthesis?',
      language: lang,
      gradeLevel: 'Class 5',
      subject: 'Science',
      userId: `compare-${lang}`,
    }),
    sidecarBody: (lang) => ({
      question: 'What is photosynthesis?',
      language: lang,
      gradeLevel: 'Class 5',
      subject: 'Science',
      userId: `compare-${lang}`,
    }),
    sidecarBlocked: 'Same `additional_properties` Gemini rejection as lesson-plan.',
  },
  {
    id: 'parent-message',
    nextPath: '/ai/parent-message',
    sidecarPath: '/v1/parent-message/generate',
    genkitBody: (lang) => ({
      studentName: 'Ravi Kumar',
      className: 'Class 6A',
      subject: 'Mathematics',
      reason: 'consecutive_absences',
      reasonContext: 'Encourage parent to send the student back to school',
      teacherNote: 'Has missed two days this week',
      parentLanguage: lang,
      consecutiveAbsentDays: 2,
      teacherName: 'Mrs. Anita',
      schoolName: 'Sahayak School',
      userId: `compare-${lang}`,
    }),
    sidecarBody: (lang) => ({
      // Sidecar wire contract uses English language NAMES, not ISO codes.
      studentName: 'Ravi Kumar',
      className: 'Class 6A',
      subject: 'Mathematics',
      reason: 'consecutive_absences',
      reasonContext: 'Encourage parent to send the student back to school',
      teacherNote: 'Has missed two days this week',
      parentLanguage: LANG_TO_NAME[lang] ?? 'English',
      consecutiveAbsentDays: 2,
      teacherName: 'Mrs. Anita',
      schoolName: 'Sahayak School',
      userId: `compare-${lang}`,
    }),
  },
  {
    id: 'rubric',
    nextPath: '/ai/rubric',
    sidecarPath: '/v1/rubric/generate',
    genkitBody: (lang) => ({
      assignmentDescription: 'Essay on the importance of clean drinking water',
      gradeLevel: 'Class 7',
      subject: 'EVS',
      language: lang,
      userId: `compare-${lang}`,
    }),
    sidecarBody: (lang) => ({
      assignmentDescription: 'Essay on the importance of clean drinking water',
      gradeLevel: 'Class 7',
      subject: 'EVS',
      language: lang,
      userId: `compare-${lang}`,
    }),
    sidecarBlocked: 'Same `additional_properties` Gemini rejection.',
  },
  {
    id: 'teacher-training',
    nextPath: '/ai/teacher-training',
    sidecarPath: '/v1/teacher-training/advise',
    // Both Genkit and sidecar require `question`.
    genkitBody: (lang) => ({
      question: 'How do I handle classroom discipline issues for Class 6?',
      language: lang,
      subject: 'Pedagogy',
      userId: `compare-${lang}`,
    }),
    sidecarBody: (lang) => ({
      question: 'How do I handle classroom discipline issues for Class 6?',
      language: lang,
      subject: 'Pedagogy',
      userId: `compare-${lang}`,
    }),
  },
  {
    id: 'virtual-field-trip',
    nextPath: '/ai/virtual-field-trip',
    sidecarPath: '/v1/virtual-field-trip/plan',
    // Both Genkit and sidecar require `topic`.
    genkitBody: (lang) => ({
      topic: 'A virtual visit to the Taj Mahal',
      gradeLevel: 'Class 7',
      language: lang,
      userId: `compare-${lang}`,
    }),
    sidecarBody: (lang) => ({
      topic: 'A virtual visit to the Taj Mahal',
      gradeLevel: 'Class 7',
      language: lang,
      userId: `compare-${lang}`,
    }),
  },
  {
    id: 'worksheet',
    nextPath: '/ai/worksheet',
    sidecarPath: '/v1/worksheet/generate',
    // Both Genkit and sidecar require imageDataUri + prompt (worksheet is
    // image-based: teacher takes a textbook-page photo).
    genkitBody: (lang) => ({
      imageDataUri:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
      prompt: 'Generate a worksheet on fractions based on this textbook page',
      gradeLevel: 'Class 5',
      subject: 'Mathematics',
      language: lang,
      userId: `compare-${lang}`,
    }),
    sidecarBody: (lang) => ({
      imageDataUri:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
      prompt: 'Generate a worksheet on fractions based on this textbook page',
      gradeLevel: 'Class 5',
      subject: 'Mathematics',
      language: lang,
      userId: `compare-${lang}`,
    }),
  },
];

interface CallResult {
  ok: boolean;
  status: number;
  ms: number;
  payload?: unknown;
  error?: string;
}

async function call(url: string, body: Record<string, unknown>, headers: Record<string, string>): Promise<CallResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const ms = Date.now() - start;
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = await res.text().catch(() => null);
    }
    return { ok: res.ok, status: res.status, ms, payload };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

interface PairResult {
  flow: string;
  lang: string;
  genkit: CallResult;
  sidecar: CallResult;
  metrics: {
    cosine: number;
    langMatchGenkit: number;
    langMatchSidecar: number;
    lengthRatio: number;
    shapeJaccard: number;
    sidecarTextLen: number;
    genkitTextLen: number;
    latencyDeltaMs: number;
  } | null;
}

function score(genkit: CallResult, sidecar: CallResult, lang: string): PairResult['metrics'] {
  if (!genkit.ok || !sidecar.ok || !genkit.payload || !sidecar.payload) return null;
  const ga = textOf(genkit.payload);
  const sa = textOf(sidecar.payload);
  const shape = shapeMatch(genkit.payload, sidecar.payload);
  return {
    cosine: tfCosine(ga, sa),
    langMatchGenkit: languageMatch(ga, lang),
    langMatchSidecar: languageMatch(sa, lang),
    lengthRatio: lengthRatio(ga, sa),
    shapeJaccard: shape.jaccard,
    sidecarTextLen: sa.length,
    genkitTextLen: ga.length,
    latencyDeltaMs: sidecar.ms - genkit.ms,
  };
}

function parseArgs(argv: string[]): { flows: string[]; langs: string[] } {
  let flows = FLOWS.map((f) => f.id);
  let langs = ALL_LANGS;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--flows') flows = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    if (argv[i] === '--langs') langs = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
  }
  return { flows, langs };
}

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (ID_TOKEN) h['Authorization'] = `Bearer ${ID_TOKEN}`;
  if (APP_CHECK_TOKEN) h['X-Firebase-AppCheck'] = APP_CHECK_TOKEN;
  return h;
}

async function runOne(flow: FlowSpec, lang: string): Promise<PairResult> {
  const headers = buildHeaders();
  const [genkit, sidecar] = await Promise.all([
    call(`${NEXT_BASE}/api${flow.nextPath}`, flow.genkitBody(lang), headers),
    call(`${SIDECAR_BASE}${flow.sidecarPath}`, flow.sidecarBody(lang), headers),
  ]);
  const metrics = score(genkit, sidecar, lang);
  const result: PairResult = { flow: flow.id, lang, genkit, sidecar, metrics };
  writeFileSync(join(RAW_DIR, `${flow.id}__${lang}.json`), JSON.stringify(result, null, 2));
  return result;
}

function fmt(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : 'n/a';
}

function writeReport(results: PairResult[]): void {
  const lines: string[] = [];
  lines.push('# Genkit (main) vs Sidecar (ADK) — comparative analysis across 11 languages');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Next.js base: ${NEXT_BASE}`);
  lines.push(`Sidecar base: ${SIDECAR_BASE}`);
  lines.push('');
  lines.push('## Methodology');
  lines.push('');
  lines.push('- Same fixed input per flow (e.g. `topic: photosynthesis` for lesson-plan), with only `language` swapped per row.');
  lines.push('- Genkit response = the Next.js `/api/ai/<flow>` endpoint (dispatcher in default `off` mode = Genkit code path).');
  lines.push('- Sidecar response = the ADK FastAPI `/v1/<flow>/generate` route (direct, no dispatcher).');
  lines.push('- Scorers: term-frequency cosine over text fields, dominant-script language match, JSON-shape Jaccard, length ratio (smaller / larger), latency delta.');
  lines.push('- All metrics are 0..1 except latency (ms).');
  lines.push('');

  const flows = Array.from(new Set(results.map((r) => r.flow)));
  for (const flow of flows) {
    const rows = results.filter((r) => r.flow === flow);
    lines.push(`## ${flow}`);
    lines.push('');
    lines.push('| Lang | Genkit | Sidecar | Cosine | LangMatch G/S | Shape | LenRatio | Δ ms (sidecar - genkit) |');
    lines.push('|------|--------|---------|--------|----------------|-------|----------|--------------------------|');
    for (const r of rows) {
      const g = r.genkit.ok ? `OK ${r.genkit.ms}ms` : `FAIL ${r.genkit.status || 'ERR'}`;
      const s = r.sidecar.ok ? `OK ${r.sidecar.ms}ms` : `FAIL ${r.sidecar.status || 'ERR'}`;
      const m = r.metrics;
      lines.push(
        `| ${r.lang} (${LANG_LABELS[r.lang] ?? r.lang}) | ${g} | ${s} | ${m ? fmt(m.cosine) : 'n/a'} | ${m ? `${fmt(m.langMatchGenkit)} / ${fmt(m.langMatchSidecar)}` : 'n/a'} | ${m ? fmt(m.shapeJaccard) : 'n/a'} | ${m ? fmt(m.lengthRatio) : 'n/a'} | ${m ? m.latencyDeltaMs : 'n/a'} |`,
      );
    }

    // Aggregate
    const valid = rows.filter((r) => r.metrics);
    if (valid.length) {
      const avg = (sel: (m: NonNullable<PairResult['metrics']>) => number) =>
        valid.reduce((acc, r) => acc + sel(r.metrics!), 0) / valid.length;
      lines.push('');
      lines.push(
        `**Aggregate** (${valid.length}/${rows.length} pairs scored): cosine=${fmt(avg((m) => m.cosine))} | ` +
          `lang-match Genkit=${fmt(avg((m) => m.langMatchGenkit))} Sidecar=${fmt(avg((m) => m.langMatchSidecar))} | ` +
          `shape=${fmt(avg((m) => m.shapeJaccard))} | length-ratio=${fmt(avg((m) => m.lengthRatio))} | ` +
          `mean Δ ms=${Math.round(avg((m) => m.latencyDeltaMs))}`,
      );
      lines.push('');
    } else {
      lines.push('');
      lines.push(`(no pair scored — both engines must succeed for the same row to compute metrics)`);
      lines.push('');
    }
  }

  // Cross-flow summary
  lines.push('## Cross-flow summary');
  lines.push('');
  lines.push('| Flow | Pairs scored | Mean cosine | Mean lang-match (S) | Mean shape | Mean Δ ms |');
  lines.push('|------|--------------|-------------|---------------------|------------|-----------|');
  for (const flow of flows) {
    const valid = results.filter((r) => r.flow === flow && r.metrics);
    if (!valid.length) {
      lines.push(`| ${flow} | 0 | n/a | n/a | n/a | n/a |`);
      continue;
    }
    const a = (sel: (m: NonNullable<PairResult['metrics']>) => number) =>
      valid.reduce((acc, r) => acc + sel(r.metrics!), 0) / valid.length;
    lines.push(
      `| ${flow} | ${valid.length} | ${fmt(a((m) => m.cosine))} | ${fmt(a((m) => m.langMatchSidecar))} | ${fmt(a((m) => m.shapeJaccard))} | ${Math.round(a((m) => m.latencyDeltaMs))} |`,
    );
  }
  lines.push('');

  // Failure table
  const failures = results.filter((r) => !r.genkit.ok || !r.sidecar.ok);
  if (failures.length) {
    lines.push('## Failures');
    lines.push('');
    lines.push('| Flow | Lang | Genkit | Sidecar |');
    lines.push('|------|------|--------|---------|');
    for (const r of failures) {
      const g = r.genkit.ok ? 'OK' : `${r.genkit.status || 'ERR'} ${r.genkit.error?.slice(0, 60) || ''}`;
      const s = r.sidecar.ok ? 'OK' : `${r.sidecar.status || 'ERR'} ${r.sidecar.error?.slice(0, 60) || ''}`;
      lines.push(`| ${r.flow} | ${r.lang} | ${g} | ${s} |`);
    }
  }

  writeFileSync(join(OUT_DIR, 'REPORT.md'), lines.join('\n'));
  writeFileSync(join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));
}

async function main(): Promise<void> {
  mkdirSync(RAW_DIR, { recursive: true });
  const args = parseArgs(process.argv.slice(2));
  const selected = FLOWS.filter((f) => args.flows.includes(f.id));

  console.log(`Comparator: ${selected.length} flows × ${args.langs.length} langs = ${selected.length * args.langs.length} pairs`);
  console.log(`  Genkit:  ${NEXT_BASE}`);
  console.log(`  Sidecar: ${SIDECAR_BASE}`);
  console.log(`  Auth: ID_TOKEN=${ID_TOKEN ? 'set' : 'NONE'}`);
  console.log('');

  const results: PairResult[] = [];
  for (const flow of selected) {
    console.log(`--- ${flow.id} ---`);
    for (const lang of args.langs) {
      const r = await runOne(flow, lang);
      const tag = `  ${r.flow.padEnd(20)} ${r.lang}`;
      const g = r.genkit.ok ? `genkit=${r.genkit.ms}ms` : `genkit=FAIL(${r.genkit.status || 'ERR'})`;
      const s = r.sidecar.ok ? `sidecar=${r.sidecar.ms}ms` : `sidecar=FAIL(${r.sidecar.status || 'ERR'})`;
      const m = r.metrics ? ` cos=${fmt(r.metrics.cosine)} lang=${fmt(r.metrics.langMatchSidecar)} shape=${fmt(r.metrics.shapeJaccard)}` : '';
      console.log(`${tag}  ${g}  ${s}${m}`);
      results.push(r);
    }
  }

  writeReport(results);
  console.log(`\nReport: ${join(OUT_DIR, 'REPORT.md')}`);
  console.log(`Raw:    ${RAW_DIR}/`);
}

main().catch((err) => {
  console.error('Comparator crashed:', err);
  process.exit(1);
});
