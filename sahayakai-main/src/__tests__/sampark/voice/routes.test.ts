/**
 * @jest-environment node
 *
 * The four voice routes through their real handlers. The jest setup's Response
 * polyfill drops headers, so `next/server` is replaced with a recorder that
 * keeps exactly what each route passed (body, status, headers).
 *
 * Covers what only the route layer decides:
 *   - SAMPARK_ENABLED off → answer/gather still return valid hangup XML (a call
 *     in flight ends cleanly), status/audio 404;
 *   - fields arrive as a form body, a JSON body (Vobiz's documented example),
 *     or the query string, and a malformed body never throws;
 *   - the request's Host header has no effect on any URL we return;
 *   - an internal failure still yields hangup XML (answer/gather) and a 500
 *     on status, so Vobiz's retry can finish the job idempotently.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => {
        throw new Error('voice route tests must not reach Firestore');
    },
    initializeFirebase: async () => undefined,
}));
jest.mock('next/server', () => {
    class MockNextResponse {
        body: unknown;
        status: number;
        headers: Record<string, string>;
        constructor(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
            this.body = body;
            this.status = init.status ?? 200;
            this.headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
        }
        static json(data: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
            const res = new MockNextResponse(data, init);
            res.headers['content-type'] = 'application/json';
            return res;
        }
    }
    return { NextResponse: MockNextResponse };
});

import { setSamparkClockForTests, setSamparkRepoForTests, setSpeechDepsForTests } from '@/lib/sampark/repo/factory';
import type { SamparkRepo, SpeechSynthesizer, SpeechVerifier } from '@/lib/sampark/ports';
import { mintSamparkVoiceToken, voicePrincipal } from '@/lib/sampark/voice/tokens';
import { EMPTY_HANGUP_XML } from '@/lib/sampark/voice/xml';
import { readVoiceFields } from '@/server/sampark/voice';

import { BASE_URL, CALL_ID, INTENT_ID, ORG, VOBIZ_CALL_UUID, gatherAction, playUrls, setVoiceEnv, tokenOf, world, type World } from './_fixtures';

interface Recorded {
    body: unknown;
    status: number;
    headers: Record<string, string>;
}

type Handler = (req: never) => Promise<unknown>;

const R = {
    answer: () => import('@/app/api/webhooks/sampark-voice/answer/route'),
    gather: () => import('@/app/api/webhooks/sampark-voice/gather/route'),
    status: () => import('@/app/api/webhooks/sampark-voice/status/route'),
    audio: () => import('@/app/api/webhooks/sampark-voice/clip/[file]/route'),
};

interface FakeRequestInit {
    method?: 'GET' | 'POST';
    query?: Record<string, string>;
    body?: string;
    contentType?: string | null;
    host?: string;
    textThrows?: boolean;
}

function fakeRequest(init: FakeRequestInit = {}) {
    // An attacker-chosen Host: nothing we return may depend on it.
    const host = init.host ?? 'attacker.example';
    const url = new URL(`https://${host}/api/webhooks/sampark-voice/x`);
    for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
    const headers: Record<string, string | null> = {
        'content-type': init.contentType === undefined ? 'application/x-www-form-urlencoded' : init.contentType,
        host,
        'x-forwarded-host': host,
    };
    return {
        method: init.method ?? 'POST',
        headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
        nextUrl: url,
        url: url.toString(),
        text: async () => {
            if (init.textThrows) throw new Error('stream already read');
            return init.body ?? '';
        },
        formData: async () => {
            throw new Error('not multipart');
        },
    };
}

async function call(handler: Handler, init: FakeRequestInit = {}): Promise<Recorded> {
    return (await handler(fakeRequest(init) as never)) as Recorded;
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

/** GET the clip route for `<file>` (the token plus `.wav`, exactly as it appears in a <Play> URL). */
async function clip(file: string): Promise<Recorded> {
    const mod = (await R.audio()) as unknown as { GET: (req: never, ctx: { params: Promise<{ file: string }> }) => Promise<unknown> };
    return (await mod.GET(fakeRequest({ method: 'GET' }) as never, { params: Promise.resolve({ file }) })) as Recorded;
}

let w: World;

beforeEach(async () => {
    setVoiceEnv();
    w = await world();
    setSamparkRepoForTests(w.repo);
    setSamparkClockForTests(w.clock);
    setSpeechDepsForTests({ synth: {} as SpeechSynthesizer, verifier: {} as SpeechVerifier, store: w.store });
});

afterAll(() => {
    setSamparkRepoForTests(null);
    setSamparkClockForTests(null);
    setSpeechDepsForTests(null);
});

const answerToken = () => mintSamparkVoiceToken('sampark-answer', voicePrincipal(ORG, CALL_ID));
const statusToken = () => mintSamparkVoiceToken('sampark-status', voicePrincipal(ORG, CALL_ID));

describe('route configuration', () => {
    it.each(Object.entries(R))('%s is dynamic and runs on node', async (_name, load) => {
        const mod = await load();
        expect(mod.dynamic).toBe('force-dynamic');
        expect(mod.runtime).toBe('nodejs');
    });

    it('answer, gather and status take GET and POST; audio takes GET', async () => {
        for (const name of ['answer', 'gather', 'status'] as const) {
            const mod = (await R[name]()) as Record<string, unknown>;
            expect(typeof mod.GET).toBe('function');
            expect(typeof mod.POST).toBe('function');
        }
        expect(typeof ((await R.audio()) as Record<string, unknown>).GET).toBe('function');
    });
});

describe('SAMPARK_ENABLED off', () => {
    beforeEach(() => setVoiceEnv({ SAMPARK_ENABLED: undefined }));

    it.each(['answer', 'gather'] as const)('%s still answers 200 with hangup XML so a live call ends cleanly', async (name) => {
        const res = await call((await R[name]()).POST, { query: { t: await answerToken() } });
        expect(res).toEqual({ body: EMPTY_HANGUP_XML, status: 200, headers: expect.objectContaining({ 'content-type': 'application/xml' }) });
        expect((await w.repo.getCall(ORG, CALL_ID))?.state).toBe('dialing');
    });

    it('status 404s and changes nothing', async () => {
        const res = await call((await R.status()).POST, { query: { t: await statusToken(), kind: 'hangup' }, body: form({ HangupCause: 'NORMAL_CLEARING' }) });
        expect(res.status).toBe(404);
        expect((await w.repo.getCall(ORG, CALL_ID))?.state).toBe('dialing');
    });

    it('audio 404s', async () => {
        const token = await mintSamparkVoiceToken('sampark-audio', voicePrincipal(ORG, w.keys.message as string));
        expect((await clip(`${token}.wav`)).status).toBe(404);
    });
});

describe('answer route', () => {
    it('form body: 200 application/xml, the message plays, every URL on the public base whatever the Host header says', async () => {
        const res = await call((await R.answer()).POST, { query: { t: await answerToken() }, body: form({ CallUUID: VOBIZ_CALL_UUID, From: '+910000000000', To: '+911111111111', Event: 'StartApp' }), host: 'evil.example' });
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('application/xml');
        const xml = res.body as string;
        expect(playUrls(xml)).toHaveLength(2);
        for (const url of [...playUrls(xml), gatherAction(xml) as string]) {
            expect(url.startsWith(`${BASE_URL}/`)).toBe(true);
            expect(url).not.toContain('evil.example');
        }
        expect((await w.repo.getCall(ORG, CALL_ID))?.vobizCallUuid).toBe(VOBIZ_CALL_UUID);
    });

    it('JSON body works too', async () => {
        const res = await call((await R.answer()).POST, { query: { t: await answerToken() }, body: JSON.stringify({ CallUUID: VOBIZ_CALL_UUID, Event: 'StartApp' }), contentType: 'application/json' });
        expect(playUrls(res.body as string)).toHaveLength(2);
        expect((await w.repo.getCall(ORG, CALL_ID))?.vobizCallUuid).toBe(VOBIZ_CALL_UUID);
    });

    it('GET with fields in the query works', async () => {
        const res = await call((await R.answer()).GET, { method: 'GET', query: { t: await answerToken(), CallUUID: 'leg-from-query' } });
        expect(playUrls(res.body as string)).toHaveLength(2);
        expect((await w.repo.getCall(ORG, CALL_ID))?.vobizCallUuid).toBe('leg-from-query');
    });

    it('a storage failure still returns valid hangup XML with 200', async () => {
        const broken = { ...w.repo, getSchool: async () => { throw new Error('firestore unavailable'); } } as SamparkRepo;
        setSamparkRepoForTests(broken);
        const res = await call((await R.answer()).POST, { query: { t: await answerToken() }, body: form({ CallUUID: VOBIZ_CALL_UUID }) });
        expect(res).toEqual({ body: EMPTY_HANGUP_XML, status: 200, headers: expect.objectContaining({ 'content-type': 'application/xml' }) });
    });

    it('no token: 200 hangup XML', async () => {
        const res = await call((await R.answer()).POST, { body: form({ CallUUID: VOBIZ_CALL_UUID }) });
        expect(res.body).toBe(EMPTY_HANGUP_XML);
        expect(res.status).toBe(200);
    });
});

describe('gather route', () => {
    it('form body Digits=1 → the confirmation clip; a replay of the same URL hangs up', async () => {
        const answered = await call((await R.answer()).POST, { query: { t: await answerToken() }, body: form({ CallUUID: VOBIZ_CALL_UUID }) });
        const t = tokenOf(gatherAction(answered.body as string) as string);
        const gather = (await R.gather()).POST;

        const first = await call(gather, { query: { t }, body: form({ CallUUID: VOBIZ_CALL_UUID, InputType: 'dtmf', Digits: '1' }) });
        expect(first.status).toBe(200);
        expect(first.headers['content-type']).toBe('application/xml');
        expect(playUrls(first.body as string)).toHaveLength(1);

        const replay = await call(gather, { query: { t }, body: form({ CallUUID: VOBIZ_CALL_UUID, InputType: 'dtmf', Digits: '9' }) });
        expect(replay.body).toBe(EMPTY_HANGUP_XML);
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome.digits).toBe('1');
    });

    it('JSON body with Digits as a number', async () => {
        const answered = await call((await R.answer()).POST, { query: { t: await answerToken() } });
        const t = tokenOf(gatherAction(answered.body as string) as string);
        await call((await R.gather()).POST, { query: { t }, body: JSON.stringify({ Digits: 2 }), contentType: 'application/json' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '2', declined: true });
    });
});

describe('status route', () => {
    beforeEach(async () => {
        await call((await R.answer()).POST, { query: { t: await answerToken() }, body: form({ CallUUID: VOBIZ_CALL_UUID }) });
    });

    it('a JSON-bodied hangup with only Status and Duration (Vobiz’s documented example) settles the call', async () => {
        const res = await call((await R.status()).POST, {
            query: { t: await statusToken(), kind: 'hangup' },
            body: JSON.stringify({ CallUUID: VOBIZ_CALL_UUID, Status: 'completed', Duration: 42 }),
            contentType: 'application/json',
        });
        expect(res).toEqual({ body: { ok: true }, status: 200, headers: expect.objectContaining({ 'content-type': 'application/json' }) });
        expect(await w.repo.getCall(ORG, CALL_ID)).toMatchObject({ state: 'completed', durationSeconds: 42, billedSeconds: 60 });
        expect((await w.repo.getIntent(ORG, INTENT_ID))?.status).toBe('done');
    });

    it('a JSON body sent under the documented form content type is still read', async () => {
        await call((await R.status()).POST, {
            query: { t: await statusToken(), kind: 'hangup' },
            body: JSON.stringify({ Status: 'completed', Duration: '42' }),
            contentType: 'application/x-www-form-urlencoded',
        });
        expect((await w.repo.getCall(ORG, CALL_ID))?.state).toBe('completed');
    });

    it('a form-bodied hangup with HangupCause settles the call', async () => {
        const res = await call((await R.status()).POST, {
            query: { t: await statusToken(), kind: 'hangup' },
            body: form({ CallUUID: VOBIZ_CALL_UUID, HangupCause: 'NORMAL_CLEARING', Duration: '42', BillDuration: '60' }),
        });
        expect(res.status).toBe(200);
        expect(await w.repo.getCall(ORG, CALL_ID)).toMatchObject({ state: 'completed', durationSeconds: 42, billedSeconds: 60 });
        expect((await w.repo.getIntent(ORG, INTENT_ID))?.status).toBe('done');
    });

    it('a bad token still answers 200 { ok: true } and changes nothing', async () => {
        const before = await w.repo.getCall(ORG, CALL_ID);
        const res = await call((await R.status()).POST, { query: { t: 'forged.1.x', kind: 'hangup' }, body: form({ HangupCause: 'NORMAL_CLEARING' }) });
        expect(res).toMatchObject({ body: { ok: true }, status: 200 });
        expect(await w.repo.getCall(ORG, CALL_ID)).toEqual(before);
    });

    it('an unreadable body never throws: the hangup is recorded from what is known', async () => {
        const res = await call((await R.status()).POST, { query: { t: await statusToken(), kind: 'hangup' }, textThrows: true });
        expect(res.status).toBe(200);
        expect((await w.repo.getCall(ORG, CALL_ID))?.state).toBe('failed'); // no cause, no duration → failed, never "heard"
    });

    it('our own storage failure answers 500 so Vobiz retries (the handler is idempotent)', async () => {
        const broken = { ...w.repo, mutateCall: async () => { throw new Error('firestore unavailable'); } } as SamparkRepo;
        setSamparkRepoForTests(broken);
        const res = await call((await R.status()).POST, { query: { t: await statusToken(), kind: 'hangup' }, body: form({ Status: 'busy' }) });
        expect(res.status).toBe(500);
    });
});

describe('audio route', () => {
    it('serves a verified clip as audio/wav (8 kHz μ-law, as stored) with its length', async () => {
        const token = await mintSamparkVoiceToken('sampark-audio', voicePrincipal(ORG, w.keys.message as string));
        const res = await clip(`${token}.wav`);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('audio/wav');
        const bytes = Buffer.from(res.body as Uint8Array);
        expect(res.headers['content-length']).toBe(String(bytes.length));
        expect(bytes.readUInt16LE(20)).toBe(7); // WAVE_FORMAT_MULAW
        expect(bytes.readUInt16LE(34)).toBe(8); // bits per sample
    });

    it('404s a bad token and an unverified clip', async () => {
        expect((await clip(`${'nope'}.wav`)).status).toBe(404);
        const failed = await world({ clips: (k) => (k === 'message' ? 'failed' : 'passed') });
        setSamparkRepoForTests(failed.repo);
        setSpeechDepsForTests({ synth: {} as SpeechSynthesizer, verifier: {} as SpeechVerifier, store: failed.store });
        const token = await mintSamparkVoiceToken('sampark-audio', voicePrincipal(ORG, failed.keys.message as string));
        expect((await clip(`${token}.wav`)).status).toBe(404);
    });
});

describe('readVoiceFields', () => {
    it('reads a multipart body through formData()', async () => {
        const fd = new FormData();
        fd.set('Digits', '9');
        fd.set('CallUUID', 'leg');
        const req = { ...fakeRequest({ contentType: 'multipart/form-data; boundary=x' }), formData: async () => fd };
        expect(await readVoiceFields(req)).toEqual({ Digits: '9', CallUUID: 'leg' });
    });

    it('lets body fields override query fields, and ignores nested JSON values', async () => {
        const req = fakeRequest({ query: { Digits: '1', t: 'tok' }, body: JSON.stringify({ Digits: '2', Nested: { a: 1 }, Flag: true }), contentType: 'application/json' });
        expect(await readVoiceFields(req)).toEqual({ Digits: '2', t: 'tok', Flag: 'true' });
    });

    it('a body that is neither JSON nor a form is read as best it can, never thrown', async () => {
        expect(await readVoiceFields(fakeRequest({ body: '{not json', contentType: 'application/json' }))).toEqual({ '{not json': '' });
        expect(await readVoiceFields(fakeRequest({ body: '', contentType: null }))).toEqual({});
        expect(await readVoiceFields(fakeRequest({ textThrows: true }))).toEqual({});
    });
});
