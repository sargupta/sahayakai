/**
 * PYQ Retrieval Service
 *
 * Filter-based retrieval of Past Year Questions (PYQs) stored in the
 * `pyq_questions` Firestore collection. Questions are seeded as plain tagged
 * documents (see src/scripts/seed-pyqs.ts) and looked up by exact tag match
 * (subject / class / chapter) — no embeddings / semantic search.
 */

import { getDb } from '@/lib/firebase-admin';
import { StructuredLogger } from '@/lib/logger/structured-logger';
import { normaliseText, canonicaliseBoard } from '@/lib/pyq/normalize';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLECTION = 'pyq_questions';

// ponytail: per-chapter inventory scan is capped at 2000 docs — headroom for the
// 10-year-history plan. The cap is applied at the query level (.limit) BEFORE the
// client-side recency sort, so a chapter over the cap returns an arbitrary doc-id
// slice and "newest first" can't recover the newest (H11). We now WARN on cap-hit
// instead of truncating silently. Real fix: orderBy('year','desc') at the query
// level + a backfilled/existing `year` field + a Firestore composite index — needs
// a deploy, out of scope here.
const CHAPTER_INVENTORY_CAP = 2000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PYQQuestion {
  topic?: string;
  id: string;
  question: string;
  subject: 'mathematics' | 'science';
  class: 9 | 10;
  year: number | null;
  chapter: string;
  /** Stable chapter id (e.g. 'math-10-1') — rename-proof join key (Phase 1).
   *  Optional: absent on docs not yet backfilled; retrieval falls back to the
   *  `chapter` title for those. */
  chapterId?: string;
  /** Stable, chapter-independent topic membership ids (Phase 4). A question
   *  follows its topics across chapter moves. Empty `[]` when the classifier
   *  could not map the question to any authored topic ("topic-unmappable") —
   *  such docs survive on the chapterId inventory leg (see getPYQsByChapter). */
  topicIds?: string[];
  /** Topic-seed version this doc was classified against (Phase 4, F8). Lets the
   *  backfill re-classify only stale-version docs. Read-only display here. */
  topicClassVersion?: string;
  marks: number;
  type: 'MCQ' | 'VSA' | 'SA' | 'LA' | 'case_study';
  board: string;
  answer?: string;
  frequency?: 'high' | 'medium' | 'low';
  section?: string; // 'Physics' | 'Chemistry' | 'Biology' for science
  /** Paper set/series (e.g. 'Set 1', '30/1/1'); null when the paper prints none. Metadata only —
   *  deliberately NOT part of derivePYQDocId, so adding it needs no corpus re-key. */
  set?: string | null;
}

// ─── Doc ID (shared by every writer so idempotency can't drift) ─────────────────

/**
 * Derive a stable document ID from a question so writes are idempotent.
 * djb2-style hash of board|subject|class|chapterKey|type|year|marks|full-question.
 * Shared by seed-pyqs.ts and ingest-pyq-pdfs.ts — do not fork this.
 *
 * Keyed on `chapterId ?? normaliseText(chapter)` (H8): both writers resolve
 * `chapterId` before deriving, so a raw vs canonicalised title no longer forks
 * the id, and stamping a chapterId keeps the same key. Hashes the FULL normalised
 * question text — not a 80-char prefix (L12) — so two questions sharing a long
 * preamble get distinct ids and whitespace/case noise no longer duplicates a row.
 *
 * ⚠️ NOT back-compatible with the old prefix/title-based scheme: existing docs
 * must be re-keyed once via src/scripts/rekey-pyq-doc-ids.ts (dry-run first).
 */
export function derivePYQDocId(q: Omit<PYQQuestion, 'id'>): string {
  const chapterKey = q.chapterId ?? normaliseText(q.chapter);
  const raw = [
    normaliseText(q.board),
    q.subject,
    String(q.class),
    chapterKey,
    q.type,
    String(q.year ?? 'null'),
    String(q.marks),
    normaliseText(q.question),
  ].join('|');

  // Simple djb2-style hash — good enough for dedup; not crypto
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return `${q.board}_${q.subject}_c${q.class}_${hash.toString(16)}`;
}

/**
 * Canonicalise a free-text ingest/paper subject to the two subjects retrieval
 * queries by (`mathematics` | `science`), or `null` when it is neither (e.g.
 * Sanskrit, Social Studies) so the caller can skip the paper. Accepts the common
 * component-subject aliases (Physics/Chemistry/Biology → science) and the
 * Devanagari forms (गणित, विज्ञान). Distinct from `canonicaliseSubject` in
 * ncert-chapters (Title-case, 11-12 split) — this one targets the PYQ corpus.
 *
 * Re-exported from `@/lib/pyq/normalize` (single source of truth — this file
 * used to keep its own diverging copy, which risked writer scripts and this
 * retrieval path normalising the same raw subject string differently).
 */
export { normaliseSubject as normalisePyqSubject } from '@/lib/pyq/normalize';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function docToPYQ(id: string, data: FirebaseFirestore.DocumentData): PYQQuestion {
  return {
    id,
    question: data.question,
    subject: data.subject,
    class: data.class,
    year: data.year ?? null,
    chapter: data.chapter,
    chapterId: data.chapterId,
    // Default to [] so downstream membership checks never hit `undefined`.
    // A doc without the field is treated as topic-unmappable (survives on the
    // chapterId leg, never dropped by the topic-currency rule).
    topicIds: data.topicIds ?? [],
    topicClassVersion: data.topicClassVersion,
    marks: data.marks,
    type: data.type,
    board: data.board,
    answer: data.answer,
    frequency: data.frequency,
    section: data.section,
    set: data.set ?? null,
  };
}

/**
 * Split topic ids into chunks of ≤30 for Firestore's `array-contains-any` cap
 * (30 values / one array filter per query — §9-J, F14). Each chunk becomes one
 * leg-(b) query; results are merged. Exported for unit testing.
 */
export function chunkTopicIds(ids: string[], size = 30): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * Live-currency filter over the retrieval union (§9-E, conservative). Pure so it
 * can be unit-tested; the caller injects the two currency predicates.
 *
 * A candidate is DROPPED when EITHER:
 *   - ANY of its tagged topics is inactive (`isTopicActive === false`) — the
 *     conservative multi-topic rule: one off-syllabus topic excludes the whole
 *     question; OR
 *   - its chapter is off-syllabus (`isChapterOffSyllabus`) AND it carries no
 *     still-active tagged topic (nothing moved it back onto the syllabus).
 *
 * Questions with `topicIds: []` (topic-unmappable) are NOT dropped by the topic
 * rule — `some()` over an empty list is false — so they survive on the leg-(a)
 * chapterId inventory. That is the whole point of F1: no silent ~10% loss of the
 * un-classified backlog at the P3→P4 cutover.
 */
export function filterLivePYQs<T extends { chapter?: string; topicIds?: string[] }>(
  items: T[],
  deps: {
    isChapterOffSyllabus: (item: T) => boolean;
    isTopicActive: (topicId: string) => boolean;
  }
): T[] {
  return items.filter((item) => {
    const topicIds = item.topicIds ?? [];
    // Rule 2 — conservative: any single inactive tagged topic excludes.
    if (topicIds.some((t) => !deps.isTopicActive(t))) return false;
    // Rule 1 — off-syllabus chapter with no active tagged topic to redeem it.
    if (deps.isChapterOffSyllabus(item) && !topicIds.some((t) => deps.isTopicActive(t))) {
      return false;
    }
    return true;
  });
}

/**
 * Fill `limit` slots from `sorted` (already ordered newest-first) so the result mirrors the
 * paper's section/marks weightage: each marks bucket contributes a share proportional to
 * `marksWeight` (marks value → that section's total-marks contribution to the paper).
 *
 * Weighted round-robin across marks buckets (newest-first within each), so the result is both
 * SPREAD across buckets and PROPORTIONAL to weight — then a newest-first backfill fills any slots
 * left by rounding or a bucket the corpus can't supply. With no `marksWeight`, every bucket is
 * uncapped, so the round-robin degrades to an even spread (1 per bucket per round). Pure; exported
 * for unit testing.
 */
export function pickByMarksWeight<T extends { marks: number }>(
  sorted: T[],
  limit: number,
  marksWeight?: Record<number, number>
): T[] {
  if (sorted.length <= limit) return sorted;

  // Bucket by marks, preserving incoming newest-first order within each bucket.
  const buckets = new Map<number, T[]>();
  for (const q of sorted) {
    const b = buckets.get(q.marks);
    if (b) b.push(q);
    else buckets.set(q.marks, [q]);
  }
  const marks = [...buckets.keys()].sort((a, b) => a - b);
  const wSum = marksWeight ? marks.reduce((s, m) => s + (marksWeight[m] ?? 0), 0) : 0;
  // Per-bucket cap: proportional to section/marks weight, or unbounded (even spread) with no weight.
  const cap = new Map<number, number>(
    marks.map((m) => [m, marksWeight && wSum > 0 ? Math.round((limit * (marksWeight[m] ?? 0)) / wSum) : limit])
  );

  const out: T[] = [];
  const cursor = new Map<number, number>(marks.map((m) => [m, 0]));
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (const m of marks) {
      if (out.length >= limit) break;
      const items = buckets.get(m)!;
      const i = cursor.get(m)!;
      if (i < items.length && (cap.get(m) ?? 0) > 0) {
        out.push(items[i]);
        cursor.set(m, i + 1);
        cap.set(m, (cap.get(m) ?? 0) - 1);
        progressed = true;
      }
    }
  }
  // Backfill leftover slots newest-first (rounding shortfall, or a needed bucket the corpus lacks).
  if (out.length < limit) {
    const taken = new Set(out);
    for (const q of sorted) {
      if (out.length >= limit) break;
      if (!taken.has(q)) out.push(q);
    }
  }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Filter-based retrieval — a deduped UNION of two legs (Phase 4, §5.2, F1),
 * both filtered by subject + class (the optional `board` arg scopes the result in-memory via
 * canonicaliseBoard so a paper only draws its own board's PYQs — see the param note below):
 *
 *   Leg (a)  `chapterId ==` — the reliable inventory leg: every correctly
 *            chapter-mapped PYQ, INCLUDING topic-unmappable ones (`topicIds:[]`).
 *            Falls back to the display-title match for un-backfilled/unmappable
 *            chapters, exactly as Phases 1–3 did.
 *   Leg (b)  `topicIds array-contains-any C.activeTopicIds` — catches questions
 *            whose topic was MOVED IN from another chapter. Skipped when the
 *            chapter has no authored active topics (behaviour then == pure
 *            leg (a), the graceful path for unseeded chapters). Batched into
 *            ≤30-value chunks for Firestore's `array-contains-any` cap (§9-J).
 *
 * The union is deduped by Firestore doc id, then a live-currency filter
 * (`filterLivePYQs`, §9-E conservative) drops off-syllabus questions.
 *
 * INVENTORY PRESERVATION (F1): vs the Phase-3 title/chapterId baseline, the
 * union can only ADD documents (leg (b) is a superset overlay on leg (a)), and
 * the currency filter never drops a `topicIds:[]` document via the topic rule
 * (`some()` over [] is false). So every un-backfilled / topic-unmappable doc
 * that Phase 3 served is still served here — no silent ~10% cutover loss —
 * while moved-in topics are gained. The only new exclusions are genuinely
 * off-syllabus docs (inactive tagged topic, or removed chapter with nothing
 * active tagged), which is the intended currency behaviour, not inventory drop.
 *
 * Requires the Firestore composite index (topicIds array-contains, subject,
 * class) for leg (b) — see firestore.indexes.json. Leg (a) is equality-only and
 * auto-served by single-field indexes (no composite needed).
 *
 * Graceful degradation: any topic-side failure (leg (b) query or the currency
 * filter) WARNs and falls back to the leg-(a) result — never throws to caller.
 * Results are ordered by frequency (high → medium → low).
 */
export async function getPYQsByChapter(
  chapter: string,
  subject: string,
  classNum: number,
  limit = 20,
  // Optional marks-bucket weighting (marks value → that section's total-marks weight in the
  // paper). When supplied, the returned `limit` questions mirror the paper's section/marks
  // distribution instead of being top-N by recency/frequency. Absent → even marks spread.
  marksWeight?: Record<number, number>,
  // Optional board scope. When supplied, only questions whose board canonicalizes to the same
  // value are returned (e.g. a CBSE paper won't draw Karnataka SSLC PYQs). Compared via
  // canonicaliseBoard on BOTH sides so inconsistent tagging in the corpus can't silently drop
  // docs. Absent → no board scoping (back-compat).
  board?: string
): Promise<PYQQuestion[]> {
  // L4: the whole body (getDb, taxonomy import, both leg queries) is wrapped so
  // any infra failure WARNs and degrades to [] — the service owns its own safety
  // rather than relying on the caller's catch.
  const logCtx = {
    service: 'pyq-retrieval-service',
    operation: 'getPYQsByChapter',
  } as const;
  try {
    const db = await getDb();
    const col = db.collection(COLLECTION);

    // H11: the cap is a .limit() applied BEFORE the client-side recency sort, so a
    // full snapshot is an arbitrary (doc-id-ordered) slice that may have dropped the
    // newest docs. Surface it instead of truncating silently.
    const warnIfCapped = (count: number, leg: string) => {
      if (count >= CHAPTER_INVENTORY_CAP)
        StructuredLogger.warn(
          `getPYQsByChapter: inventory scan hit the cap (${CHAPTER_INVENTORY_CAP}) on leg "${leg}" for "${chapter}" (Class ${classNum} ${subject}) — results may be truncated; newest-first is NOT guaranteed.`,
          { ...logCtx, metadata: { chapter, classNum, subject, cap: CHAPTER_INVENTORY_CAP, leg } }
        );
    };

    // NOTE: orderBy('frequency') on a string enum is lexicographically wrong
    // ('medium' > 'low' > 'high'), so we sort client-side with a numeric rank
    // AFTER unioning — hence no pre-sort limit (M3); cap the scan instead.
    const runEqQuery = (field: 'chapterId' | 'chapter', value: string) =>
      col
        .where(field, '==', value)
        .where('subject', '==', subject)
        .where('class', '==', classNum)
        .limit(CHAPTER_INVENTORY_CAP)
        .get();

    // Lazy import keeps the heavy NCERT taxonomy out of this module's cold start.
    const { resolveChapterId, isChapterRemoved, getActiveTopicIds, isTopicActive } = await import(
      '@/ai/data/ncert-chapters'
    );
    const gradeLabel = `Class ${classNum}`;
    const chapterId = resolveChapterId(gradeLabel, subject, chapter);

    // ── Leg (a): reliable chapterId inventory (with title fallback) ─────────────
    const union = new Map<string, PYQQuestion>();
    if (chapterId) {
      // H5: always run BOTH legs and union by doc id — stamping leaves `chapter`
      // untouched, so the chapterId leg (stamped, incl. renamed) and the title leg
      // (every doc still under this title, incl. un-backfilled) together are the
      // complete recoverable inventory. Removing the `if (snapshot.empty)` gate
      // fixes the partial-backfill gap where stamped + un-stamped docs coexist.
      const [byId, byTitle] = await Promise.all([
        runEqQuery('chapterId', chapterId),
        runEqQuery('chapter', chapter),
      ]);
      warnIfCapped(byId.docs.length, 'chapterId');
      warnIfCapped(byTitle.docs.length, 'title');
      for (const doc of [...byId.docs, ...byTitle.docs]) union.set(doc.id, docToPYQ(doc.id, doc.data()));
    } else if (isChapterRemoved(gradeLabel, subject, chapter)) {
      // Currency guard (Phase 3): the chapter was rationalized OUT of the syllabus.
      // Serve nothing — do NOT title-fallback, which would surface off-syllabus PYQs.
      StructuredLogger.warn(
        `getPYQsByChapter: "${chapter}" (Class ${classNum} ${subject}) is rationalized-out (off current syllabus) — returning no PYQs.`,
        { ...logCtx, metadata: { chapter, classNum, subject, reason: 'rationalized-out' } }
      );
      return [];
    } else {
      StructuredLogger.warn(
        `getPYQsByChapter: "${chapter}" (Class ${classNum} ${subject}) did not resolve to a chapterId — falling back to title match.`,
        { ...logCtx, metadata: { chapter, classNum, subject, reason: 'no-chapterId' } }
      );
      const snapshot = await runEqQuery('chapter', chapter);
      warnIfCapped(snapshot.docs.length, 'title');
      for (const doc of snapshot.docs) union.set(doc.id, docToPYQ(doc.id, doc.data()));
    }

    // Leg (a) is the guaranteed floor — the fallback if the topic side fails.
    const legA = [...union.values()];

    // ── Leg (b) + live-currency filter (best-effort; never throws to caller) ────
    let candidates = legA;
    try {
      if (chapterId) {
        const activeTopicIds = getActiveTopicIds(chapterId);
        // Empty → SKIP leg (b) entirely (unseeded chapter → pure leg (a)).
        for (const chunk of chunkTopicIds(activeTopicIds)) {
          const snapshot = await col
            .where('topicIds', 'array-contains-any', chunk)
            .where('subject', '==', subject)
            .where('class', '==', classNum)
            .limit(CHAPTER_INVENTORY_CAP)
            .get();
          warnIfCapped(snapshot.docs.length, 'topic');
          for (const doc of snapshot.docs) union.set(doc.id, docToPYQ(doc.id, doc.data()));
        }
      }
      candidates = filterLivePYQs([...union.values()], {
        isChapterOffSyllabus: (p) => (p.chapter ? isChapterRemoved(gradeLabel, p.subject, p.chapter) : false),
        isTopicActive,
      });
    } catch (err) {
      StructuredLogger.warn(
        `getPYQsByChapter: topic-side (leg (b) / currency filter) failed for "${chapter}" (Class ${classNum} ${subject}) — serving leg (a) only.`,
        { ...logCtx, metadata: { chapter, classNum, subject, error: err instanceof Error ? err.message : String(err) } }
      );
      candidates = legA;
    }

    // Board scope (post-query, in-memory): canonicalize BOTH sides so inconsistent tagging can't
    // silently drop docs, and no composite index is needed on either leg. Unmappable boards
    // canonicalize to a distinct passthrough → excluded (fail-closed). No board → unchanged.
    const scoped = board
      ? candidates.filter((p) => canonicaliseBoard(p.board ?? '') === canonicaliseBoard(board))
      : candidates;

    const freqRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    // Latest year first (recent papers reflect the current exam pattern/syllabus), then frequency
    // as the tiebreaker. year can be null → those sort last (-Infinity).
    const sorted = scoped.sort((a, b) => {
      const ya = a.year ?? -Infinity;
      const yb = b.year ?? -Infinity;
      if (ya !== yb) return yb - ya;
      return (freqRank[a.frequency ?? ''] ?? 3) - (freqRank[b.frequency ?? ''] ?? 3);
    });

    // Sort THEN marks-shaped select — recent/high-freq docs win regardless of doc-id order in the
    // capped scan (M3), and the returned slice mirrors the paper's section/marks weightage (even
    // marks spread when no weight supplied).
    return pickByMarksWeight(sorted, limit, marksWeight);
  } catch (err) {
    StructuredLogger.warn(
      `getPYQsByChapter: retrieval failed for "${chapter}" (Class ${classNum} ${subject}) — returning no PYQs.`,
      { ...logCtx, metadata: { chapter, classNum, subject, error: err instanceof Error ? err.message : String(err) } }
    );
    return [];
  }
}
