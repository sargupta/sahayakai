/**
 * Time-saved estimator for the principal dashboard.
 *
 * Heuristic: each piece of content generated saves a fixed number of minutes
 * versus manual preparation, based on the Karnataka government-school pilot
 * self-reported baselines (N=150, Q4 2025). Numbers are deliberately
 * conservative; the dashboard displays "estimated" and exposes a "see
 * assumptions" link so a principal asking "how did you calculate that?" gets
 * a concrete answer (not a magic number).
 *
 * Baseline times come from the teacher-time research cited in
 * outputs/investment_and_proposals/pitch_strategy_2026/EVIDENCE_AND_SOURCES.md
 * (UNESCO 2023 teacher-time surveys + pilot self-reports).
 *
 * Update these values only with new pilot data; do not tune them to hit a
 * specific demo number.
 */

export const CONTENT_TIME_SAVED_MINUTES = {
    'lesson-plan': 35, // baseline ~45 min, SahayakAI ~5 min output + ~5 min teacher edit
    'quiz': 20, // baseline ~25 min per 3-level quiz
    'worksheet': 15, // baseline ~20 min manual + answer key
    'visual-aid': 10, // baseline ~15 min sketching or sourcing
    'rubric': 25, // baseline ~30 min CCE-aligned rubric
    'exam-paper': 40, // baseline ~60 min board-exam style
    'instant-answer': 3, // teacher research savings
    'field-trip': 30, // virtual field-trip planning
} as const;

export const CONTENT_EDIT_BONUS_MINUTES = 5;

export type ContentType = keyof typeof CONTENT_TIME_SAVED_MINUTES;

export interface TimeSavedInput {
    /** Count of `content_created` events by content_type in the window. */
    contentByType: Partial<Record<ContentType, number>>;
    /** Count of `content_edited` events in the window (any type). */
    editsCount?: number;
}

export interface TimeSavedResult {
    totalMinutes: number;
    totalHours: number;
    byType: Partial<Record<ContentType, number>>;
    assumptionsRef: string;
}

export function estimateTimeSaved(input: TimeSavedInput): TimeSavedResult {
    const byType: Partial<Record<ContentType, number>> = {};
    let totalMinutes = 0;

    for (const [type, count] of Object.entries(input.contentByType) as Array<[ContentType, number]>) {
        const minutesPerItem = CONTENT_TIME_SAVED_MINUTES[type];
        if (minutesPerItem === undefined) continue;
        const saved = (count || 0) * minutesPerItem;
        byType[type] = saved;
        totalMinutes += saved;
    }

    const edits = input.editsCount ?? 0;
    totalMinutes += edits * CONTENT_EDIT_BONUS_MINUTES;

    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    return {
        totalMinutes,
        totalHours,
        byType,
        assumptionsRef:
            'Based on self-reported baselines from the Karnataka government-school pilot (N=150, Q4 2025). Numbers are conservative estimates, not measured outcomes.',
    };
}
