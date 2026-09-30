/**
 * When Sampark may phone a parent (plan §4④ "Hours", §2 D4).
 *
 * ROUTINE purposes — every purpose except the emergency closure — are allowed
 * only when ALL of these hold at the IST instant:
 *   1. inside the school's adopted window, clamped into [10:00, 20:00) IST
 *      (a school may narrow the band, never widen it);
 *   2. inside the platform window 09:00–21:00 IST (`checkCallingWindow`,
 *      reused, not re-implemented — it is the platform floor every dialer obeys);
 *   3. not one of the school's off-days (default Sunday);
 *   4. not one of the school's holidays (IST calendar date);
 *   5. for concern-type purposes (`spec.noFridaySaturday`), not Friday or Saturday.
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ THE ONE SANCTIONED WIDENING OF THE 09:00 PLATFORM FLOOR               │
 * │                                                                        │
 * │ Purposes with `spec.emergency` (only D4, emergency closure) may be    │
 * │ placed 06:00–21:00 IST on ANY day, including off-days and holidays.   │
 * │ Hill-school closures are decided at 05:30–07:00 and buses leave by    │
 * │ 07:30, so a 09:00 start would fail exactly the families D4 exists to  │
 * │ protect (plan §2 D4, §9 "Reused"). This is deliberately NOT a school  │
 * │ setting and NOT reachable by any routine purpose: it is keyed on the  │
 * │ catalogue's `emergency` flag, which only emergency_closure carries,   │
 * │ and it is tested separately (window.test.ts). The 21:00 end is the    │
 * │ platform's own end — emergencies do not widen the evening.            │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * `nextAllowedAt` is the first instant after `at` at which the same purpose
 * would be allowed, walking IST calendar days across off-days and holidays.
 */

import { checkCallingWindow, formatIST } from '@/lib/calling-hours';
import type { PurposeSpec } from '@/lib/sampark/catalogue';
import { addDays, istInstant, istParts, weekdayOf } from '@/lib/sampark/policy/ist';
import type { CallingWindow, SamparkSchool } from '@/types/sampark';

export interface WindowVerdict {
    allowed: boolean;
    reason: string;
    nextAllowedAt: Date | null;
}

/** Routine band every school window is clamped into (IST hours, start inclusive, end exclusive). */
export const ROUTINE_START_FLOOR_HOUR = 10;
export const ROUTINE_END_CEILING_HOUR = 20;

/** Emergency (D4) band — see the block comment above. */
export const EMERGENCY_START_HOUR = 6;
export const EMERGENCY_END_HOUR = 21;

/** How many IST days ahead nextAllowedAt looks before giving up (holiday lists are finite). */
const LOOKAHEAD_DAYS = 400;

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function clampHour(value: unknown, fallback: number): number {
    const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return Math.min(ROUTINE_END_CEILING_HOUR, Math.max(ROUTINE_START_FLOOR_HOUR, n));
}

/** The school's window after clamping into [10, 20) IST. `startHour >= endHour` means the window is empty. */
export function effectiveRoutineWindow(window: CallingWindow | null | undefined): { startHour: number; endHour: number } {
    return {
        startHour: Math.ceil(clampHour(window?.startHour, ROUTINE_START_FLOOR_HOUR)),
        endHour: Math.floor(clampHour(window?.endHour, ROUTINE_END_CEILING_HOUR)),
    };
}

function offDaysOf(school: SamparkSchool): number[] {
    const off = school.callingWindow?.offDays;
    return Array.isArray(off) ? off : [0];
}

/** Why a routine call may not be placed at all on this IST date, or null if the day is open. */
function closedDayReason(school: SamparkSchool, spec: PurposeSpec, date: string): string | null {
    if ((school.holidays ?? []).includes(date)) return `${date} is a school holiday`;
    const weekday = weekdayOf(date);
    if (offDaysOf(school).includes(weekday)) return `${WEEKDAY_NAMES[weekday]} is a school off-day`;
    if (spec.noFridaySaturday && (weekday === 5 || weekday === 6)) {
        return `this purpose is never placed on a ${WEEKDAY_NAMES[weekday]}`;
    }
    return null;
}

function hh(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
}

function emergencyVerdict(at: Date): WindowVerdict {
    const p = istParts(at);
    if (p.hour >= EMERGENCY_START_HOUR && p.hour < EMERGENCY_END_HOUR) {
        return { allowed: true, reason: '', nextAllowedAt: null };
    }
    const openDate = p.hour < EMERGENCY_START_HOUR ? p.date : addDays(p.date, 1);
    return {
        allowed: false,
        reason:
            `Emergency notices are placed between ${hh(EMERGENCY_START_HOUR)} and ${hh(EMERGENCY_END_HOUR)} IST; ` +
            `it is ${formatIST(at)} now.`,
        nextAllowedAt: istInstant(openDate, EMERGENCY_START_HOUR, 0),
    };
}

function routineVerdict(school: SamparkSchool, spec: PurposeSpec, at: Date): WindowVerdict {
    const { startHour, endHour } = effectiveRoutineWindow(school.callingWindow);
    if (startHour >= endHour) {
        return {
            allowed: false,
            reason: `The school's calling window is empty after clamping to ${hh(ROUTINE_START_FLOOR_HOUR)}–${hh(ROUTINE_END_CEILING_HOUR)} IST.`,
            nextAllowedAt: null,
        };
    }

    const p = istParts(at);
    const dayReason = closedDayReason(school, spec, p.date);
    const inBand = p.hour >= startHour && p.hour < endHour;
    const platform = checkCallingWindow(at);

    if (!dayReason && inBand && platform.allowed) {
        return { allowed: true, reason: '', nextAllowedAt: null };
    }

    let reason: string;
    if (dayReason) reason = `No routine calls today: ${dayReason}.`;
    else if (!inBand) reason = `Routine calls are placed between ${hh(startHour)} and ${hh(endHour)} IST; it is ${formatIST(at)} now.`;
    else reason = platform.reason;

    return { allowed: false, reason, nextAllowedAt: nextRoutineOpening(school, spec, at, startHour, endHour) };
}

function nextRoutineOpening(school: SamparkSchool, spec: PurposeSpec, at: Date, startHour: number, endHour: number): Date | null {
    const today = istParts(at).date;
    for (let i = 0; i <= LOOKAHEAD_DAYS; i++) {
        const date = addDays(today, i);
        if (closedDayReason(school, spec, date)) continue;
        const open = istInstant(date, startHour, 0);
        const close = istInstant(date, endHour, 0);
        if (at.getTime() < open.getTime()) {
            if (checkCallingWindow(open).allowed) return open;
            continue;
        }
        if (at.getTime() < close.getTime()) {
            // Inside today's band but refused by the platform floor (cannot happen while
            // the band sits inside 09–21, but stay correct if either constant moves):
            // the platform's own next opening, if it falls inside the band.
            const platformNext = checkCallingWindow(at).nextAllowedAt;
            if (platformNext && platformNext.getTime() < close.getTime()) return platformNext;
        }
    }
    return null;
}

/**
 * Routine purposes: school window ∩ [10,20) IST, not an off-day, not a holiday, and never outside the platform 09–21 floor
 * (reuses checkCallingWindow from '@/lib/calling-hours'). Emergency purposes (spec.emergency): 06:00–21:00 IST any day.
 */
export function samparkWindowVerdict(school: SamparkSchool, spec: PurposeSpec, at: Date): WindowVerdict {
    return spec.emergency ? emergencyVerdict(at) : routineVerdict(school, spec, at);
}
