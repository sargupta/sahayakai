/**
 * Scores for the call-quality bench. Pure: no network, no clock.
 *
 * Word error rate uses the same normalisation the voice gates use (speech/verify.ts:
 * script folding, numbers, punctuation), so a bench score and a render-gate score mean
 * the same thing. Must-hear words use the hard-word probe's matcher (speech/probe.ts).
 */

import { missingHardWords } from '@/lib/sampark/speech/probe';
import { levenshtein, normaliseForCompare } from '@/lib/sampark/speech/verify';
import type { ParentLanguage } from '@/types/sampark';

function words(text: string, language: ParentLanguage): string[] {
    return normaliseForCompare(text, language).split(' ').filter(Boolean);
}

/** Word error rate: (substitutions + insertions + deletions) / reference words. 0 is perfect; can exceed 1. */
export function wordErrorRate(expected: string, transcript: string, language: ParentLanguage): number {
    const ref = words(expected, language);
    const hyp = words(transcript, language);
    if (ref.length === 0) return hyp.length === 0 ? 0 : 1;
    return levenshtein(ref, hyp) / ref.length;
}

/** The must-hear words the transcript lost. */
export function missingWords(transcript: string, mustHear: readonly string[], language: ParentLanguage): string[] {
    return missingHardWords(transcript, [...mustHear], language);
}

/** Nearest-rank percentile of the finite values; null when there are none. */
export function percentile(values: readonly number[], p: number): number | null {
    const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (v.length === 0) return null;
    const rank = Math.min(v.length, Math.max(1, Math.ceil((p / 100) * v.length)));
    return v[rank - 1];
}

export function mean(values: readonly number[]): number | null {
    const v = values.filter((x) => Number.isFinite(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
