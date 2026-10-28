/**
 * Real Google: OAuth 2.0 authorization-code flow with PKCE (web server app) and the
 * Calendar API v3 over fetch. Rate limits (429, 403 rateLimitExceeded /
 * userRateLimitExceeded) and 5xx are retried with exponential backoff and jitter, at
 * most `maxAttempts` times; everything else is mapped to a GoogleApiError kind.
 *
 * Endpoints (developers.google.com/identity/protocols/oauth2/web-server and
 * developers.google.com/workspace/calendar/api/v3/reference):
 *   authorize  https://accounts.google.com/o/oauth2/v2/auth
 *   token      https://oauth2.googleapis.com/token
 *   revoke     https://oauth2.googleapis.com/revoke
 *   calendar   https://www.googleapis.com/calendar/v3
 */

import { GoogleApiError, type CalendarListEntry, type GoogleCalendarApi, type GoogleErrorKind, type SyncPage, type TokenSet } from './api';
import type { GoogleEvent, GoogleEventBody } from './recurrence';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';

export interface HttpApiOptions {
    clientId: string;
    clientSecret: string;
    fetch?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    maxAttempts?: number;
}

function kindFor(status: number, reason: string, oauthError: string): GoogleErrorKind {
    if (oauthError === 'invalid_grant') return 'invalid_grant';
    if (status === 401) return 'unauthorized';
    if (status === 429 || (status === 403 && /rateLimitExceeded|userRateLimitExceeded|quotaExceeded/.test(reason))) return 'rate_limited';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not_found';
    if (status === 409) return 'conflict';
    if (status === 410) return 'gone';
    if (status >= 500) return 'unavailable';
    return 'bad_request';
}

export function createHttpGoogleCalendarApi(opts: HttpApiOptions): GoogleCalendarApi {
    const doFetch = opts.fetch ?? fetch;
    const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    const maxAttempts = opts.maxAttempts ?? 4;

    async function request<T>(url: string, init: RequestInit): Promise<T> {
        for (let attempt = 1; ; attempt += 1) {
            let res: Response;
            try {
                res = await doFetch(url, init);
            } catch (err) {
                if (attempt >= maxAttempts) throw new GoogleApiError('unavailable', 0, `Network error: ${(err as Error).message}`);
                await sleep(backoff(attempt));
                continue;
            }
            if (res.ok) {
                if (res.status === 204) return undefined as T;
                const text = await res.text();
                return (text ? JSON.parse(text) : undefined) as T;
            }
            const body = (await res.json().catch(() => ({}))) as {
                error?: string | { message?: string; errors?: { reason?: string }[] };
                error_description?: string;
            };
            const oauthError = typeof body.error === 'string' ? body.error : '';
            const reason = typeof body.error === 'object' ? (body.error.errors ?? []).map((e) => e.reason).join(',') : '';
            const message = typeof body.error === 'object' ? (body.error.message ?? '') : (body.error_description ?? oauthError);
            const err = new GoogleApiError(kindFor(res.status, reason, oauthError), res.status, message || `Google returned ${res.status}`);
            if (!err.transient || attempt >= maxAttempts) throw err;
            const retryAfter = Number(res.headers.get('retry-after'));
            await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : backoff(attempt));
        }
    }

    const backoff = (attempt: number) => Math.min(8000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);

    const bearer = (accessToken: string, json = false): HeadersInit => ({
        Authorization: `Bearer ${accessToken}`,
        ...(json ? { 'Content-Type': 'application/json' } : {}),
    });
    const cal = (calendarId: string) => `${API}/calendars/${encodeURIComponent(calendarId)}`;

    async function token(params: Record<string, string>): Promise<TokenSet> {
        const raw = await request<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }>(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: opts.clientId, client_secret: opts.clientSecret, ...params }).toString(),
        });
        return {
            accessToken: raw.access_token,
            refreshToken: raw.refresh_token ?? null,
            expiresAt: new Date(Date.now() + Math.max(60, raw.expires_in) * 1000),
            scopes: (raw.scope ?? '').split(' ').filter(Boolean),
        };
    }

    return {
        mode: 'google',
        authorizationUrl({ state, codeChallenge, redirectUri, scopes }) {
            const q = new URLSearchParams({
                client_id: opts.clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: scopes.join(' '),
                access_type: 'offline',
                prompt: 'consent',
                include_granted_scopes: 'false',
                state,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
            });
            return `${AUTH_URL}?${q.toString()}`;
        },
        exchangeCode: ({ code, codeVerifier, redirectUri }) =>
            token({ grant_type: 'authorization_code', code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
        refresh: (refreshToken) => token({ grant_type: 'refresh_token', refresh_token: refreshToken }),
        async revoke(tok) {
            try {
                await request(REVOKE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ token: tok }).toString(),
                });
            } catch (err) {
                // 400 invalid_token: already revoked or expired — the goal is met.
                if (err instanceof GoogleApiError && (err.kind === 'bad_request' || err.kind === 'invalid_grant')) return;
                throw err;
            }
        },
        async listCalendars(accessToken) {
            const out: CalendarListEntry[] = [];
            let pageToken: string | undefined;
            do {
                const q = new URLSearchParams({ maxResults: '250', ...(pageToken ? { pageToken } : {}) });
                const page = await request<{ items?: CalendarListEntry[]; nextPageToken?: string }>(`${API}/users/me/calendarList?${q}`, {
                    headers: bearer(accessToken),
                });
                for (const c of page.items ?? []) out.push({ id: c.id, summary: c.summary, timeZone: c.timeZone, primary: Boolean(c.primary), accessRole: c.accessRole });
                pageToken = page.nextPageToken;
            } while (pageToken);
            return out;
        },
        async listEvents(accessToken, calendarId, { timeMin, timeMax }) {
            const out: GoogleEvent[] = [];
            let pageToken: string | undefined;
            do {
                const q = new URLSearchParams({
                    singleEvents: 'true',
                    orderBy: 'startTime',
                    timeMin: timeMin.toISOString(),
                    timeMax: timeMax.toISOString(),
                    maxResults: '250',
                    ...(pageToken ? { pageToken } : {}),
                });
                const page = await request<{ items?: GoogleEvent[]; nextPageToken?: string }>(`${cal(calendarId)}/events?${q}`, { headers: bearer(accessToken) });
                out.push(...(page.items ?? []).filter((e) => e.status !== 'cancelled'));
                pageToken = page.nextPageToken;
            } while (pageToken && out.length < 2500);
            return out;
        },
        getEvent: (accessToken, calendarId, eventId) =>
            request<GoogleEvent>(`${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, { headers: bearer(accessToken) }),
        insertEvent: (accessToken, calendarId, body) =>
            request<GoogleEvent>(`${cal(calendarId)}/events`, { method: 'POST', headers: bearer(accessToken, true), body: JSON.stringify(body) }),
        patchEvent: (accessToken, calendarId, eventId, body) =>
            request<GoogleEvent>(`${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, {
                method: 'PATCH',
                headers: bearer(accessToken, true),
                body: JSON.stringify(body),
            }),
        async deleteEvent(accessToken, calendarId, eventId) {
            await request<void>(`${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE', headers: bearer(accessToken) });
        },
        async syncEvents(accessToken, calendarId, syncToken): Promise<SyncPage> {
            const items: GoogleEvent[] = [];
            let pageToken: string | undefined;
            for (;;) {
                const q = new URLSearchParams({
                    maxResults: '250',
                    ...(syncToken ? { syncToken } : { showDeleted: 'true' }),
                    ...(pageToken ? { pageToken } : {}),
                });
                const page = await request<{ items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>(`${cal(calendarId)}/events?${q}`, {
                    headers: bearer(accessToken),
                });
                items.push(...(page.items ?? []));
                if (page.nextPageToken) {
                    pageToken = page.nextPageToken;
                    continue;
                }
                return { items, nextSyncToken: page.nextSyncToken ?? '' };
            }
        },
        async watch(accessToken, calendarId, channel) {
            const raw = await request<{ resourceId: string; expiration?: string }>(`${cal(calendarId)}/events/watch`, {
                method: 'POST',
                headers: bearer(accessToken, true),
                body: JSON.stringify({ id: channel.id, type: 'web_hook', address: channel.address, token: channel.token, params: { ttl: String(channel.ttlSeconds) } }),
            });
            return { resourceId: raw.resourceId, expiresAt: new Date(Number(raw.expiration ?? Date.now() + channel.ttlSeconds * 1000)) };
        },
        async stopChannel(accessToken, channel) {
            await request<void>(`${API}/channels/stop`, { method: 'POST', headers: bearer(accessToken, true), body: JSON.stringify(channel) });
        },
    };
}
