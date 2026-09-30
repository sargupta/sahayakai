/**
 * IST calendar helpers for the Sampark engine.
 *
 * Parents are in India, so every Sampark decision about "today", "tomorrow",
 * an off-day, a holiday or a window opening is made on the IST wall clock —
 * never on the server's local zone and never by adding a hard-coded +05:30 to a
 * Date. Wall-clock parts come from Intl with timeZone 'Asia/Kolkata' (the same
 * approach as `@/lib/calling-hours`), and the one conversion the other way
 * (an IST wall-clock time → an instant) derives the zone offset from Intl too.
 *
 * Calendar arithmetic on a YYYY-MM-DD string (next day, weekday) uses
 * Date.UTC purely as a proleptic calendar — no time zone is involved there.
 */

export const IST_TIME_ZONE = 'Asia/Kolkata';

const IST_FORMAT = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

export interface IstParts {
    year: number;
    month: number;   // 1–12
    day: number;     // 1–31
    hour: number;    // 0–23
    minute: number;
    second: number;
    /** 0 = Sunday … 6 = Saturday, of the IST calendar date. */
    weekday: number;
    /** YYYY-MM-DD of the IST calendar date. */
    date: string;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/** IST wall-clock parts of an instant. */
export function istParts(at: Date): IstParts {
    const parts = IST_FORMAT.formatToParts(at);
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? '0');
    const year = get('year');
    const month = get('month');
    const day = get('day');
    // Some engines render midnight as "24" even with h23; normalise.
    const hour = get('hour') % 24;
    const date = `${year}-${pad2(month)}-${pad2(day)}`;
    return { year, month, day, hour, minute: get('minute'), second: get('second'), weekday: weekdayOf(date), date };
}

/** True for a real calendar date written YYYY-MM-DD. */
export function isDateString(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const m = DATE_RE.exec(value);
    if (!m) return false;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function parseDate(date: string): [number, number, number] {
    if (!isDateString(date)) throw new Error(`Invalid date (expected YYYY-MM-DD): ${String(date)}`);
    const m = DATE_RE.exec(date)!;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Calendar arithmetic: the date `days` after `date` (negative goes back). */
export function addDays(date: string, days: number): string {
    const [y, m, d] = parseDate(date);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday for a calendar date. */
export function weekdayOf(date: string): number {
    const [y, m, d] = parseDate(date);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** How far IST wall-clock is ahead of UTC at `at`, in ms, derived from Intl (no hard-coded offset). */
function istOffsetMs(at: Date): number {
    const p = istParts(at);
    const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const truncated = Math.floor(at.getTime() / 1000) * 1000;
    return wallAsUtc - truncated;
}

/** The instant at which the IST wall clock reads `date` `hour`:`minute`:00. */
export function istInstant(date: string, hour: number, minute = 0): Date {
    const [y, m, d] = parseDate(date);
    const guess = Date.UTC(y, m - 1, d, hour, minute, 0, 0);
    const first = guess - istOffsetMs(new Date(guess));
    // Re-derive once at the candidate instant; this is what makes the method
    // correct for any zone with offset changes, not only IST.
    const second = guess - istOffsetMs(new Date(first));
    return new Date(second);
}

/** YYYY-MM-DD of the IST calendar date at `at`. */
export function istDate(at: Date): string {
    return istParts(at).date;
}
