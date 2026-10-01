/**
 * @jest-environment node
 *
 * CLASS GATE 15 — the Nepali render uses ne-NP and the pinned Gemini-TTS model
 * (plan §5, §13); Bengali uses Chirp 3 HD bn-IN (Gemini-TTS has no bn-IN, only
 * the Bangladesh locale); and the synthesizer sends exactly those fields, in
 * μ-law at 8 kHz, with the style prompt only where the engine accepts one.
 */

import { GEMINI_TTS_MODEL, languageInfo, SCHOOL_VOICE } from '@/lib/sampark/languages';
import {
    buildSynthesizeRequest,
    createChirpVerifier,
    createGoogleSynthesizer,
    DEFAULT_GCP_PROJECT,
    GEMINI_TTS_STYLE_PROMPT,
    recognizeUrl,
    TTS_ENDPOINT,
    isTransientFetchError,
} from '@/lib/sampark/speech/google-speech';
import { PARENT_LANGUAGES } from '@/types/sampark';

import { fakeFetch, fakeMulawWav } from './helpers';

const token = async () => 'test-token';

describe('Gate 15 — speech engine per language', () => {
    it('Nepali is Gemini-TTS ne-NP on the pinned model', () => {
        const s = languageInfo('Nepali').speech;
        expect(s.engine).toBe('gemini-tts');
        expect(s.ttsLanguageCode).toBe('ne-NP');
        expect(s.model).toBe(GEMINI_TTS_MODEL);
        expect(s.sttLanguageCode).toBe('ne-NP');
    });

    it('Bengali is Chirp 3 HD bn-IN (never the bn-BD Gemini voice)', () => {
        const s = languageInfo('Bengali').speech;
        expect(s.engine).toBe('chirp3-hd');
        expect(s.ttsLanguageCode).toBe('bn-IN');
        expect(s.voice).toBe(`bn-IN-Chirp3-HD-${SCHOOL_VOICE}`);
    });

    it('every language uses the one school voice', () => {
        for (const l of PARENT_LANGUAGES) expect(languageInfo(l).speech.voice).toContain(SCHOOL_VOICE);
    });

    it('the Nepali request carries exactly ne-NP, the voice, the pinned model, MULAW 8 kHz and the style prompt', async () => {
        const { impl, requests } = fakeFetch(() => ({ json: { audioContent: fakeMulawWav(1.5).toString('base64') } }));
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token, project: 'proj-x' });
        const out = await synth.synthesize({ text: 'नमस्ते, यो सूचना हो।', language: 'Nepali', speech: languageInfo('Nepali').speech, delivery: 'styled' });

        expect(requests).toHaveLength(1);
        expect(requests[0].url).toBe(TTS_ENDPOINT);
        expect(requests[0].headers.Authorization).toBe('Bearer test-token');
        expect(requests[0].headers['x-goog-user-project']).toBe('proj-x');
        expect(requests[0].body).toEqual({
            input: { text: 'नमस्ते, यो सूचना हो।', prompt: GEMINI_TTS_STYLE_PROMPT },
            voice: { languageCode: 'ne-NP', name: SCHOOL_VOICE, modelName: GEMINI_TTS_MODEL },
            audioConfig: { audioEncoding: 'MULAW', sampleRateHertz: 8000 },
        });
        expect(out.mimeType).toBe('audio/wav');
        expect(out.durationSeconds).toBeCloseTo(1.5, 3);
    });

    it('class gate: a short clip never carries a style instruction (Gemini-TTS read one aloud on 2026-10-01)', async () => {
        const { impl, requests } = fakeFetch(() => ({ json: { audioContent: fakeMulawWav(1).toString('base64') } }));
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token });
        await synth.synthesize({ text: 'धन्यवाद, सबैजना सुरक्षित रहनुहोस्।', language: 'Nepali', speech: languageInfo('Nepali').speech });
        await synth.synthesize({ text: 'Thank you.', language: 'English', speech: languageInfo('English').speech, delivery: 'plain' });
        for (const r of requests) expect((r.body as { input: Record<string, unknown> }).input).not.toHaveProperty('prompt');
        // The hint that IS sent with a message is a few words, with nothing worth reading out.
        expect(GEMINI_TTS_STYLE_PROMPT.split(/\s+/).length).toBeLessThanOrEqual(6);
    });

    it('the Bengali request is Chirp 3 HD: no model, no prompt', () => {
        expect(buildSynthesizeRequest('নমস্কার।', languageInfo('Bengali').speech)).toEqual({
            input: { text: 'নমস্কার।' },
            voice: { languageCode: 'bn-IN', name: 'bn-IN-Chirp3-HD-Kore' },
            audioConfig: { audioEncoding: 'MULAW', sampleRateHertz: 8000 },
        });
    });

    it('a Gemini-TTS config without a pinned model is refused', () => {
        expect(() => buildSynthesizeRequest('x', { ...languageInfo('Nepali').speech, model: null })).toThrow(/pinned model/);
    });

    it('bills the default project unless SAMPARK_GCP_PROJECT is set', async () => {
        const prev = process.env.SAMPARK_GCP_PROJECT;
        delete process.env.SAMPARK_GCP_PROJECT;
        try {
            const { impl, requests } = fakeFetch(() => ({ json: { audioContent: fakeMulawWav(0.5).toString('base64') } }));
            await createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token }).synthesize({
                text: 'hello',
                language: 'English',
                speech: languageInfo('English').speech,
            });
            expect(requests[0].headers['x-goog-user-project']).toBe(DEFAULT_GCP_PROJECT);
        } finally {
            if (prev !== undefined) process.env.SAMPARK_GCP_PROJECT = prev;
        }
    });

    it('surfaces an HTTP error and a response without audio', async () => {
        const failing = fakeFetch(() => ({ status: 403, json: { error: { message: 'denied' } } }));
        await expect(
            createGoogleSynthesizer({ fetchImpl: failing.impl, getAccessToken: token }).synthesize({ text: 'x', language: 'Hindi', speech: languageInfo('Hindi').speech }),
        ).rejects.toThrow(/HTTP 403/);
        const empty = fakeFetch(() => ({ json: {} }));
        await expect(
            createGoogleSynthesizer({ fetchImpl: empty.impl, getAccessToken: token }).synthesize({ text: 'x', language: 'Hindi', speech: languageInfo('Hindi').speech }),
        ).rejects.toThrow(/no audioContent/);
    });

    it('waits and retries on a 429 quota error (Gemini-TTS per-minute quota), then succeeds', async () => {
        let n = 0;
        const { impl, requests } = fakeFetch(() =>
            ++n <= 2 ? { status: 429, json: { error: { code: 429, status: 'RESOURCE_EXHAUSTED' } } } : { json: { audioContent: fakeMulawWav(1).toString('base64') } },
        );
        const waits: number[] = [];
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token, backoffMs: 100, sleep: async (ms) => void waits.push(ms) });
        const out = await synth.synthesize({ text: 'x', language: 'Nepali', speech: languageInfo('Nepali').speech });
        expect(out.durationSeconds).toBe(1);
        expect(requests).toHaveLength(3);
        expect(waits).toHaveLength(2);
        expect(waits[0]).toBeGreaterThanOrEqual(100);
        expect(waits[1]).toBeGreaterThanOrEqual(200);
    });

    it('gives up after maxRetries', async () => {
        const { impl, requests } = fakeFetch(() => ({ status: 503, json: {} }));
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token, maxRetries: 2, sleep: async () => undefined });
        await expect(synth.synthesize({ text: 'x', language: 'Hindi', speech: languageInfo('Hindi').speech })).rejects.toThrow(/HTTP 503/);
        expect(requests).toHaveLength(3);
    });

    it('retries a timeout or dropped connection like a 503, then succeeds', async () => {
        let n = 0;
        const requests: unknown[] = [];
        const impl = (async (_url: string, init: RequestInit) => {
            requests.push(init);
            n += 1;
            if (n === 1) throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
            if (n === 2) throw new TypeError('fetch failed');
            return { ok: true, status: 200, headers: new Headers(), json: async () => ({ audioContent: fakeMulawWav(1).toString('base64') }), text: async () => '' };
        }) as unknown as typeof fetch;
        const waits: number[] = [];
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token, backoffMs: 100, sleep: async (ms) => void waits.push(ms) });
        const out = await synth.synthesize({ text: 'x', language: 'English', speech: languageInfo('English').speech });
        expect(out.durationSeconds).toBe(1);
        expect(requests).toHaveLength(3);
        expect(waits).toHaveLength(2);
    });

    it('does not retry a programming error, and stops after maxRetries timeouts', async () => {
        expect(isTransientFetchError(new Error('boom'))).toBe(false);
        const impl = (async () => {
            throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
        }) as unknown as typeof fetch;
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token, maxRetries: 2, sleep: async () => undefined });
        await expect(synth.synthesize({ text: 'x', language: 'Hindi', speech: languageInfo('Hindi').speech })).rejects.toThrow(/aborted/);
    });

    it('rejects audio that is not 8 kHz mono μ-law', async () => {
        const pcm = Buffer.from(fakeMulawWav(0.2));
        pcm.writeUInt16LE(1, 20); // audioFormat := PCM
        const { impl } = fakeFetch(() => ({ json: { audioContent: pcm.toString('base64') } }));
        await expect(
            createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token }).synthesize({ text: 'x', language: 'Hindi', speech: languageInfo('Hindi').speech }),
        ).rejects.toThrow(/μ-law/);
    });
});

describe('Chirp 2 transcribe-back request', () => {
    it('posts chirp_2 with the STT language code to asia-southeast1 and joins the transcripts', async () => {
        const { impl, requests } = fakeFetch(() => ({
            json: {
                results: [
                    { alternatives: [{ transcript: 'नमस्ते यो', confidence: 0.9 }] },
                    { alternatives: [{ transcript: 'सूचना हो', confidence: 0.7 }] },
                    {},
                ],
            },
        }));
        const verifier = createChirpVerifier({ fetchImpl: impl, getAccessToken: token, project: 'proj-y' });
        const audio = fakeMulawWav(1);
        const out = await verifier.transcribe({ audio, mimeType: 'audio/wav', language: 'Nepali', sttLanguageCode: 'ne-NP' });

        expect(requests[0].url).toBe(recognizeUrl('proj-y'));
        expect(requests[0].url).toBe('https://asia-southeast1-speech.googleapis.com/v2/projects/proj-y/locations/asia-southeast1/recognizers/_:recognize');
        expect(requests[0].body).toEqual({
            config: { autoDecodingConfig: {}, languageCodes: ['ne-NP'], model: 'chirp_2' },
            content: audio.toString('base64'),
        });
        expect(out.transcript).toBe('नमस्ते यो सूचना हो');
        expect(out.confidence).toBeCloseTo(0.8, 5);
    });

    it('an empty recognition is an empty transcript with zero confidence', async () => {
        const { impl } = fakeFetch(() => ({ json: {} }));
        const out = await createChirpVerifier({ fetchImpl: impl, getAccessToken: token }).transcribe({
            audio: fakeMulawWav(0.1),
            mimeType: 'audio/wav',
            language: 'Hindi',
            sttLanguageCode: 'hi-IN',
        });
        expect(out).toEqual({ transcript: '', confidence: 0 });
    });
});
