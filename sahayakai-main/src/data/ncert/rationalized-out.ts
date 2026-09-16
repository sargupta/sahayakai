/**
 * Rationalized-out chapter registry (deprecation record).
 *
 * The "retain, never delete" side of the syllabus-resilience invariant (Phase 3):
 * chapters a board REMOVED from the current syllabus are recorded here so the
 * system can distinguish "off-syllabus, do not serve" from "unknown chapter".
 * Without this, a removed chapter simply fails to resolve and PYQ retrieval
 * silently falls back to a title match — serving off-syllabus questions.
 *
 * These entries were removed from `src/data/ncert/*` before the retain-don't-
 * delete convention existed, so they are re-captured here rather than re-inserted
 * (with fabricated numbers/ids) into the large per-subject files. GOING FORWARD,
 * deprecate in place with `isActive: false` on the chapter; use this registry
 * only for chapters already gone from the main files.
 *
 * Scope: only chapters that still have PYQs in the bank need to be here (the
 * currency guard only matters where questions exist). Add more as the orphan
 * report surfaces them.
 */

export interface RationalizedOutChapter {
    /** Numeric grade (9, 10, …). */
    grade: number;
    /** Canonical subject key ('Science', 'Mathematics', …) — matches canonicaliseSubject output. */
    subject: string;
    /** The chapter's title as it appeared on the syllabus / in PYQ papers. */
    title: string;
    /** Spelling / punctuation variants seen in PYQ papers. */
    aliases?: string[];
    /** When/why it left the syllabus (provenance for the Curriculum Owner). */
    removedIn?: string;
}

const CBSE_2023 = '2023-CBSE-rationalization';

export const RATIONALIZED_OUT: RationalizedOutChapter[] = [
    // ── Class 10 Science ──────────────────────────────────────────────────────
    { grade: 10, subject: 'Science', title: 'Periodic Classification of Elements', removedIn: CBSE_2023 },
    { grade: 10, subject: 'Science', title: 'Sources of Energy', removedIn: CBSE_2023 },
    { grade: 10, subject: 'Science', title: 'Management of Natural Resources', removedIn: CBSE_2023 },
    // ── Class 9 Science ───────────────────────────────────────────────────────
    { grade: 9, subject: 'Science', title: 'Diversity in Living Organisms', removedIn: CBSE_2023 },
    { grade: 9, subject: 'Science', title: 'Why Do We Fall Ill', aliases: ['Why Do We Fall Ill?'], removedIn: CBSE_2023 },
    // ── Mathematics (Constructions rationalized out of the board exam) ─────────
    { grade: 10, subject: 'Mathematics', title: 'Constructions', removedIn: CBSE_2023 },
    { grade: 9, subject: 'Mathematics', title: 'Constructions', removedIn: CBSE_2023 },
];
