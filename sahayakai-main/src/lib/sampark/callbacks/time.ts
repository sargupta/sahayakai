/**
 * Callback times: IANA zones without a dependency, and a small, strict parser for
 * what parents and staff actually say ("call me at 5 PM", "tomorrow morning",
 * "in 20 minutes").
 *
 * Rules the parser follows, because guessing a time and calling a family at it is
 * worse than asking:
 *   - a relative time ("in 20 minutes") or a clock time with its meaning fixed
 *     ("5 PM", "17:30", "evening at 6") is EXACT;
 *   - "5" or "at 5" without am/pm, a part of the day without a clock time
 *     ("tomorrow morning"), a day without a time ("tomorrow"), or a time already
 *     passed today with no day named is AMBIGUOUS: it returns suggestions and
 *     the caller must ask;
 *   - anything else is INVALID, with a reason.
 * Every instant is returned in UTC; the zone only decides what "5 PM" means.
 */

import { CALLBACK_MAX_AHEAD_MS } from './state';

export const DEFAULT_CALLBACK_TIME_ZONE = 'Asia/Kolkata';

export function isValidTimeZone(tz: string): boolean {
    if (!tz || tz.length > 64) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

export interface ZonedParts {
    year: number;
    month: number; // 1–12
    day: number;
    hour: number;
    minute: number;
    /** 0 = Sunday */
    weekday: number;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function zonedParts(at: Date, timeZone: string): ZonedParts {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        weekday: 'long',
    }).formatToParts(at);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return {
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        hour: Number(get('hour')),
        minute: Number(get('minute')),
        weekday: WEEKDAYS.indexOf(get('weekday').toLowerCase()),
    };
}

/** Offset of `timeZone` from UTC at `at`, in minutes (IST: +330). */
function offsetMinutes(at: Date, timeZone: string): number {
    const p = zonedParts(at, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/**
 * The UTC instant of a wall-clock time in `timeZone`. Two passes, so it is right
 * across a DST change; a wall time skipped by a spring-forward resolves to the
 * instant after the gap.
 */
export function zonedToUtc(wall: { year: number; month: number; day: number; hour: number; minute: number }, timeZone: string): Date {
    const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
    let guess = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000);
    guess = new Date(naive - offsetMinutes(guess, timeZone) * 60_000);
    return guess;
}

/** Calendar date `days` after the zoned date of `at`, as wall parts at hh:mm. */
function zonedDay(at: Date, timeZone: string, days: number, hour: number, minute: number): Date {
    const p = zonedParts(at, timeZone);
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
    return zonedToUtc({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour, minute }, timeZone);
}

/** "Mon 27 Oct, 5:00 PM" in the zone. */
export function formatInZone(at: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-IN', {
        timeZone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(at);
}

export type CallbackTimeParse =
    | { status: 'exact'; at: Date }
    | { status: 'ambiguous'; reason: AmbiguityReason; candidates: Date[] }
    | { status: 'invalid'; reason: InvalidReason };

export type AmbiguityReason = 'am_or_pm' | 'part_of_day_only' | 'time_missing' | 'time_passed_today';
export type InvalidReason = 'unrecognised' | 'in_past' | 'too_soon' | 'too_far' | 'bad_time';

const NUMBER_WORDS: Record<string, number> = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty five': 45, sixty: 60,
};

/** Default hour suggested for a part of the day, and how a bare 1–12 hour is read in it. */
const PARTS_OF_DAY: Record<string, { suggest: number; pm: boolean }> = {
    morning: { suggest: 10, pm: false },
    afternoon: { suggest: 14, pm: true },
    evening: { suggest: 17, pm: true },
    tonight: { suggest: 19, pm: true },
    night: { suggest: 19, pm: true },
};

function finalize(at: Date, now: Date): CallbackTimeParse {
    if (at.getTime() <= now.getTime()) return { status: 'invalid', reason: 'in_past' };
    if (at.getTime() - now.getTime() > CALLBACK_MAX_AHEAD_MS) return { status: 'invalid', reason: 'too_far' };
    return { status: 'exact', at };
}

function futureOnly(candidates: Date[], now: Date): Date[] {
    return candidates.filter((c) => c.getTime() > now.getTime() && c.getTime() - now.getTime() <= CALLBACK_MAX_AHEAD_MS);
}

/** Parse a spoken or typed callback time relative to `now` in `timeZone`. */
export function parseCallbackTime(text: string, now: Date, timeZone: string = DEFAULT_CALLBACK_TIME_ZONE): CallbackTimeParse {
    const s = ` ${text.toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim()} `;
    if (s.trim().length === 0 || s.length > 200) return { status: 'invalid', reason: 'unrecognised' };

    // 1. Relative: "in 20 minutes", "after an hour", "in half an hour", "20 minutes from now".
    if (/\b(in|after)\s+half\s+an?\s+hour\b/.test(s)) return finalize(new Date(now.getTime() + 30 * 60_000), now);
    const rel = s.match(/\b(?:in|after)\s+(\d{1,3}|an?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty five|forty|sixty)\s*(minutes?|mins?|hours?|hrs?)\b/)
        ?? s.match(/\b(\d{1,3})\s*(minutes?|mins?|hours?|hrs?)\s+from\s+now\b/);
    if (rel) {
        const n = /^\d+$/.test(rel[1]) ? Number(rel[1]) : NUMBER_WORDS[rel[1]];
        const minutes = rel[2].startsWith('h') ? n * 60 : n;
        if (!minutes) return { status: 'invalid', reason: 'bad_time' };
        return finalize(new Date(now.getTime() + minutes * 60_000), now);
    }

    // 2. Which day.
    let dayOffset: number | null = null;
    let dayNamed = false;
    if (/\bday after tomorrow\b/.test(s)) { dayOffset = 2; dayNamed = true; }
    else if (/\btomorrow\b/.test(s)) { dayOffset = 1; dayNamed = true; }
    else if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(s)) { dayOffset = 0; dayNamed = true; }
    else {
        const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b(next |this |on )?${w}\\b`).test(s));
        if (wd >= 0) {
            const today = zonedParts(now, timeZone).weekday;
            let diff = (wd - today + 7) % 7;
            if (diff === 0) diff = 7; // "Monday" said on a Monday means the next one
            dayOffset = diff;
            dayNamed = true;
        }
    }

    // 3. Part of the day.
    const partKey = Object.keys(PARTS_OF_DAY).find((k) => new RegExp(`\\b${k}\\b`).test(s));
    const part = partKey ? PARTS_OF_DAY[partKey] : null;

    // 4. Clock time.
    let hour: number | null = null;
    let minute = 0;
    let meridiemFixed = false;
    if (/\bnoon\b|\bmidday\b/.test(s)) { hour = 12; meridiemFixed = true; }
    else if (/\bmidnight\b/.test(s)) { hour = 0; meridiemFixed = true; }
    else {
        const t = s.match(/\b(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm|a m|p m)?\b(?!\s*(minutes?|mins?|hours?|hrs?|days?))/);
        if (t && (t[2] !== undefined || t[3] !== undefined || /\b(at|by|around|after)\s+\d/.test(s) || /\bo'?clock\b/.test(s) || part || dayNamed)) {
            hour = Number(t[1]);
            minute = t[2] !== undefined ? Number(t[2]) : 0;
            if (hour > 23 || minute > 59) return { status: 'invalid', reason: 'bad_time' };
            const mer = t[3]?.replace(' ', '');
            if (mer) {
                if (hour < 1 || hour > 12) return { status: 'invalid', reason: 'bad_time' };
                hour = (hour % 12) + (mer === 'pm' ? 12 : 0);
                meridiemFixed = true;
            } else if (hour === 0 || hour > 12 || (t[2] !== undefined && t[1].length === 2 && t[1].startsWith('0'))) {
                meridiemFixed = true; // 24-hour clock: "17:30", "09:15"
            } else if (part) {
                hour = (hour % 12) + (part.pm ? 12 : 0);
                meridiemFixed = true;
            }
        }
    }

    const offset = dayOffset ?? 0;

    if (hour === null) {
        if (part) {
            return { status: 'ambiguous', reason: 'part_of_day_only', candidates: futureOnly([zonedDay(now, timeZone, offset, part.suggest, 0)], now) };
        }
        if (dayNamed) {
            return { status: 'ambiguous', reason: 'time_missing', candidates: futureOnly([10, 14, 17].map((h) => zonedDay(now, timeZone, offset, h, 0)), now) };
        }
        return { status: 'invalid', reason: 'unrecognised' };
    }

    if (!meridiemFixed) {
        // "at 5": 05:00 or 17:00 — ask.
        const am = zonedDay(now, timeZone, offset, hour % 12, minute);
        const pm = zonedDay(now, timeZone, offset, (hour % 12) + 12, minute);
        const options = futureOnly([am, pm], now);
        if (options.length === 0 && !dayNamed) {
            return { status: 'ambiguous', reason: 'am_or_pm', candidates: futureOnly([zonedDay(now, timeZone, 1, hour % 12, minute), zonedDay(now, timeZone, 1, (hour % 12) + 12, minute)], now) };
        }
        return { status: 'ambiguous', reason: 'am_or_pm', candidates: options };
    }

    const at = zonedDay(now, timeZone, offset, hour, minute);
    if (at.getTime() <= now.getTime() && !dayNamed) {
        // "at 5 PM" said at 6 PM: probably tomorrow, but ask.
        return { status: 'ambiguous', reason: 'time_passed_today', candidates: futureOnly([zonedDay(now, timeZone, 1, hour, minute)], now) };
    }
    return finalize(at, now);
}
