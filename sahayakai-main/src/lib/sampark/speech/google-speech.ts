/**
 * Google Cloud speech adapters for Sampark notice calls.
 *
 *   createGoogleSynthesizer — Cloud Text-to-Speech v1 REST. Gemini-TTS for
 *     en-IN / hi-IN / ne-NP (model pinned in languages.ts), Chirp 3 HD for
 *     bn-IN (Gemini-TTS has no bn-IN, plan §5). Audio is requested as 8 kHz
 *     μ-law (audioEncoding MULAW) so it is telephony-ready with no transcoder.
 *   createChirpVerifier — Speech-to-Text v2, model chirp_2 in asia-southeast1,
 *     for the transcribe-back check (plan §4⑥).
 *
 * Auth is Application Default Credentials via google-auth-library (Cloud Run's
 * service account in production, `gcloud auth application-default login`
 * locally). Requests are billed to SAMPARK_GCP_PROJECT (default the prod
 * project) through `x-goog-user-project`. Both factories accept optional
 * dependencies so tests can inject fetch and a token, and so a local script can
 * fall back to the gcloud CLI token.
 *
 * The synthesizer is deliberately generic: it returns exactly what TTS said.
 * Call-specific shaping (the lead-in silence before a `message` clip) is done
 * by the render job.
 */

import type { SpeechEngineConfig } from '@/lib/sampark/languages';
import type { SpeechSynthesizer, SpeechVerifier, SynthesisResult } from '@/lib/sampark/ports';

import { buildMulawWav, isRiffWave, mulawSamples, TELEPHONY_SAMPLE_RATE } from './wav';

export const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
export const STT_LOCATION = 'asia-southeast1';
export const STT_MODEL = 'chirp_2';
export const DEFAULT_GCP_PROJECT = 'sahayakai-b4248';

/**
 * Style prompt for Gemini-TTS (ignored by Chirp 3 HD, so not sent to it).
 *
 * It shapes DELIVERY only. An earlier, more "human" prompt that also asked the
 * voice to "say the date, time and place clearly" made the model improvise on
 * short clips: it repeated sentences and, in one Nepali confirmation, invented
 * a date that was not in the text (verify-voice run, 2026-09-30). The words a
 * parent hears come from reviewed templates, so the prompt now forbids adding,
 * repeating or skipping anything, and every clip is transcribed back.
 */
export const GEMINI_TTS_STYLE_PROMPT =
    'Read the text exactly as written, word for word: do not add, repeat, skip or change anything. ' +
    'Voice: a warm, friendly member of the school office speaking naturally to a parent on the phone, ' +
    'calm and unhurried, with natural pauses between sentences.';

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const REQUEST_TIMEOUT_MS = 60_000;

export type AccessTokenProvider = () => Promise<string>;

export interface GoogleSpeechDeps {
    fetchImpl?: typeof fetch;
    getAccessToken?: AccessTokenProvider;
    /** Billing / quota project; defaults to SAMPARK_GCP_PROJECT or the prod project. */
    project?: string;
    /**
     * Retries on 429 / 500 / 503 with exponential backoff (default 5). Gemini-TTS
     * has a low per-minute request quota per base model, so a four-language
     * render routinely meets 429 and must wait rather than fail.
     */
    maxRetries?: number;
    /** Backoff base in ms (default 2000: 2 s, 4 s, 8 s, 16 s, 32 s). */
    backoffMs?: number;
    sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** Timeouts (AbortError from our own timer) and network failures (fetch rejects with TypeError). */
export function isTransientFetchError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    return err.name === 'AbortError' || err.name === 'TimeoutError' || err instanceof TypeError;
}
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let adcProvider: AccessTokenProvider | null = null;

/** ADC token via google-auth-library (cached by the library until expiry). */
export function adcAccessTokenProvider(): AccessTokenProvider {
    if (adcProvider) return adcProvider;
    let authPromise: Promise<{ getAccessToken(): Promise<string | null | undefined> }> | null = null;
    adcProvider = async () => {
        authPromise ??= import('google-auth-library').then(({ GoogleAuth }) => new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] }));
        const token = await (await authPromise).getAccessToken();
        if (!token) throw new Error('Google ADC returned no access token');
        return token;
    };
    return adcProvider;
}

function projectOf(deps: GoogleSpeechDeps): string {
    return deps.project ?? process.env.SAMPARK_GCP_PROJECT ?? DEFAULT_GCP_PROJECT;
}

async function postJson(
    deps: GoogleSpeechDeps,
    url: string,
    body: unknown,
    what: string,
): Promise<Record<string, unknown>> {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const maxRetries = deps.maxRetries ?? 5;
    const backoffMs = deps.backoffMs ?? 2000;
    const sleep = deps.sleep ?? defaultSleep;
    const payload = JSON.stringify(body);
    for (let attempt = 0; ; attempt++) {
        const token = await (deps.getAccessToken ?? adcAccessTokenProvider())();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            let res: Response;
            try {
                res = await fetchImpl(url, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json; charset=utf-8',
                        'x-goog-user-project': projectOf(deps),
                    },
                    body: payload,
                    signal: controller.signal,
                });
            } catch (err) {
                // A timeout (our AbortController) or a dropped connection is as transient as a 503:
                // the verify-voice run on 2026-09-30 lost 12 clips to 60 s timeouts during a burst.
                if (isTransientFetchError(err) && attempt < maxRetries) {
                    await sleep(backoffMs * 2 ** attempt + Math.floor(Math.random() * 250));
                    continue;
                }
                throw err;
            }
            if (res.ok) return (await res.json()) as Record<string, unknown>;
            const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 500);
            if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
                const retryAfter = Number(res.headers?.get?.('retry-after'));
                const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs * 2 ** attempt;
                await sleep(wait + Math.floor(Math.random() * 250));
                continue;
            }
            throw new Error(`${what} failed: HTTP ${res.status} ${detail}`);
        } finally {
            clearTimeout(timer);
        }
    }
}

/** The exact Cloud TTS request body for a text and engine (exported for class gate 15). */
export function buildSynthesizeRequest(text: string, speech: SpeechEngineConfig): Record<string, unknown> {
    const audioConfig = { audioEncoding: 'MULAW', sampleRateHertz: TELEPHONY_SAMPLE_RATE };
    if (speech.engine === 'gemini-tts') {
        if (!speech.model) throw new Error(`Gemini-TTS for ${speech.ttsLanguageCode} needs a pinned model`);
        return {
            input: { text, prompt: GEMINI_TTS_STYLE_PROMPT },
            voice: { languageCode: speech.ttsLanguageCode, name: speech.voice, modelName: speech.model },
            audioConfig,
        };
    }
    return {
        input: { text },
        voice: { languageCode: speech.ttsLanguageCode, name: speech.voice },
        audioConfig,
    };
}

/** Normalise TTS output to an 8 kHz mono μ-law WAV and measure it. */
export function toTelephonyWav(audio: Buffer): SynthesisResult {
    // Cloud TTS wraps MULAW in a WAV; if a headerless stream ever comes back, wrap it.
    const wav = isRiffWave(audio) ? audio : buildMulawWav(audio);
    const samples = mulawSamples(wav); // throws unless 8 kHz mono μ-law
    return { audio: wav, mimeType: 'audio/wav', durationSeconds: samples.length / TELEPHONY_SAMPLE_RATE };
}

export function createGoogleSynthesizer(deps: GoogleSpeechDeps = {}): SpeechSynthesizer {
    return {
        async synthesize({ text, speech }) {
            if (!text.trim()) throw new Error('Cannot synthesise empty text');
            const json = await postJson(deps, TTS_ENDPOINT, buildSynthesizeRequest(text, speech), `TTS ${speech.engine} ${speech.ttsLanguageCode}`);
            const content = json.audioContent;
            if (typeof content !== 'string' || content.length === 0) throw new Error('TTS response had no audioContent');
            return toTelephonyWav(Buffer.from(content, 'base64'));
        },
    };
}

export function recognizeUrl(project: string): string {
    return `https://${STT_LOCATION}-speech.googleapis.com/v2/projects/${project}/locations/${STT_LOCATION}/recognizers/_:recognize`;
}

interface RecognizeResponse {
    results?: { alternatives?: { transcript?: string; confidence?: number }[] }[];
}

export function createChirpVerifier(deps: GoogleSpeechDeps = {}): SpeechVerifier {
    return {
        async transcribe({ audio, sttLanguageCode }) {
            const body = {
                config: { autoDecodingConfig: {}, languageCodes: [sttLanguageCode], model: STT_MODEL },
                content: audio.toString('base64'),
            };
            const json = (await postJson(deps, recognizeUrl(projectOf(deps)), body, `STT ${STT_MODEL} ${sttLanguageCode}`)) as RecognizeResponse;
            const best = (json.results ?? []).map((r) => r.alternatives?.[0]).filter((a): a is { transcript?: string; confidence?: number } => !!a);
            const transcript = best.map((a) => (a.transcript ?? '').trim()).filter(Boolean).join(' ');
            const confidences = best.map((a) => a.confidence).filter((c): c is number => typeof c === 'number');
            const confidence = confidences.length ? confidences.reduce((s, c) => s + c, 0) / confidences.length : 0;
            return { transcript, confidence };
        },
    };
}
