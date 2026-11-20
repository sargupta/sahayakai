/**
 * @jest-environment node
 *
 * The call-quality bench, offline: fake engines and a fake network. The live run is
 * scripts/sampark/call-quality-bench.ts.
 */
import { addPhoneNoise, runBench, summarise, type SttEngine, type TtsEngine } from '@/lib/sampark/quality/bench';
import { BENCH_CORPUS } from '@/lib/sampark/quality/corpus';
import { elevenLabsScribe, elevenLabsVoice, pcmWavToTelephony, sarvamVoice } from '@/lib/sampark/quality/engines';
import { missingWords, percentile, wordErrorRate } from '@/lib/sampark/quality/metrics';
import { renderListeningSheet, renderReport, runToJson } from '@/lib/sampark/quality/report';
import { mulawEncode } from '@/lib/sampark/speech/dsp';
import { buildMulawWav, mulawSamples, parseWav } from '@/lib/sampark/speech/wav';
import { PARENT_LANGUAGE_INFO } from '@/lib/sampark/languages';
import type { ParentLanguage } from '@/types/sampark';

/** A tone as 8 kHz μ-law; `tag` makes each clip unique so the fake recogniser can look it up. */
function tone(seconds: number, tag: number): Buffer {
    const n = Math.round(seconds * 8000);
    const s = Buffer.alloc(n);
    for (let i = 0; i < n; i++) s[i] = mulawEncode(Math.round(8000 * Math.sin((2 * Math.PI * (300 + tag) * i) / 8000)));
    return buildMulawWav(s);
}

function pcmWav(rate: number, samples: number): Buffer {
    const data = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(10000 * Math.sin((2 * Math.PI * 440 * i) / rate)), i * 2);
    const h = Buffer.alloc(44);
    h.write('RIFF', 0, 'ascii');
    h.writeUInt32LE(36 + data.length, 4);
    h.write('WAVE', 8, 'ascii');
    h.write('fmt ', 12, 'ascii');
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20);
    h.writeUInt16LE(1, 22);
    h.writeUInt32LE(rate, 24);
    h.writeUInt32LE(rate * 2, 28);
    h.writeUInt16LE(2, 32);
    h.writeUInt16LE(16, 34);
    h.write('data', 36, 'ascii');
    h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
}

/** A world where every voice's audio is remembered, so a recogniser can "hear" the text back. */
function world() {
    let clock = 0;
    const spoken = new Map<string, string>();
    let tag = 0;
    const voice = (name: string, opts: { langs?: ParentLanguage[]; costMs?: number; fail?: boolean; streaming?: boolean } = {}): TtsEngine => ({
        name,
        streaming: !!opts.streaming,
        supports: (l) => (opts.langs ?? (Object.keys(PARENT_LANGUAGE_INFO) as ParentLanguage[])).includes(l),
        async synthesize(text) {
            if (opts.fail) throw new Error(`${name} is down`);
            clock += opts.costMs ?? 100;
            const wav = tone(0.5, ++tag);
            spoken.set(wav.toString('base64'), text);
            return { wav, ...(opts.streaming ? { firstAudioMs: 40 } : {}) };
        },
    });
    const recogniser = (name: string, opts: { garble?: (t: string) => string; langs?: ParentLanguage[]; costMs?: number } = {}): SttEngine => ({
        name,
        supports: (l) => (opts.langs ?? (Object.keys(PARENT_LANGUAGE_INFO) as ParentLanguage[])).includes(l),
        async transcribe(wav) {
            clock += opts.costMs ?? 50;
            const text = spoken.get(wav.toString('base64')) ?? '';
            return opts.garble ? opts.garble(text) : text;
        },
    });
    return { voice, recogniser, now: () => clock };
}

describe('metrics', () => {
    it('word error rate uses the render gate normalisation', () => {
        expect(wordErrorRate('Yes, I will come on Saturday.', 'yes i will come on saturday', 'English')).toBe(0);
        expect(wordErrorRate('Yes, I will come on Saturday.', 'yes i will come on sunday', 'English')).toBeCloseTo(1 / 6);
        expect(wordErrorRate('शनिवार को', 'शनिवार को', 'Hindi')).toBe(0);
    });

    it('must-hear words are reported when lost', () => {
        expect(missingWords('yes I will come on Sunday', ['yes', 'Saturday'], 'English')).toEqual(['Saturday']);
        expect(missingWords('हाँ जी, मैं शनिवार को आऊँगा', ['हाँ', 'शनिवार'], 'Hindi')).toEqual([]);
    });

    it('percentile is nearest-rank and ignores non-finite values', () => {
        expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
        expect(percentile([5, 1, 3, 2, 4, NaN], 95)).toBe(5);
        expect(percentile([], 50)).toBeNull();
    });
});

describe('corpus', () => {
    it('covers every parent language, and every must-hear word is in its own sentence', () => {
        for (const language of Object.keys(PARENT_LANGUAGE_INFO) as ParentLanguage[]) {
            const c = BENCH_CORPUS[language];
            expect(c.agentLines.length).toBeGreaterThanOrEqual(3);
            expect(c.parentReplies.map((r) => r.intent)).toEqual(expect.arrayContaining(['yes', 'reschedule', 'callback', 'stop']));
            for (const item of [...c.agentLines, ...c.parentReplies]) {
                expect({ language, id: item.id, lost: missingWords(item.text, item.mustHear, language) }).toEqual({ language, id: item.id, lost: [] });
            }
        }
    });
});

describe('runBench', () => {
    it('times every voice and recogniser, scores what is heard, and keeps going past a failing engine', async () => {
        const w = world();
        const run = await runBench(
            {
                tts: [w.voice('good', { costMs: 300 }), w.voice('down', { fail: true }), w.voice('stream', { streaming: true, langs: ['English'] }), w.voice('hindi-only', { langs: ['Hindi'] })],
                stt: [w.recogniser('exact'), w.recogniser('deaf-to-saturday', { garble: (t) => t.replace(/Saturday/g, 'Sunday') })],
                replyVoice: () => w.voice('reply'),
                now: w.now,
            },
            { languages: ['English'], repeats: 2 },
        );

        const good = run.tts.filter((r) => r.engine === 'good');
        expect(good).toHaveLength(BENCH_CORPUS.English.agentLines.length);
        expect(good[0]).toMatchObject({ ok: true, totalMs: [300, 300], firstAudioMs: [300, 300], streaming: false });
        expect(good[0].durationSec).toBeCloseTo(0.5);
        expect(good[0].lufs).not.toBeNull();
        expect(run.tts.filter((r) => r.engine === 'down').every((r) => !r.ok && /down/.test(r.error ?? ''))).toBe(true);
        expect(run.tts.find((r) => r.engine === 'stream')?.firstAudioMs).toEqual([40, 40]);
        expect(run.skipped).toContainEqual({ stage: 'tts', language: 'English', engine: 'hindi-only', reason: 'language not supported' });

        const ptm = good.find((r) => r.itemId === 'ptm');
        expect(ptm?.heardBy.find((h) => h.engine === 'exact')).toMatchObject({ wer: 0, missing: [] });
        expect(ptm?.heardBy.find((h) => h.engine === 'deaf-to-saturday')?.missing).toEqual(['Saturday']);

        const replies = run.stt.filter((r) => r.engine === 'deaf-to-saturday');
        expect(replies).toHaveLength(BENCH_CORPUS.English.parentReplies.length);
        expect(replies.find((r) => r.itemId === 'yes')).toMatchObject({ ok: true, ms: [50, 50], missing: ['Saturday'] });
        expect(Object.keys(run.replyAudio)).toHaveLength(BENCH_CORPUS.English.parentReplies.length);

        const summary = summarise(run);
        const sGood = summary.tts.find((s) => s.engine === 'good');
        expect(sGood).toMatchObject({ items: 3, failed: 0, totalP50: 300, totalP95: 300, streaming: false });
        expect(summary.tts.find((s) => s.engine === 'down')).toMatchObject({ failed: 3, totalP50: null });
        const exact = summary.stt.find((s) => s.engine === 'exact');
        expect(exact).toMatchObject({ meanWer: 0, keyWordsOk: exact?.keyWordsOf, p50: 50 });
    });

    it('a language without a reply voice skips recognition for it, and says so', async () => {
        const w = world();
        const run = await runBench({ tts: [], stt: [w.recogniser('exact')], replyVoice: () => null, now: w.now }, { languages: ['Nepali'] });
        expect(run.stt).toEqual([]);
        expect(run.skipped).toContainEqual({ stage: 'reply', language: 'Nepali', engine: '-', reason: 'no reference voice for this language' });
    });
});

describe('phone noise', () => {
    it('is deterministic, keeps the length, and changes the audio', () => {
        const clean = tone(1, 1);
        const a = addPhoneNoise(clean, 10, 7);
        const b = addPhoneNoise(clean, 10, 7);
        expect(a.equals(b)).toBe(true);
        expect(mulawSamples(a).length).toBe(mulawSamples(clean).length);
        expect(a.equals(clean)).toBe(false);
    });
});

describe('report and listening sheet', () => {
    it('the listening sheet is blind: no engine name in the sheet, every clip in the key', async () => {
        const w = world();
        const run = await runBench({ tts: [w.voice('vendor-a'), w.voice('vendor-b')], stt: [w.recogniser('exact')], replyVoice: () => w.voice('reply'), now: w.now }, { languages: ['Hindi'], repeats: 1 });
        const { sheet, key, clips } = renderListeningSheet(run);
        expect(sheet).not.toMatch(/vendor-/);
        expect(clips).toHaveLength(run.tts.length);
        for (const c of clips) expect(key).toContain(c.id);
        const report = renderReport(run, summarise(run), { measuredFrom: 'test' });
        expect(report).toContain('| Hindi | vendor-a |');
        expect(report).toContain('Read this first');
        const json = JSON.parse(runToJson(run, summarise(run)));
        expect(json.tts[0].audio).toBeUndefined();
    });
});

describe('live adapters against a fake network', () => {
    const KEY = 'sk_secret_value_123';

    it('Sarvam: 16-bit PCM WAV → 8 kHz μ-law; the key never appears in an error', async () => {
        const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ audios: [pcmWav(24000, 24000).toString('base64')] }), { status: 200 }));
        const v = sarvamVoice({ getApiKey: async () => KEY, fetchImpl: fetchImpl as unknown as typeof fetch });
        const { wav } = await v.synthesize('नमस्ते', 'Hindi');
        expect(parseWav(wav)).toMatchObject({ audioFormat: 7, sampleRate: 8000, channels: 1 });
        expect(mulawSamples(wav).length).toBeCloseTo(8000, -2);
        const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
        expect(body).toMatchObject({ target_language_code: 'hi-IN', model: 'bulbul:v3' });
        expect(v.supports('Nepali')).toBe(false);

        const bad = sarvamVoice({ getApiKey: async () => KEY, fetchImpl: (async () => new Response(`invalid key ${KEY}`, { status: 403 })) as unknown as typeof fetch });
        await expect(bad.synthesize('x', 'English')).rejects.toThrow(/HTTP 403 invalid key \[redacted\]/);
    });

    it('ElevenLabs voice: first-audio time is measured at the first streamed chunk', async () => {
        let t = 0;
        const chunks = [Buffer.alloc(800, 0xff), Buffer.alloc(800, 0x7f)];
        const fetchImpl = jest.fn(async () => {
            t += 120; // request accepted
            let i = 0;
            // A streamed body: each read is a later chunk on the wire.
            const body = {
                getReader: () => ({
                    read: async () => {
                        if (i >= chunks.length) return { done: true, value: undefined };
                        if (i > 0) t += 300;
                        return { done: false, value: new Uint8Array(chunks[i++]) };
                    },
                }),
            };
            return { ok: true, status: 200, body } as unknown as Response;
        });
        const v = elevenLabsVoice({ getApiKey: async () => KEY, now: () => t, fetchImpl: fetchImpl as unknown as typeof fetch });
        const out = await v.synthesize('Hello', 'English');
        expect(out.firstAudioMs).toBe(120);
        expect(mulawSamples(out.wav).length).toBe(1600);
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toContain('output_format=ulaw_8000');
        expect((init.headers as Record<string, string>)['xi-api-key']).toBe(KEY);
        expect(v.supports('Bengali')).toBe(false);
    });

    it('ElevenLabs Scribe returns the text', async () => {
        const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ text: ' yes I will come ' }), { status: 200 }));
        const s = elevenLabsScribe({ getApiKey: async () => KEY, fetchImpl: fetchImpl as unknown as typeof fetch });
        await expect(s.transcribe(tone(0.2, 1), 'English')).resolves.toBe('yes I will come');
    });

    it('pcmWavToTelephony passes 8 kHz μ-law through and rejects other formats', () => {
        const mulaw = tone(0.1, 1);
        expect(pcmWavToTelephony(mulaw)).toBe(mulaw);
        const eightBit = pcmWav(8000, 10);
        eightBit.writeUInt16LE(8, 34);
        expect(() => pcmWavToTelephony(eightBit)).toThrow(/16-bit PCM/);
    });
});
