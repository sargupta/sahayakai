/**
 * @fileOverview Shared PYQ validation + field normalisers.
 *
 * Single source of truth for the small set of normalisers the PYQ writers agree
 * on (seed-pyqs, consolidate-pyqs, the derivePYQDocId dedup key). Kept dependency-
 * free (no firebase, no genkit) so every writer and the retrieval service can
 * import it without dragging in a heavy module.
 */

export type PYQSubject = 'mathematics' | 'science';
export type PYQClass = 9 | 10;
export type PYQType = 'MCQ' | 'VSA' | 'SA' | 'LA' | 'case_study';

/** Lowercased, trimmed, whitespace-collapsed — the canonical text form used for
 *  dedup keys and the doc-id hash so trivial whitespace/case noise never forks. */
export function normaliseText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Strips a qualifier like "(Standard)"/"(Basic)" (anywhere, not just at the
 *  end — some headers read "Mathematics (Standard) - Theory") and a trailing
 *  "- Theory"/"- Practical" component suffix, then matches against English +
 *  Hindi aliases (including the science sub-subjects). CBSE papers print both
 *  forms and the exact-match list would otherwise reject them as unrecognized. */
export function normaliseSubject(raw: string): PYQSubject | null {
  const s = raw.trim().toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*-\s*(theory|practical)\s*$/i, '')
    .trim();
  if (['mathematics', 'maths', 'math', 'गणित'].includes(s)) return 'mathematics';
  if (['science', 'physics', 'chemistry', 'biology', 'विज्ञान'].includes(s)) return 'science';
  return null;
}

export function normaliseClass(raw: unknown): PYQClass | null {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN;
  if (n === 9 || n === 10) return n;
  return null;
}

/** Canonicalise a free-text board to a consistent display form so every writer, the backfill, and
 *  retrieval agree — the fix for inconsistent board tagging across the corpus. Alias + substring
 *  fallback covers the corpus boards and common variants; an unrecognised board falls back to a
 *  trimmed/collapsed passthrough (deterministic, and won't collide with a known board → excluded by
 *  a board-scoped query). */
export function canonicaliseBoard(raw: string): string {
  const s = normaliseText(raw); // lowercase + trim + collapse whitespace
  if (!s) return '';
  if (s.includes('cbse') || s.includes('central board')) return 'CBSE';
  if (s.includes('icse') || s.includes('indian school certificate')) return 'ICSE';
  if (s.includes('karnataka') || s.includes('kseeb')) return 'Karnataka SSLC';
  if (s.includes('telangana') || s.includes('tsbie')) return 'Telangana SSC';
  return raw.trim().replace(/\s+/g, ' '); // unknown → cleaned passthrough
}

/** Canonicalise a paper's set/series label to a consistent display form:
 *  "SET-1"/"set  1"/"Set-A" → "Set 1"/"Set A". A series code like "30/1/1"
 *  doesn't match the "Set N" shape and passes through unchanged (just
 *  trimmed/whitespace-collapsed) — it's already standard. Metadata only,
 *  same as the field itself — not part of derivePYQDocId. */
export function normaliseSet(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  if (!collapsed) return null;
  const m = collapsed.match(/^set[\s_-]*([0-9a-z]+)$/i);
  return m ? `Set ${m[1].toUpperCase()}` : collapsed;
}

export function normaliseType(raw: string): PYQType | null {
  const t = raw.toUpperCase().trim();
  if (t === 'MCQ') return 'MCQ';
  if (t === 'VSA') return 'VSA';
  if (t === 'SA') return 'SA';
  if (t === 'LA') return 'LA';
  if (t === 'CASE_STUDY' || t === 'CASE STUDY') return 'case_study';
  return null;
}

export const VALID_TYPES: readonly PYQType[] = ['MCQ', 'VSA', 'SA', 'LA', 'case_study'];

/** Minimal shape validate() reads — accepts the raw JSON/extraction rows. */
export interface RawPYQ {
  question?: unknown;
  subject?: unknown;
  class?: unknown;
  chapter?: unknown;
  marks?: unknown;
  type?: unknown;
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

/**
 * Reject a PYQ row that would corrupt the corpus (missing text/chapter, unknown
 * subject/class/type, non-numeric marks). Returns the reasons so the caller can
 * log which rows it skipped. Never throws.
 */
export function validate(q: RawPYQ): ValidationResult {
  const reasons: string[] = [];

  if (!q.question || typeof q.question !== 'string' || q.question.trim() === '') {
    reasons.push('missing question text');
  }
  if (q.subject === undefined || normaliseSubject(String(q.subject)) === null) {
    reasons.push(`invalid subject: "${String(q.subject)}"`);
  }
  if (q.class === undefined || normaliseClass(q.class) === null) {
    reasons.push(`invalid class: "${String(q.class)}"`);
  }
  if (!q.chapter || typeof q.chapter !== 'string' || q.chapter.trim() === '') {
    reasons.push('missing chapter');
  }
  if (q.marks === undefined || isNaN(Number(q.marks))) {
    reasons.push(`invalid marks: "${String(q.marks)}"`);
  }
  if (q.type === undefined || normaliseType(String(q.type)) === null) {
    reasons.push(`invalid type: "${String(q.type)}" (must be one of: ${VALID_TYPES.join(', ')})`);
  }

  return { valid: reasons.length === 0, reasons };
}
