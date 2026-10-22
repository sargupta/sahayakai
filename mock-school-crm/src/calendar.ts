/**
 * Date helpers. Dates are 'YYYY-MM-DD' strings in IST (the school's zone);
 * instants are ISO-8601 UTC strings. Everything here is pure: no wall clock.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;

function parseDate(date: string): [number, number, number] {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) throw new Error(`bad date: ${date}`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isValidDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const [y, mo, d] = parseDate(date);
    const t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

export function addDays(date: string, days: number): string {
    const [y, m, d] = parseDate(date);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: string): number {
    const [y, m, d] = parseDate(date);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The instant of an IST wall-clock time on an IST date, as ISO UTC. */
export function istInstant(date: string, hour: number, minute = 0, second = 0): string {
    const [y, m, d] = parseDate(date);
    return new Date(Date.UTC(y, m - 1, d, hour, minute, second) - IST_OFFSET_MS).toISOString();
}

/** The IST calendar date of an instant. */
export function istDate(at: Date): string {
    return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Mon–Fri, not a holiday, not a closure day. */
export function isSchoolDay(date: string, offDays: ReadonlySet<string>): boolean {
    const wd = weekday(date);
    return wd !== 0 && wd !== 6 && !offDays.has(date);
}

/** The last `count` school days ending on `anchor` (inclusive), oldest first. */
export function schoolDaysEndingOn(anchor: string, count: number, offDays: ReadonlySet<string>): string[] {
    const out: string[] = [];
    let day = anchor;
    while (out.length < count) {
        if (isSchoolDay(day, offDays)) out.push(day);
        day = addDays(day, -1);
    }
    return out.reverse();
}

/** School days in [from, to], oldest first. */
export function schoolDaysBetween(from: string, to: string, offDays: ReadonlySet<string>): string[] {
    const out: string[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
        if (isSchoolDay(day, offDays)) out.push(day);
    }
    return out;
}
