/** @jest-environment node */
/**
 * Google Calendar pure parts: event input → Google body (timed, all-day, repeat
 * rules, time zones and DST gaps, invalid dates), Google event → app event, the
 * configuration rules (redirect / webhook URLs, mock mode only in local development)
 * and token encryption bound to the school.
 */

import crypto from 'node:crypto';

import { readGoogleCalendarConfig, validRedirectUri, validWebhookUrl } from '@/lib/sampark/google-calendar/config';
import { decryptToken, encryptToken } from '@/lib/sampark/google-calendar/crypto';
import { EventValidationError, fromGoogleEvent, fromRecurrence, toGoogleBody, toRrule } from '@/lib/sampark/google-calendar/recurrence';
import type { EventInput } from '@/lib/sampark/google-calendar/types';

const IST = 'Asia/Kolkata';
const input = (over: Partial<EventInput> = {}): EventInput => ({
    summary: 'PTM',
    description: '',
    location: '',
    allDay: false,
    startDate: '2026-11-21',
    startTime: '10:00',
    endDate: '2026-11-21',
    endTime: '12:00',
    timeZone: IST,
    repeat: null,
    ...over,
});
const code = (fn: () => unknown) => {
    try {
        fn();
    } catch (err) {
        return (err as EventValidationError).code;
    }
    return null;
};

describe('toGoogleBody', () => {
    it('sends a timed event as wall time plus its zone', () => {
        const b = toGoogleBody(input());
        expect(b.start).toEqual({ dateTime: '2026-11-21T10:00:00', timeZone: IST });
        expect(b.end).toEqual({ dateTime: '2026-11-21T12:00:00', timeZone: IST });
        expect(b.recurrence).toEqual([]);
    });

    it('makes the inclusive all-day end exclusive for Google', () => {
        const b = toGoogleBody(input({ allDay: true, startDate: '2026-12-24', endDate: '2026-12-26', startTime: undefined, endTime: undefined }));
        expect(b.start).toEqual({ date: '2026-12-24' });
        expect(b.end).toEqual({ date: '2026-12-27' });
    });

    it('refuses an end at or before the start, a date that does not exist, and a missing time', () => {
        expect(code(() => toGoogleBody(input({ endTime: '10:00' })))).toBe('END_BEFORE_START');
        expect(code(() => toGoogleBody(input({ endDate: '2026-11-20' })))).toBe('END_BEFORE_START');
        expect(code(() => toGoogleBody(input({ startDate: '2027-02-30', endDate: '2027-02-30' })))).toBe('INVALID_DATE');
        expect(code(() => toGoogleBody(input({ endTime: undefined })))).toBe('TIME_REQUIRED');
    });

    it('refuses a wall time skipped by a daylight-saving change, and accepts the hour after it', () => {
        const ny = { timeZone: 'America/New_York', startDate: '2026-03-08', endDate: '2026-03-08' };
        expect(code(() => toGoogleBody(input({ ...ny, startTime: '02:30', endTime: '03:30' })))).toBe('TIME_DOES_NOT_EXIST');
        expect(() => toGoogleBody(input({ ...ny, startTime: '03:00', endTime: '04:00' }))).not.toThrow();
    });

    it('builds daily, weekly, monthly and yearly rules with interval, count and until', () => {
        const rule = (repeat: EventInput['repeat']) => toGoogleBody(input({ repeat })).recurrence;
        expect(rule({ freq: 'DAILY', interval: 1, ends: { type: 'never' } })).toEqual(['RRULE:FREQ=DAILY']);
        expect(rule({ freq: 'WEEKLY', interval: 2, ends: { type: 'count', count: 6 } })).toEqual(['RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6']);
        // Until the end of 31 Mar in IST = 18:29 UTC.
        expect(rule({ freq: 'MONTHLY', interval: 1, ends: { type: 'until', date: '2027-03-31' } })).toEqual(['RRULE:FREQ=MONTHLY;UNTIL=20270331T182900Z']);
        expect(toRrule({ freq: 'YEARLY', interval: 1, ends: { type: 'until', date: '2030-01-01' } }, true, IST)).toBe('RRULE:FREQ=YEARLY;UNTIL=20300101');
        expect(code(() => toGoogleBody(input({ repeat: { freq: 'DAILY', interval: 1, ends: { type: 'until', date: '2026-11-01' } } })))).toBe('REPEAT_ENDS_BEFORE_START');
    });
});

describe('fromRecurrence / fromGoogleEvent', () => {
    it('round-trips the rules this app writes', () => {
        for (const repeat of [
            { freq: 'DAILY', interval: 1, ends: { type: 'never' } },
            { freq: 'WEEKLY', interval: 3, ends: { type: 'count', count: 4 } },
            { freq: 'YEARLY', interval: 1, ends: { type: 'until', date: '2030-06-01' } },
        ] as const) {
            expect(fromRecurrence(toGoogleBody(input({ repeat })).recurrence, IST).repeat).toEqual(repeat);
        }
    });

    it('keeps a rule it cannot edit as text', () => {
        expect(fromRecurrence(['RRULE:FREQ=WEEKLY;BYDAY=MO,WE'], IST)).toEqual({ repeat: null, text: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE' });
        expect(fromRecurrence(['RRULE:FREQ=DAILY', 'EXDATE:20261122T043000Z'], IST).repeat).toBeNull();
    });

    it('maps offset times to instants and the all-day end back to inclusive', () => {
        const timed = fromGoogleEvent({ id: 'a', summary: 'X', start: { dateTime: '2026-11-21T10:00:00+05:30', timeZone: IST }, end: { dateTime: '2026-11-21T12:00:00+05:30' } }, 'cal', 'UTC');
        expect(timed).toMatchObject({ start: '2026-11-21T04:30:00.000Z', end: '2026-11-21T06:30:00.000Z', timeZone: IST, allDay: false });
        const allDay = fromGoogleEvent({ id: 'b', start: { date: '2026-12-24' }, end: { date: '2026-12-27' } }, 'cal', IST);
        expect(allDay).toMatchObject({ start: '2026-12-24', end: '2026-12-26', allDay: true, summary: '(No title)' });
    });
});

describe('configuration', () => {
    const key = crypto.randomBytes(32).toString('base64');
    const base = { SAMPARK_GCAL_TOKEN_KEY: key, GOOGLE_CALENDAR_REDIRECT_URI: 'https://app.example.org/api/sampark/google-calendar/oauth/callback' };

    it('names what is missing and is never "configured" without a client', () => {
        const r = readGoogleCalendarConfig({});
        expect(r.ok).toBe(false);
        expect(!r.ok && r.missing).toEqual(['SAMPARK_GCAL_TOKEN_KEY', 'GOOGLE_CALENDAR_REDIRECT_URI', 'GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET']);
        expect(readGoogleCalendarConfig({ ...base, GOOGLE_CALENDAR_CLIENT_ID: 'id', GOOGLE_CALENDAR_CLIENT_SECRET: 's' }).ok).toBe(true);
    });

    it('accepts only an exact callback path, https or a local http host', () => {
        expect(validRedirectUri('http://localhost:3005/api/sampark/google-calendar/oauth/callback')).toBe(true);
        expect(validRedirectUri('http://app.example.org/api/sampark/google-calendar/oauth/callback')).toBe(false);
        expect(validRedirectUri('https://app.example.org/api/sampark/google-calendar/oauth/callback?x=1')).toBe(false);
        expect(validRedirectUri('https://app.example.org/other')).toBe(false);
    });

    it('accepts a webhook only on public HTTPS', () => {
        expect(validWebhookUrl('https://app.example.org/api/sampark/google-calendar/notifications')).toBe(true);
        expect(validWebhookUrl('https://localhost/api/sampark/google-calendar/notifications')).toBe(false);
        expect(validWebhookUrl('http://app.example.org/api/sampark/google-calendar/notifications')).toBe(false);
    });

    it('allows mock mode only in development with the Firestore emulator', () => {
        const mock = { ...base, GOOGLE_CALENDAR_MODE: 'mock' };
        expect(readGoogleCalendarConfig({ ...mock, NODE_ENV: 'development', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }).ok).toBe(true);
        expect(readGoogleCalendarConfig({ ...mock, NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }).ok).toBe(false);
        expect(readGoogleCalendarConfig({ ...mock, NODE_ENV: 'development' }).ok).toBe(false);
    });
});

describe('token encryption', () => {
    const env = { SAMPARK_GCAL_TOKEN_KEY: crypto.randomBytes(32).toString('base64') };
    it('round-trips for the same school and fails for another school', () => {
        const enc = encryptToken('refresh-token-value', 'school-a', env);
        expect(enc).not.toContain('refresh-token-value');
        expect(decryptToken(enc, 'school-a', env)).toBe('refresh-token-value');
        expect(() => decryptToken(enc, 'school-b', env)).toThrow();
    });
    it('has no default key', () => {
        expect(() => encryptToken('x', 'school-a', {})).toThrow(/SAMPARK_GCAL_TOKEN_KEY/);
    });
});
