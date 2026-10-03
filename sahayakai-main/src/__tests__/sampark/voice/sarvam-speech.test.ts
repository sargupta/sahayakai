/**
 * @jest-environment node
 *
 * Sarvam Bulbul v3 adapter. UNVERIFIED against the live API: these tests pin the request shape we
 * wrote from the docs and the safety rails (env flag, no Nepali, pace range, 8 kHz μ-law output).
 */

import { linearToMulaw, pcm16ToMulaw } from '@/lib/sampark/speech/g711';
import { buildSarvamRequest, createSarvamSynthesizer, SARVAM_TTS_ENDPOINT, sarvamEnabled, sarvamWavToTelephony } from '@/lib/sampark/speech/sarvam-speech';
import type { SynthProfile } from '@/lib/sampark/speech/synthesizer';
import { buildMulawWav, mulawSamples, MULAW_SILENCE } from '@/lib/sampark/speech/wav';
import { fakeMulawWav } from '../speech/helpers';

const profile: SynthProfile = { provider: 'sarvam-bulbul', model: 'bulbul:v3', voice: 'priya', localeCode: 'hi-IN', sttLanguageCode: 'hi-IN', speakingRate: 1.1, stylePrompt: null };

/** A 16-bit PCM WAV (format 1). */
function pcmWav(samples: number[], sampleRate = 8000, channels = 1): Buffer {
    const data = Buffer.alloc(samples.length * 2);
    samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
    const header = Buffer.alloc(44);
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2 * channels, 28);
    header.writeUInt16LE(2 * channels, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(data.length, 40);
    return Buffer.concat([header, data]);
}

function fetchReturning(audios: unknown, status = 200) {
    const calls: { url: string; init: RequestInit }[] = [];
    const impl = (async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), init });
        return { ok: status < 300, status, json: async () => ({ request_id: 'r', audios }), text: async () => 'detail' };
    }) as unknown as typeof fetch;
    return { impl, calls };
}

describe('G.711 encoder', () => {
    it('encodes silence, peaks and sign like the standard', () => {
        expect(linearToMulaw(0)).toBe(MULAW_SILENCE);
        expect(linearToMulaw(32767)).toBe(0x80);
        expect(linearToMulaw(-32768)).toBe(0x00);
        expect(linearToMulaw(-1)).toBe(0x7f);
        expect(pcm16ToMulaw(Buffer.from([0, 0, 0xff, 0x7f]))).toEqual(Buffer.from([0xff, 0x80]));
    });
});

describe('Sarvam request', () => {
    it('is the documented shape, at 8 kHz, with the pinned model and the profile locale/voice/pace', () => {
        expect(buildSarvamRequest('नमस्ते', profile)).toEqual({
            text: 'नमस्ते',
            target_language_code: 'hi-IN',
            speaker: 'priya',
            model: 'bulbul:v3',
            speech_sample_rate: 8000,
            output_audio_codec: 'wav',
            pace: 1.1,
        });
        expect(buildSarvamRequest('x', { ...profile, speakingRate: null })).not.toHaveProperty('pace');
    });

    it('refuses Nepali (Bulbul v3 has no Nepali) before any network call', () => {
        expect(() => buildSarvamRequest('x', { ...profile, localeCode: 'ne-NP' })).toThrow(/no ne-NP/);
    });
    it('refuses another model, a Google profile and an out-of-range pace', () => {
        expect(() => buildSarvamRequest('x', { ...profile, model: 'bulbul:v2' })).toThrow(/pinned/);
        expect(() => buildSarvamRequest('x', { ...profile, provider: 'chirp3-hd' })).toThrow(/cannot render/);
        expect(() => buildSarvamRequest('x', { ...profile, speakingRate: 3 })).toThrow(/outside/);
        expect(() => buildSarvamRequest('x', { ...profile, speakingRate: 0.4 })).toThrow(/outside/);
    });
});

describe('Sarvam synthesizer', () => {
    const mulaw = fakeMulawWav(1);

    it('is off unless SARVAM_BULBUL_ENABLED=1 and a key is present', async () => {
        expect(sarvamEnabled({ SARVAM_BULBUL_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(true);
        expect(sarvamEnabled({} as NodeJS.ProcessEnv)).toBe(false);
        const { impl, calls } = fetchReturning([mulaw.toString('base64')]);
        await expect(createSarvamSynthesizer({ fetchImpl: impl, apiKey: 'k', enabled: false }).synthesize({ text: 'x', profile, delivery: 'plain' })).rejects.toThrow(/SARVAM_BULBUL_ENABLED/);
        await expect(createSarvamSynthesizer({ fetchImpl: impl, apiKey: '', enabled: true }).synthesize({ text: 'x', profile, delivery: 'plain' })).rejects.toThrow(/SARVAM_API_KEY/);
        expect(calls).toHaveLength(0);
    });

    it('posts with the subscription key header and returns 8 kHz μ-law', async () => {
        const { impl, calls } = fetchReturning([mulaw.toString('base64')]);
        const out = await createSarvamSynthesizer({ fetchImpl: impl, apiKey: 'sekret', enabled: true }).synthesize({ text: 'नमस्ते', profile, delivery: 'styled' });
        expect(calls[0].url).toBe(SARVAM_TTS_ENDPOINT);
        expect((calls[0].init.headers as Record<string, string>)['api-subscription-key']).toBe('sekret');
        expect(JSON.parse(String(calls[0].init.body)).model).toBe('bulbul:v3');
        expect(out.durationSeconds).toBeCloseTo(1, 3);
        expect(mulawSamples(out.audio).length).toBe(8000);
    });

    it('re-encodes a 16-bit PCM WAV response to μ-law', () => {
        const out = sarvamWavToTelephony(pcmWav([0, 32767, -32768, 0]));
        expect(mulawSamples(out.audio)).toEqual(Buffer.from([0xff, 0x80, 0x00, 0xff]));
        expect(out.durationSeconds).toBeCloseTo(4 / 8000, 6);
    });

    it('rejects audio that is not 8 kHz mono, not a WAV, or an unsupported format', () => {
        expect(() => sarvamWavToTelephony(pcmWav([0, 0], 16000))).toThrow(/8000 Hz mono/);
        expect(() => sarvamWavToTelephony(pcmWav([0, 0], 8000, 2))).toThrow(/8000 Hz mono/);
        expect(() => sarvamWavToTelephony(Buffer.from('not a wav'))).toThrow(/not a WAV/);
        const alaw = buildMulawWav(Buffer.alloc(10));
        alaw.writeUInt16LE(6, 20); // A-law
        expect(() => sarvamWavToTelephony(alaw)).toThrow(/expected 16-bit PCM or/);
    });

    it('retries a 429 then succeeds, gives up on a 400, and complains about a missing audios[0]', async () => {
        let n = 0;
        const impl = (async () => {
            n += 1;
            return n === 1
                ? { ok: false, status: 429, json: async () => ({}), text: async () => 'slow down' }
                : { ok: true, status: 200, json: async () => ({ audios: [mulaw.toString('base64')] }), text: async () => '' };
        }) as unknown as typeof fetch;
        const waits: number[] = [];
        const synth = createSarvamSynthesizer({ fetchImpl: impl, apiKey: 'k', enabled: true, backoffMs: 10, sleep: async (ms) => void waits.push(ms) });
        await expect(synth.synthesize({ text: 'x', profile, delivery: 'plain' })).resolves.toBeDefined();
        expect(waits).toEqual([10]);

        const bad = fetchReturning([], 400);
        await expect(createSarvamSynthesizer({ fetchImpl: bad.impl, apiKey: 'k', enabled: true }).synthesize({ text: 'x', profile, delivery: 'plain' })).rejects.toThrow(/HTTP 400/);
        const empty = fetchReturning([]);
        await expect(createSarvamSynthesizer({ fetchImpl: empty.impl, apiKey: 'k', enabled: true }).synthesize({ text: 'x', profile, delivery: 'plain' })).rejects.toThrow(/no audios/);
        await expect(createSarvamSynthesizer({ fetchImpl: empty.impl, apiKey: 'k', enabled: true }).synthesize({ text: '  ', profile, delivery: 'plain' })).rejects.toThrow(/empty text/);
    });
});
