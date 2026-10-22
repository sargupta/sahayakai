/**
 * @jest-environment node
 *
 * `placeVobizCall` is the teacher parent-call path's dialler (src/app/api/attendance/call/route.ts).
 * The Sampark hardening sprint added `placeVobizCallDetailed` beside it and must not change it by
 * a byte of behaviour (HARDENING_CONTRACT.md, "Rules for every stream"). This pins what the
 * attendance route depends on: the exact request, the four categories for every status, no
 * timeout or abort signal, and no change to how an accepted call's id is read.
 */
import { placeVobizCall, type VobizConfig, type VobizResult } from '@/lib/vobiz/client';

const CONFIG: VobizConfig = { authId: 'AUTHID', authToken: 'AUTHTOKEN', baseUrl: 'https://api.vobiz.ai/api/v1', fromNumber: '+917965853645' };
const OPTIONS = { to: '+919876543210', answerUrl: 'https://app/answer?t=A', hangupUrl: 'https://app/status?kind=hangup&t=S' };

function respond(status: number, body: unknown = {}, text = '') {
    return jest.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300, json: async () => body, text: async () => text }) as unknown as typeof fetch & jest.Mock;
}

describe('placeVobizCall is unchanged by the hardening sprint', () => {
    it('keeps its arity: (config, options, fetchImpl?) and nothing more', () => {
        expect(placeVobizCall.length).toBe(2);
    });

    it('sends exactly the same request, with no abort signal (it has never had a timeout)', async () => {
        const f = respond(200, { request_uuid: 'req-1' });
        await placeVobizCall(CONFIG, { ...OPTIONS, ringUrl: 'https://app/status?kind=ring&t=S', ringTimeout: 25 }, f);
        expect(f).toHaveBeenCalledTimes(1);
        const [url, init] = f.mock.calls[0];
        expect(url).toBe('https://api.vobiz.ai/api/v1/Account/AUTHID/Call/');
        expect(Object.keys(init).sort()).toEqual(['body', 'headers', 'method']);
        expect(init.method).toBe('POST');
        expect(init.headers).toEqual({ 'X-Auth-ID': 'AUTHID', 'X-Auth-Token': 'AUTHTOKEN', 'Content-Type': 'application/json' });
        expect(init.body).toBe(
            JSON.stringify({
                from: '917965853645',
                to: '919876543210',
                answer_url: 'https://app/answer?t=A',
                answer_method: 'POST',
                hangup_url: 'https://app/status?kind=hangup&t=S',
                ring_url: 'https://app/status?kind=ring&t=S',
                ring_timeout: 25,
            }),
        );
    });

    it('defaults ring_timeout to 30 and leaves ring_url out when none is given', async () => {
        const f = respond(201, { request_uuid: 'req-2' });
        await placeVobizCall(CONFIG, OPTIONS, f);
        expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
            from: '917965853645',
            to: '919876543210',
            answer_url: 'https://app/answer?t=A',
            answer_method: 'POST',
            hangup_url: 'https://app/status?kind=hangup&t=S',
            ring_timeout: 30,
        });
    });

    it.each<[number, VobizResult]>([
        [200, { ok: true, handle: { requestUuid: 'req-x' } }],
        [201, { ok: true, handle: { requestUuid: 'req-x' } }],
        [202, { ok: true, handle: { requestUuid: 'req-x' } }],
        [204, { ok: false, failure: { category: 'provider_rejected', status: 204 } }],
        [301, { ok: false, failure: { category: 'provider_rejected', status: 301 } }],
        [400, { ok: false, failure: { category: 'provider_rejected', status: 400 } }],
        [401, { ok: false, failure: { category: 'provider_unconfigured', status: 401 } }],
        [403, { ok: false, failure: { category: 'provider_unconfigured', status: 403 } }],
        [404, { ok: false, failure: { category: 'provider_rejected', status: 404 } }],
        // The categories the detailed variant adds are NOT seen here: 429 and 5xx stay provider_rejected.
        [429, { ok: false, failure: { category: 'provider_rejected', status: 429 } }],
        [500, { ok: false, failure: { category: 'provider_rejected', status: 500 } }],
        [502, { ok: false, failure: { category: 'provider_rejected', status: 502 } }],
        [503, { ok: false, failure: { category: 'provider_rejected', status: 503 } }],
        [504, { ok: false, failure: { category: 'provider_rejected', status: 504 } }],
    ])('HTTP %d → %j', async (status, expected) => {
        expect(await placeVobizCall(CONFIG, OPTIONS, respond(status, { request_uuid: 'req-x' }))).toEqual(expected);
    });

    it('a DND body changes nothing: still provider_rejected, and the body is never read as text', async () => {
        const f = respond(400, {}, 'Number is registered on DND');
        const text = jest.fn();
        f.mockResolvedValue({ status: 400, ok: false, json: async () => ({}), text });
        expect(await placeVobizCall(CONFIG, OPTIONS, f)).toEqual({ ok: false, failure: { category: 'provider_rejected', status: 400 } });
        expect(text).not.toHaveBeenCalled();
    });

    it('an accepted call with an unreadable body keeps going with an empty id', async () => {
        const f = jest.fn().mockResolvedValue({ status: 202, ok: true, json: async () => { throw new Error('bad json'); } }) as unknown as typeof fetch;
        expect(await placeVobizCall(CONFIG, OPTIONS, f)).toEqual({ ok: true, handle: { requestUuid: '' } });
    });

    it('a thrown fetch is network; a short destination is refused before any request', async () => {
        const thrown = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;
        expect(await placeVobizCall(CONFIG, OPTIONS, thrown)).toEqual({ ok: false, failure: { category: 'network' } });
        const f = respond(200);
        expect(await placeVobizCall(CONFIG, { ...OPTIONS, to: '12345' }, f)).toEqual({ ok: false, failure: { category: 'invalid_destination' } });
        expect(f).not.toHaveBeenCalled();
    });
});
