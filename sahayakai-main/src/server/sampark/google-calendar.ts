/**
 * Google Calendar for a SamparkAI school, behind the Sampark route shell (flag →
 * 401 → org admin). One connection per school; see the ownership note in
 * src/lib/sampark/google-calendar/types.ts and docs/sampark/GOOGLE_CALENDAR.md.
 *
 *   connect      startConnect → Google consent → completeConnect (state: single use,
 *                10 minutes, bound to the user who started it; PKCE S256; tokens
 *                encrypted with the school's orgId as associated data)
 *   events       read live from Google for the visible range; create (idempotent:
 *                the event id is derived from the client's requestId), edit and
 *                cancel one occurrence or the whole series
 *   sync         incremental with Google's syncToken into a reconciled copy; a 410
 *                (token expired) falls back to a full sync. Runs after a validated
 *                push notification, on the scheduler tick, and on "Sync now"
 *   push         a web_hook channel only when GOOGLE_CALENDAR_WEBHOOK_URL is a public
 *                HTTPS URL; renewed before expiry by the tick
 *   disconnect   stop the channel, revoke the refresh token at Google, delete
 *
 * Nothing here creates, triggers or cancels a phone call: calendar events are not
 * callbacks (src/server/sampark/callbacks.ts owns those).
 */

import crypto from 'node:crypto';

import { logger } from '@/lib/logger';
import { GoogleApiError, type GoogleCalendarApi } from '@/lib/sampark/google-calendar/api';
import { readGoogleCalendarConfig, type ConfigResult } from '@/lib/sampark/google-calendar/config';
import { decryptToken, encryptToken, pkceChallenge, randomToken, safeEqual, sha256 } from '@/lib/sampark/google-calendar/crypto';
import { createHttpGoogleCalendarApi } from '@/lib/sampark/google-calendar/http-api';
import { createMockGoogleCalendarApi } from '@/lib/sampark/google-calendar/mock-api';
import { EventValidationError, fromGoogleEvent, toGoogleBody, type GoogleEvent } from '@/lib/sampark/google-calendar/recurrence';
import {
    FirestoreGoogleCalendarStore,
    firestoreMockBackend,
    type CachedEvent,
    type GoogleCalendarStore,
    type StoredConnection,
} from '@/lib/sampark/google-calendar/store';
import {
    GOOGLE_CALENDAR_SCOPES,
    type CalendarChoice,
    type CreateEventInput,
    type EventInput,
    type EventScope,
    type GoogleCalendarStatus,
    type SchoolCalendarEvent,
} from '@/lib/sampark/google-calendar/types';
import { DEFAULT_CALLBACK_TIME_ZONE } from '@/lib/sampark/callbacks/time';
import { badRequest, conflict, notFound, upstreamFailed } from '@/server/sampark/errors';

export const OAUTH_STATE_TTL_MS = 10 * 60_000;
export const MAX_EVENT_RANGE_MS = 100 * 24 * 60 * 60_000;
/** Renew a push channel when less than this is left. */
export const CHANNEL_RENEW_BEFORE_MS = 24 * 60 * 60_000;
export const CHANNEL_TTL_SECONDS = 7 * 24 * 60 * 60;
/** The tick re-syncs a school whose last sync is older than this (missed or expired notifications). */
export const FALLBACK_SYNC_AFTER_MS = 15 * 60_000;

export interface GoogleCalendarDeps {
    store: GoogleCalendarStore;
    config: ConfigResult;
    /** null when not configured. */
    api: GoogleCalendarApi | null;
    /** Real time (tokens and OAuth state expire in real time, not on the Sampark dev clock). */
    now: () => Date;
    env?: Record<string, string | undefined>;
}

export async function googleCalendarDeps(): Promise<GoogleCalendarDeps> {
    const { getDb } = await import('@/lib/firebase-admin');
    const db = await getDb();
    const config = readGoogleCalendarConfig();
    let api: GoogleCalendarApi | null = null;
    if (config.ok) {
        api =
            config.config.mode === 'mock'
                ? createMockGoogleCalendarApi({ backend: firestoreMockBackend(db) })
                : createHttpGoogleCalendarApi({ clientId: config.config.clientId, clientSecret: config.config.clientSecret });
    }
    return { store: new FirestoreGoogleCalendarStore(db), config, api, now: () => new Date() };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function configured(deps: GoogleCalendarDeps) {
    if (!deps.config.ok || !deps.api) throw conflict('GCAL_NOT_CONFIGURED', 'Google Calendar is not set up on this server yet.');
    return { config: deps.config.config, api: deps.api };
}

async function connected(deps: GoogleCalendarDeps, orgId: string): Promise<StoredConnection> {
    const conn = await deps.store.getConnection(orgId);
    if (!conn) throw conflict('GCAL_NOT_CONNECTED', 'Connect a Google account first.');
    if (conn.state === 'reconnect_required') throw conflict('GCAL_RECONNECT_REQUIRED', 'Google access has expired or was removed. Reconnect the account.');
    if (deps.config.ok && conn.mode !== deps.config.config.mode) {
        throw conflict('GCAL_RECONNECT_REQUIRED', 'This connection was made in a different mode. Reconnect the account.');
    }
    return conn;
}

function withCalendar(conn: StoredConnection) {
    if (!conn.calendar) throw conflict('GCAL_NO_CALENDAR', 'Choose which Google calendar the school uses.');
    return conn.calendar;
}

async function recordError(deps: GoogleCalendarDeps, orgId: string, code: string, message: string, extra: Partial<StoredConnection> = {}) {
    try {
        await deps.store.patchConnection(orgId, { lastError: { code, message, at: deps.now().toISOString() }, updatedAt: deps.now().toISOString(), ...extra });
    } catch (err) {
        logger.warn('Google Calendar: could not record an error', 'SAMPARK_GCAL', { orgId, code, err: String(err) });
    }
}

/** Map a Google failure to a service error; invalid_grant also marks the connection. */
async function mapGoogleError(deps: GoogleCalendarDeps, orgId: string, err: unknown): Promise<never> {
    if (err instanceof GoogleApiError) {
        if (err.kind === 'invalid_grant' || err.kind === 'unauthorized') {
            await recordError(deps, orgId, 'GCAL_RECONNECT_REQUIRED', 'Google access expired or was revoked.', { state: 'reconnect_required', accessTokenEnc: null });
            throw conflict('GCAL_RECONNECT_REQUIRED', 'Google access has expired or was removed. Reconnect the account.');
        }
        if (err.kind === 'not_found' || err.kind === 'gone') throw notFound('GCAL_EVENT_NOT_FOUND', 'That event no longer exists in Google Calendar.');
        if (err.kind === 'forbidden') throw conflict('GCAL_FORBIDDEN', 'Google refused: this account cannot change that calendar.');
        if (err.kind === 'bad_request') throw badRequest('GCAL_REJECTED', `Google rejected the request: ${err.message}`);
        if (err.transient) {
            await recordError(deps, orgId, 'GCAL_UNAVAILABLE', 'Google Calendar did not respond. Try again in a minute.');
            throw upstreamFailed('GCAL_UNAVAILABLE', 'Google Calendar did not respond. Try again in a minute.');
        }
    }
    if (err instanceof EventValidationError) throw badRequest(err.code, err.message);
    throw err;
}

async function freshAccessToken(deps: GoogleCalendarDeps, conn: StoredConnection, force = false): Promise<string> {
    const { api } = configured(deps);
    // A token that no longer decrypts (key rotated, or copied from another school) is a
    // lost grant: the school must reconnect, never a 500.
    const open = (enc: string) => {
        try {
            return decryptToken(enc, conn.orgId, deps.env);
        } catch {
            throw new GoogleApiError('invalid_grant', 0, 'Stored Google token cannot be read');
        }
    };
    const expires = conn.accessTokenExpiresAt ? Date.parse(conn.accessTokenExpiresAt) : 0;
    if (!force && conn.accessTokenEnc && expires - deps.now().getTime() > 60_000) return open(conn.accessTokenEnc);
    const tokens = await api.refresh(open(conn.refreshTokenEnc));
    const patch: Partial<StoredConnection> = {
        accessTokenEnc: encryptToken(tokens.accessToken, conn.orgId, deps.env),
        accessTokenExpiresAt: tokens.expiresAt.toISOString(),
        updatedAt: deps.now().toISOString(),
        // Google may rotate the refresh token; keep the newest.
        ...(tokens.refreshToken ? { refreshTokenEnc: encryptToken(tokens.refreshToken, conn.orgId, deps.env) } : {}),
    };
    await deps.store.patchConnection(conn.orgId, patch);
    Object.assign(conn, patch);
    return tokens.accessToken;
}

/** Run `fn` with a valid access token; a rejected token is refreshed once. */
async function withAccess<T>(deps: GoogleCalendarDeps, conn: StoredConnection, fn: (token: string, api: GoogleCalendarApi) => Promise<T>): Promise<T> {
    const { api } = configured(deps);
    try {
        try {
            return await fn(await freshAccessToken(deps, conn), api);
        } catch (err) {
            if (err instanceof GoogleApiError && err.kind === 'unauthorized') return await fn(await freshAccessToken(deps, conn, true), api);
            throw err;
        }
    } catch (err) {
        return mapGoogleError(deps, conn.orgId, err);
    }
}

// ── status ───────────────────────────────────────────────────────────────────

export async function getGoogleCalendarStatus(deps: GoogleCalendarDeps, orgId: string): Promise<GoogleCalendarStatus> {
    const base = deps.config.ok
        ? { configured: true, mode: deps.config.config.mode, missing: [] as string[] }
        : { configured: false, mode: deps.config.mode, missing: deps.config.missing };
    const conn = await deps.store.getConnection(orgId);
    if (!conn) {
        return {
            ...base,
            state: base.configured ? 'disconnected' : 'unconfigured',
            accountLabel: null,
            calendar: null,
            connectedAt: null,
            connectedBy: null,
            lastSyncedAt: null,
            lastError: null,
            push: { active: false, reason: 'not_connected' },
        };
    }
    const modeMismatch = deps.config.ok && conn.mode !== deps.config.config.mode;
    const webhook = deps.config.ok ? deps.config.config.webhookUrl : null;
    const channelLive = conn.channel && Date.parse(conn.channel.expiresAt) > deps.now().getTime();
    return {
        ...base,
        state: !base.configured ? 'unconfigured' : modeMismatch ? 'reconnect_required' : conn.state,
        accountLabel: conn.accountLabel,
        calendar: conn.calendar,
        connectedAt: conn.connectedAt,
        connectedBy: conn.connectedBy,
        lastSyncedAt: conn.lastSyncedAt,
        lastError: conn.lastError,
        push: channelLive
            ? { active: true, expiresAt: conn.channel!.expiresAt }
            : { active: false, reason: !webhook ? 'no_public_url' : conn.pushError ? 'failed' : 'not_started' },
    };
}

// ── OAuth ────────────────────────────────────────────────────────────────────

export async function startGoogleConnect(deps: GoogleCalendarDeps, orgId: string, uid: string): Promise<{ authUrl: string }> {
    const { config, api } = configured(deps);
    const state = randomToken(32);
    const verifier = randomToken(48);
    const now = deps.now();
    await deps.store.putOAuthState(sha256(state), {
        orgId,
        uid,
        codeVerifierEnc: encryptToken(verifier, orgId, deps.env),
        redirectUri: config.redirectUri,
        mode: config.mode,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS).toISOString(),
        usedAt: null,
    });
    return { authUrl: api.authorizationUrl({ state, codeChallenge: pkceChallenge(verifier), redirectUri: config.redirectUri, scopes: GOOGLE_CALENDAR_SCOPES }) };
}

export type ConnectFailure =
    | 'invalid_state'
    | 'expired_state'
    | 'used_state'
    | 'wrong_user'
    | 'not_admin'
    | 'denied'
    | 'no_refresh_token'
    | 'scope_missing'
    | 'exchange_failed'
    | 'not_configured';

export type ConnectResult = { ok: true; orgId: string } | { ok: false; orgId: string | null; reason: ConnectFailure };

/**
 * The OAuth redirect. The state is consumed first (single use) whatever happens next,
 * so a replayed or leaked URL is worthless. `isAdmin` re-checks the user against the
 * school named in the STORED state — never a school named by the request.
 */
export async function completeGoogleConnect(
    deps: GoogleCalendarDeps,
    p: { state: string | null; code: string | null; error: string | null; uid: string | null; isAdmin: (orgId: string, uid: string) => Promise<boolean> },
): Promise<ConnectResult> {
    if (!p.state || !/^[A-Za-z0-9_-]{20,128}$/.test(p.state)) return { ok: false, orgId: null, reason: 'invalid_state' };
    const consumed = await deps.store.consumeOAuthState(sha256(p.state), deps.now());
    if (!consumed.ok) return { ok: false, orgId: null, reason: consumed.reason === 'expired' ? 'expired_state' : consumed.reason === 'used' ? 'used_state' : 'invalid_state' };
    const record = consumed.record;
    const orgId = record.orgId;
    if (!p.uid || !safeEqual(p.uid, record.uid)) return { ok: false, orgId, reason: 'wrong_user' };
    if (!(await p.isAdmin(orgId, p.uid))) return { ok: false, orgId, reason: 'not_admin' };
    if (p.error) return { ok: false, orgId, reason: 'denied' };
    if (!p.code || p.code.length > 2048) return { ok: false, orgId, reason: 'exchange_failed' };
    if (!deps.config.ok || !deps.api || deps.config.config.mode !== record.mode || deps.config.config.redirectUri !== record.redirectUri) {
        return { ok: false, orgId, reason: 'not_configured' };
    }
    const api = deps.api;
    let tokens;
    try {
        tokens = await api.exchangeCode({ code: p.code, codeVerifier: decryptToken(record.codeVerifierEnc, orgId, deps.env), redirectUri: record.redirectUri });
    } catch (err) {
        logger.warn('Google Calendar: code exchange failed', 'SAMPARK_GCAL', { orgId, kind: err instanceof GoogleApiError ? err.kind : 'error' });
        return { ok: false, orgId, reason: 'exchange_failed' };
    }
    if (!tokens.refreshToken) return { ok: false, orgId, reason: 'no_refresh_token' };
    if (GOOGLE_CALENDAR_SCOPES.some((s) => !tokens.scopes.includes(s))) {
        await api.revoke(tokens.refreshToken).catch(() => undefined);
        return { ok: false, orgId, reason: 'scope_missing' };
    }

    const previous = await deps.store.getConnection(orgId);
    if (previous) await stopPush(deps, previous, tokens.accessToken);
    let calendars: Awaited<ReturnType<GoogleCalendarApi['listCalendars']>> = [];
    try {
        calendars = await api.listCalendars(tokens.accessToken);
    } catch (err) {
        logger.warn('Google Calendar: calendar list failed after connect', 'SAMPARK_GCAL', { orgId, err: String(err) });
    }
    const owned = calendars.filter((c) => c.accessRole === 'owner');
    const keep = previous?.calendar && owned.find((c) => c.id === previous.calendar!.id);
    const primary = owned.find((c) => c.primary) ?? owned[0];
    const chosen = keep ?? primary ?? null;
    const now = deps.now().toISOString();
    const conn: StoredConnection = {
        orgId,
        mode: record.mode,
        state: 'connected',
        accountLabel: calendars.find((c) => c.primary)?.id ?? null,
        scopes: tokens.scopes,
        refreshTokenEnc: encryptToken(tokens.refreshToken, orgId, deps.env),
        accessTokenEnc: encryptToken(tokens.accessToken, orgId, deps.env),
        accessTokenExpiresAt: tokens.expiresAt.toISOString(),
        calendar: chosen ? { id: chosen.id, summary: chosen.summary, timeZone: chosen.timeZone } : null,
        connectedBy: record.uid,
        connectedAt: now,
        updatedAt: now,
        lastError: null,
        syncToken: null,
        lastSyncedAt: null,
        lastFullSyncAt: null,
        channel: null,
        pushError: null,
    };
    await deps.store.putConnection(conn);
    if (conn.calendar) await afterCalendarChosen(deps, conn);
    return { ok: true, orgId };
}

/** Start push (when configured) and a first full sync. Neither failing undoes the connection. */
async function afterCalendarChosen(deps: GoogleCalendarDeps, conn: StoredConnection) {
    try {
        await startPush(deps, conn);
    } catch (err) {
        logger.warn('Google Calendar: push channel not started', 'SAMPARK_GCAL', { orgId: conn.orgId, err: String(err) });
    }
    try {
        await syncGoogleCalendar(deps, conn.orgId);
    } catch (err) {
        logger.warn('Google Calendar: first sync failed', 'SAMPARK_GCAL', { orgId: conn.orgId, err: String(err) });
    }
}

// ── calendars ────────────────────────────────────────────────────────────────

export async function listCalendarChoices(deps: GoogleCalendarDeps, orgId: string): Promise<CalendarChoice[]> {
    const conn = await connected(deps, orgId);
    const calendars = await withAccess(deps, conn, (t, api) => api.listCalendars(t));
    return calendars
        .filter((c) => c.accessRole === 'owner')
        .map((c) => ({ id: c.id, summary: c.summary, timeZone: c.timeZone, primary: c.primary, selected: c.id === conn.calendar?.id }));
}

export async function selectCalendar(deps: GoogleCalendarDeps, orgId: string, calendarId: string): Promise<GoogleCalendarStatus> {
    const conn = await connected(deps, orgId);
    const choices = await listCalendarChoices(deps, orgId);
    const chosen = choices.find((c) => c.id === calendarId);
    if (!chosen) throw badRequest('GCAL_CALENDAR_NOT_ALLOWED', 'Choose a calendar this Google account owns.');
    if (conn.calendar?.id !== calendarId) {
        await stopPush(deps, conn);
        const patch: Partial<StoredConnection> = {
            calendar: { id: chosen.id, summary: chosen.summary, timeZone: chosen.timeZone },
            syncToken: null,
            lastSyncedAt: null,
            channel: null,
            pushError: null,
            updatedAt: deps.now().toISOString(),
        };
        await deps.store.patchConnection(orgId, patch);
        await deps.store.applySync(orgId, [], [], true);
        await afterCalendarChosen(deps, { ...conn, ...patch });
    }
    return getGoogleCalendarStatus(deps, orgId);
}

// ── events ───────────────────────────────────────────────────────────────────

export interface GoogleEventsResponse {
    timeZone: string;
    calendarId: string;
    from: string;
    to: string;
    events: SchoolCalendarEvent[];
}

export async function listGoogleEvents(deps: GoogleCalendarDeps, orgId: string, from: Date, to: Date): Promise<GoogleEventsResponse> {
    if (!(to.getTime() > from.getTime())) throw badRequest('INVALID_RANGE', '`to` must be after `from`.');
    if (to.getTime() - from.getTime() > MAX_EVENT_RANGE_MS) throw badRequest('RANGE_TOO_LONG', 'Ask for at most 100 days at a time.');
    const conn = await connected(deps, orgId);
    const cal = withCalendar(conn);
    const items = await withAccess(deps, conn, (t, api) => api.listEvents(t, cal.id, { timeMin: from, timeMax: to }));
    return {
        timeZone: cal.timeZone || DEFAULT_CALLBACK_TIME_ZONE,
        calendarId: cal.id,
        from: from.toISOString(),
        to: to.toISOString(),
        events: items.map((e) => fromGoogleEvent(e, cal.id, cal.timeZone)),
    };
}

export async function getGoogleEvent(deps: GoogleCalendarDeps, orgId: string, eventId: string): Promise<SchoolCalendarEvent> {
    const conn = await connected(deps, orgId);
    const cal = withCalendar(conn);
    const e = await withAccess(deps, conn, (t, api) => api.getEvent(t, cal.id, eventId));
    if (e.status === 'cancelled') throw notFound('GCAL_EVENT_NOT_FOUND', 'That event was cancelled.');
    return fromGoogleEvent(e, cal.id, cal.timeZone);
}

/** Google event ids are base32hex (0-9a-v), 5–1024 chars: lowercase hex qualifies. */
export function eventIdFor(orgId: string, calendarId: string, requestId: string): string {
    return crypto.createHash('sha256').update(`${orgId}|${calendarId}|${requestId}`).digest('hex').slice(0, 32);
}

function validBody(input: EventInput) {
    try {
        return toGoogleBody(input);
    } catch (err) {
        if (err instanceof EventValidationError) throw badRequest(err.code, err.message);
        throw err;
    }
}

export async function createGoogleEvent(deps: GoogleCalendarDeps, orgId: string, uid: string, input: CreateEventInput): Promise<{ event: SchoolCalendarEvent; created: boolean }> {
    const { requestId, ...fields } = input;
    const body = validBody(fields);
    const conn = await connected(deps, orgId);
    const cal = withCalendar(conn);
    const id = eventIdFor(orgId, cal.id, requestId);
    body.id = id;
    body.extendedProperties = { private: { sahayakOrgId: orgId, sahayakCreatedBy: uid } };
    return withAccess(deps, conn, async (t, api) => {
        try {
            const e = await api.insertEvent(t, cal.id, body);
            return { event: fromGoogleEvent(e, cal.id, cal.timeZone), created: true };
        } catch (err) {
            // A retried create: the event with this id exists — return it, never a second copy.
            if (err instanceof GoogleApiError && err.kind === 'conflict') {
                const existing = await api.getEvent(t, cal.id, id);
                if (existing.status === 'cancelled') throw conflict('GCAL_REQUEST_USED', 'This request was already used for an event that has since been cancelled.');
                return { event: fromGoogleEvent(existing, cal.id, cal.timeZone), created: false };
            }
            throw err;
        }
    });
}

/** The id an edit or cancel acts on: the occurrence itself, or its series. */
async function targetId(api: GoogleCalendarApi, token: string, calendarId: string, eventId: string, scope: EventScope): Promise<{ id: string; occurrence: boolean }> {
    const e: GoogleEvent = await api.getEvent(token, calendarId, eventId);
    if (e.recurringEventId && scope === 'series') return { id: e.recurringEventId, occurrence: false };
    return { id: eventId, occurrence: Boolean(e.recurringEventId) };
}

export async function updateGoogleEvent(deps: GoogleCalendarDeps, orgId: string, eventId: string, input: EventInput, scope: EventScope): Promise<SchoolCalendarEvent> {
    const body = validBody(input);
    const conn = await connected(deps, orgId);
    const cal = withCalendar(conn);
    return withAccess(deps, conn, async (t, api) => {
        const target = await targetId(api, t, cal.id, eventId, scope);
        if (target.occurrence) {
            if (input.repeat) throw badRequest('GCAL_OCCURRENCE_CANNOT_REPEAT', 'One occurrence cannot have its own repeat. Edit the whole series instead.');
            delete body.recurrence;
        } else if (!input.repeat) {
            // A repeat rule made in Google that this app cannot edit (BYDAY, …) is kept as it is.
            const series = await api.getEvent(t, cal.id, target.id);
            if (fromGoogleEvent(series, cal.id, cal.timeZone).repeatText) delete body.recurrence;
        }
        const e = await api.patchEvent(t, cal.id, target.id, body);
        return fromGoogleEvent(e, cal.id, cal.timeZone);
    });
}

export async function cancelGoogleEvent(deps: GoogleCalendarDeps, orgId: string, eventId: string, scope: EventScope): Promise<{ cancelled: true; alreadyCancelled: boolean }> {
    const conn = await connected(deps, orgId);
    const cal = withCalendar(conn);
    return withAccess(deps, conn, async (t, api) => {
        let target: { id: string };
        try {
            target = await targetId(api, t, cal.id, eventId, scope);
        } catch (err) {
            if (err instanceof GoogleApiError && (err.kind === 'not_found' || err.kind === 'gone')) return { cancelled: true, alreadyCancelled: true } as const;
            throw err;
        }
        try {
            await api.deleteEvent(t, cal.id, target.id);
            return { cancelled: true, alreadyCancelled: false } as const;
        } catch (err) {
            if (err instanceof GoogleApiError && (err.kind === 'gone' || err.kind === 'not_found')) return { cancelled: true, alreadyCancelled: true } as const;
            throw err;
        }
    });
}

// ── sync & push ──────────────────────────────────────────────────────────────

export interface SyncReport {
    full: boolean;
    changed: number;
    removed: number;
}

function cached(e: GoogleEvent, zone: string): CachedEvent {
    const v = fromGoogleEvent(e, '', zone);
    return {
        id: e.id,
        summary: v.summary,
        status: v.status,
        allDay: v.allDay,
        start: v.start,
        end: v.end,
        recurringEventId: v.recurringEventId,
        recurrence: e.recurrence ?? null,
        updated: v.updated,
    };
}

/** Incremental sync; a 410 (token expired) restarts with a full sync. Reconciles against the API, never trusts a notification body. */
export async function syncGoogleCalendar(deps: GoogleCalendarDeps, orgId: string): Promise<SyncReport> {
    const conn = await connected(deps, orgId);
    const cal = withCalendar(conn);
    const { page, full } = await withAccess(deps, conn, async (t, api) => {
        if (conn.syncToken) {
            try {
                return { page: await api.syncEvents(t, cal.id, conn.syncToken), full: false };
            } catch (err) {
                if (!(err instanceof GoogleApiError && err.kind === 'gone')) throw err;
            }
        }
        return { page: await api.syncEvents(t, cal.id, null), full: true };
    });
    const upserts = page.items.filter((e) => e.status !== 'cancelled').map((e) => cached(e, cal.timeZone));
    const removed = page.items.filter((e) => e.status === 'cancelled').map((e) => e.id);
    await deps.store.applySync(orgId, upserts, removed, full);
    const now = deps.now().toISOString();
    await deps.store.patchConnection(orgId, {
        syncToken: page.nextSyncToken || null,
        lastSyncedAt: now,
        ...(full ? { lastFullSyncAt: now } : {}),
        lastError: null,
        state: 'connected',
        updatedAt: now,
    });
    return { full, changed: upserts.length, removed: removed.length };
}

async function startPush(deps: GoogleCalendarDeps, conn: StoredConnection) {
    const webhook = deps.config.ok ? deps.config.config.webhookUrl : null;
    if (!webhook || !conn.calendar) return;
    const cal = conn.calendar;
    const id = crypto.randomUUID();
    const token = randomToken(32);
    try {
        const { resourceId, expiresAt } = await withAccess(deps, conn, (t, api) => api.watch(t, cal.id, { id, address: webhook, token, ttlSeconds: CHANNEL_TTL_SECONDS }));
        await deps.store.putChannel(id, { orgId: conn.orgId, calendarId: cal.id, resourceId, tokenHash: sha256(token), expiresAt: expiresAt.toISOString(), lastMessageNumber: 0 });
        const old = conn.channel;
        const patch = { channel: { id, resourceId, expiresAt: expiresAt.toISOString() }, pushError: null };
        await deps.store.patchConnection(conn.orgId, patch);
        Object.assign(conn, patch);
        if (old) await stopChannelRecord(deps, conn, old);
    } catch (err) {
        await deps.store.patchConnection(conn.orgId, { pushError: err instanceof Error ? err.message.slice(0, 300) : 'push failed' }).catch(() => undefined);
        throw err;
    }
}

async function stopChannelRecord(deps: GoogleCalendarDeps, conn: StoredConnection, channel: { id: string; resourceId: string }, accessToken?: string) {
    await deps.store.deleteChannel(channel.id);
    if (!deps.api) return;
    try {
        const token = accessToken ?? (await freshAccessToken(deps, conn));
        await deps.api.stopChannel(token, { id: channel.id, resourceId: channel.resourceId });
    } catch (err) {
        // A channel Google no longer knows expires on its own; the record is already gone.
        logger.warn('Google Calendar: channel stop failed', 'SAMPARK_GCAL', { orgId: conn.orgId, err: String(err) });
    }
}

async function stopPush(deps: GoogleCalendarDeps, conn: StoredConnection, accessToken?: string) {
    if (conn.channel) await stopChannelRecord(deps, conn, conn.channel, accessToken);
}

export type NotificationResult = { status: 200 | 403 | 404 | 500; outcome: string };

/**
 * A push notification. It only says "something changed": it is validated against the
 * stored channel (id, token hash, resource id, expiry, the school's current channel),
 * a repeated message number is ignored, and then the school is reconciled by an
 * incremental sync against the API.
 */
export async function handleGoogleNotification(deps: GoogleCalendarDeps, h: (name: string) => string | null): Promise<NotificationResult> {
    const channelId = h('x-goog-channel-id');
    if (!channelId || channelId.length > 128) return { status: 404, outcome: 'unknown_channel' };
    const channel = await deps.store.getChannel(channelId);
    if (!channel) return { status: 404, outcome: 'unknown_channel' };
    const token = h('x-goog-channel-token') ?? '';
    if (!safeEqual(sha256(token), channel.tokenHash)) return { status: 403, outcome: 'bad_token' };
    if (h('x-goog-resource-id') !== channel.resourceId) return { status: 403, outcome: 'bad_resource' };
    if (Date.parse(channel.expiresAt) <= deps.now().getTime()) return { status: 200, outcome: 'expired_channel' };
    const conn = await deps.store.getConnection(channel.orgId);
    if (!conn || conn.channel?.id !== channelId || conn.calendar?.id !== channel.calendarId) return { status: 200, outcome: 'stale_channel' };
    const state = h('x-goog-resource-state');
    if (state === 'sync') return { status: 200, outcome: 'sync_handshake' };
    const n = Number(h('x-goog-message-number') ?? '0');
    if (Number.isFinite(n) && n > 0 && n <= channel.lastMessageNumber) return { status: 200, outcome: 'duplicate' };
    try {
        await syncGoogleCalendar(deps, channel.orgId);
    } catch (err) {
        logger.warn('Google Calendar: sync after notification failed', 'SAMPARK_GCAL', { orgId: channel.orgId, err: String(err) });
        // Non-2xx: Google retries with backoff; the tick's fallback sync covers the rest.
        return { status: 500, outcome: 'sync_failed' };
    }
    if (Number.isFinite(n) && n > 0) await deps.store.advanceChannelMessage(channelId, n);
    return { status: 200, outcome: 'synced' };
}

export interface GoogleCalendarTickReport {
    schools: number;
    synced: number;
    renewed: number;
    errors: { orgId: string; code: string }[];
}

/** Scheduler: renew channels before they expire and re-sync schools whose last sync is stale. */
export async function runGoogleCalendarTick(deps: GoogleCalendarDeps): Promise<GoogleCalendarTickReport> {
    const report: GoogleCalendarTickReport = { schools: 0, synced: 0, renewed: 0, errors: [] };
    if (!deps.config.ok) return report;
    const webhook = deps.config.config.webhookUrl;
    const now = deps.now().getTime();
    for (const conn of await deps.store.listConnections()) {
        if (conn.state !== 'connected' || !conn.calendar || conn.mode !== deps.config.config.mode) continue;
        report.schools += 1;
        try {
            if (webhook && (!conn.channel || Date.parse(conn.channel.expiresAt) - now < CHANNEL_RENEW_BEFORE_MS)) {
                await startPush(deps, conn);
                report.renewed += 1;
            }
            if (!conn.lastSyncedAt || now - Date.parse(conn.lastSyncedAt) >= FALLBACK_SYNC_AFTER_MS) {
                await syncGoogleCalendar(deps, conn.orgId);
                report.synced += 1;
            }
        } catch (err) {
            report.errors.push({ orgId: conn.orgId, code: (err as { code?: string }).code ?? 'ERROR' });
        }
    }
    return report;
}

// ── disconnect ───────────────────────────────────────────────────────────────

export async function disconnectGoogleCalendar(deps: GoogleCalendarDeps, orgId: string): Promise<{ disconnected: true; revoked: boolean }> {
    const conn = await deps.store.getConnection(orgId);
    if (!conn) return { disconnected: true, revoked: false };
    await stopPush(deps, conn).catch(() => undefined);
    let revoked = false;
    if (deps.api && conn.mode === (deps.config.ok ? deps.config.config.mode : null)) {
        try {
            await deps.api.revoke(decryptToken(conn.refreshTokenEnc, orgId, deps.env));
            revoked = true;
        } catch (err) {
            logger.warn('Google Calendar: revoke failed; removing the connection anyway', 'SAMPARK_GCAL', { orgId, err: String(err) });
        }
    }
    await deps.store.deleteConnection(orgId);
    return { disconnected: true, revoked };
}

/** For the optional callback ↔ event link: does the synced copy still have this event? */
export async function syncedEventExists(deps: GoogleCalendarDeps, orgId: string, eventId: string): Promise<boolean> {
    const e = await deps.store.getCachedEvent(orgId, eventId);
    return Boolean(e && e.status !== 'cancelled');
}
