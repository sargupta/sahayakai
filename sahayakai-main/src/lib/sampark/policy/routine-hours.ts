/**
 * The routine calling band, in one place.
 *
 * Founder decision, 23 Oct 2026: every routine parent call happens between 10:00 and 19:00
 * IST, whatever starts it (a Sampark campaign, a teacher in the app, an API call). Only the
 * emergency closure (D4) has its own band, in window.ts.
 *
 * Pure and client-safe. The settings screen's hour pickers, the school API's schema and the
 * dispatcher's clamp all read these numbers, so they cannot drift apart
 * (gate-routine-window-single-source.test.ts).
 */

/** First IST hour a routine call may start (inclusive). */
export const ROUTINE_START_FLOOR_HOUR = 10;
/** IST hour by which every routine call has started (exclusive). */
export const ROUTINE_END_CEILING_HOUR = 19;

function hoursFrom(first: number, last: number): number[] {
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/** Start hours a school may pick: the floor up to one hour before the ceiling. */
export const ROUTINE_START_HOUR_OPTIONS: readonly number[] = hoursFrom(ROUTINE_START_FLOOR_HOUR, ROUTINE_END_CEILING_HOUR - 1);
/** End hours a school may pick: one hour after the floor up to the ceiling. */
export const ROUTINE_END_HOUR_OPTIONS: readonly number[] = hoursFrom(ROUTINE_START_FLOOR_HOUR + 1, ROUTINE_END_CEILING_HOUR);
