/**
 * When a demo callback may ring, mirroring SamparkAI's callback rules: inside
 * calling hours (10:00–20:00 IST, Monday to Saturday), not on a school holiday,
 * at least a minute ahead and at most 30 days ahead. A refused time comes back
 * with the next permitted time for the person to choose; nothing is moved
 * silently.
 */

import { CALLBACK_MAX_AHEAD_MS, CALLBACK_MIN_LEAD_MS } from '@/lib/sampark/callbacks/state';
import { DEFAULT_CALLBACK_TIME_ZONE, zonedToUtc } from '@/lib/sampark/callbacks/time';

const TZ = DEFAULT_CALLBACK_TIME_ZONE;
export const CALL_START_HOUR = 10;
export const CALL_END_HOUR = 20;

export type TimeRefusal = 'past' | 'too_far' | 'sunday' | 'holiday' | 'outside_hours';

function wall(at: Date): { date: string; hour: number; minute: number; weekday: string } {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
            .formatToParts(at)
            .map((p) => [p.type, p.value]),
    );
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute), weekday: parts.weekday };
}

export function checkCallbackTime(at: Date, now: Date, holidays: readonly string[]): { ok: true } | { ok: false; why: TimeRefusal; next: Date | null } {
    const why = refusal(at, now, holidays);
    return why ? { ok: false, why, next: nextAllowed(why === 'past' ? now : at, now, holidays) } : { ok: true };
}

function refusal(at: Date, now: Date, holidays: readonly string[]): TimeRefusal | null {
    if (at.getTime() < now.getTime() + CALLBACK_MIN_LEAD_MS) return 'past';
    if (at.getTime() > now.getTime() + CALLBACK_MAX_AHEAD_MS) return 'too_far';
    const w = wall(at);
    if (w.weekday === 'Sun') return 'sunday';
    if (holidays.includes(w.date)) return 'holiday';
    const minutes = w.hour * 60 + w.minute;
    if (minutes < CALL_START_HOUR * 60 || minutes >= CALL_END_HOUR * 60) return 'outside_hours';
    return null;
}

/** The first permitted half-hour at or after `from`, or null if none within the 30-day limit. */
export function nextAllowed(from: Date, now: Date, holidays: readonly string[]): Date | null {
    const step = 30 * 60_000;
    let t = Math.ceil(Math.max(from.getTime(), now.getTime() + CALLBACK_MIN_LEAD_MS) / step) * step;
    const limit = now.getTime() + CALLBACK_MAX_AHEAD_MS;
    while (t <= limit) {
        const d = new Date(t);
        if (!refusal(d, now, holidays)) return d;
        const w = wall(d);
        // Jump to the next day's opening once the window has closed for today.
        if (w.hour >= CALL_END_HOUR || w.weekday === 'Sun' || holidays.includes(w.date)) {
            const [y, m, dd] = w.date.split('-').map(Number);
            t = zonedToUtc({ year: y, month: m, day: dd, hour: CALL_START_HOUR, minute: 0 }, TZ).getTime() + 86_400_000;
        } else if (w.hour < CALL_START_HOUR) {
            const [y, m, dd] = w.date.split('-').map(Number);
            t = zonedToUtc({ year: y, month: m, day: dd, hour: CALL_START_HOUR, minute: 0 }, TZ).getTime();
        } else {
            t += step;
        }
    }
    return null;
}

export const REFUSAL_TEXT: Record<TimeRefusal, string> = {
    past: 'That time has already passed.',
    too_far: 'Callbacks can be booked up to 30 days ahead.',
    sunday: 'The school does not call families on Sundays.',
    holiday: 'That day is a school holiday: no routine calls.',
    outside_hours: 'Families are called between 10:00 and 20:00.',
};
