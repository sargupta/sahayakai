/**
 * pyq-store.ts
 *
 * In-memory PYQ store backed by the static consolidated_pyqs.json file.
 *
 * The JSON is imported at module load time, so all filter operations are
 * pure, synchronous array operations — no network or Firestore calls needed
 * during development.  Firestore vector search can be layered on top later
 * as an optional enhancement once the production corpus is live.
 *
 * If the consolidated file is empty or missing, every function returns [].
 */

import type { PYQQuestion } from '@/lib/services/pyq-retrieval-service';

// ---------------------------------------------------------------------------
// Static import — resolved at build time.
// When the placeholder empty array is present, all filter functions simply
// return [] without error.  Once consolidate-pyqs.ts populates the file,
// the Next.js dev server must be restarted to pick up the new content.
// ---------------------------------------------------------------------------

// We use a try/require pattern so that if the file is absent during unit tests
// the module still loads without crashing.
let rawData: unknown[] = [];
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  rawData = require('./pyq/consolidated_pyqs.json') as unknown[];
} catch {
  // File not found or invalid JSON — degrade gracefully
  rawData = [];
}

// Validate shape: must be an array
const ALL_PYQS: PYQQuestion[] = Array.isArray(rawData)
  ? (rawData as PYQQuestion[])
  : [];

// ─── Internal helpers ─────────────────────────────────────────────────────────

function matchSubjectAndClass(
  q: PYQQuestion,
  subject: 'mathematics' | 'science',
  classNum: 9 | 10
): boolean {
  return q.subject === subject && q.class === classNum;
}

function normaliseChapter(ch: string): string {
  return ch.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns PYQs filtered by subject, class, and chapter.
 * Optionally further filtered by question type.
 * Results are ordered: high-frequency first, then medium, then low/undefined.
 */
export function getPYQsByChapterAndType(
  subject: 'mathematics' | 'science',
  classNum: 9 | 10,
  chapter: string,
  type?: string,
  limit?: number
): PYQQuestion[] {
  const normChapter = normaliseChapter(chapter);

  let results = ALL_PYQS.filter(
    (q) =>
      matchSubjectAndClass(q, subject, classNum) &&
      normaliseChapter(q.chapter) === normChapter
  );

  if (type !== undefined) {
    const normType = type.toUpperCase();
    results = results.filter((q) => q.type.toUpperCase() === normType);
  }

  // Sort by frequency: high → medium → low → undefined
  const freqRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  results.sort((a, b) => {
    const ra = freqRank[a.frequency ?? ''] ?? 3;
    const rb = freqRank[b.frequency ?? ''] ?? 3;
    return ra - rb;
  });

  return limit !== undefined ? results.slice(0, limit) : results;
}

/**
 * Returns PYQs filtered by subject, class, and marks value.
 * Optionally further filtered by chapter.
 */
export function getPYQsByMarks(
  subject: 'mathematics' | 'science',
  classNum: 9 | 10,
  marks: number,
  chapter?: string,
  limit?: number
): PYQQuestion[] {
  let results = ALL_PYQS.filter(
    (q) => matchSubjectAndClass(q, subject, classNum) && q.marks === marks
  );

  if (chapter !== undefined) {
    const normChapter = normaliseChapter(chapter);
    results = results.filter((q) => normaliseChapter(q.chapter) === normChapter);
  }

  // Sort by frequency
  const freqRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  results.sort((a, b) => {
    const ra = freqRank[a.frequency ?? ''] ?? 3;
    const rb = freqRank[b.frequency ?? ''] ?? 3;
    return ra - rb;
  });

  return limit !== undefined ? results.slice(0, limit) : results;
}

/**
 * Keyword-based search across question text, chapter, and topic fields.
 * All supplied keywords must be present (AND semantics).
 * Case-insensitive.
 */
export function searchPYQs(
  subject: 'mathematics' | 'science',
  classNum: 9 | 10,
  keywords: string[],
  limit?: number
): PYQQuestion[] {
  if (keywords.length === 0) return [];

  const normKeywords = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  if (normKeywords.length === 0) return [];

  const results = ALL_PYQS.filter((q) => {
    if (!matchSubjectAndClass(q, subject, classNum)) return false;
    const haystack =
      `${q.question} ${q.chapter} ${q.topic ?? ''}`.toLowerCase();
    return normKeywords.every((kw) => haystack.includes(kw));
  });

  return limit !== undefined ? results.slice(0, limit) : results;
}

/**
 * Returns the total number of questions in the in-memory store.
 * Useful for health-checks and test assertions.
 */
export function getPYQStoreSize(): number {
  return ALL_PYQS.length;
}
