/**
 * @jest-environment node
 *
 * `placeVobizCallDetailed` (hardening H7): the Sampark dispatcher's dialler. Same request as
 * `placeVobizCall`, plus an abort timeout (8 s by default) and the categories that decide
 * whether a family's attempt is spent (429), whether the call may already have been placed
 * (5xx, no answer), and whether the number can take these calls at all (DND). The provider's
 * body is read only to recognise DND and is never returned.
 */
import { placeVobizCall, placeVobizCallDetailed, VOBIZ_PLACE_TIMEOUT_MS, type VobizConfig, type VobizDetailedResult } from '@/lib/vobiz/client';

const CONFIG: VobizConfig = { authId: 'AUTHID', authToken: 'AUTHTOKEN', baseUrl: 'https://api.vobiz.ai/api/v1', fromNumber: '+917965853645' };
const OPTIONS = { to: '+919876543210', answerUrl: 'https://app/answer?t=A', hangupUrl: 'https://app/status?kind=hangup&t=S', ringUrl: 'https://app/status?kind=ring&t=S' };

function respond(status: number, body = '') {
    return jest.fn(async () => new Response(status === 204 ? null : body, { status })) as unknown as typeof fetch & jest.Mock;
}

/** A provider that never answers; it rejects only when the request's signal aborts. */
function hanging() {
    return jest.fn((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
        }),
    ) as unknown as typeof fetch & jest.Mock;
}

afterEach(() => jest.useRealTimers());

describe('placeVobizCallDetailed — categories', () => {
    it.each<[number, string, VobizDetailedResult]>([
        [200, '{"request_uuid":"req-1"}', { ok: true, handle: { requestUuid: 'req-1' } }],
        [201, '{"request_uuid":"req-1"}', { ok: true, handle: { requestUuid: 'req-1' } }],
        [202, '', { ok: true, handle: { requestUuid: '' } }],
        [429, 'Too Many Requests', { ok: false, failure: { category: 'rate_limited', status: 429 } }],
        [500, '', { ok: false, failure: { category: 'provider_error', status: 500 } }],
        [502, '<html>Bad Gateway</html>', { ok: false, failure: { category: 'provider_error', status: 502 } }],
        [503, '', { ok: false, failure: { category: 'provider_error', status: 503 } }],
        [504, '', { ok: false, failure: { category: 'provider_error', status: 504 } }],
        // Neither an acceptance nor a refusal: Vobiz may have placed the call, so the outcome is unknown.
        [204, '', { ok: false, failure: { category: 'provider_error', status: 204 } }],
        [302, '', { ok: false, failure: { category: 'provider_error', status: 302 } }],
        [400, '{"error":"Number is registered on DND"}', { ok: false, failure: { category: 'dnd_blocked', status: 400 } }],
        [403, 'Destination blocked: NDNC registry', { ok: false, failure: { category: 'dnd_blocked', status: 403 } }],
        [422, 'Subscriber has opted for Do Not Disturb', { ok: false, failure: { category: 'dnd_blocked', status: 422 } }],
        [401, 'Unauthorized', { ok: false, failure: { category: 'provider_unconfigured', status: 401 } }],
        [403, 'Forbidden', { ok: false, failure: { category: 'provider_unconfigured', status: 403 } }],
        [400, '{"error":"bad request"}', { ok: false, failure: { category: 'provider_rejected', status: 400 } }],
        [404, 'not found', { ok: false, failure: { category: 'provider_rejected', status: 404 } }],
        // "dnd" only as a whole word: an id or a word that merely contains it is not a DND refusal.
        [400, '{"error":"invalid field","trace":"xdndx-123"}', { ok: false, failure: { category: 'provider_rejected', status: 400 } }],
    ])('HTTP %d (%s) → %j', async (status, body, expected) => {
        expect(await placeVobizCallDetailed(CONFIG, OPTIONS, respond(status, body))).toEqual(expected);
    });

    it('a thrown fetch is network; a short destination is invalid and never sent', async () => {
        const thrown = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
        expect(await placeVobizCallDetailed(CONFIG, OPTIONS, thrown)).toEqual({ ok: false, failure: { category: 'network' } });
        const f = respond(200);
        expect(await placeVobizCallDetailed(CONFIG, { ...OPTIONS, to: '12345' }, f)).toEqual({ ok: false, failure: { category: 'invalid_destination' } });
        expect(f).not.toHaveBeenCalled();
    });

    it('never returns the provider body, whatever the category', async () => {
        const secret = 'account MA_SECRET_ACCOUNT on DND list';
        for (const status of [400, 403, 429, 500]) {
            const result = await placeVobizCallDetailed(CONFIG, OPTIONS, respond(status, secret));
            expect(JSON.stringify(result)).not.toContain('MA_SECRET_ACCOUNT');
            expect(Object.keys(result.ok ? result.handle : result.failure).sort()).toEqual(result.ok ? ['requestUuid'] : ['category', 'status']);
        }
    });
});

describe('placeVobizCallDetailed — the request and the timeout', () => {
    it('sends exactly what placeVobizCall sends, plus an abort signal', async () => {
        const plain = respond(201, '{"request_uuid":"a"}');
        const detailed = respond(201, '{"request_uuid":"a"}');
        await placeVobizCall(CONFIG, OPTIONS, plain);
        await placeVobizCallDetailed(CONFIG, OPTIONS, detailed);
        const [plainUrl, plainInit] = plain.mock.calls[0];
        const [url, init] = detailed.mock.calls[0];
        expect(url).toBe(plainUrl);
        const { signal, ...rest } = init as RequestInit;
        expect(rest).toEqual(plainInit);
        expect(signal).toBeInstanceOf(AbortSignal);
    });

    it(`gives up after ${VOBIZ_PLACE_TIMEOUT_MS} ms by default, as network (an unknown outcome)`, async () => {
        expect(VOBIZ_PLACE_TIMEOUT_MS).toBe(8000);
        jest.useFakeTimers();
        const f = hanging();
        let settled: VobizDetailedResult | null = null;
        const pending = placeVobizCallDetailed(CONFIG, OPTIONS, f).then((r) => {
            settled = r;
            return r;
        });
        await jest.advanceTimersByTimeAsync(VOBIZ_PLACE_TIMEOUT_MS - 1);
        expect(settled).toBeNull();
        await jest.advanceTimersByTimeAsync(1);
        expect(await pending).toEqual({ ok: false, failure: { category: 'network' } });
    });

    it('honours a shorter timeout and clears its timer when the provider answers', async () => {
        const f = hanging();
        expect(await placeVobizCallDetailed(CONFIG, OPTIONS, f, { timeoutMs: 5 })).toEqual({ ok: false, failure: { category: 'network' } });
        jest.useFakeTimers();
        await placeVobizCallDetailed(CONFIG, OPTIONS, respond(201, '{"request_uuid":"b"}'));
        expect(jest.getTimerCount()).toBe(0);
    });
});
