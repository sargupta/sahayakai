/**
 * Gate for the credential-staleness class that kept parent calls dead for a week.
 *
 * WHAT HAPPENED
 * Twice. First the Twilio auth token was rotated on Twilio's side and never
 * updated in Secret Manager. Then it was updated, while TWILIO_ACCOUNT_SID was
 * left on a version belonging to a DIFFERENT account — so the pair still did
 * not authenticate. Both produced `20003 Authenticate` on every call, for days,
 * with nothing alerting: two dead calls a day sits far below any rate-based
 * threshold, and the route classifies provider failures correctly, so it never
 * looked like an outage.
 *
 * WHAT THIS GATE CATCHES
 * Not "the current credentials work" — that is a deployment fact, not a test.
 * The class is: the preflight must distinguish a credential problem from a
 * network problem, must never leak the auth token, and must place no call. A
 * probe that reported "rejected" on a flaky network would send someone to
 * rotate a working key; one that reported "ok" on a 401 would restore exactly
 * the blindness this endpoint exists to remove.
 */

const loggerErrorMock = jest.fn();
jest.mock('@/lib/logger', () => ({
    logger: { error: loggerErrorMock, warn: jest.fn(), info: jest.fn() },
}));

import { NextResponse } from 'next/server';

// NextResponse.json() yields no readable body under jsdom; assert on what the
// route handed it (the repo convention — see feedback-app-route.test).
const jsonSpy = jest.spyOn(NextResponse, 'json');
function lastCall(): { body: any; status: number } {
    const c = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1];
    return { body: c[0] as any, status: (c[1] as any)?.status ?? 200 };
}

const CRON_SECRET = 'test-cron-secret';
const SID = 'ACtest0000000000000000000000000001';
const TOKEN = 'super-secret-auth-token-value';

function makeRequest(auth = `Bearer ${CRON_SECRET}`) {
    return { headers: { get: (h: string) => (h === 'authorization' ? auth : null) } } as any;
}

describe('GET /api/health/twilio — credential preflight', () => {
    let GET: any;
    let fetchSpy: jest.SpyInstance;

    beforeAll(async () => {
        process.env.CRON_SECRET = CRON_SECRET;
        ({ GET } = await import('@/app/api/health/twilio/route'));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.TWILIO_ACCOUNT_SID = SID;
        process.env.TWILIO_AUTH_TOKEN = TOKEN;
        process.env.TWILIO_PHONE_NUMBER = '+15550001111';
        fetchSpy = jest.spyOn(global, 'fetch' as any);
    });

    afterEach(() => fetchSpy.mockRestore());

    it('requires the operator secret', async () => {
        await GET(makeRequest('Bearer wrong'));
        expect(lastCall().status).toBe(401);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('reports ok when Twilio accepts the pair and the account is active', async () => {
        fetchSpy.mockResolvedValueOnce({
            ok: true, status: 200, json: async () => ({ status: 'active' }),
        } as any);

        await GET(makeRequest());
        expect(lastCall().body.verdict).toBe('ok');
        expect(lastCall().body.ok).toBe(true);
    });

    // The exact production failure, caught before a teacher hits it.
    it('reports credentials_rejected on a 401, not a generic error', async () => {
        fetchSpy.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as any);

        await GET(makeRequest());
        const { body } = lastCall();

        expect(body.verdict).toBe('credentials_rejected');
        expect(body.ok).toBe(false);
        expect(loggerErrorMock).toHaveBeenCalled();
    });

    it('does not call a network failure a credential failure', async () => {
        // Reporting "rejected" here would send an operator to rotate a key that
        // was never the problem.
        fetchSpy.mockRejectedValueOnce(new Error('ECONNRESET'));

        await GET(makeRequest());
        const { body } = lastCall();
        expect(body.verdict).toBe('provider_unreachable');
        expect(body.verdict).not.toBe('credentials_rejected');
    });

    it('flags a suspended account even though the credentials are valid', async () => {
        fetchSpy.mockResolvedValueOnce({
            ok: true, status: 200, json: async () => ({ status: 'suspended' }),
        } as any);

        await GET(makeRequest());
        const { body } = lastCall();
        expect(body.verdict).toBe('account_suspended');
        expect(body.ok).toBe(false);
    });

    it('reports unconfigured without calling out when a variable is missing', async () => {
        delete process.env.TWILIO_AUTH_TOKEN;

        await GET(makeRequest());
        const { body } = lastCall();
        expect(body.verdict).toBe('unconfigured');
        expect(body.detail).toMatch(/TWILIO_AUTH_TOKEN/);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('never puts the auth token in the response, on any path', async () => {
        const cases: Array<() => void> = [
            () => fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'active' }) } as any),
            () => fetchSpy.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as any),
            () => fetchSpy.mockRejectedValueOnce(new Error('boom')),
        ];
        for (const arrange of cases) {
            jest.clearAllMocks();
            arrange();
            await GET(makeRequest());
            const { body } = lastCall();
            expect(JSON.stringify(body)).not.toContain(TOKEN);
            // The SID prefix is deliberate — it is what distinguishes two
            // accounts — but the full SID must not ship either.
            expect(JSON.stringify(body)).not.toContain(SID);
        }
    });

    it('uses the read-only account endpoint, so no call is ever placed', async () => {
        fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'active' }) } as any);
        await GET(makeRequest());

        const url = String(fetchSpy.mock.calls[0][0]);
        expect(url).toContain(`/Accounts/${SID}.json`);
        // Anything under /Calls would actually dial someone.
        expect(url).not.toMatch(/\/Calls/i);
    });
});
