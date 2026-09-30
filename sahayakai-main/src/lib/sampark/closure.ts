/**
 * D4 emergency closure: which audio variant to play, and when the intent dies
 * (plan §2 D4, class gate 14).
 *
 * The variant is chosen at the moment of dialling, from the IST calendar, so a
 * retry that crosses midnight says "today" on the closure day and no parent
 * ever hears "closed tomorrow" on the closure day itself. After the closure day
 * ends (23:59:59.999 IST) no new attempt is started.
 */

import { addDays, istDate, istInstant, isDateString } from '@/lib/sampark/policy/ist';

/** YYYY-MM-DD of the IST calendar date at `at`. */
export function istDateString(at: Date): string {
    return istDate(at);
}

/** 'today' if closureDate is today in IST, 'tomorrow' if it is the next IST day, null otherwise (expired or too early). */
export function chooseClosureVariant(closureDate: string, now: Date): 'today' | 'tomorrow' | null {
    if (!isDateString(closureDate)) return null;
    const today = istDate(now);
    if (closureDate === today) return 'today';
    if (closureDate === addDays(today, 1)) return 'tomorrow';
    return null;
}

/** End of the closure day in IST (23:59:59.999 IST) as a Date. Throws on a malformed date. */
export function closureExpiry(closureDate: string): Date {
    const nextMidnight = istInstant(addDays(closureDate, 1), 0, 0);
    return new Date(nextMidnight.getTime() - 1);
}
