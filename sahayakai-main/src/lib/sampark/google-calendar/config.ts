/**
 * Google Calendar configuration, read from the environment on every call (so tests
 * and the launcher can change it). Values are never returned to a browser; only the
 * NAMES of missing variables are.
 *
 *   GOOGLE_CALENDAR_CLIENT_ID / _CLIENT_SECRET   the OAuth web client (Google Cloud)
 *   GOOGLE_CALENDAR_REDIRECT_URI                 exactly <origin>/api/sampark/google-calendar/oauth/callback
 *   SAMPARK_GCAL_TOKEN_KEY                       base64 32-byte key for tokens at rest
 *   GOOGLE_CALENDAR_WEBHOOK_URL                  optional: public HTTPS <origin>/api/sampark/google-calendar/notifications
 *   GOOGLE_CALENDAR_MODE=mock                    local development only: a fake Google, no real account
 *
 * Mock mode is refused in production and outside the Firestore emulator, so a
 * misconfigured deployment can never look "connected" without Google.
 */

import { hasTokenKey } from './crypto';
import { GOOGLE_CALENDAR_CALLBACK_PATH, GOOGLE_CALENDAR_NOTIFY_PATH, type GoogleCalendarMode } from './types';

type Env = Record<string, string | undefined>;

export interface GoogleCalendarConfig {
    mode: GoogleCalendarMode;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    /** null: push notifications are off and sync runs on the scheduler / manual refresh. */
    webhookUrl: string | null;
}

export type ConfigResult = { ok: true; config: GoogleCalendarConfig } | { ok: false; mode: GoogleCalendarMode | null; missing: string[] };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The redirect URI must be https (or http on a local host) and end in the callback path, with no query. */
export function validRedirectUri(raw: string): boolean {
    try {
        const u = new URL(raw);
        const local = LOCAL_HOSTS.has(u.hostname);
        if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return false;
        return u.pathname === GOOGLE_CALENDAR_CALLBACK_PATH && !u.search && !u.hash && !u.username && !u.password;
    } catch {
        return false;
    }
}

/** Google only delivers to public HTTPS; a localhost URL is not accepted. */
export function validWebhookUrl(raw: string): boolean {
    try {
        const u = new URL(raw);
        return u.protocol === 'https:' && !LOCAL_HOSTS.has(u.hostname) && u.pathname === GOOGLE_CALENDAR_NOTIFY_PATH && !u.search;
    } catch {
        return false;
    }
}

export function mockAllowed(env: Env = process.env): boolean {
    return env.NODE_ENV !== 'production' && Boolean(env.FIRESTORE_EMULATOR_HOST);
}

export function readGoogleCalendarConfig(env: Env = process.env): ConfigResult {
    const wantsMock = env.GOOGLE_CALENDAR_MODE?.trim() === 'mock';
    const missing: string[] = [];
    if (!hasTokenKey(env)) missing.push('SAMPARK_GCAL_TOKEN_KEY');
    const redirectUri = env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ?? '';
    if (!redirectUri || !validRedirectUri(redirectUri)) missing.push('GOOGLE_CALENDAR_REDIRECT_URI');
    const webhookRaw = env.GOOGLE_CALENDAR_WEBHOOK_URL?.trim() ?? '';
    const webhookUrl = webhookRaw && validWebhookUrl(webhookRaw) ? webhookRaw : null;

    if (wantsMock) {
        if (!mockAllowed(env)) return { ok: false, mode: 'mock', missing: ['GOOGLE_CALENDAR_MODE=mock is only allowed in local development with the Firestore emulator'] };
        if (missing.length) return { ok: false, mode: 'mock', missing };
        return { ok: true, config: { mode: 'mock', clientId: 'mock-client', clientSecret: 'mock-secret', redirectUri, webhookUrl } };
    }
    const clientId = env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ?? '';
    const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ?? '';
    if (!clientId) missing.push('GOOGLE_CALENDAR_CLIENT_ID');
    if (!clientSecret) missing.push('GOOGLE_CALENDAR_CLIENT_SECRET');
    if (missing.length) return { ok: false, mode: clientId ? 'google' : null, missing };
    return { ok: true, config: { mode: 'google', clientId, clientSecret, redirectUri, webhookUrl } };
}
