/**
 * @jest-environment node
 *
 * The Vertex AI Gemini-TTS route (voice phase, CONVERSATION_PLAN.md §6.1):
 * Bengali moved here from Chirp 3 HD because Cloud TTS refuses `bn-IN` for
 * every Gemini model. These tests pin the request (text, voice, language code
 * and nothing else), the PCM handling (rate from the MIME type, every part in
 * order, 8 kHz μ-law out), the 180 s timeout and the error paths.
 */

import { BENGALI_VERTEX_TTS_MODEL, languageInfo, SCHOOL_VOICE, type SpeechEngineConfig } from '@/lib/sampark/languages';
import { mulawDecode } from '@/lib/sampark/speech/dsp';
import {
    buildSynthesizeRequest,
    buildVertexTtsRequest,
    createGoogleSynthesizer,
    pcmRateFromMimeType,
    VERTEX_TTS_TIMEOUT_MS,
    vertexResponseToTelephonyWav,
    vertexTtsUrl,
} from '@/lib/sampark/speech/google-speech';
import { mulawSamples, parseWav } from '@/lib/sampark/speech/wav';

import { fakeFetch, fakeMulawWav } from './helpers';

const token = async () => 'test-token';
const bengali = languageInfo('Bengali').speech;
const TEXT = 'বৃহস্পতিবার সকাল সাড়ে দশটায় প্যারেন্ট টিচার মিটিং আছে।';

/** Little-endian 16-bit PCM of a sine (silence when hz is 0), base64 — what Vertex puts in inlineData.data. */
function pcmBase64(seconds: number, rate: number, hz = 1000, amplitude = 8000): string {
    const n = Math.round(seconds * rate);
    const buf = Buffer.alloc(n * 2);
    for (let i = 0; i < n; i++) buf.writeInt16LE(hz ? Math.round(amplitude * Math.sin((2 * Math.PI * hz * i) / rate)) : 0, i * 2);
    return buf.toString('base64');
}

function audioPart(seconds: number, rate = 24_000, hz = 1000) {
    return { inlineData: { mimeType: `audio/L16;codec=pcm;rate=${rate}`, data: pcmBase64(seconds, rate, hz) } };
}

function vertexJson(...parts: unknown[]) {
    return { candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] };
}

function rms(samples: ArrayLike<number>, from: number, to: number): number {
    let s = 0;
    for (let i = from; i < to; i++) s += samples[i] * samples[i];
    return Math.sqrt(s / (to - from));
}

describe('Vertex Gemini-TTS request', () => {
    it('posts the text, voice and bn-IN to the pinned model on Vertex generateContent, and nothing else', async () => {
        const { impl, requests } = fakeFetch(() => ({ json: vertexJson(audioPart(1.5)) }));
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token, project: 'proj-x' });
        await synth.synthesize({ text: TEXT, language: 'Bengali', speech: bengali, delivery: 'styled' });

        expect(requests).toHaveLength(1);
        expect(requests[0].url).toBe(
            `https://aiplatform.googleapis.com/v1/projects/proj-x/locations/global/publishers/google/models/${BENGALI_VERTEX_TTS_MODEL}:generateContent`,
        );
        expect(requests[0].headers.Authorization).toBe('Bearer test-token');
        expect(requests[0].headers['x-goog-user-project']).toBe('proj-x');
        expect(requests[0].body).toEqual({
            contents: [{ role: 'user', parts: [{ text: TEXT }] }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: SCHOOL_VOICE } }, languageCode: 'bn-IN' },
            },
        });
    });

    it('sends the identical body for styled and plain delivery (no style prompt on this route)', async () => {
        const { impl, requests } = fakeFetch(() => ({ json: vertexJson(audioPart(0.2)) }));
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token });
        await synth.synthesize({ text: TEXT, language: 'Bengali', speech: bengali, delivery: 'styled' });
        await synth.synthesize({ text: TEXT, language: 'Bengali', speech: bengali, delivery: 'plain' });
        await synth.synthesize({ text: TEXT, language: 'Bengali', speech: bengali });
        expect(requests[1].body).toEqual(requests[0].body);
        expect(requests[2].body).toEqual(requests[0].body);
        expect(requests[0].body).toEqual(buildVertexTtsRequest(TEXT, bengali));
    });

    it('uses a regional host when SAMPARK_TTS_VERTEX_LOCATION names a region', async () => {
        const prev = process.env.SAMPARK_TTS_VERTEX_LOCATION;
        process.env.SAMPARK_TTS_VERTEX_LOCATION = 'us-central1';
        try {
            const { impl, requests } = fakeFetch(() => ({ json: vertexJson(audioPart(0.2)) }));
            await createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token, project: 'p' }).synthesize({ text: TEXT, language: 'Bengali', speech: bengali });
            expect(requests[0].url).toBe(
                `https://us-central1-aiplatform.googleapis.com/v1/projects/p/locations/us-central1/publishers/google/models/${BENGALI_VERTEX_TTS_MODEL}:generateContent`,
            );
        } finally {
            if (prev === undefined) delete process.env.SAMPARK_TTS_VERTEX_LOCATION;
            else process.env.SAMPARK_TTS_VERTEX_LOCATION = prev;
        }
        expect(vertexTtsUrl('p', 'm', 'global')).toBe('https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/m:generateContent');
    });

    it('refuses a Vertex voice without a pinned model before sending anything, and keeps the routes apart', async () => {
        const { impl, requests } = fakeFetch(() => ({ json: vertexJson(audioPart(0.2)) }));
        const unpinned: SpeechEngineConfig = { ...bengali, model: null };
        await expect(createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token }).synthesize({ text: TEXT, language: 'Bengali', speech: unpinned })).rejects.toThrow(
            /pinned model/,
        );
        expect(requests).toHaveLength(0);
        expect(() => buildVertexTtsRequest(TEXT, languageInfo('Hindi').speech)).toThrow(/not a Vertex voice/);
        expect(() => buildSynthesizeRequest(TEXT, bengali)).toThrow(/Vertex voice/);
    });
});

describe('Vertex PCM → 8 kHz μ-law', () => {
    it('reads the PCM rate from the MIME type', () => {
        expect(pcmRateFromMimeType('audio/L16;codec=pcm;rate=24000')).toBe(24_000);
        expect(pcmRateFromMimeType('audio/L16; rate=16000')).toBe(16_000);
        expect(pcmRateFromMimeType('audio/pcm;rate=24000')).toBe(24_000);
        expect(() => pcmRateFromMimeType('audio/L16;codec=pcm')).toThrow(/sample rate/);
        expect(() => pcmRateFromMimeType('audio/L16;rate=4000')).toThrow(/sample rate/);
        expect(() => pcmRateFromMimeType('audio/mpeg')).toThrow(/unsupported/);
    });

    it.each([24_000, 16_000])('turns %i Hz PCM into an 8 kHz μ-law WAV of the same length, keeping the level', async (rate) => {
        const { impl } = fakeFetch(() => ({ json: vertexJson(audioPart(1.5, rate)) }));
        const out = await createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token }).synthesize({ text: TEXT, language: 'Bengali', speech: bengali });
        const info = parseWav(out.audio);
        expect(info).toMatchObject({ audioFormat: 7, channels: 1, sampleRate: 8000, bitsPerSample: 8 });
        expect(out.mimeType).toBe('audio/wav');
        expect(out.durationSeconds).toBeCloseTo(1.5, 6);
        const pcm = Array.from(mulawSamples(out.audio), mulawDecode);
        expect(20 * Math.log10(rms(pcm, 400, pcm.length - 400) / (8000 / Math.SQRT2))).toBeCloseTo(0, 0); // within ±0.5 dB
    });

    it('joins every audio part in order and ignores non-audio parts', () => {
        const out = vertexResponseToTelephonyWav(vertexJson({ text: 'ignored' }, audioPart(0.5, 24_000, 0), audioPart(1.0, 24_000, 1000)));
        expect(out.durationSeconds).toBeCloseTo(1.5, 6);
        const pcm = Array.from(mulawSamples(out.audio), mulawDecode);
        expect(rms(pcm, 0, 3600)).toBeLessThan(10); // the silent part first
        expect(rms(pcm, 4400, 12_000)).toBeGreaterThan(5000); // then the tone
    });

    it('reads WAV-wrapped PCM (gemini-3.8-flash-tts answers audio/wav), at the rate in its header', () => {
        const pcm = Buffer.from(pcmBase64(1.0, 24_000), 'base64');
        const header = Buffer.alloc(44);
        header.write('RIFF', 0, 'ascii');
        header.writeUInt32LE(36 + pcm.length, 4);
        header.write('WAVE', 8, 'ascii');
        header.write('fmt ', 12, 'ascii');
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20); // PCM
        header.writeUInt16LE(1, 22); // mono
        header.writeUInt32LE(24_000, 24);
        header.writeUInt32LE(48_000, 28);
        header.writeUInt16LE(2, 32);
        header.writeUInt16LE(16, 34);
        header.write('data', 36, 'ascii');
        header.writeUInt32LE(pcm.length, 40);
        const wavPart = { inlineData: { mimeType: 'audio/wav', data: Buffer.concat([header, pcm]).toString('base64') } };
        const out = vertexResponseToTelephonyWav(vertexJson(wavPart));
        expect(out.durationSeconds).toBeCloseTo(1.0, 6);
        const decoded = Array.from(mulawSamples(out.audio), mulawDecode);
        expect(20 * Math.log10(rms(decoded, 400, decoded.length - 400) / (8000 / Math.SQRT2))).toBeCloseTo(0, 0);
    });

    it('refuses parts at different rates', () => {
        expect(() => vertexResponseToTelephonyWav(vertexJson(audioPart(0.2, 24_000), audioPart(0.2, 16_000)))).toThrow(/different rates/);
    });
});

describe('Vertex error paths', () => {
    it('fails plainly when the response has no audio part', async () => {
        const cases: [unknown, RegExp][] = [
            [vertexJson({ text: 'I can only read text.' }), /no audio \(STOP\)/],
            [{ candidates: [{ finishReason: 'SAFETY' }] }, /no audio \(SAFETY\)/],
            [{ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } }, /no audio \(PROHIBITED_CONTENT\)/],
            [{}, /no audio \(no candidate\)/],
        ];
        for (const [json, message] of cases) {
            const { impl } = fakeFetch(() => ({ json }));
            await expect(createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token }).synthesize({ text: TEXT, language: 'Bengali', speech: bengali })).rejects.toThrow(
                message,
            );
        }
    });

    it('does not retry an HTTP 400 (a bad request stays bad)', async () => {
        const { impl, requests } = fakeFetch(() => ({ status: 400, json: { error: { code: 400, message: 'Unsupported language bn-IN' } } }));
        const waits: number[] = [];
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token, sleep: async (ms) => void waits.push(ms) });
        await expect(synth.synthesize({ text: TEXT, language: 'Bengali', speech: bengali })).rejects.toThrow(/TTS gemini-tts-vertex bn-IN failed: HTTP 400 .*Unsupported language/);
        expect(requests).toHaveLength(1);
        expect(waits).toHaveLength(0);
    });

    it('waits and retries a 429 quota error, then succeeds', async () => {
        let n = 0;
        const { impl, requests } = fakeFetch(() => (++n <= 2 ? { status: 429, json: { error: { code: 429, status: 'RESOURCE_EXHAUSTED' } } } : { json: vertexJson(audioPart(1)) }));
        const waits: number[] = [];
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token, backoffMs: 100, sleep: async (ms) => void waits.push(ms) });
        const out = await synth.synthesize({ text: TEXT, language: 'Bengali', speech: bengali });
        expect(out.durationSeconds).toBeCloseTo(1, 6);
        expect(requests).toHaveLength(3);
        expect(waits).toHaveLength(2);
        expect(waits[0]).toBeGreaterThanOrEqual(100);
        expect(waits[1]).toBeGreaterThanOrEqual(200);
    });

    describe('timeout', () => {
        afterEach(() => jest.useRealTimers());

        /** A fetch that never answers and records when its request is aborted. */
        function hangingFetch() {
            const abortedAt: number[] = [];
            const impl = ((_url: string, init: { signal: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    init.signal.addEventListener('abort', () => {
                        abortedAt.push(Date.now());
                        reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
                    });
                })) as unknown as typeof fetch;
            return { impl, abortedAt };
        }

        it('gives Vertex 180 s per attempt (Cloud TTS keeps 60 s)', async () => {
            jest.useFakeTimers({ now: 0 });
            expect(VERTEX_TTS_TIMEOUT_MS).toBe(180_000);
            const vertex = hangingFetch();
            const vertexCall = createGoogleSynthesizer({ fetchImpl: vertex.impl, getAccessToken: token, maxRetries: 0 })
                .synthesize({ text: TEXT, language: 'Bengali', speech: bengali })
                .catch((e: unknown) => e);
            await jest.advanceTimersByTimeAsync(179_999);
            expect(vertex.abortedAt).toEqual([]);
            await jest.advanceTimersByTimeAsync(1);
            expect(vertex.abortedAt).toEqual([180_000]);
            expect(await vertexCall).toMatchObject({ name: 'AbortError' });

            const cloud = hangingFetch();
            const start = Date.now();
            const cloudCall = createGoogleSynthesizer({ fetchImpl: cloud.impl, getAccessToken: token, maxRetries: 0 })
                .synthesize({ text: 'x', language: 'Hindi', speech: languageInfo('Hindi').speech })
                .catch((e: unknown) => e);
            await jest.advanceTimersByTimeAsync(60_000);
            expect(cloud.abortedAt).toEqual([start + 60_000]);
            expect(await cloudCall).toMatchObject({ name: 'AbortError' });
        });
    });

    it('never mistakes a Cloud TTS-shaped answer for Vertex audio (the routes do not mix)', async () => {
        const { impl } = fakeFetch(() => ({ json: { audioContent: fakeMulawWav(0.5).toString('base64') } }));
        await expect(createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token }).synthesize({ text: TEXT, language: 'Bengali', speech: bengali })).rejects.toThrow(/no audio/);
    });
});
