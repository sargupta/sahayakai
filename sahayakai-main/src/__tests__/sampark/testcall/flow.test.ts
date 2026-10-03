/**
 * @jest-environment node
 *
 * Test-call tool: the real local HTTP server on port 0, an injected clock and an
 * injected fetch (no Vobiz endpoint is ever contacted).
 */
import {
    buildWav, mintToken, runTestCall, TESTCALL_DOMAINS, WAV_FORMAT_MULAW, type ClipSet, type RunHandle,
} from '../../../../scripts/sampark/vobiz-test-call';
import { fakeFetch, localPath, parseXml, request } from './helpers';

const BASE = 'https://tunnel.example.com';
const PHONE = '+919876543210';
const OTHER = '+919111111111';
const CANARY_TOKEN = 'CANARY-AUTH-TOKEN-9f3a';
const CANARY_ID = 'CANARY-AUTH-ID-77c1';
const KEY = 'canary-signing-key-'.padEnd(48, 'x');

const ENV = {
    TEST_PHONE_E164: PHONE, PUBLIC_BASE_URL: BASE,
    VOBIZ_AUTH_ID: CANARY_ID, VOBIZ_AUTH_TOKEN: CANARY_TOKEN, VOBIZ_FROM_NUMBER: '+911234567890',
} as NodeJS.ProcessEnv;

const wav = (n: number) => buildWav(Buffer.alloc(n, 0x55), WAV_FORMAT_MULAW);
const fullClips = (): ClipSet => new Map([
    ['notice', wav(100)], ['confirm_1', wav(10)], ['confirm_2', wav(12)], ['opt_out_done', wav(14)], ['no_input', wav(16)],
]);

let clock = new Date('2026-10-05T06:00:00Z').getTime(); // 11:30 IST
const now = () => new Date(clock);

interface Run {
    handle: RunHandle; port: number; fetch: ReturnType<typeof fakeFetch>; lines: string[];
    answerPath: string; statusPath: string; ringPath: string;
}

async function start(over: Partial<Parameters<typeof runTestCall>[0]> = {}, f = fakeFetch()): Promise<Run> {
    const lines: string[] = [];
    const handle = runTestCall({
        iOwnThisNumber: true, env: ENV, clips: fullClips(), audioLabel: 'test', port: 0, now, key: KEY,
        fetchImpl: f.impl, sink: (l) => lines.push(l), maxDurationMs: 5000, ...over,
    });
    const port = await handle.ready;
    // wait for the dial to reach the fake provider
    for (let i = 0; i < 200 && !lines.some((l) => l.includes('"dial_result"')) && port > 0; i++) await new Promise((r) => setTimeout(r, 5));
    const body = f.dials()[0]?.body as Record<string, string> | undefined;
    return {
        handle, port, fetch: f, lines,
        answerPath: body ? localPath(body.answer_url) : '',
        statusPath: body ? localPath(body.hangup_url) : '',
        ringPath: body ? localPath(body.ring_url) : '',
    };
}

const FORM_CT = { CallUUID: 'call-xyz', To: OTHER, From: '+911234567890' };

async function answer(r: Run) {
    const res = await request(r.port, 'POST', r.answerPath, FORM_CT);
    const root = parseXml(res.text);
    const gather = root.children.find((c) => c.name === 'Gather')!;
    return { res, root, gatherPath: localPath(gather.attrs.action), audioPath: localPath(gather.children[0].text) };
}

beforeEach(() => { clock = new Date('2026-10-05T06:00:00Z').getTime(); });

describe('happy path', () => {
    it('dials ONLY TEST_PHONE_E164, once; answer -> digit 1 -> confirm -> hangup -> server shuts down', async () => {
        const r = await start();
        expect(r.fetch.dials()).toHaveLength(1);
        const d = r.fetch.dials()[0];
        expect(d.url).toMatch(/\/Account\/.+\/Call\/$/);
        expect(d.body).toMatchObject({ to: '919876543210', answer_method: 'POST', ring_timeout: 30 });
        expect(String(d.body!.answer_url)).toMatch(/^https:\/\/tunnel\.example\.com\/answer\?t=/);
        expect(String(d.body!.hangup_url)).toContain('kind=hangup');

        // crafted request carrying another number: ignored everywhere
        const a = await answer(r);
        expect(a.res.status).toBe(200);
        expect(a.res.headers['content-type']).toMatch(/xml/);
        expect(a.res.text).not.toContain('9111111111');

        const audio = await request(r.port, 'GET', a.audioPath);
        expect(audio.status).toBe(200);
        expect(audio.headers['content-type']).toBe('audio/wav');
        expect(Number(audio.headers['content-length'])).toBe(audio.body.length);
        expect(audio.body.length).toBe(fullClips().get('notice')!.length);

        const g = await request(r.port, 'POST', a.gatherPath, { Digits: '1', To: OTHER, CallUUID: 'call-xyz' });
        const gx = parseXml(g.text);
        expect(gx.children.map((c) => c.name)).toEqual(['Play', 'Hangup']);
        expect(gx.children[0].text).toContain('/audio/confirm_1.wav');

        const ring = await request(r.port, 'GET', `${r.ringPath}&CallStatus=ringing`);
        expect(ring.status).toBe(200);
        const st = await request(r.port, 'POST', r.statusPath, { CallUUID: 'call-xyz', Duration: '14', HangupCause: 'NORMAL_CLEARING' });
        expect(st.text).toBe('<Response/>');

        const result = await r.handle.done;
        expect(result.outcome).toBe('completed');
        expect(result.state.digit).toBe('1');
        expect(result.state.answered).toBe(true);
        expect(result.state.hangupCause).toBe('NORMAL_CLEARING');
        expect(result.summary).toContain('digit pressed:      1');
        expect(r.fetch.dials()).toHaveLength(1); // still exactly one call
        expect(r.fetch.hangups()).toHaveLength(0); // already hung up by the provider

        const types = result.events.map((e) => e.type);
        for (const t of ['dial_requested', 'dial_result', 'answer_webhook', 'audio_served', 'gather_webhook', 'status_webhook', 'shutdown']) {
            expect(types).toContain(t);
        }
        const gEv = result.events.find((e) => e.type === 'gather_webhook')!;
        expect(gEv.digit).toBe('1');
        expect(gEv.rawFieldNames).toEqual(['CallUUID', 'Digits', 'To']);
        // The server is shut down: further connections fail.
        await expect(request(r.port, 'GET', '/answer')).rejects.toBeDefined();
    });

    it.each([['2', 'confirm_2'], ['9', 'opt_out_done']])('digit %s routes to %s', async (digit, clip) => {
        const r = await start();
        const a = await answer(r);
        const g = await request(r.port, 'GET', `${a.gatherPath}&digits=${digit}`); // GET + lowercase name
        expect(parseXml(g.text).children[0].text).toContain(`/audio/${clip}.wav`);
        r.handle.abort('test');
        const res = await r.handle.done;
        expect(res.state.digit).toBe(digit);
    });

    it('invalid digit repeats the Gather once, then no_input + Hangup; empty counts as invalid', async () => {
        const r = await start();
        const a = await answer(r);
        const first = parseXml((await request(r.port, 'POST', a.gatherPath, { Digits: '5' })).text);
        expect(first.children.map((c) => c.name)).toEqual(['Gather', 'Play', 'Hangup']);
        const second = parseXml((await request(r.port, 'POST', a.gatherPath, {})).text);
        expect(second.children.map((c) => c.name)).toEqual(['Play', 'Hangup']);
        expect(second.children[0].text).toContain('no_input.wav');
        r.handle.abort('test');
        const res = await r.handle.done;
        expect(res.state.digit).toBeNull();
        expect(res.summary).toContain('invalid (5)');
    });

    it('records raw param names (not values) for the paste-back', async () => {
        const r = await start();
        const a = await answer(r);
        await request(r.port, 'POST', a.gatherPath, { Digit: '1', Weird_Field: 'v' });
        r.handle.abort('test');
        const res = await r.handle.done;
        expect(res.state.rawNames.gather.has('Weird_Field')).toBe(true);
        expect(res.summary).toContain('Weird_Field');
        expect(res.summary).not.toContain('"v"');
    });
});

describe('token enforcement on every route', () => {
    it('missing / garbage / expired / wrong-domain tokens: 403 + <Response/>, nothing leaks', async () => {
        const r = await start();
        const a = await answer(r);
        const wrongDomain = mintToken(KEY, TESTCALL_DOMAINS.status, 'x', clock);
        const probes: [string, string, string][] = [];
        for (const route of ['/answer', '/gather', '/status?kind=hangup', '/audio/notice.wav']) {
            const sep = route.includes('?') ? '&' : '?';
            probes.push([route, '', route]);
            probes.push([route, 'garbage', `${route}${sep}t=garbage`]);
            probes.push([route, 'wrongdomain', `${route}${sep}t=${wrongDomain}`]);
        }
        // answer token used on gather / audio, and gather token used on answer
        const answerTok = new URL(r.answerPath, 'http://x').searchParams.get('t')!;
        probes.push(['/gather', 'answer-token', `/gather?t=${answerTok}`]);
        probes.push(['/audio/notice.wav', 'answer-token', `/audio/notice.wav?t=${answerTok}`]);
        probes.push(['/answer', 'gather-token', `/answer?t=${new URL(a.gatherPath, 'http://x').searchParams.get('t')}`]);
        for (const method of ['GET', 'POST']) {
            for (const [, , p] of probes) {
                const res = await request(r.port, method, p, method === 'POST' ? { Digits: '1' } : null);
                expect([method, p, res.status]).toEqual([method, p, 403]);
                expect(res.text).toBe('<Response/>');
            }
        }
        // nothing was recorded as a real step
        const st = await request(r.port, 'POST', '/status?kind=hangup', { Duration: '1' });
        expect(st.status).toBe(403);
        r.handle.abort('test');
        const res = await r.handle.done;
        expect(res.state.digit).toBeNull();
        expect(res.state.hangupSeen).toBe(false);
        expect(res.state.audioFetched.size).toBe(0);
        expect(res.events.filter((e) => e.type === 'auth_failed').length).toBeGreaterThan(20);
    });

    it('expired token (clock moved past TTL) is refused on every route', async () => {
        const r = await start();
        const a = await answer(r);
        clock += 11 * 60 * 1000;
        // still inside the calling window: 11:41 IST, so only the TTL can be the reason
        for (const p of [r.answerPath, a.gatherPath, a.audioPath, r.statusPath]) {
            const res = await request(r.port, 'POST', p, { Digits: '1' });
            expect([p.split('?')[0], res.status]).toEqual([p.split('?')[0], 403]);
        }
        r.handle.abort('test');
        await r.handle.done;
    });

    it('unknown clip names and path traversal never touch the filesystem', async () => {
        const r = await start();
        const a = await answer(r);
        const t = new URL(a.audioPath, 'http://x').searchParams.get('t');
        for (const name of ['nope.wav', '..%2F..%2Fetc%2Fpasswd', '%2e%2e/secret']) {
            const res = await request(r.port, 'GET', `/audio/${name}?t=${t}`);
            expect(res.status).toBe(404);
        }
        r.handle.abort('test');
        await r.handle.done;
    });
});

describe('calling window', () => {
    it('refuses to dial outside 09:00-21:00 IST, no fetch, no server needed', async () => {
        clock = new Date('2026-10-05T16:00:00Z').getTime(); // 21:30 IST
        const f = fakeFetch();
        const handle = runTestCall({ iOwnThisNumber: true, env: ENV, clips: fullClips(), audioLabel: 't', port: 0, now, key: KEY, fetchImpl: f.impl, sink: () => {} });
        const res = await handle.done;
        expect(res.outcome).toBe('refused');
        expect(res.guards.find((g) => g.guard === 'calling_window')!.ok).toBe(false);
        expect(f.calls).toHaveLength(0);
    });

    it('re-checks inside /answer: window closes between dial and answer -> <Response/> and a logged block', async () => {
        clock = new Date('2026-10-05T15:29:30Z').getTime(); // 20:59:30 IST, dial allowed
        const r = await start();
        expect(r.fetch.dials()).toHaveLength(1);
        clock = new Date('2026-10-05T15:31:00Z').getTime(); // 21:01 IST, token (600 s TTL) still valid
        const res = await request(r.port, 'POST', r.answerPath, FORM_CT);
        expect(res.status).toBe(200);
        expect(res.text).toBe('<Response/>');
        r.handle.abort('test');
        const out = await r.handle.done;
        const ev = out.events.find((e) => e.type === 'answer_webhook')!;
        expect(ev.blocked).toBe('outside_calling_window');
        expect(out.state.answered).toBe(false);
    });
});

describe('dial-time guards refuse (nothing is dialled)', () => {
    const cases: [string, Partial<Parameters<typeof runTestCall>[0]>, string][] = [
        ['no --i-own-this-number flag', { iOwnThisNumber: false }, 'flag'],
        ['TEST_PHONE_E164 unset', { env: { ...ENV, TEST_PHONE_E164: '' } }, 'test_phone'],
        ['synthetic +915 number', { env: { ...ENV, TEST_PHONE_E164: '+915123456789' } }, 'test_phone'],
        ['non-E.164 number', { env: { ...ENV, TEST_PHONE_E164: '98765 43210' } }, 'test_phone'],
        ['http base URL', { env: { ...ENV, PUBLIC_BASE_URL: 'http://tunnel.example.com' } }, 'base_url'],
        ['http localhost base URL (real run)', { env: { ...ENV, PUBLIC_BASE_URL: 'http://localhost:8787' } }, 'base_url'],
        ['missing Vobiz credentials', { env: { ...ENV, VOBIZ_AUTH_TOKEN: '' } }, 'vobiz_config'],
    ];
    it.each(cases)('%s', async (_name, over, guard) => {
        const f = fakeFetch();
        const handle = runTestCall({ iOwnThisNumber: true, env: ENV, clips: fullClips(), audioLabel: 't', port: 0, now, fetchImpl: f.impl, sink: () => {}, ...over });
        const res = await handle.done;
        expect(res.outcome).toBe('refused');
        expect(res.guards.filter((g) => !g.ok).map((g) => g.guard)).toContain(guard);
        expect(f.calls).toHaveLength(0);
        expect(await handle.ready).toBe(-1);
    });
});

describe('single call per run, no retries', () => {
    it('provider rejection -> dial_failed with the category, exactly one POST', async () => {
        const f = fakeFetch({ dialStatus: 500 });
        const r = await start({}, f);
        const res = await r.handle.done;
        expect(res.outcome).toBe('dial_failed');
        expect(res.state.dialCategory).toBe('provider_rejected');
        expect(f.dials()).toHaveLength(1);
        await new Promise((x) => setTimeout(x, 50));
        expect(f.dials()).toHaveLength(1); // no retry
        expect(res.summary).toContain('provider_rejected');
        expect(res.events.find((e) => e.type === 'dial_result')).toMatchObject({ ok: false, category: 'provider_rejected', status: 500 });
    });

    it('a completed run never dials again even if webhooks keep arriving', async () => {
        const r = await start();
        const a = await answer(r);
        await request(r.port, 'POST', a.gatherPath, { Digits: '1' });
        await request(r.port, 'POST', r.statusPath, { Duration: '3', HangupCause: 'x' });
        await r.handle.done;
        expect(r.fetch.dials()).toHaveLength(1);
    });
});

describe('shutdown, Ctrl-C and timeout', () => {
    it('abort (Ctrl-C / SIGTERM path) hangs up the known call uuid then shuts down', async () => {
        const r = await start();
        await answer(r); // learns CallUUID from the webhook
        r.handle.abort('SIGINT');
        const res = await r.handle.done;
        expect(res.outcome).toBe('aborted');
        expect(r.fetch.hangups()).toHaveLength(1);
        expect(r.fetch.hangups()[0].url).toMatch(/\/Call\/call-xyz\/$/);
        expect(res.events.map((e) => e.type)).toEqual(expect.arrayContaining(['hangup_requested', 'shutdown']));
    });

    it('abort with only the dial request uuid known still hangs up', async () => {
        const r = await start();
        r.handle.abort('SIGTERM');
        await r.handle.done;
        expect(r.fetch.hangups()[0].url).toMatch(/\/Call\/req-uuid-1\/$/);
    });

    it('max-duration timeout hangs up and shuts the server down', async () => {
        const r = await start({ maxDurationMs: 60 });
        const res = await r.handle.done;
        expect(res.outcome).toBe('timeout');
        expect(r.fetch.hangups()).toHaveLength(1);
        await expect(request(r.port, 'GET', '/answer')).rejects.toBeDefined();
    });

    it('abort before any call uuid is known does not call hangup', async () => {
        const f = fakeFetch({ requestUuid: '' });
        const r = await start({}, f);
        r.handle.abort('SIGINT');
        await r.handle.done;
        expect(f.hangups()).toHaveLength(0);
    });
});

describe('secrets never reach logs, events or the summary', () => {
    it('canary auth id / token / signing key / tokens / full phone appear nowhere', async () => {
        const r = await start();
        const a = await answer(r);
        await request(r.port, 'POST', a.gatherPath, { Digits: '1', Authorization: CANARY_TOKEN });
        await request(r.port, 'POST', r.statusPath, { Duration: '2', HangupCause: `x-${CANARY_TOKEN}` });
        const res = await r.handle.done;
        const everything = [r.lines.join('\n'), JSON.stringify(res.events), res.summary].join('\n');
        for (const secret of [CANARY_TOKEN, CANARY_ID, KEY, PHONE, '9876543210']) expect(everything).not.toContain(secret);
        for (const t of [r.answerPath, a.gatherPath, a.audioPath, r.statusPath]) {
            expect(everything).not.toContain(new URL(t, 'http://x').searchParams.get('t'));
        }
        // and the events are still useful
        expect(r.lines.length).toBeGreaterThan(5);
        expect(everything).toContain('"toLast4":"3210"');
    });
});
