/**
 * When it is acceptable to phone a parent.
 *
 * Parents are in India, so the window is fixed to IST regardless of where the
 * teacher, the server, or the Cloud Run region happens to be. A teacher marking
 * attendance from abroad, a cron firing in UTC, and a retry scheduled hours
 * later must all agree, and the only clock a family cares about is their own.
 *
 * The window is the routine calling band, 10:00–19:00 IST (founder decision,
 * 23 Oct 2026). Outside it, no call is placed — not delayed, not queued for
 * "soon", refused with the time it would next be allowed.
 *
 * The hours are NOT defined here. They live in one module,
 * `lib/sampark/policy/routine-hours.ts`, which every surface that knows the
 * calling hours reads, so the teacher path and every other caller cannot drift
 * apart (gate: calling-hours-single-source-gate.test.ts).
 *
 * This must be enforced on the SERVER. Hiding the button is a courtesy; the
 * guarantee is that the route will not dial. Anything that can reach the call
 * route — a retry, a scheduled job, a direct POST — has to pass through here.
 */

import { ROUTINE_END_CEILING_HOUR, ROUTINE_START_FLOOR_HOUR } from '@/lib/sampark/policy/routine-hours';

/** First hour at which calling is allowed (IST, inclusive). */
export const CALLING_WINDOW_START_HOUR = ROUTINE_START_FLOOR_HOUR;
/** First hour at which calling is NO LONGER allowed (IST, exclusive). */
export const CALLING_WINDOW_END_HOUR = ROUTINE_END_CEILING_HOUR;

/** `10` -> `"10:00"`; also keeps a single-digit hour readable (`"09:00"`). */
function hourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
}

const IST_TIME_ZONE = 'Asia/Kolkata';

export interface CallingWindowVerdict {
    allowed: boolean;
    /** IST hour (0-23) the decision was made against. */
    istHour: number;
    /** IST wall-clock, for logs and operator messages. */
    istTime: string;
    /** Human-readable reason, safe to show a teacher. Empty when allowed. */
    reason: string;
    /** When calling next opens. Null when already inside the window. */
    nextAllowedAt: Date | null;
}

/**
 * IST hour and minute for an instant, via Intl rather than a fixed +5:30 offset.
 * India has no DST today, but hard-coding an offset is the kind of assumption
 * that silently rots, and Intl costs nothing here.
 */
function istParts(at: Date): { hour: number; minute: number } {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: IST_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(at);

    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
    // Intl renders midnight as "24" in some locales/engines; normalise it.
    return { hour: get('hour') % 24, minute: get('minute') };
}

/** Formats an instant as IST wall-clock, e.g. "21:42 IST". */
export function formatIST(at: Date): string {
    const { hour, minute } = istParts(at);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} IST`;
}

/**
 * The next instant at which calling opens, given a time outside the window.
 * Computed by stepping in whole minutes rather than by date arithmetic on a
 * local Date, so it stays correct no matter what the server's own zone is.
 */
function nextWindowOpening(from: Date): Date {
    const cursor = new Date(from.getTime());
    // Advance to the next minute boundary, then walk forward. A day is 1440
    // minutes; the window opens at least once in any 24h span, so this
    // terminates well inside that bound.
    cursor.setSeconds(0, 0);
    for (let i = 0; i < 24 * 60 + 1; i++) {
        cursor.setTime(cursor.getTime() + 60_000);
        const { hour, minute } = istParts(cursor);
        if (hour === CALLING_WINDOW_START_HOUR && minute === 0) return cursor;
    }
    // Unreachable in practice; returning `from` keeps the type honest rather
    // than asserting a non-null the caller cannot verify.
    return from;
}

/** The code every route returns when it will not place a parent call now. */
export const OUTSIDE_CALLING_HOURS_CODE = 'OUTSIDE_CALLING_HOURS';

/**
 * The 409 body for a call refused by the calling window. One shape for every
 * route that refuses on hours (the call route and the outreach route), so the
 * modal reads one contract.
 */
export function outsideCallingHoursBody(verdict: CallingWindowVerdict): {
    error: string;
    code: typeof OUTSIDE_CALLING_HOURS_CODE;
    nextAllowedAt: string | null;
} {
    return {
        error: verdict.reason,
        code: OUTSIDE_CALLING_HOURS_CODE,
        nextAllowedAt: verdict.nextAllowedAt?.toISOString() ?? null,
    };
}

/**
 * Is it acceptable to phone a parent right now?
 *
 * `at` is injectable so tests can pin an instant — never read the clock inside
 * a branch you cannot reproduce.
 */
export function checkCallingWindow(at: Date = new Date()): CallingWindowVerdict {
    const { hour } = istParts(at);
    const allowed = hour >= CALLING_WINDOW_START_HOUR && hour < CALLING_WINDOW_END_HOUR;

    if (allowed) {
        return { allowed: true, istHour: hour, istTime: formatIST(at), reason: '', nextAllowedAt: null };
    }

    const nextAllowedAt = nextWindowOpening(at);
    return {
        allowed: false,
        istHour: hour,
        istTime: formatIST(at),
        reason:
            `Calls to parents are only placed between ${hourLabel(CALLING_WINDOW_START_HOUR)} and ` +
            `${hourLabel(CALLING_WINDOW_END_HOUR)} IST. It is ${formatIST(at)} now, so this call was not placed. ` +
            `Calling reopens at ${hourLabel(CALLING_WINDOW_START_HOUR)} IST.`,
        nextAllowedAt,
    };
}
