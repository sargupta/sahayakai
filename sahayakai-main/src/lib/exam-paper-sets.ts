/**
 * @fileOverview Derives multiple "sets" (A/B/C…) from one generated exam paper —
 * anti-cheating variants that hold the SAME questions but reshuffle their placement
 * within each section and renumber sequentially. Pure client-side derivation: no AI,
 * no server, no schema change. The shuffle is seeded by set index so a given set is
 * the same permutation every time (reprints match without persisting anything).
 */
import type { GeneratedPaper } from '@/app/exam-paper/types';

// mulberry32 — tiny deterministic PRNG. Same seed → same sequence, so "Set B" is a
// stable permutation across reopens.
// ponytail: seeded so sets need no persistence; swap for stored permutations only if
// teachers ever need to reprint an exact past variant after the paper itself changed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Build `count` variants of `paper`. Set 0 is the paper unchanged (identity), so
 * "Set A" always matches what's on screen. Each later set reshuffles the questions
 * WITHIN each section (never across sections) and renumbers by new position, so it
 * still reads sequentially. Marks are never touched → `sum(marks) === maxMarks`
 * holds for every set by construction.
 */
export function buildQuestionSets(paper: GeneratedPaper, count: number): GeneratedPaper[] {
  const sets: GeneratedPaper[] = [];
  for (let s = 0; s < Math.max(1, count); s++) {
    const copy: GeneratedPaper = structuredClone(paper);
    if (s > 0) {
      const rand = mulberry32((s * 2654435761) >>> 0);
      copy.sections?.forEach((section) => {
        const qs = section.questions ?? [];
        if (qs.length < 2) return; // nothing to reorder
        // Capture the section's existing numbers in ascending order, so we preserve
        // whatever convention the paper uses (per-section or continuous) while
        // guaranteeing the reshuffled order stays sequential.
        const numbers = qs
          .map((q, i) => q.number ?? q.questionNumber ?? i + 1)
          .sort((a, b) => a - b);
        shuffleInPlace(qs, rand);
        qs.forEach((q, i) => {
          q.number = numbers[i];
          if (q.questionNumber != null) q.questionNumber = numbers[i];
        });
      });
    }
    sets.push(copy);
  }
  return sets;
}

/** Display label for a set index: 0→A, 1→B, … */
export function setLabel(index: number): string {
  return String.fromCharCode(65 + index);
}
