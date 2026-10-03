/**
 * Classifies existing `instant-answer` Library rows for the one-off
 * reclassification (scripts/migrate-library-instant-answers.ts).
 *
 * Until 2026-10 every instant answer — including greetings and navigation
 * questions routed through /api/ai/intent or VIDYA — was auto-saved to
 * `users/{uid}/content`. Those rows are conversation, not artifacts. Rows the
 * teacher saved with the Save button are artifacts and must stay.
 *
 * The writers left distinguishable shapes (all fields below really exist):
 *
 *   AUTO (Genkit `instantAnswerFlow`, and the sidecar `persistSidecarJSON`):
 *     - top-level gradeLevel / subject / language set
 *     - title === topic === the full question
 *     - data = { answer, videoSuggestionUrl, gradeLevel, subject, grounded } —
 *       NO `language` key
 *     - storagePath users/{uid}/instant-answers/{yyyyMMdd_HHmmss}_{slug}.json
 *
 *   SAVED (Save button → `saveToLibrary`):
 *     - NO top-level gradeLevel (saveToLibrary never wrote it)
 *     - data carries a `language` key (form context; `dbAdapter.saveContent`
 *       keeps the key even when the value was undefined → null)
 *
 * Anything else is AMBIGUOUS and is kept. The migration only ever HIDES
 * (`hiddenFromLibrary: true`, reversible) — it never deletes.
 */

export type InstantAnswerRowClass = 'auto' | 'saved' | 'ambiguous' | 'not-instant-answer';

export interface ClassifiedRow {
    rowClass: InstantAnswerRowClass;
    reason: string;
}

const AUTO_STORAGE_PATH = /^users\/[^/]+\/instant-answers\/\d{8}_\d{6}_[^/]*\.json$/;

export function classifyInstantAnswerRow(row: Record<string, unknown>): ClassifiedRow {
    if (row.type !== 'instant-answer') return { rowClass: 'not-instant-answer', reason: 'type' };

    const data = (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>;
    const dataHasLanguage = Object.prototype.hasOwnProperty.call(data, 'language');
    const hasTopLevelGrade = typeof row.gradeLevel === 'string' && row.gradeLevel.length > 0;

    if (dataHasLanguage && !hasTopLevelGrade) {
        return { rowClass: 'saved', reason: 'saveToLibrary shape (explicit Save)' };
    }

    const titleIsQuestion = typeof row.title === 'string' && row.title.length > 0 && row.title === row.topic;
    const autoPath = typeof row.storagePath === 'string' && AUTO_STORAGE_PATH.test(row.storagePath);
    if (!dataHasLanguage && hasTopLevelGrade && titleIsQuestion && autoPath && typeof data.answer === 'string') {
        return { rowClass: 'auto', reason: 'instant-answer flow auto-save shape' };
    }

    return { rowClass: 'ambiguous', reason: 'shape matches neither writer — kept' };
}

/** Marker written on hidden rows so `--revert` touches only this script's work. */
export const LIBRARY_MIGRATION_ID = 'instant-answer-reclassification-2026-10';
