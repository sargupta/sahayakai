/**
 * Gate on when a parent may be phoned.
 *
 * WHY THIS EXISTS
 * Automated calls go to families about their children. A bug that lets one out
 * at 2am is not a rendering glitch — it wakes a household, and it is the kind
 * of thing that ends a school pilot. Retries make it sharper: a call that fails
 * at 20:55 and retries "in a few hours" lands at midnight unless something
 * refuses it.
 *
 * WHAT THIS GATE CATCHES
 * Not "21:00 is blocked" — the class is: the window is evaluated in IST no
 * matter where the server, teacher or scheduler sits, the boundaries are exact,
 * and a refusal always says when calling reopens. A future timezone shortcut —
 * reading the server clock, hard-coding +5:30, using local Date arithmetic —
 * fails here.
 */

import {
    checkCallingWindow,
    formatIST,
    CALLING_WINDOW_START_HOUR,
    CALLING_WINDOW_END_HOUR,
} from '@/lib/calling-hours';

/** An instant expressed as IST wall-clock, built via the UTC offset (+5:30). */
function istInstant(hour: number, minute = 0, day = 15): Date {
    return new Date(Date.UTC(2026, 7, day, hour - 5, minute - 30));
}

describe('calling window (class gate)', () => {
    it('allows calls through the working day', () => {
        for (const h of [9, 10, 13, 17, 20]) {
            expect(checkCallingWindow(istInstant(h, 30)).allowed).toBe(true);
        }
    });

    it('refuses calls at night and early morning', () => {
        for (const h of [21, 22, 23, 0, 1, 3, 6, 8]) {
            const v = checkCallingWindow(istInstant(h, 30));
            expect(v.allowed).toBe(false);
            expect(v.reason).toMatch(/only placed between/);
        }
    });

    it('has exact boundaries — 09:00 open, 21:00 shut', () => {
        // The two minutes that decide whether a family's evening is interrupted.
        expect(checkCallingWindow(istInstant(CALLING_WINDOW_START_HOUR, 0)).allowed).toBe(true);
        expect(checkCallingWindow(istInstant(CALLING_WINDOW_START_HOUR - 1, 59)).allowed).toBe(false);
        expect(checkCallingWindow(istInstant(CALLING_WINDOW_END_HOUR - 1, 59)).allowed).toBe(true);
        expect(checkCallingWindow(istInstant(CALLING_WINDOW_END_HOUR, 0)).allowed).toBe(false);
    });

    it('judges by IST, not by the server clock or a UTC reading', () => {
        // 20:00 UTC is 01:30 IST — the middle of the night for the family.
        // Anything reading UTC hours would happily allow this.
        const utcEvening = new Date('2026-08-15T20:00:00.000Z');
        expect(checkCallingWindow(utcEvening).allowed).toBe(false);

        // 05:00 UTC is 10:30 IST — a perfectly normal time to call, even though
        // a server reading its own UTC clock would call it "too early".
        const utcEarly = new Date('2026-08-15T05:00:00.000Z');
        expect(checkCallingWindow(utcEarly).allowed).toBe(true);
    });

    it('is unaffected by the process timezone', () => {
        // The verdict must be identical whether the container runs in UTC,
        // asia-south1, or a laptop in another hemisphere.
        const instant = new Date('2026-08-15T17:00:00.000Z'); // 22:30 IST
        const original = process.env.TZ;
        const verdicts: boolean[] = [];
        for (const tz of ['UTC', 'America/New_York', 'Asia/Kolkata', 'Pacific/Auckland']) {
            process.env.TZ = tz;
            verdicts.push(checkCallingWindow(instant).allowed);
        }
        process.env.TZ = original;
        expect(new Set(verdicts).size).toBe(1);
        expect(verdicts[0]).toBe(false);
    });

    it('always says when calling reopens, and that time is inside the window', () => {
        for (const h of [21, 23, 2, 8]) {
            const v = checkCallingWindow(istInstant(h, 15));
            expect(v.allowed).toBe(false);
            expect(v.nextAllowedAt).toBeInstanceOf(Date);
            // The suggested time must itself be callable, or we would send a
            // retry straight back into a refusal.
            expect(checkCallingWindow(v.nextAllowedAt!).allowed).toBe(true);
            expect(v.nextAllowedAt!.getTime()).toBeGreaterThan(istInstant(h, 15).getTime());
        }
    });

    it('reopens at 09:00 IST, not merely "some time later"', () => {
        const v = checkCallingWindow(istInstant(23, 10));
        expect(formatIST(v.nextAllowedAt!)).toBe('09:00 IST');
    });

    it('offers no reopening time when calling is already allowed', () => {
        const v = checkCallingWindow(istInstant(11, 0));
        expect(v.allowed).toBe(true);
        expect(v.nextAllowedAt).toBeNull();
        expect(v.reason).toBe('');
    });

    it('reports the IST wall-clock in the refusal, so the reason is checkable', () => {
        const v = checkCallingWindow(istInstant(22, 42));
        expect(v.istTime).toBe('22:42 IST');
        expect(v.istHour).toBe(22);
        expect(v.reason).toContain('22:42 IST');
    });
});
