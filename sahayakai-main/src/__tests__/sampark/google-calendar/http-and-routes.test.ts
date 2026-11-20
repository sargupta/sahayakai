/** @jest-environment node */
/**
 * The real-Google HTTP client with a stubbed fetch (consent URL, retries with backoff
 * on rate limits and 5xx, error mapping, paging) — no network — and the routes'
 * shell: Sampark flag → 401 → 400 → 403, the OAuth callback always redirecting with
 * an outcome (never a token), and the public notification endpoint. Route bodies and
 * headers cannot be read under jest.setup.ts's Response stub, so routes are checked by
 * status; the outcomes behind them are covered in service.test.ts.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/server/sampark/auth', () => ({ requireOrgAdmin: jest.fn(async (orgId: string, uid: string) => orgId === 'hillview-demo' && uid === 'admin-uid') }));

import type { NextRequest } from 'next/server';

import { GoogleApiError } from '@/lib/sampark/google-calendar/api';
import { createHttpGoogleCalendarApi } from '@/lib/sampark/google-calendar/http-api';
import { MemoryGoogleCalendarStore } from '@/lib/sampark/google-calendar/store';

const store = new MemoryGoogleCalendarStore();
jest.mock('@/server/sampark/google-calendar', () => {
    const actual = jest.requireActual('@/server/sampark/google-calendar');
    const { readGoogleCalendarConfig } = jest.requireActual('@/lib/sampark/google-calendar/config');
    return { ...actual, googleCalendarDeps: async () => ({ store, config: readGoogleCalendarConfig({}), api: null, now: () => new Date() }) };
});

import { GET as statusGET, DELETE as statusDELETE } from '@/app/api/sampark/[orgId]/google-calendar/route';
import { GET as eventsGET, POST as eventsPOST } from '@/app/api/sampark/[orgId]/google-calendar/events/route';
import { GET as callbackGET } from '@/app/api/sampark/google-calendar/oauth/callback/route';
import { POST as notifyPOST } from '@/app/api/sampark/google-calendar/notifications/route';
import { POST as tickPOST } from '@/app/api/jobs/sampark-google-calendar/route';

// jest.setup.ts replaces the global Response with a stub without headers, so the
// fetch stub returns the small part of a Response the client reads.
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
        json: async () => body,
        text: async () => JSON.stringify(body),
    }) as unknown as Response;

describe('HTTP client (stubbed fetch)', () => {
    it('builds an offline consent URL with PKCE and only the requested scopes', () => {
        const api = createHttpGoogleCalendarApi({ clientId: 'cid', clientSecret: 'secret' });
        const u = new URL(api.authorizationUrl({ state: 'st', codeChallenge: 'ch', redirectUri: 'https://x.org/cb', scopes: ['a', 'b'] }));
        expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
        expect(Object.fromEntries(u.searchParams)).toMatchObject({ client_id: 'cid', redirect_uri: 'https://x.org/cb', response_type: 'code', scope: 'a b', access_type: 'offline', prompt: 'consent', state: 'st', code_challenge: 'ch', code_challenge_method: 'S256' });
        expect(u.toString()).not.toContain('secret');
    });

    it('retries rate limits and 5xx with backoff, then succeeds', async () => {
        const sleep = jest.fn(async () => undefined);
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(json(429, { error: { message: 'Rate Limit Exceeded' } }, { 'retry-after': '2' }))
            .mockResolvedValueOnce(json(403, { error: { message: 'x', errors: [{ reason: 'userRateLimitExceeded' }] } }))
            .mockResolvedValueOnce(json(503, { error: { message: 'Backend Error' } }))
            .mockResolvedValueOnce(json(200, { items: [{ id: 'e1', status: 'confirmed' }, { id: 'e2', status: 'cancelled' }] }));
        const api = createHttpGoogleCalendarApi({ clientId: 'c', clientSecret: 's', fetch: fetchMock as unknown as typeof fetch, sleep });
        const items = await api.listEvents('at', 'primary', { timeMin: new Date('2026-11-01T00:00:00Z'), timeMax: new Date('2026-12-01T00:00:00Z') });
        expect(items.map((e) => e.id)).toEqual(['e1']);
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(sleep).toHaveBeenNthCalledWith(1, 2000);
        const url = new URL(fetchMock.mock.calls[3][0]);
        expect(Object.fromEntries(url.searchParams)).toMatchObject({ singleEvents: 'true', orderBy: 'startTime' });
    });

    it('gives up after the attempt limit with a transient error, and maps other statuses', async () => {
        const sleep = jest.fn(async () => undefined);
        const always503 = jest.fn(async () => json(503, { error: { message: 'down' } }));
        const api = createHttpGoogleCalendarApi({ clientId: 'c', clientSecret: 's', fetch: always503 as unknown as typeof fetch, sleep, maxAttempts: 3 });
        await expect(api.getEvent('at', 'primary', 'e')).rejects.toMatchObject({ kind: 'unavailable', transient: true });
        expect(always503).toHaveBeenCalledTimes(3);

        const one = (status: number, body: unknown) => createHttpGoogleCalendarApi({ clientId: 'c', clientSecret: 's', fetch: (async () => json(status, body)) as unknown as typeof fetch, sleep });
        await expect(one(401, { error: { message: 'Invalid Credentials' } }).getEvent('at', 'p', 'e')).rejects.toMatchObject({ kind: 'unauthorized' });
        await expect(one(410, { error: { message: 'gone' } }).syncEvents('at', 'p', 'tok')).rejects.toMatchObject({ kind: 'gone' });
        await expect(one(409, { error: { message: 'dup' } }).insertEvent('at', 'p', {})).rejects.toMatchObject({ kind: 'conflict' });
        await expect(one(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }).refresh('rt')).rejects.toMatchObject({ kind: 'invalid_grant' });
        // Revoking a token that is already invalid is success.
        await expect(one(400, { error: 'invalid_token' }).revoke('rt')).resolves.toBeUndefined();
        expect(new GoogleApiError('forbidden', 403, 'x').transient).toBe(false);
    });

    it('follows sync pages and returns the final sync token', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(json(200, { items: [{ id: 'a' }], nextPageToken: 'p2' }))
            .mockResolvedValueOnce(json(200, { items: [{ id: 'b', status: 'cancelled' }], nextSyncToken: 'sync-2' }));
        const api = createHttpGoogleCalendarApi({ clientId: 'c', clientSecret: 's', fetch: fetchMock as unknown as typeof fetch });
        await expect(api.syncEvents('at', 'p', 'sync-1')).resolves.toEqual({ items: [{ id: 'a' }, { id: 'b', status: 'cancelled' }], nextSyncToken: 'sync-2' });
        expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('syncToken')).toBe('sync-1');
        expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('pageToken')).toBe('p2');
    });
});

const req = (headers: Record<string, string>, url = 'http://localhost/api/sampark/hillview-demo/google-calendar', body = '') =>
    ({
        url,
        headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
        json: async () => JSON.parse(body || '{}'),
    }) as unknown as NextRequest;
const org = (orgId = 'hillview-demo') => ({ params: Promise.resolve({ orgId }) });

const saved = { ...process.env };
beforeEach(() => {
    process.env.SAMPARK_ENABLED = 'true';
});
afterEach(() => {
    process.env = { ...saved };
});

describe('routes', () => {
    it('404 when Sampark is off; 401 without a user; 403 for a teacher or another school', async () => {
        process.env.SAMPARK_ENABLED = 'false';
        expect((await statusGET(req({ 'x-user-id': 'admin-uid' }), org())).status).toBe(404);
        process.env.SAMPARK_ENABLED = 'true';
        expect((await statusGET(req({}), org())).status).toBe(401);
        expect((await statusGET(req({ 'x-user-id': 'teacher-uid' }), org())).status).toBe(403);
        expect((await statusGET(req({ 'x-user-id': 'admin-uid' }), org('riverside-demo'))).status).toBe(403);
        expect((await statusDELETE(req({ 'x-user-id': 'teacher-uid' }), org())).status).toBe(403);
        expect((await eventsPOST(req({ 'x-user-id': 'teacher-uid' }), org())).status).toBe(403);
    });

    it('an admin gets the status', async () => {
        expect((await statusGET(req({ 'x-user-id': 'admin-uid' }), org())).status).toBe(200);
    });

    it('validates the event range and body', async () => {
        const bad = await eventsGET(req({ 'x-user-id': 'admin-uid' }, 'http://localhost/api/sampark/hillview-demo/google-calendar/events?from=x&to=y'), org());
        expect(bad.status).toBe(400);
        const noRequestId = await eventsPOST(req({ 'x-user-id': 'admin-uid' }, undefined, JSON.stringify({ summary: 'x' })), org());
        expect(noRequestId.status).toBe(400);
        // Valid input, but the server has no Google client: a 409 the page explains.
        const body = { requestId: 'req-12345678', summary: 'PTM', allDay: true, startDate: '2026-11-21', endDate: '2026-11-21', timeZone: 'Asia/Kolkata' };
        const notConfigured = await eventsPOST(req({ 'x-user-id': 'admin-uid' }, undefined, JSON.stringify(body)), org());
        expect(notConfigured.status).toBe(409);
    });

    it('the OAuth callback always answers with a redirect', async () => {
        const res = await callbackGET(req({ 'x-user-id': 'admin-uid' }, 'http://localhost:3005/api/sampark/google-calendar/oauth/callback?code=secret-code&state=nope'));
        expect(res.status).toBe(303);
    });

    it('the notification endpoint rejects an unknown channel; the job needs CRON_SECRET', async () => {
        expect((await notifyPOST(req({ 'x-goog-channel-id': 'nope', 'x-goog-channel-token': 't' }))).status).toBe(404);
        delete process.env.CRON_SECRET;
        expect((await tickPOST(req({ authorization: 'Bearer x' }))).status).toBe(503);
        process.env.CRON_SECRET = 'right';
        expect((await tickPOST(req({ authorization: 'Bearer wrong' }))).status).toBe(401);
        expect((await tickPOST(req({ authorization: 'Bearer right' }))).status).toBe(200);
    });
});
