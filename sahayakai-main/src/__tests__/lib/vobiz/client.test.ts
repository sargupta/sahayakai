/**
 * The Vobiz dial contract, pinned against the shape the working Suraksha
 * dialer actually sends. These are the details that fail silently rather than
 * loudly: a `+` left on the number connects to nothing, a missing
 * `answer_method` makes the provider GET a webhook that expects form fields.
 */
import {
    placeVobizCall,
    hangupVobizCall,
    readVobizConfig,
    toVobizNumber,
} from '@/lib/vobiz/client';

const CONFIG = {
    authId: 'AUTHID',
    authToken: 'AUTHTOKEN',
    baseUrl: 'https://api.vobiz.ai/api/v1',
    fromNumber: '+917965853645',
};

function okFetch(body: unknown = { request_uuid: 'req-1' }, status = 200) {
    return jest.fn().mockResolvedValue({
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
    }) as unknown as typeof fetch;
}

describe('number normalisation', () => {
    it('strips the + so the provider can route the call', () => {
        expect(toVobizNumber('+919876543210')).toBe('919876543210');
    });

    it('adds the country code to a bare ten-digit Indian mobile', () => {
        expect(toVobizNumber('9876543210')).toBe('919876543210');
    });

    it('never invents a country code for a number that already has one', () => {
        expect(toVobizNumber('+14155550123')).toBe('14155550123');
    });

    it('tolerates human formatting', () => {
        expect(toVobizNumber('+91 98765-43210')).toBe('919876543210');
    });
});

describe('configuration', () => {
    it('returns null when any credential is missing, so the caller can report it as an operator fix', () => {
        expect(readVobizConfig({ VOBIZ_AUTH_ID: 'a', VOBIZ_AUTH_TOKEN: 'b' } as NodeJS.ProcessEnv)).toBeNull();
        expect(readVobizConfig({} as NodeJS.ProcessEnv)).toBeNull();
    });

    it('defaults the base URL and trims a trailing slash', () => {
        const c = readVobizConfig({
            VOBIZ_AUTH_ID: 'a', VOBIZ_AUTH_TOKEN: 'b', VOBIZ_FROM_NUMBER: '+91123',
            VOBIZ_BASE_URL: 'https://staging.vobiz.ai/api/v1/',
        } as NodeJS.ProcessEnv);
        expect(c?.baseUrl).toBe('https://staging.vobiz.ai/api/v1');
    });
});

describe('placing a call', () => {
    it('posts the documented body to the documented endpoint', async () => {
        const f = okFetch();
        const res = await placeVobizCall(CONFIG, {
            to: '+919876543210',
            answerUrl: 'https://app/answer?t=A',
            hangupUrl: 'https://app/status?kind=hangup&t=S',
            ringUrl: 'https://app/status?kind=ring&t=S',
        }, f);

        expect(res).toEqual({ ok: true, handle: { requestUuid: 'req-1' } });
        const [url, init] = (f as jest.Mock).mock.calls[0];
        expect(url).toBe('https://api.vobiz.ai/api/v1/Account/AUTHID/Call/');
        expect(init.headers['X-Auth-ID']).toBe('AUTHID');
        expect(init.headers['X-Auth-Token']).toBe('AUTHTOKEN');

        const body = JSON.parse(init.body);
        expect(body.to).toBe('919876543210');
        expect(body.from).toBe('917965853645');
        // The answer webhook reads Vobiz's form fields (CallUUID); a GET would
        // deliver none of them and the stream could not be bound to the leg.
        expect(body.answer_method).toBe('POST');
        expect(body.ring_timeout).toBe(30);
    });

    it('refuses a destination too short to be a real number without billing an attempt', async () => {
        const f = okFetch();
        const res = await placeVobizCall(CONFIG, {
            to: '12345', answerUrl: 'a', hangupUrl: 'h',
        }, f);
        expect(res).toEqual({ ok: false, failure: { category: 'invalid_destination' } });
        expect(f).not.toHaveBeenCalled();
    });

    it('classifies a credential rejection as an operator problem, not a retry', async () => {
        const res = await placeVobizCall(CONFIG, { to: '+919876543210', answerUrl: 'a', hangupUrl: 'h' }, okFetch({}, 401));
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.failure.category).toBe('provider_unconfigured');
    });

    it('classifies other provider rejections separately', async () => {
        const res = await placeVobizCall(CONFIG, { to: '+919876543210', answerUrl: 'a', hangupUrl: 'h' }, okFetch({}, 400));
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.failure.category).toBe('provider_rejected');
    });

    it('reports a transport failure as network rather than throwing at the route', async () => {
        const f = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;
        const res = await placeVobizCall(CONFIG, { to: '+919876543210', answerUrl: 'a', hangupUrl: 'h' }, f);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.failure.category).toBe('network');
    });

    it('keeps a connected call even when the response carries no id', async () => {
        // Losing the id costs status correlation, not the call. Failing here
        // would mark a ringing parent's call as failed.
        const res = await placeVobizCall(CONFIG, { to: '+919876543210', answerUrl: 'a', hangupUrl: 'h' }, okFetch({}, 202));
        expect(res).toEqual({ ok: true, handle: { requestUuid: '' } });
    });
});

describe('hangup', () => {
    it('calls DELETE on the call resource', async () => {
        const f = okFetch({}, 204);
        await expect(hangupVobizCall(CONFIG, 'cuid-9', f)).resolves.toBe(true);
        const [url, init] = (f as jest.Mock).mock.calls[0];
        expect(url).toBe('https://api.vobiz.ai/api/v1/Account/AUTHID/Call/cuid-9/');
        expect(init.method).toBe('DELETE');
    });

    it('is a no-op without a call id rather than issuing a malformed DELETE', async () => {
        const f = okFetch();
        await expect(hangupVobizCall(CONFIG, '', f)).resolves.toBe(false);
        expect(f).not.toHaveBeenCalled();
    });
});
