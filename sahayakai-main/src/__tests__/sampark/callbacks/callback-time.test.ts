/** @jest-environment node */
/**
 * Callback times: IANA zone conversion (including a DST change), and the parser's
 * promise — exact only when the meaning is fixed, otherwise ASK (ambiguous with
 * suggestions) or refuse (invalid). Instants are always UTC.
 */

import { isValidTimeZone, parseCallbackTime, zonedParts, zonedToUtc } from '@/lib/sampark/callbacks/time';

const IST = 'Asia/Kolkata';
// Wednesday 7 Oct 2026, 11:00 IST.
const WED_11_IST = new Date('2026-10-07T05:30:00Z');
const iso = (d: Date) => d.toISOString();

function exact(text: string, now = WED_11_IST, tz = IST): string {
    const r = parseCallbackTime(text, now, tz);
    if (r.status !== 'exact') throw new Error(`"${text}" → ${JSON.stringify(r)}`);
    return iso(r.at);
}

describe('zones', () => {
    it('validates IANA names', () => {
        expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
        expect(isValidTimeZone('America/New_York')).toBe(true);
        expect(isValidTimeZone('IST+5')).toBe(false);
        expect(isValidTimeZone('')).toBe(false);
    });

    it('converts a wall time to UTC and back (IST is +05:30)', () => {
        const at = zonedToUtc({ year: 2026, month: 10, day: 7, hour: 17, minute: 0 }, IST);
        expect(iso(at)).toBe('2026-10-07T11:30:00.000Z');
        expect(zonedParts(at, IST)).toMatchObject({ year: 2026, month: 10, day: 7, hour: 17, minute: 0, weekday: 3 });
    });

    it('is right on both sides of a DST change', () => {
        // New York leaves DST on 1 Nov 2026: 10:00 is UTC-4 on 31 Oct and UTC-5 on 2 Nov.
        expect(iso(zonedToUtc({ year: 2026, month: 10, day: 31, hour: 10, minute: 0 }, 'America/New_York'))).toBe('2026-10-31T14:00:00.000Z');
        expect(iso(zonedToUtc({ year: 2026, month: 11, day: 2, hour: 10, minute: 0 }, 'America/New_York'))).toBe('2026-11-02T15:00:00.000Z');
    });

    it('crosses the UTC date boundary correctly (00:30 IST is the previous UTC day)', () => {
        expect(iso(zonedToUtc({ year: 2026, month: 10, day: 8, hour: 0, minute: 30 }, IST))).toBe('2026-10-07T19:00:00.000Z');
    });
});

describe('parseCallbackTime — exact', () => {
    it('relative times', () => {
        expect(exact('call me back in 20 minutes')).toBe('2026-10-07T05:50:00.000Z');
        expect(exact('in an hour')).toBe('2026-10-07T06:30:00.000Z');
        expect(exact('after half an hour')).toBe('2026-10-07T06:00:00.000Z');
        expect(exact('in two hours')).toBe('2026-10-07T07:30:00.000Z');
        expect(exact('20 minutes from now')).toBe('2026-10-07T05:50:00.000Z');
    });

    it('clock times with their meaning fixed, today', () => {
        expect(exact('call me at 5 PM')).toBe('2026-10-07T11:30:00.000Z');
        expect(exact('5:30 pm')).toBe('2026-10-07T12:00:00.000Z');
        expect(exact('at 17:45')).toBe('2026-10-07T12:15:00.000Z');
        expect(exact('at noon')).toBe('2026-10-07T06:30:00.000Z');
        expect(exact('this evening at 6')).toBe('2026-10-07T12:30:00.000Z');
    });

    it('named days', () => {
        expect(exact('tomorrow at 10 am')).toBe('2026-10-08T04:30:00.000Z');
        expect(exact('tomorrow evening at 6')).toBe('2026-10-08T12:30:00.000Z');
        expect(exact('day after tomorrow 4 pm')).toBe('2026-10-09T10:30:00.000Z');
        // Wednesday → "Monday" is the coming Monday, 12 Oct.
        expect(exact('Monday 10:30 AM')).toBe('2026-10-12T05:00:00.000Z');
        // "Wednesday" said on a Wednesday is next week.
        expect(exact('wednesday at 11 am')).toBe('2026-10-14T05:30:00.000Z');
    });

    it('reads "tomorrow" across a month boundary in the zone', () => {
        const oct31Late = new Date('2026-10-31T17:00:00Z'); // 22:30 IST, 31 Oct
        expect(exact('tomorrow at 10 am', oct31Late)).toBe('2026-11-01T04:30:00.000Z');
    });

    it('reads the same words in another zone', () => {
        expect(exact('tomorrow at 9 am', WED_11_IST, 'America/New_York')).toBe('2026-10-08T13:00:00.000Z');
    });
});

describe('parseCallbackTime — asks instead of guessing', () => {
    it('"at 5" without am/pm offers both, only future ones', () => {
        const r = parseCallbackTime('call me at 5', WED_11_IST, IST);
        expect(r.status).toBe('ambiguous');
        if (r.status !== 'ambiguous') return;
        expect(r.reason).toBe('am_or_pm');
        // 05:00 today has passed; 17:00 today is offered.
        expect(r.candidates.map(iso)).toEqual(['2026-10-07T11:30:00.000Z']);
    });

    it('a part of the day without a time suggests one', () => {
        const r = parseCallbackTime('call tomorrow morning', WED_11_IST, IST);
        expect(r).toMatchObject({ status: 'ambiguous', reason: 'part_of_day_only' });
        if (r.status === 'ambiguous') expect(r.candidates.map(iso)).toEqual(['2026-10-08T04:30:00.000Z']);
    });

    it('a day without a time asks', () => {
        expect(parseCallbackTime('tomorrow', WED_11_IST, IST)).toMatchObject({ status: 'ambiguous', reason: 'time_missing' });
    });

    it('a time already passed today with no day named suggests tomorrow, but asks', () => {
        const r = parseCallbackTime('at 10 am', WED_11_IST, IST);
        expect(r).toMatchObject({ status: 'ambiguous', reason: 'time_passed_today' });
        if (r.status === 'ambiguous') expect(r.candidates.map(iso)).toEqual(['2026-10-08T04:30:00.000Z']);
    });
});

describe('parseCallbackTime — invalid', () => {
    it.each([
        ['banana', 'unrecognised'],
        ['', 'unrecognised'],
        ['today at 9 am', 'in_past'],
        ['at 25:00', 'bad_time'],
        ['at 13 pm', 'bad_time'],
        ['in 0 minutes', 'bad_time'],
    ])('%s → %s', (text, reason) => {
        expect(parseCallbackTime(text, WED_11_IST, IST)).toEqual({ status: 'invalid', reason });
    });

    it('more than 30 days ahead is refused', () => {
        expect(parseCallbackTime('in 999 hours', WED_11_IST, IST)).toEqual({ status: 'invalid', reason: 'too_far' });
    });
});
