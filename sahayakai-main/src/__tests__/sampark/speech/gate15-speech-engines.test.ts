/**
 * @jest-environment node
 *
 * CLASS GATE 15 — every language renders on its pinned engine, model, voice and
 * language code, and the synthesizer sends exactly those fields:
 *   - English, Hindi, Nepali: Cloud TTS Gemini-TTS, μ-law at 8 kHz, the short
 *     style hint only with a campaign's main message (plan §5, §13).
 *   - Bengali: Gemini-TTS through Vertex AI, bn-IN (voice phase, 7 Oct 2026 —
 *     Chirp 3 HD bn-IN mispronounced Bengali on real calls; Cloud TTS refuses
 *     bn-IN for Gemini; never the bn-BD locale). On this route NO prompt or
 *     instruction is ever sent, for any clip or delivery: an English instruction
 *     made the voice English-accented, and prompts have been read aloud before.
 *   - Every request carries its language's code (without one, Gemini read
 *     English and some Hindi with an American accent).
 */

import { availablePurposes } from '@/lib/sampark/catalogue';
import { GEMINI_TTS_MODEL, languageInfo, SCHOOL_VOICE, type SpeechEngineConfig } from '@/lib/sampark/languages';
import { SAMPLE_SCHOOL, SAMPLE_SECTION_AUDIENCE, sampleFactsFor } from '@/lib/sampark/scripts/samples';
import {
    buildSynthesizeRequest,
    buildVertexTtsRequest,
    createChirpVerifier,
    createGoogleSynthesizer,
    DEFAULT_GCP_PROJECT,
    GEMINI_TTS_STYLE_PROMPT,
    recognizeUrl,
    TTS_ENDPOINT,
    isTransientFetchError,
} from '@/lib/sampark/speech/google-speech';
import { neededClips } from '@/lib/sampark/speech/render-job';
import { PARENT_LANGUAGES, type ClipKind, type ParentLanguage } from '@/types/sampark';

import { fakeFetch, fakeMulawWav, type RecordedRequest } from './helpers';

const token = async () => 'test-token';

/** The language code each language must send — literal on purpose: changing one is a deliberate edit here. */
const LANGUAGE_CODES: Record<ParentLanguage, string> = { English: 'en-IN', Hindi: 'hi-IN', Bengali: 'bn-IN', Nepali: 'ne-NP' };

/** Every clip kind (a Record so a new ClipKind fails to compile until it is listed). */
const CLIP_KINDS: Record<ClipKind, true> = {
    message: true,
    confirm_1: true,
    confirm_2: true,
    opt_out_confirm: true,
    opt_out_done: true,
    no_input: true,
    fallback_office: true,
};

/** A Vertex generateContent answer: 0.1 s of 24 kHz PCM silence. */
const VERTEX_AUDIO = {
    candidates: [{ content: { role: 'model', parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: Buffer.alloc(4800).toString('base64') } }] } }],
};

/** Answers Vertex and Cloud TTS requests each in their own shape. */
const answerEither = (req: RecordedRequest) =>
    req.url.includes('aiplatform.googleapis.com') ? { json: VERTEX_AUDIO } : { json: { audioContent: fakeMulawWav(0.1).toString('base64') } };

/** The language code a request actually carries, on either route. */
function languageCodeSent(req: RecordedRequest): string | undefined {
    return req.url.includes('aiplatform.googleapis.com') ? req.body.generationConfig?.speechConfig?.languageCode : req.body.voice?.languageCode;
}

describe('Gate 15 — speech engine per language', () => {
    it('pins every language\'s speech configuration', () => {
        expect(Object.fromEntries(PARENT_LANGUAGES.map((l) => [l, languageInfo(l).speech]))).toEqual({
            English: { engine: 'gemini-tts', ttsLanguageCode: 'en-IN', voice: 'Kore', model: 'gemini-2.5-flash-tts', sttLanguageCode: 'en-IN' },
            Hindi: { engine: 'gemini-tts', ttsLanguageCode: 'hi-IN', voice: 'Kore', model: 'gemini-2.5-flash-tts', sttLanguageCode: 'hi-IN' },
            Bengali: { engine: 'gemini-tts-vertex', ttsLanguageCode: 'bn-IN', voice: 'Kore', model: 'gemini-3.8-flash-tts', sttLanguageCode: 'bn-IN' },
            Nepali: { engine: 'gemini-tts', ttsLanguageCode: 'ne-NP', voice: 'Kore', model: 'gemini-2.5-flash-tts', sttLanguageCode: 'ne-NP' },
        });
    });

    it('Nepali is Gemini-TTS ne-NP on the pinned model', () => {
        const s = languageInfo('Nepali').speech;
        expect(s.engine).toBe('gemini-tts');
        expect(s.ttsLanguageCode).toBe('ne-NP');
        expect(s.model).toBe(GEMINI_TTS_MODEL);
        expect(s.sttLanguageCode).toBe('ne-NP');
    });

    it('Bengali is Gemini-TTS on Vertex, bn-IN, on a pinned model (never Chirp 3 HD, never bn-BD)', () => {
        const s = languageInfo('Bengali').speech;
        expect(s.engine).toBe('gemini-tts-vertex');
        expect(s.ttsLanguageCode).toBe('bn-IN');
        expect(s.sttLanguageCode).toBe('bn-IN');
        expect(s.voice).toBe(SCHOOL_VOICE);
        expect(s.model).toMatch(/^gemini-[\d.]+-flash(-lite)?-tts$/);
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

    it('the Bengali request is the Vertex body: text, voice, bn-IN and nothing else', () => {
        expect(buildVertexTtsRequest('নমস্কার।', languageInfo('Bengali').speech)).toEqual({
            contents: [{ role: 'user', parts: [{ text: 'নমস্কার।' }] }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, languageCode: 'bn-IN' },
            },
        });
    });

    it('a Chirp 3 HD config (no language uses one today) still gets no model and no prompt', () => {
        const chirp: SpeechEngineConfig = { engine: 'chirp3-hd', ttsLanguageCode: 'bn-IN', voice: 'bn-IN-Chirp3-HD-Kore', model: null, sttLanguageCode: 'bn-IN' };
        expect(buildSynthesizeRequest('নমস্কার।', chirp, 'styled')).toEqual({
            input: { text: 'নমস্কার।' },
            voice: { languageCode: 'bn-IN', name: 'bn-IN-Chirp3-HD-Kore' },
            audioConfig: { audioEncoding: 'MULAW', sampleRateHertz: 8000 },
        });
    });

    it('class gate: the Vertex route never sends a prompt or instruction — every clip of every purpose, both deliveries', async () => {
        const vertexLanguages = PARENT_LANGUAGES.filter((l) => languageInfo(l).speech.engine === 'gemini-tts-vertex');
        expect(vertexLanguages.length).toBeGreaterThan(0);
        const { impl, requests } = fakeFetch(answerEither);
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token });
        const sent: { text: string; language: ParentLanguage }[] = [];
        const kinds = new Set<ClipKind>();
        for (const language of vertexLanguages) {
            for (const spec of availablePurposes()) {
                for (const clip of neededClips(spec.id, sampleFactsFor(spec.id), SAMPLE_SCHOOL, SAMPLE_SECTION_AUDIENCE, [language])) {
                    kinds.add(clip.kind);
                    for (const delivery of ['styled', 'plain'] as const) {
                        await synth.synthesize({ text: clip.text, language, speech: clip.speech, delivery });
                        sent.push({ text: clip.text, language });
                    }
                }
            }
        }
        expect([...kinds].sort()).toEqual(Object.keys(CLIP_KINDS).sort());
        expect(requests).toHaveLength(sent.length);
        requests.forEach((r, i) => {
            const speech = languageInfo(sent[i].language).speech;
            // Exactly the text as content, and exactly voice + language code as configuration.
            expect(r.body).toEqual(buildVertexTtsRequest(sent[i].text, speech));
            expect(Object.keys(r.body).sort()).toEqual(['contents', 'generationConfig']);
            expect(Object.keys(r.body.generationConfig).sort()).toEqual(['responseModalities', 'speechConfig']);
            const wire = JSON.stringify(r.body);
            expect(wire).not.toContain(GEMINI_TTS_STYLE_PROMPT);
            expect(wire).not.toMatch(/prompt|instruction/i);
        });
    });

    it('class gate: every language\'s request carries its own language code, for both deliveries', async () => {
        const { impl, requests } = fakeFetch(answerEither);
        const synth = createGoogleSynthesizer({ fetchImpl: impl, getAccessToken: token });
        const order: ParentLanguage[] = [];
        for (const language of PARENT_LANGUAGES) {
            for (const delivery of ['styled', 'plain'] as const) {
                await synth.synthesize({ text: 'x', language, speech: languageInfo(language).speech, delivery });
                order.push(language);
            }
        }
        expect(Object.keys(LANGUAGE_CODES).sort()).toEqual([...PARENT_LANGUAGES].sort());
        requests.forEach((r, i) => {
            expect(languageCodeSent(r)).toBe(LANGUAGE_CODES[order[i]]);
            expect(languageCodeSent(r)).toBe(languageInfo(order[i]).speech.ttsLanguageCode);
            expect(JSON.stringify(r.body)).not.toContain('bn-BD');
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
