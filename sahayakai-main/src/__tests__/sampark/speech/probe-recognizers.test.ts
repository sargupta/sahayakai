/**
 * @jest-environment node
 *
 * The probe's second, independent recognisers (secondary-recognizers.ts): the
 * exact requests they send, and how failures are worded. Network is never
 * touched — fetch and the key/token providers are injected.
 */

import {
    CHIRP3_LOCATION,
    CHIRP3_MODEL,
    chirp3RecognizeUrl,
    createChirp3Verifier,
    createSarvamVerifier,
    SARVAM_STT_ENDPOINT,
    SARVAM_STT_MODEL,
    secondaryRecognizerFor,
} from '@/lib/sampark/speech/secondary-recognizers';

import { fakeFetch, fakeMulawWav } from './helpers';

const KEY = 'sk_test_0123456789abcdef';
const noSleep = async () => undefined;

interface SentRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: FormData;
}

/** A fetch stand-in for multipart requests: records the FormData and answers in turn from `replies`. */
function multipartFetch(replies: { status: number; body: unknown }[]) {
    const requests: SentRequest[] = [];
    const impl = (async (url: string, init: { method: string; headers: Record<string, string>; body: FormData }) => {
        requests.push({ url: String(url), method: init.method, headers: init.headers, body: init.body });
        const reply = replies[Math.min(requests.length - 1, replies.length - 1)];
        const text = JSON.stringify(reply.body);
        return {
            ok: reply.status >= 200 && reply.status < 300,
            status: reply.status,
            headers: new Headers(),
            json: async () => reply.body,
            text: async () => text,
        };
    }) as unknown as typeof fetch;
    return { impl, requests };
}

describe('createSarvamVerifier — Saarika v2.5', () => {
    it('POSTs multipart file + model + language_code with the api-subscription-key header', async () => {
        const audio = fakeMulawWav(1.25);
        const { impl, requests } = multipartFetch([{ status: 200, body: { request_id: 'r1', transcript: '  নমস্কার, এই বৃহস্পতিবার  ', language_code: 'bn-IN' } }]);
        const verifier = createSarvamVerifier({ fetchImpl: impl, getApiKey: async () => KEY });

        const out = await verifier.transcribe({ audio, mimeType: 'audio/wav', language: 'Bengali', sttLanguageCode: 'bn-IN' });

        expect(out.transcript).toBe('নমস্কার, এই বৃহস্পতিবার');
        expect(requests).toHaveLength(1);
        const [req] = requests;
        expect(req.url).toBe(SARVAM_STT_ENDPOINT);
        expect(req.url).toBe('https://api.sarvam.ai/speech-to-text');
        expect(req.method).toBe('POST');
        expect(req.headers).toEqual({ 'api-subscription-key': KEY }); // fetch sets the multipart boundary itself
        expect(req.body).toBeInstanceOf(FormData);
        expect(req.body.get('model')).toBe(SARVAM_STT_MODEL);
        expect(SARVAM_STT_MODEL).toBe('saarika:v2.5');
        expect(req.body.get('language_code')).toBe('bn-IN');
        const file = req.body.get('file') as File;
        expect(file.type).toBe('audio/wav');
        expect(file.name).toBe('probe.wav');
        expect(Buffer.from(await file.arrayBuffer()).equals(audio)).toBe(true);
        expect([...req.body.keys()].sort()).toEqual(['file', 'language_code', 'model']);
    });

    it.each(['hi-IN', 'en-IN'])('sends %s as the language code', async (code) => {
        const { impl, requests } = multipartFetch([{ status: 200, body: { transcript: 'ok' } }]);
        await createSarvamVerifier({ fetchImpl: impl, getApiKey: async () => KEY }).transcribe({ audio: fakeMulawWav(1), mimeType: 'audio/wav', language: 'Hindi', sttLanguageCode: code });
        expect(requests[0].body.get('language_code')).toBe(code);
    });

    it('refuses Nepali before any request: Saarika has no Nepali', async () => {
        const { impl, requests } = multipartFetch([{ status: 200, body: { transcript: 'x' } }]);
        const getApiKey = jest.fn(async () => KEY);
        await expect(
            createSarvamVerifier({ fetchImpl: impl, getApiKey }).transcribe({ audio: fakeMulawWav(1), mimeType: 'audio/wav', language: 'Nepali', sttLanguageCode: 'ne-NP' }),
        ).rejects.toThrow(/does not recognise ne-NP/);
        expect(requests).toHaveLength(0);
        expect(getApiKey).not.toHaveBeenCalled();
    });

    it('maps a rejected key to a plain error that never contains the key', async () => {
        const { impl } = multipartFetch([{ status: 403, body: { error: { message: 'Invalid or missing authentication credentials', code: 'invalid_api_key_error' } } }]);
        const err = await createSarvamVerifier({ fetchImpl: impl, getApiKey: async () => KEY })
            .transcribe({ audio: fakeMulawWav(1), mimeType: 'audio/wav', language: 'Bengali', sttLanguageCode: 'bn-IN' })
            .catch((e: Error) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/rejected the API key \(HTTP 403 invalid_api_key_error: Invalid or missing authentication credentials\)/);
        expect((err as Error).message).toMatch(/SARVAM_AI_API_KEY/);
        expect((err as Error).message).not.toContain(KEY);
    });

    it('a 400 carries Sarvam’s code and message; a key reflected in a reply is redacted', async () => {
        const { impl } = multipartFetch([{ status: 400, body: { error: { message: `bad audio for ${KEY}`, code: 'invalid_request_error' } } }]);
        const err = (await createSarvamVerifier({ fetchImpl: impl, getApiKey: async () => KEY })
            .transcribe({ audio: fakeMulawWav(1), mimeType: 'audio/wav', language: 'Bengali', sttLanguageCode: 'bn-IN' })
            .catch((e: Error) => e)) as Error;
        expect(err.message).toBe('Sarvam STT saarika:v2.5 bn-IN failed: HTTP 400 invalid_request_error: bad audio for [redacted]');
    });

    it('retries 429 and 5xx with backoff, then succeeds', async () => {
        const { impl, requests } = multipartFetch([
            { status: 429, body: { error: { message: 'rate limited' } } },
            { status: 503, body: {} },
            { status: 200, body: { transcript: 'আটই' } },
        ]);
        const sleep = jest.fn(noSleep);
        const out = await createSarvamVerifier({ fetchImpl: impl, getApiKey: async () => KEY, sleep })
            .transcribe({ audio: fakeMulawWav(1), mimeType: 'audio/wav', language: 'Bengali', sttLanguageCode: 'bn-IN' });
        expect(out.transcript).toBe('আটই');
        expect(requests).toHaveLength(3);
        expect(sleep).toHaveBeenCalledTimes(2);
    });

    it('gives up after its retries on a persistent 500', async () => {
        const { impl, requests } = multipartFetch([{ status: 500, body: { error: { message: 'boom' } } }]);
        await expect(
            createSarvamVerifier({ fetchImpl: impl, getApiKey: async () => KEY, sleep: noSleep, maxRetries: 2 })
                .transcribe({ audio: fakeMulawWav(1), mimeType: 'audio/wav', language: 'Bengali', sttLanguageCode: 'bn-IN' }),
        ).rejects.toThrow('Sarvam STT saarika:v2.5 bn-IN failed: HTTP 500 boom');
        expect(requests).toHaveLength(3);
    });

    it('a reply without a transcript is an error, not an empty pass', async () => {
        const { impl } = multipartFetch([{ status: 200, body: { request_id: 'r' } }]);
        await expect(
            createSarvamVerifier({ fetchImpl: impl, getApiKey: async () => KEY }).transcribe({ audio: fakeMulawWav(1), mimeType: 'audio/wav', language: 'Bengali', sttLanguageCode: 'bn-IN' }),
        ).rejects.toThrow(/returned no transcript/);
    });
});

describe('createChirp3Verifier — Google Speech v2 chirp_3 in `us` (Nepali)', () => {
    it('sends ne-NP to chirp_3 at the us endpoint, billed to the project', async () => {
        const audio = fakeMulawWav(2);
        const { impl, requests } = fakeFetch(() => ({
            json: { results: [{ alternatives: [{ transcript: ' नमस्ते सिलिगुडी स्कुलबाट ', confidence: 0.8 }] }, { alternatives: [{ transcript: 'बिहिबार 10:30 बजे' }] }] },
        }));
        const verifier = createChirp3Verifier({ fetchImpl: impl, getAccessToken: async () => 'test-token', project: 'proj-x' });

        const out = await verifier.transcribe({ audio, mimeType: 'audio/wav', language: 'Nepali', sttLanguageCode: 'ne-NP' });

        expect(out).toEqual({ transcript: 'नमस्ते सिलिगुडी स्कुलबाट बिहिबार 10:30 बजे', confidence: 0.8 });
        expect(requests).toHaveLength(1);
        expect(requests[0].url).toBe('https://us-speech.googleapis.com/v2/projects/proj-x/locations/us/recognizers/_:recognize');
        expect(requests[0].url).toBe(chirp3RecognizeUrl('proj-x'));
        expect(CHIRP3_LOCATION).toBe('us');
        expect(requests[0].headers.Authorization).toBe('Bearer test-token');
        expect(requests[0].headers['x-goog-user-project']).toBe('proj-x');
        expect(requests[0].body).toEqual({
            config: { autoDecodingConfig: {}, languageCodes: ['ne-NP'], model: CHIRP3_MODEL },
            content: audio.toString('base64'),
        });
        expect(CHIRP3_MODEL).toBe('chirp_3');
    });

    it('an empty result is an empty transcript (which then misses every hard word)', async () => {
        const { impl } = fakeFetch(() => ({ json: {} }));
        const out = await createChirp3Verifier({ fetchImpl: impl, getAccessToken: async () => 't' }).transcribe({ audio: fakeMulawWav(1), mimeType: 'audio/wav', language: 'Nepali', sttLanguageCode: 'ne-NP' });
        expect(out).toEqual({ transcript: '', confidence: 0 });
    });

    it('a non-retryable error names the model, language and status', async () => {
        const { impl } = fakeFetch(() => ({ status: 400, json: { error: { message: 'Invalid recognition config' } } }));
        await expect(
            createChirp3Verifier({ fetchImpl: impl, getAccessToken: async () => 't', sleep: noSleep }).transcribe({ audio: fakeMulawWav(1), mimeType: 'audio/wav', language: 'Nepali', sttLanguageCode: 'ne-NP' }),
        ).rejects.toThrow(/^STT chirp_3 ne-NP failed: HTTP 400 .*Invalid recognition config/);
    });
});

describe('secondaryRecognizerFor', () => {
    it('Saarika for Bengali, Hindi and English; Chirp 3 for Nepali', () => {
        expect(secondaryRecognizerFor('Bengali')).toBe('sarvam');
        expect(secondaryRecognizerFor('Hindi')).toBe('sarvam');
        expect(secondaryRecognizerFor('English')).toBe('sarvam');
        expect(secondaryRecognizerFor('Nepali')).toBe('chirp3');
    });
});
