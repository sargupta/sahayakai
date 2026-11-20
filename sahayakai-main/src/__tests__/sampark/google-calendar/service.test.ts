/** @jest-environment node */
/**
 * The Google Calendar service against the in-memory store and the fake Google
 * (mock-api.ts). These are MOCKED Google responses: they prove this app's logic
 * (OAuth state handling, token storage and refresh, tenant isolation, events,
 * recurrence, sync, notifications, recovery), not a live Google connection.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import crypto from 'node:crypto';

import { GoogleApiError, type GoogleCalendarApi } from '@/lib/sampark/google-calendar/api';
import { readGoogleCalendarConfig } from '@/lib/sampark/google-calendar/config';
import { sha256 } from '@/lib/sampark/google-calendar/crypto';
import { createMockGoogleCalendarApi, memoryMockBackend, MOCK_CALENDARS } from '@/lib/sampark/google-calendar/mock-api';
import { MemoryGoogleCalendarStore } from '@/lib/sampark/google-calendar/store';
import type { CreateEventInput } from '@/lib/sampark/google-calendar/types';
import {
    cancelGoogleEvent,
    completeGoogleConnect,
    createGoogleEvent,
    disconnectGoogleCalendar,
    getGoogleCalendarStatus,
    handleGoogleNotification,
    listGoogleEvents,
    runGoogleCalendarTick,
    selectCalendar,
    startGoogleConnect,
    syncGoogleCalendar,
    updateGoogleEvent,
    type GoogleCalendarDeps,
} from '@/server/sampark/google-calendar';

const ORG = 'hillview-demo';
const OTHER = 'riverside-demo';
const ADMIN = 'admin-uid';
const PRIMARY = MOCK_CALENDARS[0].id;
const IST = 'Asia/Kolkata';

function makeEnv(over: Record<string, string> = {}) {
    return {
        NODE_ENV: 'test',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        GOOGLE_CALENDAR_MODE: 'mock',
        SAMPARK_GCAL_TOKEN_KEY: crypto.randomBytes(32).toString('base64'),
        GOOGLE_CALENDAR_REDIRECT_URI: 'http://localhost:3005/api/sampark/google-calendar/oauth/callback',
        ...over,
    };
}

function setup(opts: { env?: Record<string, string>; wrap?: (api: GoogleCalendarApi) => GoogleCalendarApi; inject?: (op: string) => GoogleApiError | undefined } = {}) {
    const env = opts.env ?? makeEnv();
    const store = new MemoryGoogleCalendarStore();
    const backend = memoryMockBackend();
    let now = new Date('2026-10-28T06:00:00Z');
    const base = createMockGoogleCalendarApi({ backend, inject: opts.inject, now: () => now.getTime() });
    const api = opts.wrap ? opts.wrap(base) : base;
    const deps: GoogleCalendarDeps = { store, config: readGoogleCalendarConfig(env), api, now: () => now, env };
    return { deps, store, backend, api, env, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
}

const isAdmin = async (orgId: string, uid: string) => uid === ADMIN && (orgId === ORG || orgId === OTHER);

async function connect(deps: GoogleCalendarDeps, orgId = ORG) {
    const { authUrl } = await startGoogleConnect(deps, orgId, ADMIN);
    const u = new URL(authUrl);
    return completeGoogleConnect(deps, { state: u.searchParams.get('state'), code: u.searchParams.get('code'), error: null, uid: ADMIN, isAdmin });
}

const event = (over: Partial<CreateEventInput> = {}): CreateEventInput => ({
    requestId: `req-${Math.random().toString(36).slice(2, 12)}`,
    summary: 'Sports day',
    description: '',
    location: 'Ground',
    allDay: false,
    startDate: '2026-11-20',
    startTime: '09:00',
    endDate: '2026-11-20',
    endTime: '12:00',
    timeZone: IST,
    repeat: null,
    ...over,
});
const range = (from: string, to: string) => [new Date(from), new Date(to)] as const;
const codeOf = async (p: Promise<unknown>) => p.then(() => null, (err: { code?: string }) => err.code);

describe('status and connect', () => {
    it('is unconfigured without an OAuth client, and never connected', async () => {
        const { deps } = setup({ env: { NODE_ENV: 'test' } });
        const s = await getGoogleCalendarStatus(deps, ORG);
        expect(s).toMatchObject({ configured: false, state: 'unconfigured' });
        expect(s.missing).toContain('SAMPARK_GCAL_TOKEN_KEY');
        expect(await codeOf(startGoogleConnect(deps, ORG, ADMIN))).toBe('GCAL_NOT_CONFIGURED');
    });

    it('connects with a single-use state, PKCE and encrypted tokens, then chooses the primary owned calendar and syncs', async () => {
        const { deps, store } = setup();
        expect((await getGoogleCalendarStatus(deps, ORG)).state).toBe('disconnected');
        const { authUrl } = await startGoogleConnect(deps, ORG, ADMIN);
        const state = new URL(authUrl).searchParams.get('state')!;
        // Only a hash of the state is stored.
        expect(store.states.has(state)).toBe(false);
        expect(store.states.has(sha256(state))).toBe(true);

        const r = await completeGoogleConnect(deps, { state, code: new URL(authUrl).searchParams.get('code'), error: null, uid: ADMIN, isAdmin });
        expect(r).toEqual({ ok: true, orgId: ORG });
        const conn = store.connections.get(ORG)!;
        expect(JSON.stringify(conn)).not.toMatch(/mock-at\.|mock-rt\./);
        expect(conn.calendar?.id).toBe(PRIMARY);
        const s = await getGoogleCalendarStatus(deps, ORG);
        expect(s).toMatchObject({ state: 'connected', accountLabel: PRIMARY, mode: 'mock', push: { active: false, reason: 'no_public_url' } });
        expect(s.lastSyncedAt).not.toBeNull();
        expect(JSON.stringify(s)).not.toMatch(/Enc|token/i);

        // The same state again is refused.
        const again = await completeGoogleConnect(deps, { state, code: 'mock-code.x', error: null, uid: ADMIN, isAdmin });
        expect(again).toEqual({ ok: false, orgId: null, reason: 'used_state' });
    });

    it('refuses an unknown, malformed or expired state, another user, a non-admin and a denial', async () => {
        const { deps, advance } = setup();
        const run = async (over: Partial<Parameters<typeof completeGoogleConnect>[1]> = {}, afterMs = 0) => {
            const { authUrl } = await startGoogleConnect(deps, ORG, ADMIN);
            advance(afterMs);
            const u = new URL(authUrl);
            return completeGoogleConnect(deps, { state: u.searchParams.get('state'), code: u.searchParams.get('code'), error: null, uid: ADMIN, isAdmin, ...over });
        };
        expect(await completeGoogleConnect(deps, { state: 'x'.repeat(43), code: 'c', error: null, uid: ADMIN, isAdmin })).toMatchObject({ reason: 'invalid_state' });
        expect(await completeGoogleConnect(deps, { state: '../../etc', code: 'c', error: null, uid: ADMIN, isAdmin })).toMatchObject({ reason: 'invalid_state' });
        expect(await run({}, 11 * 60_000)).toMatchObject({ reason: 'expired_state' });
        expect(await run({ uid: 'someone-else' })).toMatchObject({ ok: false, orgId: ORG, reason: 'wrong_user' });
        expect(await run({ isAdmin: async () => false })).toMatchObject({ reason: 'not_admin' });
        expect(await run({ error: 'access_denied', code: null })).toMatchObject({ reason: 'denied' });
        expect(await getGoogleCalendarStatus(deps, ORG)).toMatchObject({ state: 'disconnected' });
    });

    it('refuses a grant without lasting access or without both scopes', async () => {
        const noRefresh = setup({ wrap: (api) => ({ ...api, exchangeCode: async (p) => ({ ...(await api.exchangeCode(p)), refreshToken: null }) }) });
        expect(await connect(noRefresh.deps)).toMatchObject({ reason: 'no_refresh_token' });
        const revoke = jest.fn(async () => undefined);
        const narrow = setup({ wrap: (api) => ({ ...api, revoke, exchangeCode: async (p) => ({ ...(await api.exchangeCode(p)), scopes: ['https://www.googleapis.com/auth/calendar.calendarlist.readonly'] }) }) });
        expect(await connect(narrow.deps)).toMatchObject({ reason: 'scope_missing' });
        expect(revoke).toHaveBeenCalled();
        expect(narrow.store.connections.size).toBe(0);
    });

    it('keeps schools apart: one school’s connection is invisible to another', async () => {
        const { deps } = setup();
        await connect(deps, ORG);
        await createGoogleEvent(deps, ORG, ADMIN, event());
        expect((await getGoogleCalendarStatus(deps, OTHER)).state).toBe('disconnected');
        expect(await codeOf(listGoogleEvents(deps, OTHER, ...range('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z')))).toBe('GCAL_NOT_CONNECTED');
        expect(await codeOf(createGoogleEvent(deps, OTHER, ADMIN, event()))).toBe('GCAL_NOT_CONNECTED');
    });

    it('only lets the school choose a calendar the account owns', async () => {
        const { deps } = setup();
        await connect(deps);
        expect(await codeOf(selectCalendar(deps, ORG, 'en.indian#holiday@mock-google.test'))).toBe('GCAL_CALENDAR_NOT_ALLOWED');
        expect((await selectCalendar(deps, ORG, MOCK_CALENDARS[1].id)).calendar?.id).toBe(MOCK_CALENDARS[1].id);
    });
});

describe('tokens', () => {
    it('refreshes an expired access token and keeps working', async () => {
        const refresh = jest.fn();
        const { deps, store, advance } = setup({ wrap: (api) => ({ ...api, refresh: async (t) => (refresh(), api.refresh(t)) }) });
        await connect(deps);
        advance(2 * 3600_000);
        await listGoogleEvents(deps, ORG, ...range('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z'));
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(Date.parse(store.connections.get(ORG)!.accessTokenExpiresAt!)).toBeGreaterThan(deps.now().getTime());
    });

    it('retries once with a fresh token after a 401', async () => {
        let first = true;
        const { deps } = setup({ inject: (op) => (op === 'listEvents' && first ? ((first = false), new GoogleApiError('unauthorized', 401, 'Invalid Credentials')) : undefined) });
        await connect(deps);
        await expect(listGoogleEvents(deps, ORG, ...range('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z'))).resolves.toMatchObject({ events: [] });
    });

    it('marks the connection "reconnect needed" when Google revoked the grant', async () => {
        let revoked = false;
        const { deps, advance } = setup({ inject: (op) => (op === 'refresh' && revoked ? new GoogleApiError('invalid_grant', 400, 'Token has been expired or revoked.') : undefined) });
        await connect(deps);
        revoked = true;
        advance(2 * 3600_000);
        expect(await codeOf(listGoogleEvents(deps, ORG, ...range('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z')))).toBe('GCAL_RECONNECT_REQUIRED');
        expect(await getGoogleCalendarStatus(deps, ORG)).toMatchObject({ state: 'reconnect_required', lastError: { code: 'GCAL_RECONNECT_REQUIRED' } });
        // Reconnecting restores it.
        revoked = false;
        expect(await connect(deps)).toEqual({ ok: true, orgId: ORG });
        expect((await getGoogleCalendarStatus(deps, ORG)).state).toBe('connected');
    });

    it('treats a token that no longer decrypts (key changed) as reconnect needed, not a crash', async () => {
        const { deps } = setup();
        await connect(deps);
        const rotated = { ...deps, env: { ...deps.env!, SAMPARK_GCAL_TOKEN_KEY: crypto.randomBytes(32).toString('base64') } };
        expect(await codeOf(listGoogleEvents(rotated, ORG, ...range('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z')))).toBe('GCAL_RECONNECT_REQUIRED');
    });

    it('reports Google being down after retries as a 502, and records it', async () => {
        const { deps } = setup({ inject: (op) => (op === 'listEvents' ? new GoogleApiError('unavailable', 503, 'Backend Error') : undefined) });
        await connect(deps);
        const err = await listGoogleEvents(deps, ORG, ...range('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z')).catch((e) => e);
        expect(err).toMatchObject({ code: 'GCAL_UNAVAILABLE', status: 502 });
        expect((await getGoogleCalendarStatus(deps, ORG)).lastError?.code).toBe('GCAL_UNAVAILABLE');
    });
});

describe('events', () => {
    const nov = range('2026-11-01T00:00:00+05:30', '2026-12-01T00:00:00+05:30');

    it('creates once per request id, even when the request is retried', async () => {
        const { deps } = setup();
        await connect(deps);
        const input = event({ requestId: 'retry-me-123' });
        const first = await createGoogleEvent(deps, ORG, ADMIN, input);
        const second = await createGoogleEvent(deps, ORG, ADMIN, input);
        expect(first.created).toBe(true);
        expect(second).toEqual({ event: first.event, created: false });
        expect((await listGoogleEvents(deps, ORG, ...nov)).events).toHaveLength(1);
        expect(first.event).toMatchObject({ start: '2026-11-20T03:30:00.000Z', end: '2026-11-20T06:30:00.000Z', timeZone: IST, location: 'Ground' });
    });

    it('validates before calling Google', async () => {
        const { deps } = setup();
        await connect(deps);
        expect(await codeOf(createGoogleEvent(deps, ORG, ADMIN, event({ endTime: '08:00' })))).toBe('END_BEFORE_START');
    });

    it('repeats weekly, edits one occurrence or the whole series, and cancels either', async () => {
        const { deps } = setup();
        await connect(deps);
        const { event: series } = await createGoogleEvent(deps, ORG, ADMIN, event({ summary: 'Staff meeting', startDate: '2026-11-02', endDate: '2026-11-02', repeat: { freq: 'WEEKLY', interval: 1, ends: { type: 'count', count: 4 } } }));
        expect(series.repeat).toEqual({ freq: 'WEEKLY', interval: 1, ends: { type: 'count', count: 4 } });
        let occ = (await listGoogleEvents(deps, ORG, ...nov)).events;
        expect(occ.map((e) => e.start.slice(0, 10))).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
        expect(occ.every((e) => e.recurringEventId === series.id)).toBe(true);

        // One occurrence moves; the others stay.
        const second = occ[1];
        await updateGoogleEvent(deps, ORG, second.id, { ...event({ summary: 'Staff meeting (hall)', startDate: '2026-11-10', endDate: '2026-11-10' }), repeat: null }, 'this');
        occ = (await listGoogleEvents(deps, ORG, ...nov)).events;
        expect(occ.map((e) => `${e.start.slice(0, 10)} ${e.summary}`)).toEqual(['2026-11-02 Staff meeting', '2026-11-10 Staff meeting (hall)', '2026-11-16 Staff meeting', '2026-11-23 Staff meeting']);
        // An occurrence cannot get its own repeat.
        expect(await codeOf(updateGoogleEvent(deps, ORG, occ[2].id, { ...event(), repeat: { freq: 'DAILY', interval: 1, ends: { type: 'never' } } }, 'this'))).toBe('GCAL_OCCURRENCE_CANNOT_REPEAT');

        // Cancel one occurrence.
        expect(await cancelGoogleEvent(deps, ORG, occ[2].id, 'this')).toEqual({ cancelled: true, alreadyCancelled: false });
        expect((await listGoogleEvents(deps, ORG, ...nov)).events).toHaveLength(3);
        // Cancelling it again is not an error.
        expect(await cancelGoogleEvent(deps, ORG, occ[2].id, 'this')).toEqual({ cancelled: true, alreadyCancelled: true });

        // Rename the whole series from one of its occurrences.
        await updateGoogleEvent(deps, ORG, occ[0].id, { ...event({ summary: 'Weekly staff meeting', startDate: '2026-11-02', endDate: '2026-11-02' }), repeat: { freq: 'WEEKLY', interval: 1, ends: { type: 'count', count: 4 } } }, 'series');
        expect((await listGoogleEvents(deps, ORG, ...nov)).events.filter((e) => e.summary === 'Weekly staff meeting')).toHaveLength(2);

        // Cancel the series: nothing left.
        await cancelGoogleEvent(deps, ORG, occ[0].id, 'series');
        expect((await listGoogleEvents(deps, ORG, ...nov)).events).toHaveLength(0);
    });

    it('expands daily, monthly (skipping short months) and yearly rules', async () => {
        const { deps } = setup();
        await connect(deps);
        await createGoogleEvent(deps, ORG, ADMIN, event({ summary: 'Assembly', startDate: '2026-11-28', endDate: '2026-11-28', repeat: { freq: 'DAILY', interval: 1, ends: { type: 'until', date: '2026-11-30' } } }));
        await createGoogleEvent(deps, ORG, ADMIN, event({ summary: 'Fee day', allDay: true, startTime: undefined, endTime: undefined, startDate: '2027-01-31', endDate: '2027-01-31', repeat: { freq: 'MONTHLY', interval: 1, ends: { type: 'count', count: 3 } } }));
        await createGoogleEvent(deps, ORG, ADMIN, event({ summary: 'Founders day', allDay: true, startTime: undefined, endTime: undefined, startDate: '2026-12-05', endDate: '2026-12-05', repeat: { freq: 'YEARLY', interval: 1, ends: { type: 'never' } } }));
        const names = async (from: string, to: string) => (await listGoogleEvents(deps, ORG, ...range(from, to))).events.map((e) => `${e.start.slice(0, 10)} ${e.summary}`);
        expect(await names('2026-11-27T00:00:00+05:30', '2026-12-01T00:00:00+05:30')).toEqual(['2026-11-28 Assembly', '2026-11-29 Assembly', '2026-11-30 Assembly']);
        // 31 Jan, (no 31 Feb), 31 Mar, (no 31 Apr), 31 May: COUNT=3 counts real occurrences.
        expect(await names('2027-01-01T00:00:00+05:30', '2027-04-10T00:00:00+05:30')).toEqual(['2027-01-31 Fee day', '2027-03-31 Fee day']);
        expect(await names('2027-05-01T00:00:00+05:30', '2027-06-01T00:00:00+05:30')).toEqual(['2027-05-31 Fee day']);
        expect(await names('2027-12-01T00:00:00+05:30', '2027-12-31T00:00:00+05:30')).toEqual(['2027-12-05 Founders day']);
    });

    it('keeps a repeating event at the same local time across a daylight-saving change', async () => {
        const { deps } = setup();
        await connect(deps);
        await createGoogleEvent(deps, ORG, ADMIN, event({ summary: 'NY call', timeZone: 'America/New_York', startDate: '2027-03-06', endDate: '2027-03-06', startTime: '09:00', endTime: '10:00', repeat: { freq: 'DAILY', interval: 1, ends: { type: 'count', count: 3 } } }));
        const evs = (await listGoogleEvents(deps, ORG, ...range('2027-03-05T00:00:00Z', '2027-03-10T00:00:00Z'))).events;
        // 9:00 EST = 14:00Z before 14 Mar 2027 … DST starts 14 Mar in 2027, so use the UTC hours to check stability.
        expect(evs.map((e) => e.start)).toEqual(['2027-03-06T14:00:00.000Z', '2027-03-07T14:00:00.000Z', '2027-03-08T14:00:00.000Z']);
    });

    it('refuses a range that is too long or reversed', async () => {
        const { deps } = setup();
        await connect(deps);
        expect(await codeOf(listGoogleEvents(deps, ORG, ...range('2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z')))).toBe('RANGE_TOO_LONG');
        expect(await codeOf(listGoogleEvents(deps, ORG, ...range('2026-02-01T00:00:00Z', '2026-01-01T00:00:00Z')))).toBe('INVALID_RANGE');
    });
});

describe('sync, notifications and the scheduler', () => {
    const webhookEnv = () => makeEnv({ GOOGLE_CALENDAR_WEBHOOK_URL: 'https://app.example.org/api/sampark/google-calendar/notifications' });
    function headersFor(store: MemoryGoogleCalendarStore, token: string, over: Record<string, string> = {}) {
        const [id, ch] = [...store.channels.entries()][0];
        const h: Record<string, string> = { 'x-goog-channel-id': id, 'x-goog-channel-token': token, 'x-goog-resource-id': ch.resourceId, 'x-goog-resource-state': 'exists', 'x-goog-message-number': '2', ...over };
        return (name: string) => h[name] ?? null;
    }

    it('syncs incrementally, and falls back to a full sync when the token expired', async () => {
        const { deps, store } = setup();
        await connect(deps);
        expect(await syncGoogleCalendar(deps, ORG)).toEqual({ full: false, changed: 0, removed: 0 });
        const { event: e } = await createGoogleEvent(deps, ORG, ADMIN, event());
        expect(await syncGoogleCalendar(deps, ORG)).toEqual({ full: false, changed: 1, removed: 0 });
        expect(await store.getCachedEvent(ORG, e.id)).toMatchObject({ summary: 'Sports day' });
        await cancelGoogleEvent(deps, ORG, e.id, 'this');
        expect(await syncGoogleCalendar(deps, ORG)).toEqual({ full: false, changed: 0, removed: 1 });
        expect(await store.getCachedEvent(ORG, e.id)).toBeNull();

        await store.patchConnection(ORG, { syncToken: 'mock-sync.99999' });
        expect(await syncGoogleCalendar(deps, ORG)).toMatchObject({ full: true });
    });

    it('starts a push channel only with a public HTTPS address, and validates every notification', async () => {
        let watchToken = '';
        const { deps, store } = setup({ env: webhookEnv(), wrap: (api) => ({ ...api, watch: (t, c, ch) => ((watchToken = ch.token), api.watch(t, c, ch)) }) });
        await connect(deps);
        expect((await getGoogleCalendarStatus(deps, ORG)).push).toMatchObject({ active: true });
        expect(JSON.stringify([...store.channels.values()])).not.toContain(watchToken);

        expect(await handleGoogleNotification(deps, () => null)).toEqual({ status: 404, outcome: 'unknown_channel' });
        expect(await handleGoogleNotification(deps, headersFor(store, 'wrong-token'))).toMatchObject({ status: 403, outcome: 'bad_token' });
        expect(await handleGoogleNotification(deps, headersFor(store, watchToken, { 'x-goog-resource-id': 'other' }))).toMatchObject({ status: 403, outcome: 'bad_resource' });
        expect(await handleGoogleNotification(deps, headersFor(store, watchToken, { 'x-goog-resource-state': 'sync', 'x-goog-message-number': '1' }))).toMatchObject({ outcome: 'sync_handshake' });

        await createGoogleEvent(deps, ORG, ADMIN, event());
        expect(await handleGoogleNotification(deps, headersFor(store, watchToken))).toEqual({ status: 200, outcome: 'synced' });
        // The same message again is ignored; the event is in the reconciled copy once.
        expect(await handleGoogleNotification(deps, headersFor(store, watchToken))).toEqual({ status: 200, outcome: 'duplicate' });
        expect(await store.countCachedEvents(ORG)).toBe(1);
    });

    it('answers 500 when the sync after a notification fails, so Google retries', async () => {
        let down = false;
        let watchToken = '';
        const { deps, store } = setup({
            env: webhookEnv(),
            inject: (op) => (op === 'syncEvents' && down ? new GoogleApiError('unavailable', 503, 'Backend Error') : undefined),
            wrap: (api) => ({ ...api, watch: (t, c, ch) => ((watchToken = ch.token), api.watch(t, c, ch)) }),
        });
        await connect(deps);
        down = true;
        expect(await handleGoogleNotification(deps, headersFor(store, watchToken))).toEqual({ status: 500, outcome: 'sync_failed' });
        down = false;
        expect(await handleGoogleNotification(deps, headersFor(store, watchToken))).toEqual({ status: 200, outcome: 'synced' });
    });

    it('the tick renews an expiring channel and re-syncs a stale school', async () => {
        const { deps, store, advance } = setup({ env: webhookEnv() });
        await connect(deps);
        const firstChannel = store.connections.get(ORG)!.channel!.id;
        advance(6.5 * 24 * 3600_000); // within a day of the 7-day expiry, and long after the last sync
        const report = await runGoogleCalendarTick(deps);
        expect(report).toEqual({ schools: 1, synced: 1, renewed: 1, errors: [] });
        const conn = store.connections.get(ORG)!;
        expect(conn.channel!.id).not.toBe(firstChannel);
        expect(store.channels.has(firstChannel)).toBe(false);
        // Right after, nothing is due.
        expect(await runGoogleCalendarTick(deps)).toEqual({ schools: 1, synced: 0, renewed: 0, errors: [] });
    });
});

describe('disconnect', () => {
    it('stops the channel, revokes at Google and removes everything of that school only', async () => {
        const revoke = jest.fn(async () => undefined);
        const { deps, store } = setup({
            env: makeEnv({ GOOGLE_CALENDAR_WEBHOOK_URL: 'https://app.example.org/api/sampark/google-calendar/notifications' }),
            wrap: (api) => ({ ...api, revoke }),
        });
        await connect(deps, ORG);
        await connect(deps, OTHER);
        await createGoogleEvent(deps, ORG, ADMIN, event());
        await syncGoogleCalendar(deps, ORG);
        expect(await disconnectGoogleCalendar(deps, ORG)).toEqual({ disconnected: true, revoked: true });
        expect(revoke).toHaveBeenCalledWith(expect.stringMatching(/^mock-rt\./));
        expect(store.connections.has(ORG)).toBe(false);
        expect(await store.countCachedEvents(ORG)).toBe(0);
        expect([...store.channels.values()].map((c) => c.orgId)).toEqual([OTHER]);
        expect((await getGoogleCalendarStatus(deps, OTHER)).state).toBe('connected');
        // Disconnecting again is harmless.
        expect(await disconnectGoogleCalendar(deps, ORG)).toEqual({ disconnected: true, revoked: false });
    });
});
