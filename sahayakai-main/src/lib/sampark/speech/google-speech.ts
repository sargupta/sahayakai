/**
 * Google Cloud speech adapters for Sampark notice calls.
 *
 *   createGoogleSynthesizer — one synthesizer that dispatches on `speech.engine`
 *     (the engine per language is pinned in languages.ts):
 *       'gemini-tts' / 'chirp3-hd' → Cloud Text-to-Speech v1 REST, audio
 *         requested as 8 kHz μ-law (audioEncoding MULAW), telephony-ready as is.
 *       'gemini-tts-vertex' → Gemini-TTS through Vertex AI generateContent.
 *         Cloud TTS refuses `bn-IN` for every Gemini model, while the same models
 *         on Vertex accept it and sound native (CONVERSATION_PLAN.md §6.1). Vertex
 *         returns 24 kHz 16-bit PCM, converted here with dsp.ts (low-pass +
 *         decimate to 8 kHz, G.711 μ-law). This route NEVER sends a style prompt
 *         or any instruction text: an English instruction made the voice
 *         English-accented, and prompts have been read aloud into audio before.
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

import { mulawEncode, resampleTo8k } from './dsp';
import { buildMulawWav, isRiffWave, mulawSamples, parseWav, TELEPHONY_SAMPLE_RATE } from './wav';

export const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
export const STT_LOCATION = 'asia-southeast1';
export const STT_MODEL = 'chirp_2';
export const DEFAULT_GCP_PROJECT = 'sahayakai-b4248';

/**
 * Delivery hint for Gemini-TTS on Cloud TTS, sent ONLY with a campaign's main
 * message (`delivery: 'styled'`); never to Chirp 3 HD, which ignores it, and
 * never on the Vertex route, where nothing but the text is sent.
 *
 * History, because each step was learned live:
 *   - A longer "human" prompt that also asked to "say the date, time and place
 *     clearly" made the voice repeat sentences and invent a date in a Nepali
 *     confirmation (2026-09-30).
 *   - A strict prompt ("read exactly as written … natural pauses between
 *     sentences") still leaked: on 2026-10-01 the voice READ THE PROMPT ALOUD,
 *     transliterated into Nepali, inside a one-line confirmation.
 * Short clips are where the instruction outweighs the text, so they now get no
 * instruction at all, and this hint is a few words with nothing worth reading
 * out. Every clip is still transcribed back and length-checked before use.
 */
export const GEMINI_TTS_STYLE_PROMPT = 'Warm, calm and unhurried.';

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const REQUEST_TIMEOUT_MS = 60_000;
/**
 * Vertex generateContent is not streamed: R2 measured 35–55 s for 27 s of
 * Bengali audio, so a long message needs far more than Cloud TTS's 60 s.
 */
export const VERTEX_TTS_TIMEOUT_MS = 180_000;
/** Vertex location for Gemini-TTS; 'global' unless SAMPARK_TTS_VERTEX_LOCATION is set. */
export const DEFAULT_VERTEX_TTS_LOCATION = 'global';

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
    timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const maxRetries = deps.maxRetries ?? 5;
    const backoffMs = deps.backoffMs ?? 2000;
    const sleep = deps.sleep ?? defaultSleep;
    const payload = JSON.stringify(body);
    for (let attempt = 0; ; attempt++) {
        const token = await (deps.getAccessToken ?? adcAccessTokenProvider())();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
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
export function buildSynthesizeRequest(
    text: string,
    speech: SpeechEngineConfig,
    delivery: 'styled' | 'plain' = 'plain',
): Record<string, unknown> {
    if (speech.engine === 'gemini-tts-vertex') {
        throw new Error(`${speech.ttsLanguageCode} is a Vertex voice; Cloud TTS cannot render it (use buildVertexTtsRequest)`);
    }
    const audioConfig = { audioEncoding: 'MULAW', sampleRateHertz: TELEPHONY_SAMPLE_RATE };
    if (speech.engine === 'gemini-tts') {
        if (!speech.model) throw new Error(`Gemini-TTS for ${speech.ttsLanguageCode} needs a pinned model`);
        return {
            input: delivery === 'styled' ? { text, prompt: GEMINI_TTS_STYLE_PROMPT } : { text },
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

// ── Gemini-TTS through Vertex AI ────────────────────────────────────────────

/** The Vertex generateContent request body: the text, the voice and the language code, and nothing else. */
export interface VertexTtsRequest {
    contents: [{ role: 'user'; parts: [{ text: string }] }];
    generationConfig: {
        responseModalities: ['AUDIO'];
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: string } }; languageCode: string };
    };
}

export function vertexTtsLocation(): string {
    return process.env.SAMPARK_TTS_VERTEX_LOCATION?.trim() || DEFAULT_VERTEX_TTS_LOCATION;
}

/** generateContent URL. 'global' is served from aiplatform.googleapis.com, a region from its own host. */
export function vertexTtsUrl(project: string, model: string, location: string = vertexTtsLocation()): string {
    const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
    return `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

/** The pinned model of a Vertex voice; throws for any other engine or an unpinned model. */
function pinnedVertexModel(speech: SpeechEngineConfig): string {
    if (speech.engine !== 'gemini-tts-vertex') throw new Error(`${speech.engine} is not a Vertex voice`);
    if (!speech.model) throw new Error(`Gemini-TTS on Vertex for ${speech.ttsLanguageCode} needs a pinned model`);
    return speech.model;
}

/**
 * The exact Vertex request body (exported for class gate 15). There is no
 * `delivery` parameter on purpose: nothing but the text itself is ever sent as
 * content, for any clip, so no instruction can colour the accent or be read out.
 */
export function buildVertexTtsRequest(text: string, speech: SpeechEngineConfig): VertexTtsRequest {
    pinnedVertexModel(speech);
    return {
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: speech.voice } }, languageCode: speech.ttsLanguageCode },
        },
    };
}

/** Sample rate of raw 16-bit PCM from its MIME type, e.g. "audio/L16;codec=pcm;rate=24000" → 24000. */
export function pcmRateFromMimeType(mimeType: string): number {
    const [type, ...params] = mimeType.split(';').map((p) => p.trim().toLowerCase());
    if (type !== 'audio/l16' && type !== 'audio/pcm') throw new Error(`Vertex TTS returned unsupported audio "${mimeType}"`);
    const rate = Number(params.find((p) => p.startsWith('rate='))?.slice(5));
    if (!Number.isInteger(rate) || rate < TELEPHONY_SAMPLE_RATE) throw new Error(`Vertex TTS audio "${mimeType}" has no usable sample rate`);
    return rate;
}

interface GenerateContentResponse {
    candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
}

/** One audio part → 16-bit PCM samples and their rate. Raw L16/PCM, or a WAV container (gemini-3.8-flash-tts returns `audio/wav`). */
function decodeAudioPart(part: { mimeType?: string; data?: string }): { rate: number; pcm: Int16Array } {
    const bytes = Buffer.from(part.data ?? '', 'base64');
    const type = (part.mimeType ?? '').split(';')[0].trim().toLowerCase();
    if (type === 'audio/wav' || type === 'audio/x-wav' || type === 'audio/wave' || isRiffWave(bytes)) {
        const info = parseWav(bytes);
        if (info.audioFormat !== 1 || info.bitsPerSample !== 16 || info.channels < 1) {
            throw new Error(`Vertex TTS returned a WAV that is not 16-bit PCM (format ${info.audioFormat}, ${info.bitsPerSample}-bit, ${info.channels} ch)`);
        }
        if (info.sampleRate < TELEPHONY_SAMPLE_RATE) throw new Error(`Vertex TTS WAV rate ${info.sampleRate} is below telephony rate`);
        const frames = Math.floor(info.dataBytes / (2 * info.channels));
        const pcm = new Int16Array(frames);
        for (let i = 0; i < frames; i++) {
            // Mixed down to mono if a model ever returns more than one channel.
            let sum = 0;
            for (let c = 0; c < info.channels; c++) sum += bytes.readInt16LE(info.dataOffset + (i * info.channels + c) * 2);
            pcm[i] = Math.round(sum / info.channels);
        }
        return { rate: info.sampleRate, pcm };
    }
    const rate = pcmRateFromMimeType(part.mimeType ?? '');
    const pcm = new Int16Array(bytes.length >> 1);
    for (let i = 0; i < pcm.length; i++) pcm[i] = bytes.readInt16LE(i * 2);
    return { rate, pcm };
}

/**
 * A generateContent response → an 8 kHz μ-law WAV. Every audio part is joined
 * in order (long text can come back in several), at the rate its MIME type or
 * WAV header states. Gemini's raw PCM is little-endian, whatever RFC 2586 says
 * about L16; newer models wrap it in a WAV container instead.
 */
export function vertexResponseToTelephonyWav(json: unknown): SynthesisResult {
    const res = json as GenerateContentResponse;
    const candidate = res.candidates?.[0];
    const audioParts = (candidate?.content?.parts ?? []).flatMap((p) => (p.inlineData?.data ? [p.inlineData] : []));
    if (audioParts.length === 0) {
        const why = res.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'no candidate';
        throw new Error(`Vertex TTS response had no audio (${why})`);
    }
    const decoded = audioParts.map(decodeAudioPart);
    const rates = new Set(decoded.map((d) => d.rate));
    if (rates.size !== 1) throw new Error(`Vertex TTS returned audio parts at different rates: ${[...rates].join(', ')}`);
    const [rate] = rates;
    const total = decoded.reduce((n, d) => n + d.pcm.length, 0);
    const pcm = new Int16Array(total);
    let at = 0;
    for (const d of decoded) {
        pcm.set(d.pcm, at);
        at += d.pcm.length;
    }
    const narrow = resampleTo8k(pcm, rate);
    const mulaw = Buffer.alloc(narrow.length);
    for (let i = 0; i < narrow.length; i++) mulaw[i] = mulawEncode(narrow[i]);
    return toTelephonyWav(buildMulawWav(mulaw));
}

export function createGoogleSynthesizer(deps: GoogleSpeechDeps = {}): SpeechSynthesizer {
    return {
        async synthesize({ text, speech, delivery }) {
            if (!text.trim()) throw new Error('Cannot synthesise empty text');
            const what = `TTS ${speech.engine} ${speech.ttsLanguageCode}`;
            if (speech.engine === 'gemini-tts-vertex') {
                // `delivery` is deliberately not read on this route (see buildVertexTtsRequest).
                const url = vertexTtsUrl(projectOf(deps), pinnedVertexModel(speech));
                const json = await postJson(deps, url, buildVertexTtsRequest(text, speech), what, VERTEX_TTS_TIMEOUT_MS);
                return vertexResponseToTelephonyWav(json);
            }
            const json = await postJson(deps, TTS_ENDPOINT, buildSynthesizeRequest(text, speech, delivery ?? 'plain'), what);
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
