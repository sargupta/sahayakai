/**
 * @jest-environment node
 *
 * Test-call tool: pure functions. XML shape, WAV/mu-law, guards, parsing, tokens.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    buildAnswerXml, buildGatherResultXml, buildWav, createEventLog, dryRunReport, evaluateGuards,
    guardBaseUrl, guardFlag, guardTestPhone, guardWindow, loadClipDir, loadOpenerClips, main, mintToken,
    missingEnv, mulawToLinear, mulawToPcm16, parseArgs, parseCallId, parseGatherDigits, parseParams,
    parseWav, summarize, newRunState, TESTCALL_DOMAINS, ulawToWav, verifyToken, xmlEscape,
    WAV_FORMAT_MULAW, WAV_FORMAT_PCM,
} from '../../../../scripts/sampark/vobiz-test-call';
import { parseXml } from './helpers';

const IN_WINDOW = new Date('2026-10-05T06:00:00Z'); // 11:30 IST
const BEFORE_OPEN = new Date('2026-10-05T03:00:00Z'); // 08:30 IST
const AFTER_CLOSE = new Date('2026-10-05T15:30:00Z'); // 21:00 IST exactly = closed
const GOOD_ENV = {
    TEST_PHONE_E164: '+919876543210', PUBLIC_BASE_URL: 'https://t.example.com',
    VOBIZ_AUTH_ID: 'MA_AUTH', VOBIZ_AUTH_TOKEN: 'tok-secret', VOBIZ_FROM_NUMBER: '+911234567890',
} as NodeJS.ProcessEnv;

const KEY = 'k'.repeat(40);
const opts = (clips: string[]) => ({
    baseUrl: 'https://t.example.com',
    tokens: { gather: mintToken(KEY, TESTCALL_DOMAINS.gather, 'run1', IN_WINDOW.getTime()), audio: mintToken(KEY, TESTCALL_DOMAINS.audio, 'run1', IN_WINDOW.getTime()) },
    clips: new Set(clips),
});
const ALL = ['notice', 'confirm_1', 'confirm_2', 'opt_out_done', 'no_input'];

describe('XML matches the documented Vobiz shape', () => {
    it('answer: Response > Gather(action,method,numDigits,timeout) > Play, then Play no_input, Hangup', () => {
        const root = parseXml(buildAnswerXml(opts(ALL)));
        expect(root.name).toBe('Response');
        expect(root.children.map((c) => c.name)).toEqual(['Gather', 'Play', 'Hangup']);
        const [gather, noInput] = root.children;
        expect(Object.keys(gather.attrs).sort()).toEqual(['action', 'method', 'numDigits', 'timeout']);
        expect(gather.attrs.method).toBe('POST');
        expect(gather.attrs.numDigits).toBe('1');
        expect(gather.attrs.timeout).toBe('10');
        expect(gather.attrs.action).toMatch(/^https:\/\/t\.example\.com\/gather\?t=run1\.\d+\./);
        expect(gather.children.map((c) => c.name)).toEqual(['Play']);
        expect(gather.children[0].text).toMatch(/^https:\/\/t\.example\.com\/audio\/notice\.wav\?t=/);
        expect(noInput.text).toMatch(/\/audio\/no_input\.wav\?t=/);
    });

    it('opener-only: no no_input Play is invented', () => {
        const root = parseXml(buildAnswerXml(opts(['notice'])));
        expect(root.children.map((c) => c.name)).toEqual(['Gather', 'Hangup']);
    });

    it('escapes & in token URLs and special characters in attribute values', () => {
        const xml = buildAnswerXml({ ...opts(ALL), baseUrl: 'https://t.example.com/a?x=1&y=<2>' });
        expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
        expect(() => parseXml(xml)).not.toThrow();
        expect(xmlEscape(`a&b<c>"d"'e'`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;');
    });

    it.each([['1', 'confirm_1'], ['2', 'confirm_2'], ['9', 'opt_out_done']])('digit %s plays %s then hangs up', (d, clip) => {
        const root = parseXml(buildGatherResultXml(opts(ALL), d, 0));
        expect(root.children.map((c) => c.name)).toEqual(['Play', 'Hangup']);
        expect(root.children[0].text).toContain(`/audio/${clip}.wav?t=`);
    });

    it('opener-only: a valid digit just hangs up', () => {
        const root = parseXml(buildGatherResultXml(opts(['notice']), '1', 0));
        expect(root.children.map((c) => c.name)).toEqual(['Hangup']);
    });

    it('invalid digit: repeats the Gather ONCE, then no_input + Hangup', () => {
        const first = parseXml(buildGatherResultXml(opts(ALL), '5', 0));
        expect(first.children.map((c) => c.name)).toEqual(['Gather', 'Play', 'Hangup']);
        const second = parseXml(buildGatherResultXml(opts(ALL), '5', 1));
        expect(second.children.map((c) => c.name)).toEqual(['Play', 'Hangup']);
        expect(second.children[0].text).toContain('no_input.wav');
        const none = parseXml(buildGatherResultXml(opts(ALL), null, 1));
        expect(none.children.map((c) => c.name)).toEqual(['Play', 'Hangup']);
    });

    it('the strict parser actually rejects malformed XML (self-check)', () => {
        expect(() => parseXml('<Response><Play>a&b</Play></Response>')).toThrow();
        expect(() => parseXml('<Response><Play></Response>')).toThrow();
        expect(() => parseXml('<Response a=1/>')).toThrow();
    });
});

describe('WAV writer and mu-law decoding', () => {
    const ulaw = Buffer.from([0xff, 0x7f, 0x00, 0x80, 0xaa, 0x55, 0x10]); // odd length on purpose

    it('tag 7: valid RIFF, 8 kHz mono 8-bit, sizes correct, data preserved', () => {
        const wav = buildWav(ulaw, WAV_FORMAT_MULAW);
        expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
        expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
        const p = parseWav(wav);
        expect(p).toMatchObject({ formatTag: 7, channels: 1, sampleRate: 8000, bitsPerSample: 8, riffSizeOk: true });
        expect(Buffer.compare(p.data, ulaw)).toBe(0);
        expect(wav.length % 2).toBe(0); // padded to even
        expect(wav.indexOf('fact')).toBeGreaterThan(0);
    });

    it('tag 1: 16-bit PCM, data is twice as long, byteRate 16000', () => {
        const wav = ulawToWav(ulaw, true);
        const p = parseWav(wav);
        expect(p).toMatchObject({ formatTag: 1, channels: 1, sampleRate: 8000, bitsPerSample: 16, riffSizeOk: true });
        expect(p.data.length).toBe(ulaw.length * 2);
        expect(wav.readUInt32LE(28)).toBe(16000);
        expect(wav.readUInt16LE(32)).toBe(2);
        expect(WAV_FORMAT_PCM).toBe(1);
    });

    it('mu-law decode matches G.711 known values', () => {
        expect(mulawToLinear(0xff)).toBe(0);
        expect(mulawToLinear(0x7f)).toBe(0);
        expect(mulawToLinear(0x00)).toBe(-32124);
        expect(mulawToLinear(0x80)).toBe(32124);
        expect(mulawToLinear(0xaa)).toBe(5372);
        expect(mulawToLinear(0x2a)).toBe(-5372);
        const pcm = mulawToPcm16(Uint8Array.from([0x80, 0x00]));
        expect(pcm.readInt16LE(0)).toBe(32124);
        expect(pcm.readInt16LE(2)).toBe(-32124);
    });

    it('parseWav rejects non-WAV input', () => {
        expect(() => parseWav(Buffer.from('not a wav file at all'))).toThrow();
    });

    it('wraps the real repo opener (Hindi) as a tag-7 WAV and as PCM', () => {
        const mu = loadOpenerClips('Hindi', false).get('notice')!;
        const pcm = loadOpenerClips('Hindi', true).get('notice')!;
        expect(parseWav(mu)).toMatchObject({ formatTag: 7, sampleRate: 8000, riffSizeOk: true });
        expect(parseWav(pcm).data.length).toBe(parseWav(mu).data.length * 2);
    });

    it('Nepali has no opener: clear error pointing at --clips', () => {
        expect(() => loadOpenerClips('Nepali', false)).toThrow(/no pre-recorded opener for Nepali.*--clips/);
    });

    it('loadClipDir requires notice.wav and validates clips', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clips-'));
        expect(() => loadClipDir(dir, false)).toThrow(/notice\.wav/);
        fs.writeFileSync(path.join(dir, 'notice.wav'), ulawToWav(ulaw, false));
        fs.writeFileSync(path.join(dir, 'confirm_1.wav'), ulawToWav(ulaw, false));
        const set = loadClipDir(dir, true);
        expect([...set.keys()].sort()).toEqual(['confirm_1', 'notice']);
        expect(parseWav(set.get('notice')!).formatTag).toBe(1);
        fs.writeFileSync(path.join(dir, 'no_input.wav'), 'garbage');
        expect(() => loadClipDir(dir, false)).toThrow();
    });
});

describe('guards (each refuses)', () => {
    it('flag', () => {
        expect(guardFlag(false).ok).toBe(false);
        expect(guardFlag(true).ok).toBe(true);
    });
    it('TEST_PHONE_E164: unset, malformed, synthetic +915 all refused; real mobile accepted', () => {
        expect(guardTestPhone(undefined).ok).toBe(false);
        expect(guardTestPhone('').ok).toBe(false);
        expect(guardTestPhone('9876543210').ok).toBe(false);
        expect(guardTestPhone('+91 98765 43210').ok).toBe(false);
        const syn = guardTestPhone('+915123456789');
        expect(syn.ok).toBe(false);
        expect(syn.reason).toMatch(/synthetic/);
        expect(guardTestPhone('+919876543210').ok).toBe(true);
    });
    it('PUBLIC_BASE_URL must be https; http only for localhost dry run', () => {
        expect(guardBaseUrl(undefined).ok).toBe(false);
        expect(guardBaseUrl('http://abc.trycloudflare.com').ok).toBe(false);
        expect(guardBaseUrl('http://abc.trycloudflare.com', true).ok).toBe(false);
        expect(guardBaseUrl('http://localhost:8787').ok).toBe(false);
        expect(guardBaseUrl('http://localhost:8787', true).ok).toBe(true);
        expect(guardBaseUrl('https://abc.trycloudflare.com').ok).toBe(true);
        expect(guardBaseUrl('not a url').ok).toBe(false);
    });
    it('calling window: 09:00 inclusive, 21:00 exclusive IST', () => {
        expect(guardWindow(BEFORE_OPEN).ok).toBe(false);
        expect(guardWindow(AFTER_CLOSE).ok).toBe(false);
        expect(guardWindow(IN_WINDOW).ok).toBe(true);
    });
    it('evaluateGuards reports every failure, ok only when all pass', () => {
        expect(evaluateGuards({ flag: true, env: GOOD_ENV, now: IN_WINDOW }).ok).toBe(true);
        const bad = evaluateGuards({ flag: false, env: {}, now: AFTER_CLOSE });
        expect(bad.ok).toBe(false);
        expect(bad.results.filter((r) => !r.ok).map((r) => r.guard).sort())
            .toEqual(['base_url', 'calling_window', 'flag', 'test_phone', 'vobiz_config']);
    });
    it('missing env forces dry run in main(): returns 0 and dials nothing', async () => {
        expect(missingEnv({})).toHaveLength(5);
        const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
        try {
            const code = await main(['--i-own-this-number', '--use-openers', 'Hindi'], {});
            expect(code).toBe(0);
            const printed = write.mock.calls.map((c) => String(c[0])).join('');
            expect(printed).toMatch(/Falling back to --dry-run/);
            expect(printed).toMatch(/would dial: NO/);
        } finally { write.mockRestore(); }
    });
    it('dryRunReport prints the XML and the guard verdicts', () => {
        const a = parseArgs(['--i-own-this-number', '--use-openers', 'Hindi', '--dry-run']);
        const rep = dryRunReport(a, GOOD_ENV, loadOpenerClips('Hindi', false), IN_WINDOW);
        expect(rep).toMatch(/\[pass\] calling_window/);
        expect(rep).toMatch(/would dial: YES/);
        expect(rep).toContain('<Response><Gather action="https://t.example.com/gather?t=');
    });
});

describe('request parsing', () => {
    it('digits: Digits / digits / Digit, keypad characters only', () => {
        expect(parseGatherDigits({ Digits: '1' })).toBe('1');
        expect(parseGatherDigits({ digits: '2' })).toBe('2');
        expect(parseGatherDigits({ Digit: '9' })).toBe('9');
        expect(parseGatherDigits({ Digits: ' 1 ' })).toBe('1');
        expect(parseGatherDigits({ Digits: '' })).toBeNull();
        expect(parseGatherDigits({ Other: '1' })).toBeNull();
        expect(parseGatherDigits({ Digits: '<script>' })).toBeNull();
    });
    it('call id: CallUUID / call_uuid / CallSid; rejects odd characters', () => {
        expect(parseCallId({ CallUUID: 'abc-1' })).toBe('abc-1');
        expect(parseCallId({ call_uuid: 'abc-2' })).toBe('abc-2');
        expect(parseCallId({ CallSid: 'abc-3' })).toBe('abc-3');
        expect(parseCallId({ CallUUID: '../../x' })).toBeNull();
        expect(parseCallId({})).toBeNull();
    });
    it('parseParams merges query, form body and JSON body', () => {
        const u = new URL('http://x/gather?t=tok&a=1');
        expect(parseParams(u, 'Digits=5&b=2', 'application/x-www-form-urlencoded')).toEqual({ t: 'tok', a: '1', Digits: '5', b: '2' });
        expect(parseParams(u, '{"Digits":"7","n":3}', 'application/json')).toEqual({ t: 'tok', a: '1', Digits: '7', n: '3' });
        expect(parseParams(u, '{bad json', 'application/json')).toEqual({ t: 'tok', a: '1' });
    });
});

describe('tokens: domain-separated, short-lived, same wire format as vobiz/tokens.ts', () => {
    const now = IN_WINDOW.getTime();
    it('verifies for its own domain only', () => {
        const t = mintToken(KEY, TESTCALL_DOMAINS.gather, 'run1', now);
        expect(verifyToken(KEY, TESTCALL_DOMAINS.gather, t, now)).toBe('run1');
        expect(verifyToken(KEY, TESTCALL_DOMAINS.answer, t, now)).toBeNull();
        expect(verifyToken(KEY, TESTCALL_DOMAINS.audio, t, now)).toBeNull();
        expect(verifyToken(KEY, TESTCALL_DOMAINS.status, t, now)).toBeNull();
    });
    it('rejects expired, wrong key, tampered, malformed, empty', () => {
        const t = mintToken(KEY, TESTCALL_DOMAINS.answer, 'run1', now, 60);
        expect(verifyToken(KEY, TESTCALL_DOMAINS.answer, t, now + 59_000)).toBe('run1');
        expect(verifyToken(KEY, TESTCALL_DOMAINS.answer, t, now + 61_000)).toBeNull();
        expect(verifyToken('z'.repeat(40), TESTCALL_DOMAINS.answer, t, now)).toBeNull();
        expect(verifyToken(KEY, TESTCALL_DOMAINS.answer, t.replace('run1', 'run2'), now)).toBeNull();
        expect(verifyToken(KEY, TESTCALL_DOMAINS.answer, 'a.b', now)).toBeNull();
        expect(verifyToken(KEY, TESTCALL_DOMAINS.answer, '', now)).toBeNull();
        expect(verifyToken(KEY, TESTCALL_DOMAINS.answer, null, now)).toBeNull();
    });
    it('default TTL is short (<= 10 minutes)', () => {
        const t = mintToken(KEY, TESTCALL_DOMAINS.answer, 'r', now);
        expect(Number(t.split('.')[1]) - Math.floor(now / 1000)).toBeLessThanOrEqual(600);
    });
});

describe('event log and summary never carry secrets', () => {
    it('scrubs known secrets and token-shaped strings', () => {
        const lines: string[] = [];
        const tok = mintToken(KEY, TESTCALL_DOMAINS.gather, 'run1', IN_WINDOW.getTime());
        const log = createEventLog(() => IN_WINDOW, ['CANARY-SECRET-123'], (l) => lines.push(l));
        log.log('x', { a: 'has CANARY-SECRET-123 inside', url: `https://h/gather?t=${tok}` });
        expect(lines.join('')).not.toContain('CANARY-SECRET-123');
        expect(lines.join('')).not.toContain(tok);
    });
    it('summary has the PASTE THIS BACK block and valid JSON', () => {
        const s = newRunState();
        s.answered = true; s.digit = '1'; s.rawNames.gather.add('Digits');
        const out = summarize(s, [], 'completed', 'openers:Hindi:mulaw');
        expect(out).toContain('PASTE THIS BACK');
        const json = out.split('----- PASTE THIS BACK -----')[1].split('----- END -----')[0];
        expect(JSON.parse(json).rawParamNames.gather).toEqual(['Digits']);
    });
});
