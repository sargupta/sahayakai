/**
 * The Google side behind one port, so the service is the same against real Google
 * (http-api.ts) and the local fake (mock-api.ts). Access tokens are passed in per
 * call and never stored here.
 */

import type { GoogleEvent, GoogleEventBody } from './recurrence';

export interface TokenSet {
    accessToken: string;
    /** Present on the first exchange (access_type=offline + prompt=consent). */
    refreshToken: string | null;
    expiresAt: Date;
    scopes: string[];
}

export interface CalendarListEntry {
    id: string;
    summary: string;
    timeZone: string;
    primary: boolean;
    accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader';
}

export type GoogleErrorKind =
    | 'invalid_grant' // refresh token revoked / expired → reconnect
    | 'unauthorized' // access token rejected → refresh once
    | 'forbidden'
    | 'not_found'
    | 'gone' // 410: sync token expired, or event already deleted
    | 'conflict' // 409: an event with that id exists
    | 'rate_limited'
    | 'unavailable'
    | 'bad_request';

export class GoogleApiError extends Error {
    constructor(
        public readonly kind: GoogleErrorKind,
        public readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = 'GoogleApiError';
    }
    get transient(): boolean {
        return this.kind === 'rate_limited' || this.kind === 'unavailable';
    }
}

export interface SyncPage {
    items: GoogleEvent[];
    nextSyncToken: string;
}

export interface GoogleCalendarApi {
    readonly mode: 'google' | 'mock';
    authorizationUrl(p: { state: string; codeChallenge: string; redirectUri: string; scopes: readonly string[] }): string;
    exchangeCode(p: { code: string; codeVerifier: string; redirectUri: string }): Promise<TokenSet>;
    refresh(refreshToken: string): Promise<TokenSet>;
    /** Best effort; resolves when Google confirms or the token was already invalid. */
    revoke(token: string): Promise<void>;
    listCalendars(accessToken: string): Promise<CalendarListEntry[]>;
    /** Occurrences expanded (singleEvents), in [timeMin, timeMax), cancelled ones excluded. */
    listEvents(accessToken: string, calendarId: string, range: { timeMin: Date; timeMax: Date }): Promise<GoogleEvent[]>;
    getEvent(accessToken: string, calendarId: string, eventId: string): Promise<GoogleEvent>;
    insertEvent(accessToken: string, calendarId: string, body: GoogleEventBody): Promise<GoogleEvent>;
    patchEvent(accessToken: string, calendarId: string, eventId: string, body: GoogleEventBody): Promise<GoogleEvent>;
    deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void>;
    /** All pages of an incremental (or, with null, full) sync. Throws `gone` when the token expired. */
    syncEvents(accessToken: string, calendarId: string, syncToken: string | null): Promise<SyncPage>;
    watch(
        accessToken: string,
        calendarId: string,
        channel: { id: string; address: string; token: string; ttlSeconds: number },
    ): Promise<{ resourceId: string; expiresAt: Date }>;
    stopChannel(accessToken: string, channel: { id: string; resourceId: string }): Promise<void>;
}
