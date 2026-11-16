/**
 * A fake Google for local development and tests. It is NOT Google: no account, no
 * network, no consent screen. It behaves like the parts of the Calendar API this app
 * uses — calendar list, events with RRULE series (FREQ/INTERVAL/COUNT/UNTIL),
 * single-occurrence edits and cancellations, sync tokens, 409 on a reused event id,
 * 410 on an unknown sync token — so every screen and the sync path can be exercised.
 *
 * The OAuth "consent" sends the browser straight back to the app's real callback with
 * a mock code, so state validation, PKCE and token storage run exactly as with Google.
 * Allowed only by config.ts (never in production, only with the Firestore emulator).
 */

import { GoogleApiError, type CalendarListEntry, type GoogleCalendarApi, type GoogleErrorKind } from './api';
import { randomToken } from './crypto';
import { addDays, dateTimeToInstant, fromRecurrence, utcStamp, type GoogleEvent, type GoogleEventBody } from './recurrence';
import { zonedParts, zonedToUtc } from '@/lib/sampark/callbacks/time';

type Stored = GoogleEvent & { seq: number };
export interface MockCalendarDoc {
    seq: number;
    events: Record<string, Stored>;
}
export interface MockBackend {
    load(calendarId: string): Promise<MockCalendarDoc>;
    save(calendarId: string, doc: MockCalendarDoc): Promise<void>;
}

export const MOCK_CALENDARS: CalendarListEntry[] = [
    { id: 'school.admin@mock-google.test', summary: 'Hillview School (mock primary)', timeZone: 'Asia/Kolkata', primary: true, accessRole: 'owner' },
    { id: 'ptm-schedule@mock-google.test', summary: 'PTM schedule (mock)', timeZone: 'Asia/Kolkata', primary: false, accessRole: 'owner' },
    { id: 'en.indian#holiday@mock-google.test', summary: 'Holidays in India (mock, read-only)', timeZone: 'Asia/Kolkata', primary: false, accessRole: 'reader' },
];

export function memoryMockBackend(): MockBackend {
    const docs = new Map<string, MockCalendarDoc>();
    return {
        load: async (id) => structuredClone(docs.get(id) ?? { seq: 0, events: {} }),
        save: async (id, doc) => void docs.set(id, structuredClone(doc)),
    };
}

const fail = (kind: GoogleErrorKind, status: number, message: string) => new GoogleApiError(kind, status, message);

function normaliseTime(t: GoogleEvent['start'], zone: string): GoogleEvent['start'] {
    if (!t) return t;
    if (t.date) return { date: t.date };
    if (!t.dateTime) return t;
    return { dateTime: dateTimeToInstant(t.dateTime, t.timeZone || zone).toISOString(), timeZone: t.timeZone || zone };
}

function startInstant(e: GoogleEvent): number {
    return e.start?.date ? Date.parse(`${e.start.date}T00:00:00Z`) : Date.parse(e.start?.dateTime ?? '');
}

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Occurrence starts of a series master (instant ms, or date key for all-day), up to `until`. */
function occurrences(master: GoogleEvent, horizon: number): { key: string; at: number; date?: string }[] {
    const zone = master.start?.timeZone || 'UTC';
    const { repeat } = fromRecurrence(master.recurrence, zone);
    if (!repeat) return [];
    const allDay = Boolean(master.start?.date);
    const first = allDay ? null : new Date(master.start!.dateTime!);
    const wall = allDay
        ? { ...(() => { const [y, m, d] = master.start!.date!.split('-').map(Number); return { year: y, month: m, day: d }; })(), hour: 0, minute: 0 }
        : zonedParts(first!, zone);
    const untilKey = repeat.ends.type === 'until' ? repeat.ends.date : null;
    const max = repeat.ends.type === 'count' ? repeat.ends.count : Infinity;
    const out: { key: string; at: number; date?: string }[] = [];
    for (let step = 0; out.length < max && step < 5000; step += 1) {
        const n = step * repeat.interval;
        let y = wall.year, m = wall.month, d = wall.day;
        if (repeat.freq === 'DAILY' || repeat.freq === 'WEEKLY') {
            const dt = new Date(Date.UTC(y, m - 1, d + n * (repeat.freq === 'WEEKLY' ? 7 : 1)));
            y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
        } else if (repeat.freq === 'MONTHLY') {
            const idx = m - 1 + n;
            y = wall.year + Math.floor(idx / 12); m = (idx % 12) + 1;
            if (d > daysIn(y, m)) continue; // RFC 5545: a month without that day has no occurrence
        } else {
            y = wall.year + n;
            if (d > daysIn(y, m)) continue; // 29 Feb only in leap years
        }
        const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (untilKey && date > untilKey) break;
        const at = allDay ? Date.parse(`${date}T00:00:00Z`) : zonedToUtc({ year: y, month: m, day: d, hour: wall.hour, minute: wall.minute }, zone).getTime();
        if (at > horizon) break;
        out.push({ key: allDay ? date.replace(/-/g, '') : utcStamp(new Date(at)), at, date: allDay ? date : undefined });
    }
    return out;
}

function instanceOf(master: GoogleEvent, occ: { key: string; at: number; date?: string }): GoogleEvent {
    const zone = master.start?.timeZone || 'UTC';
    const base = { ...master, id: `${master.id}_${occ.key}`, recurringEventId: master.id, recurrence: undefined };
    if (occ.date) {
        const span = Math.round((Date.parse(`${master.end!.date}T00:00:00Z`) - Date.parse(`${master.start!.date}T00:00:00Z`)) / 86_400_000);
        return { ...base, start: { date: occ.date }, end: { date: addDays(occ.date, span) }, originalStartTime: { date: occ.date } };
    }
    const dur = Date.parse(master.end!.dateTime!) - Date.parse(master.start!.dateTime!);
    const start = new Date(occ.at).toISOString();
    return {
        ...base,
        start: { dateTime: start, timeZone: zone },
        end: { dateTime: new Date(occ.at + dur).toISOString(), timeZone: zone },
        originalStartTime: { dateTime: start, timeZone: zone },
    };
}

export interface MockApiOptions {
    backend: MockBackend;
    /** Test hook: return an error to throw before an operation runs. */
    inject?: (op: string) => GoogleApiError | undefined;
    /** Clock for token and channel expiry (tests share theirs). */
    now?: () => number;
}

export function createMockGoogleCalendarApi({ backend, inject, now = Date.now }: MockApiOptions): GoogleCalendarApi {
    const check = (op: string, accessToken?: string) => {
        const e = inject?.(op);
        if (e) throw e;
        if (accessToken !== undefined && !accessToken.startsWith('mock-at.')) throw fail('unauthorized', 401, 'Invalid Credentials');
    };
    const calendar = (id: string, write = false) => {
        const c = MOCK_CALENDARS.find((x) => x.id === id);
        if (!c) throw fail('not_found', 404, 'Not Found');
        if (write && c.accessRole !== 'owner') throw fail('forbidden', 403, 'Forbidden');
        return c;
    };
    const tokens = (): ReturnType<GoogleCalendarApi['refresh']> =>
        Promise.resolve({
            accessToken: `mock-at.${randomToken(18)}`,
            refreshToken: `mock-rt.${randomToken(18)}`,
            expiresAt: new Date(now() + 3600_000),
            scopes: [
                'https://www.googleapis.com/auth/calendar.events.owned',
                'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
            ],
        });

    function find(doc: MockCalendarDoc, eventId: string): GoogleEvent | null {
        const stored = doc.events[eventId];
        if (stored) return stored;
        const sep = eventId.lastIndexOf('_');
        if (sep < 0) return null;
        const master = doc.events[eventId.slice(0, sep)];
        if (!master || master.status === 'cancelled') return null;
        const occ = occurrences(master, Number.MAX_SAFE_INTEGER).find((o) => o.key === eventId.slice(sep + 1));
        return occ ? instanceOf(master, occ) : null;
    }

    function put(doc: MockCalendarDoc, e: GoogleEvent): Stored {
        doc.seq += 1;
        const stored: Stored = { ...e, updated: new Date().toISOString(), seq: doc.seq };
        doc.events[e.id] = stored;
        return stored;
    }

    const strip = ({ seq: _seq, ...e }: Stored | GoogleEvent & { seq?: number }): GoogleEvent => e;

    return {
        mode: 'mock',
        authorizationUrl({ state, redirectUri }) {
            const q = new URLSearchParams({ code: `mock-code.${randomToken(12)}`, state });
            return `${redirectUri}?${q.toString()}`;
        },
        async exchangeCode({ code }) {
            check('exchangeCode');
            if (!code.startsWith('mock-code.')) throw fail('invalid_grant', 400, 'Malformed auth code.');
            return tokens();
        },
        async refresh(refreshToken) {
            check('refresh');
            if (!refreshToken.startsWith('mock-rt.')) throw fail('invalid_grant', 400, 'Token has been expired or revoked.');
            const t = await tokens();
            return { ...t, refreshToken: null };
        },
        async revoke() {
            check('revoke');
        },
        async listCalendars(accessToken) {
            check('listCalendars', accessToken);
            return MOCK_CALENDARS.map((c) => ({ ...c }));
        },
        async listEvents(accessToken, calendarId, { timeMin, timeMax }) {
            check('listEvents', accessToken);
            calendar(calendarId);
            const doc = await backend.load(calendarId);
            const all = Object.values(doc.events);
            const exceptions = new Map(all.filter((e) => e.recurringEventId).map((e) => [e.id, e]));
            const out: GoogleEvent[] = [];
            const overlaps = (e: GoogleEvent) => {
                const s = startInstant(e);
                const end = e.end?.date ? Date.parse(`${e.end.date}T00:00:00Z`) : Date.parse(e.end?.dateTime ?? '');
                return s < timeMax.getTime() && end > timeMin.getTime();
            };
            for (const e of all) {
                if (e.status === 'cancelled' || e.recurringEventId) continue;
                if (!e.recurrence?.length) {
                    if (overlaps(e)) out.push(strip(e));
                    continue;
                }
                for (const occ of occurrences(e, timeMax.getTime())) {
                    const inst = exceptions.get(`${e.id}_${occ.key}`) ?? instanceOf(e, occ);
                    if (inst.status !== 'cancelled' && overlaps(inst)) out.push(strip(inst as Stored));
                }
            }
            return out.sort((a, b) => startInstant(a) - startInstant(b));
        },
        async getEvent(accessToken, calendarId, eventId) {
            check('getEvent', accessToken);
            calendar(calendarId);
            const e = find(await backend.load(calendarId), eventId);
            if (!e) throw fail('not_found', 404, 'Not Found');
            return strip(e as Stored);
        },
        async insertEvent(accessToken, calendarId, body) {
            check('insertEvent', accessToken);
            const c = calendar(calendarId, true);
            const doc = await backend.load(calendarId);
            const id = body.id ?? randomToken(16).toLowerCase().replace(/[^a-v0-9]/g, '0');
            if (doc.events[id]) throw fail('conflict', 409, 'The requested identifier already exists.');
            const e = put(doc, {
                ...body,
                id,
                status: 'confirmed',
                start: normaliseTime(body.start, c.timeZone),
                end: normaliseTime(body.end, c.timeZone),
                recurrence: body.recurrence?.length ? body.recurrence : undefined,
                htmlLink: `https://calendar.mock-google.test/event?eid=${id}`,
            });
            await backend.save(calendarId, doc);
            return strip(e);
        },
        async patchEvent(accessToken, calendarId, eventId, body) {
            check('patchEvent', accessToken);
            const c = calendar(calendarId, true);
            const doc = await backend.load(calendarId);
            const current = find(doc, eventId);
            if (!current || current.status === 'cancelled') throw fail('not_found', 404, 'Not Found');
            const next: GoogleEvent = {
                ...current,
                ...body,
                id: eventId,
                start: body.start ? normaliseTime(body.start, c.timeZone) : current.start,
                end: body.end ? normaliseTime(body.end, c.timeZone) : current.end,
            };
            if (current.recurringEventId) next.recurrence = undefined;
            else if (body.recurrence) next.recurrence = body.recurrence.length ? body.recurrence : undefined;
            const e = put(doc, next);
            await backend.save(calendarId, doc);
            return strip(e);
        },
        async deleteEvent(accessToken, calendarId, eventId) {
            check('deleteEvent', accessToken);
            calendar(calendarId, true);
            const doc = await backend.load(calendarId);
            const current = find(doc, eventId);
            if (!current) throw fail('not_found', 404, 'Not Found');
            if (current.status === 'cancelled') throw fail('gone', 410, 'Resource has been deleted');
            put(doc, { ...current, status: 'cancelled' });
            if (!current.recurringEventId) {
                for (const e of Object.values(doc.events)) if (e.recurringEventId === eventId && e.status !== 'cancelled') put(doc, { ...e, status: 'cancelled' });
            }
            await backend.save(calendarId, doc);
        },
        async syncEvents(accessToken, calendarId, syncToken) {
            check('syncEvents', accessToken);
            calendar(calendarId);
            const doc = await backend.load(calendarId);
            let since = 0;
            if (syncToken) {
                const m = /^mock-sync\.(\d+)$/.exec(syncToken);
                if (!m || Number(m[1]) > doc.seq) throw fail('gone', 410, 'Sync token is no longer valid, a full sync is required.');
                since = Number(m[1]);
            }
            const items = Object.values(doc.events)
                .filter((e) => e.seq > since && (syncToken || e.status !== 'cancelled'))
                .map((e) => strip(e));
            return { items, nextSyncToken: `mock-sync.${doc.seq}` };
        },
        async watch(accessToken, calendarId, channel) {
            check('watch', accessToken);
            calendar(calendarId);
            return { resourceId: `mock-resource.${calendarId}`, expiresAt: new Date(now() + channel.ttlSeconds * 1000) };
        },
        async stopChannel(accessToken) {
            check('stopChannel', accessToken);
        },
    };
}
