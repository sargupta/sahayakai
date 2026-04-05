/**
 * consolidate-pyqs.ts
 *
 * Reads all JSON files from src/ai/data/pyq/, deduplicates and validates
 * questions, then writes:
 *   - consolidated_pyqs.json  — the single merged source of truth
 *   - pyq_metadata.json       — statistics index used at runtime
 *
 * Run with:
 *   npx tsx src/scripts/consolidate-pyqs.ts
 */

import fs from 'fs';
import path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawQuestion {
  id?: string;
  question?: string;
  subject?: string;
  class?: number | string;
  year?: number | string | null;
  chapter?: string;
  topic?: string;
  marks?: number | string;
  type?: string;
  board?: string;
  answer?: string;
  frequency?: string;
  section?: string;
  options?: string[];
  [key: string]: unknown;
}

interface ConsolidatedQuestion {
  id: string;
  question: string;
  subject: 'mathematics' | 'science';
  class: 9 | 10;
  year: number | null;
  chapter: string;
  topic: string;
  marks: number;
  type: 'MCQ' | 'VSA' | 'SA' | 'LA' | 'case_study';
  board: string;
  answer?: string;
  frequency?: 'high' | 'medium' | 'low';
  section?: string;
  options?: string[];
}

interface PyqMetadata {
  total: number;
  by_class: Record<string, number>;
  by_subject: Record<string, number>;
  by_type: Record<string, number>;
  by_year: Record<string, number>;
  by_chapter: Record<string, number>;
  last_updated: string;
}

interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PYQ_DIR = path.resolve(__dirname, '../ai/data/pyq');
const CONSOLIDATED_PATH = path.join(PYQ_DIR, 'consolidated_pyqs.json');
const METADATA_PATH = path.join(PYQ_DIR, 'pyq_metadata.json');
const SKIP_FILES = new Set(['consolidated_pyqs.json', 'pyq_metadata.json']);

const VALID_SUBJECTS = new Set(['mathematics', 'science']);
const VALID_CLASSES = new Set([9, 10]);
const VALID_TYPES = new Set<string>(['MCQ', 'VSA', 'SA', 'LA', 'case_study']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normaliseSubject(raw: string): 'mathematics' | 'science' | null {
  const s = raw.toLowerCase().trim();
  if (s === 'mathematics' || s === 'maths' || s === 'math') return 'mathematics';
  if (s === 'science') return 'science';
  return null;
}

function normaliseType(raw: string): ConsolidatedQuestion['type'] | null {
  const t = raw.toUpperCase().trim();
  if (t === 'MCQ') return 'MCQ';
  if (t === 'VSA') return 'VSA';
  if (t === 'SA') return 'SA';
  if (t === 'LA') return 'LA';
  if (t === 'CASE_STUDY' || t === 'CASE STUDY') return 'case_study';
  return null;
}

function normaliseClass(raw: number | string): 9 | 10 | null {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  if (n === 9 || n === 10) return n;
  return null;
}

function validate(q: RawQuestion): ValidationResult {
  const reasons: string[] = [];

  if (!q.question || typeof q.question !== 'string' || q.question.trim() === '') {
    reasons.push('missing question text');
  }
  if (!q.subject || normaliseSubject(String(q.subject)) === null) {
    reasons.push(`invalid subject: "${q.subject}"`);
  }
  if (q.class === undefined || normaliseClass(q.class) === null) {
    reasons.push(`invalid class: "${q.class}"`);
  }
  if (!q.chapter || typeof q.chapter !== 'string' || q.chapter.trim() === '') {
    reasons.push('missing chapter');
  }
  if (q.marks === undefined || isNaN(Number(q.marks))) {
    reasons.push(`invalid marks: "${q.marks}"`);
  }
  if (!q.type || normaliseType(String(q.type)) === null) {
    reasons.push(`invalid type: "${q.type}" (must be one of: ${[...VALID_TYPES].join(', ')})`);
  }

  return { valid: reasons.length === 0, reasons };
}

function toConsolidated(q: RawQuestion, assignedId: string): ConsolidatedQuestion {
  const subject = normaliseSubject(String(q.subject))!;
  const classNum = normaliseClass(q.class!)!;
  const type = normaliseType(String(q.type))!;
  const year = q.year !== undefined && q.year !== null ? Number(q.year) || null : null;
  const marks = Number(q.marks);
  const frequency = (['high', 'medium', 'low'] as const).includes(q.frequency as 'high' | 'medium' | 'low')
    ? (q.frequency as 'high' | 'medium' | 'low')
    : undefined;

  const out: ConsolidatedQuestion = {
    id: assignedId,
    question: q.question!.trim(),
    subject,
    class: classNum,
    year,
    chapter: q.chapter!.trim(),
    topic: typeof q.topic === 'string' ? q.topic.trim() : '',
    marks,
    type,
    board: typeof q.board === 'string' ? q.board.trim() : 'CBSE',
  };

  if (q.answer !== undefined) out.answer = q.answer;
  if (frequency !== undefined) out.frequency = frequency;
  if (q.section !== undefined) out.section = q.section;
  if (Array.isArray(q.options)) out.options = q.options;

  return out;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  console.log(`\nReading PYQ files from: ${PYQ_DIR}\n`);

  const jsonFiles = fs
    .readdirSync(PYQ_DIR)
    .filter((f) => f.endsWith('.json') && !SKIP_FILES.has(f));

  console.log(`Found ${jsonFiles.length} source file(s): ${jsonFiles.join(', ')}\n`);

  const allRaw: Array<{ raw: RawQuestion; sourceFile: string }> = [];

  for (const file of jsonFiles) {
    const filePath = path.join(PYQ_DIR, file);
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`  [SKIP] ${file} — JSON parse error: ${(e as Error).message}`);
      continue;
    }

    if (!Array.isArray(parsed)) {
      console.warn(`  [SKIP] ${file} — root is not an array`);
      continue;
    }

    console.log(`  Loaded ${(parsed as RawQuestion[]).length} questions from ${file}`);
    for (const item of parsed as RawQuestion[]) {
      allRaw.push({ raw: item, sourceFile: file });
    }
  }

  console.log(`\nTotal raw questions loaded: ${allRaw.length}`);

  // ── Validate & collect ────────────────────────────────────────────────────

  let invalidCount = 0;
  const validRaw: Array<{ raw: RawQuestion; sourceFile: string }> = [];

  for (const entry of allRaw) {
    const result = validate(entry.raw);
    if (!result.valid) {
      invalidCount++;
      console.warn(
        `  [INVALID] ${entry.sourceFile} / id="${entry.raw.id ?? 'unknown'}" — ${result.reasons.join('; ')}`
      );
    } else {
      validRaw.push(entry);
    }
  }

  console.log(`  Valid: ${validRaw.length}  |  Invalid (skipped): ${invalidCount}`);

  // ── Deduplicate ────────────────────────────────────────────────────────────

  const seen = new Map<string, boolean>(); // normalisedText → true
  const dedupedRaw: Array<{ raw: RawQuestion; sourceFile: string }> = [];
  let dupCount = 0;

  for (const entry of validRaw) {
    const key = normaliseText(entry.raw.question!);
    if (seen.has(key)) {
      dupCount++;
      continue;
    }
    seen.set(key, true);
    dedupedRaw.push(entry);
  }

  console.log(`  After deduplication: ${dedupedRaw.length} unique  |  Duplicates removed: ${dupCount}`);

  // ── Assign IDs & convert ──────────────────────────────────────────────────

  // Preserve existing IDs where they are unique; assign new sequential IDs
  // where missing or colliding.
  const usedIds = new Set<string>();
  const consolidated: ConsolidatedQuestion[] = [];

  for (let i = 0; i < dedupedRaw.length; i++) {
    const { raw } = dedupedRaw[i];
    let id: string;

    if (raw.id && typeof raw.id === 'string' && !usedIds.has(raw.id)) {
      id = raw.id;
    } else {
      // Generate sequential ID
      const subjPrefix = (raw.subject ?? 'unknown').toLowerCase().slice(0, 3);
      const classNum = normaliseClass(raw.class!) ?? 'xx';
      id = `pyq_${subjPrefix}_c${classNum}_${String(i + 1).padStart(4, '0')}`;
      // In the unlikely event this also collides, append a suffix
      let suffix = 0;
      while (usedIds.has(id)) {
        suffix++;
        id = `pyq_${subjPrefix}_c${classNum}_${String(i + 1).padStart(4, '0')}_${suffix}`;
      }
    }

    usedIds.add(id);
    consolidated.push(toConsolidated(raw, id));
  }

  // ── Build metadata ────────────────────────────────────────────────────────

  const by_class: Record<string, number> = {};
  const by_subject: Record<string, number> = {};
  const by_type: Record<string, number> = {};
  const by_year: Record<string, number> = {};
  const by_chapter: Record<string, number> = {};

  for (const q of consolidated) {
    const classKey = String(q.class);
    by_class[classKey] = (by_class[classKey] ?? 0) + 1;
    by_subject[q.subject] = (by_subject[q.subject] ?? 0) + 1;
    by_type[q.type] = (by_type[q.type] ?? 0) + 1;
    if (q.year !== null) {
      const yearKey = String(q.year);
      by_year[yearKey] = (by_year[yearKey] ?? 0) + 1;
    }
    by_chapter[q.chapter] = (by_chapter[q.chapter] ?? 0) + 1;
  }

  const metadata: PyqMetadata = {
    total: consolidated.length,
    by_class,
    by_subject,
    by_type,
    by_year,
    by_chapter,
    last_updated: new Date().toISOString().slice(0, 10),
  };

  // ── Print summary ─────────────────────────────────────────────────────────

  console.log('\n=== Summary Report ===');
  console.log(`Total consolidated questions : ${metadata.total}`);
  console.log(`By class    : ${JSON.stringify(by_class)}`);
  console.log(`By subject  : ${JSON.stringify(by_subject)}`);
  console.log(`By type     : ${JSON.stringify(by_type)}`);
  const yearKeys = Object.keys(by_year).sort();
  console.log(`By year     : ${yearKeys.map((y) => `${y}=${by_year[y]}`).join(', ')}`);
  const topChapters = Object.entries(by_chapter)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  console.log(`Top chapters: ${topChapters.map(([ch, n]) => `"${ch}"=${n}`).join(', ')}`);

  // ── Write files ───────────────────────────────────────────────────────────

  fs.writeFileSync(CONSOLIDATED_PATH, JSON.stringify(consolidated, null, 2), 'utf8');
  console.log(`\nWrote consolidated_pyqs.json  (${consolidated.length} questions)`);

  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`Wrote pyq_metadata.json`);

  console.log('\nDone.\n');
}

main();
