/**
 * Calendar arithmetic in the school's zone, on top of the zone helpers in
 * src/lib/sampark/callbacks/time.ts. Pure; client-safe.
 */

import { zonedParts, zonedToUtc } from "@/lib/sampark/callbacks/time";

export type CalendarView = "day" | "week" | "month" | "year";

export interface DayKey {
    year: number;
    month: number; // 1–12
    day: number;
}

export function dayKeyOf(at: Date, tz: string): DayKey {
    const p = zonedParts(at, tz);
    return { year: p.year, month: p.month, day: p.day };
}

export function keyString(k: DayKey): string {
    return `${k.year}-${String(k.month).padStart(2, "0")}-${String(k.day).padStart(2, "0")}`;
}

/** Midnight of that calendar day in the zone, as a UTC instant. */
export function startOfDay(k: DayKey, tz: string): Date {
    return zonedToUtc({ ...k, hour: 0, minute: 0 }, tz);
}

export function addDaysKey(k: DayKey, days: number): DayKey {
    const d = new Date(Date.UTC(k.year, k.month - 1, k.day + days));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function weekdayOf(k: DayKey): number {
    return new Date(Date.UTC(k.year, k.month - 1, k.day)).getUTCDay();
}

/** Weeks start on Monday (the school week). */
export function startOfWeek(k: DayKey): DayKey {
    return addDaysKey(k, -((weekdayOf(k) + 6) % 7));
}

/** The days a view shows, and the [from, to) instants to load for it. */
export function viewRange(view: CalendarView, anchor: DayKey, tz: string): { days: DayKey[]; from: Date; to: Date } {
    let first: DayKey;
    let count: number;
    if (view === "year") {
        // Jan 1 to the next Jan 1 in the zone. Loaded in chunks (yearChunks): the calendar
        // API serves at most 62 days per request.
        first = { year: anchor.year, month: 1, day: 1 };
        const next = { year: anchor.year + 1, month: 1, day: 1 };
        count = Math.round((Date.UTC(next.year, 0, 1) - Date.UTC(first.year, 0, 1)) / 86_400_000);
    } else if (view === "day") {
        first = anchor;
        count = 1;
    } else if (view === "week") {
        first = startOfWeek(anchor);
        count = 7;
    } else {
        // Whole weeks covering the month.
        const monthStart = { year: anchor.year, month: anchor.month, day: 1 };
        first = startOfWeek(monthStart);
        const nextMonth = addDaysKey({ year: anchor.year, month: anchor.month, day: 28 }, 4);
        const monthEnd = addDaysKey({ year: nextMonth.year, month: nextMonth.month, day: 1 }, -1);
        const lastWeekStart = startOfWeek(monthEnd);
        const utcDay = (k: DayKey) => Date.UTC(k.year, k.month - 1, k.day);
        count = Math.round((utcDay(lastWeekStart) - utcDay(first)) / 86_400_000) + 7;
    }
    const days = Array.from({ length: count }, (_, i) => addDaysKey(first, i));
    return { days, from: startOfDay(first, tz), to: startOfDay(addDaysKey(first, count), tz) };
}

export function shiftAnchor(view: CalendarView, anchor: DayKey, direction: 1 | -1): DayKey {
    if (view === "year") return { year: anchor.year + direction, month: 1, day: 1 };
    if (view === "day") return addDaysKey(anchor, direction);
    if (view === "week") return addDaysKey(anchor, 7 * direction);
    const m = anchor.month - 1 + direction;
    const year = anchor.year + Math.floor(m / 12);
    const month = ((m % 12) + 12) % 12 + 1;
    return { year, month, day: 1 };
}

/**
 * A year as six two-month ranges, each within the calendar API's 62-day limit
 * (Jan–Feb 59/60 days … Jul–Aug 62 days), in the zone. Together they cover the year
 * exactly once; an event spanning a boundary comes back twice and is de-duplicated by key.
 */
export function yearChunks(year: number, tz: string): { from: Date; to: Date }[] {
    return [1, 3, 5, 7, 9, 11].map((m) => ({
        from: startOfDay({ year, month: m, day: 1 }, tz),
        to: startOfDay(m === 11 ? { year: year + 1, month: 1, day: 1 } : { year, month: m + 2, day: 1 }, tz),
    }));
}

/** The days of one month (1–12). */
export function monthDays(year: number, month: number): DayKey[] {
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: count }, (_, i) => ({ year, month, day: i + 1 }));
}

/** 0 = Monday … 6 = Sunday (the school week starts on Monday). */
export function mondayIndex(k: DayKey): number {
    return (weekdayOf(k) + 6) % 7;
}

/** "2026-10-27T17:00" for an <input type="datetime-local"> in the zone. */
export function toLocalInput(at: Date, tz: string): string {
    const p = zonedParts(at, tz);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** The UTC instant of a datetime-local value read in the zone; null when malformed. */
export function fromLocalInput(value: string, tz: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!m) return null;
    const [y, mo, d, h, mi] = m.slice(1).map(Number);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
    return zonedToUtc({ year: y, month: mo, day: d, hour: h, minute: mi }, tz);
}

export function timeLabel(at: Date, tz: string): string {
    return new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(at);
}

export function dayLabel(k: DayKey, style: "long" | "short" = "long"): string {
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "UTC",
        weekday: style === "long" ? "long" : "short",
        day: "numeric",
        month: style === "long" ? "long" : "short",
    }).format(new Date(Date.UTC(k.year, k.month - 1, k.day, 12)));
}

export function monthLabel(k: DayKey): string {
    return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(k.year, k.month - 1, 15)));
}
