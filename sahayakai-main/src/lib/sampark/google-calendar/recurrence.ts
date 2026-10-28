/**
 * Event input ⇄ Google's event body, and the small RFC 5545 subset this app edits:
 * RRULE with FREQ (DAILY / WEEKLY / MONTHLY / YEARLY), INTERVAL, and COUNT or UNTIL.
 * Any other rule part (BYDAY, BYMONTHDAY, …) is kept as text and left to Google.
 *
 * Time: a timed event is sent as wall-clock `dateTime` plus `timeZone`, so Google
 * keeps each occurrence at the same local time across daylight-saving changes. A wall
 * time that does not exist in the zone (skipped by a spring-forward) is refused, not
 * shifted. All-day ends are inclusive here and exclusive at Google.
 */

import { zonedParts, zonedToUtc } from '@/lib/sampark/callbacks/time';

import type { EventInput, RepeatFrequency, RepeatRule, SchoolCalendarEvent } from './types';
import { REPEAT_FREQUENCIES } from './types';

/** The parts of Google's Event resource this app reads and writes. */
export interface GoogleEventTime {
    date?: string;
    dateTime?: string;
    timeZone?: string;
}
export interface GoogleEvent {
    id: string;
    status?: 'confirmed' | 'tentative' | 'cancelled';
    summary?: string;
    description?: string;
    location?: string;
    start?: GoogleEventTime;
    end?: GoogleEventTime;
    recurrence?: string[];
    recurringEventId?: string;
    originalStartTime?: GoogleEventTime;
    htmlLink?: string;
    updated?: string;
    extendedProperties?: { private?: Record<string, string> };
}
export type GoogleEventBody = Omit<GoogleEvent, 'id' | 'htmlLink' | 'updated' | 'recurringEventId' | 'originalStartTime' | 'status'> & {
    id?: string;
    status?: GoogleEvent['status'];
};

export class EventValidationError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = 'EventValidationError';
    }
}

function dateParts(key: string): { year: number; month: number; day: number } {
    const [year, month, day] = key.split('-').map(Number);
    return { year, month, day };
}

function realDate(key: string): boolean {
    const { year, month, day } = dateParts(key);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function addDays(key: string, days: number): string {
    const { year, month, day } = dateParts(key);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The instant of a wall time, or null when the zone skips it (DST gap). */
export function wallToInstant(date: string, time: string, timeZone: string): Date | null {
    const { year, month, day } = dateParts(date);
    const [hour, minute] = time.split(':').map(Number);
    const at = zonedToUtc({ year, month, day, hour, minute }, timeZone);
    const back = zonedParts(at, timeZone);
    if (back.year !== year || back.month !== month || back.day !== day || back.hour !== hour || back.minute !== minute) return null;
    return at;
}

/** RFC 3339 dateTime → instant; a value without an offset is wall time in `timeZone`. */
export function dateTimeToInstant(dateTime: string, timeZone: string): Date {
    if (/(Z|[+-]\d{2}:\d{2})$/.test(dateTime)) return new Date(dateTime);
    const [date, time] = dateTime.split('T');
    return wallToInstant(date, time.slice(0, 5), timeZone) ?? zonedToUtc({ ...dateParts(date), hour: Number(time.slice(0, 2)), minute: Number(time.slice(3, 5)) }, timeZone);
}

export function utcStamp(at: Date): string {
    return at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** RRULE for a repeat rule. UNTIL is the end of that date in the event's zone (UTC for timed events). */
export function toRrule(rule: RepeatRule, allDay: boolean, timeZone: string): string {
    const parts = [`FREQ=${rule.freq}`];
    if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
    if (rule.ends.type === 'count') parts.push(`COUNT=${rule.ends.count}`);
    if (rule.ends.type === 'until') {
        if (allDay) parts.push(`UNTIL=${rule.ends.date.replace(/-/g, '')}`);
        else parts.push(`UNTIL=${utcStamp(wallToInstant(rule.ends.date, '23:59', timeZone) ?? new Date(`${rule.ends.date}T23:59:00Z`))}`);
    }
    return `RRULE:${parts.join(';')}`;
}

/** Parse a recurrence list back to a rule this app can edit, or null with the raw text. */
export function fromRecurrence(recurrence: string[] | undefined, timeZone: string): { repeat: RepeatRule | null; text: string | null } {
    if (!recurrence?.length) return { repeat: null, text: null };
    const rrules = recurrence.filter((r) => r.startsWith('RRULE:'));
    const text = recurrence.join('\n');
    if (rrules.length !== 1 || recurrence.length !== 1) return { repeat: null, text };
    const fields = new Map(
        rrules[0]
            .slice('RRULE:'.length)
            .split(';')
            .map((p) => p.split('=') as [string, string]),
    );
    const freq = fields.get('FREQ') as RepeatFrequency | undefined;
    const known = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'WKST']);
    if (!freq || !REPEAT_FREQUENCIES.includes(freq) || [...fields.keys()].some((k) => !known.has(k))) return { repeat: null, text };
    const interval = Number(fields.get('INTERVAL') ?? 1);
    if (!Number.isInteger(interval) || interval < 1 || interval > 99) return { repeat: null, text };
    let ends: RepeatRule['ends'] = { type: 'never' };
    const count = fields.get('COUNT');
    const until = fields.get('UNTIL');
    if (count) ends = { type: 'count', count: Number(count) };
    else if (until) {
        const m = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(until);
        if (!m) return { repeat: null, text };
        if (m[4]) {
            const at = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[5], +m[6], +m[7]));
            const p = zonedParts(at, timeZone);
            ends = { type: 'until', date: `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}` };
        } else ends = { type: 'until', date: `${m[1]}-${m[2]}-${m[3]}` };
    }
    return { repeat: { freq, interval, ends }, text: null };
}

/** Validate an input and build Google's body. Throws EventValidationError with a code. */
export function toGoogleBody(input: EventInput): GoogleEventBody {
    if (!realDate(input.startDate) || !realDate(input.endDate)) throw new EventValidationError('INVALID_DATE', 'That date does not exist.');
    const body: GoogleEventBody = { summary: input.summary.trim(), description: input.description, location: input.location };
    if (input.allDay) {
        if (input.endDate < input.startDate) throw new EventValidationError('END_BEFORE_START', 'The event ends before it starts.');
        body.start = { date: input.startDate };
        body.end = { date: addDays(input.endDate, 1) };
    } else {
        if (!input.startTime || !input.endTime) throw new EventValidationError('TIME_REQUIRED', 'Choose a start and end time, or make it an all-day event.');
        const start = wallToInstant(input.startDate, input.startTime, input.timeZone);
        const end = wallToInstant(input.endDate, input.endTime, input.timeZone);
        if (!start || !end) throw new EventValidationError('TIME_DOES_NOT_EXIST', `That time does not exist in ${input.timeZone} (the clocks change).`);
        if (end.getTime() <= start.getTime()) throw new EventValidationError('END_BEFORE_START', 'The event must end after it starts.');
        body.start = { dateTime: `${input.startDate}T${input.startTime}:00`, timeZone: input.timeZone };
        body.end = { dateTime: `${input.endDate}T${input.endTime}:00`, timeZone: input.timeZone };
    }
    if (input.repeat) {
        if (input.repeat.ends.type === 'until' && input.repeat.ends.date < input.startDate) {
            throw new EventValidationError('REPEAT_ENDS_BEFORE_START', 'The repeat ends before the first event.');
        }
        body.recurrence = [toRrule(input.repeat, input.allDay, input.timeZone)];
    } else {
        body.recurrence = [];
    }
    return body;
}

/** Google's event → the app's event. `fallbackZone` is the calendar's zone. */
export function fromGoogleEvent(e: GoogleEvent, calendarId: string, fallbackZone: string): SchoolCalendarEvent {
    const allDay = Boolean(e.start?.date);
    const timeZone = e.start?.timeZone || fallbackZone;
    const { repeat, text } = fromRecurrence(e.recurrence, timeZone);
    const instant = (t?: GoogleEventTime) => (t?.dateTime ? dateTimeToInstant(t.dateTime, t.timeZone || timeZone).toISOString() : '');
    return {
        id: e.id,
        calendarId,
        summary: e.summary ?? '(No title)',
        description: e.description ?? '',
        location: e.location ?? '',
        status: e.status ?? 'confirmed',
        allDay,
        start: allDay ? (e.start?.date ?? '') : instant(e.start),
        end: allDay ? addDays(e.end?.date ?? e.start?.date ?? '', -1) : instant(e.end),
        timeZone,
        repeat,
        repeatText: text,
        recurringEventId: e.recurringEventId ?? null,
        htmlLink: e.htmlLink ?? null,
        updated: e.updated ?? null,
    };
}
