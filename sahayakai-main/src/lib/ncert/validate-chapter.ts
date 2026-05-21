/**
 * Soft-validation helper used by AI flows.
 *
 * This is a thin wrapper around `validateChapter` from
 * `@/ai/data/ncert-chapters` that adapts each flow's input shape
 * (lesson-plan-generator uses `topic`, exam-paper-generator uses
 * `chapters[]`, quiz-generator uses `topic`) and normalises the warning into
 * a consistent metadata payload the routes/UI can surface.
 *
 * Contract: this function NEVER throws. AI generation must always proceed
 * even when validation fails — the validation warning is best-effort
 * additional context that surfaces in logs + response metadata for the
 * teacher to review.
 */

import {
    validateChapter,
    shouldAutoCorrect,
    type ChapterValidationResult,
} from '@/ai/data/ncert-chapters';

export interface ValidationWarning {
    /** Did the validator definitively reject the chapter? */
    invalid: boolean;
    /** Lenient passes are returned when the seed cell is pending/unknown — UI
     *  can still surface a "verifying" hint. */
    lenient: boolean;
    /** Best human-readable hint for the teacher. */
    message: string;
    /** When the suggestion is high-confidence, the canonical chapter we would
     *  auto-correct to (caller decides whether to apply). */
    autoCorrectTo?: { number: number; title: string };
    /** Echo of the raw inputs for trace correlation. */
    input: { gradeLevel: string; subject: string; chapter: string };
}

/**
 * Run validation and produce a flow-friendly summary. Returns `null` when the
 * inputs were valid (so callers can skip log noise on the happy path).
 */
export function validateChapterForFlow(args: {
    gradeLevel?: string | string[] | null;
    subject?: string | null;
    chapter?: string | number | null;
}): ValidationWarning | null {
    // Lesson-plan flow accepts `gradeLevels: string[]`; pick the first concrete
    // grade for validation (multi-grade lesson plans validate against the
    // primary class).
    const rawGrade = Array.isArray(args.gradeLevel) ? args.gradeLevel[0] : args.gradeLevel;
    if (!rawGrade || !args.subject || args.chapter === null || args.chapter === undefined) {
        return null; // Not enough signal to validate — caller proceeds silently.
    }
    const chapter = args.chapter;
    if (typeof chapter === 'string' && !chapter.trim()) return null;

    const result: ChapterValidationResult = validateChapter(rawGrade, args.subject, chapter);

    if (result.valid && !result.suggestion) return null; // happy path, no warning to surface

    const message = result.suggestion
        ?? result.reason
        ?? 'Chapter could not be confirmed against the NCERT seed.';

    const warning: ValidationWarning = {
        invalid: !result.valid,
        lenient: !!result.lenient,
        message,
        input: {
            gradeLevel: String(rawGrade),
            subject: String(args.subject),
            chapter: String(chapter),
        },
    };
    if (shouldAutoCorrect(result) && result.closestMatch) {
        warning.autoCorrectTo = result.closestMatch;
    }
    return warning;
}

export { validateChapter } from '@/ai/data/ncert-chapters';
