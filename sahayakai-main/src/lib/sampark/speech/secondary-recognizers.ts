/**
 * The second, INDEPENDENT recogniser for the hard-word probe (probe.ts).
 *
 * The probe only means something if a mispronounced word fails two recognisers
 * that do not share a model: one recogniser can "hear" the right word from
 * context. Chirp 2 is the primary everywhere (google-speech.ts); the second is
 *
 *   createSarvamVerifier — Sarvam Saarika v2.5 (REST, multipart), for bn-IN,
 *     hi-IN and en-IN: a non-Google model. Key: secret SARVAM_AI_API_KEY via
 *     getSecret (env var first, then Secret Manager); it never appears in an
 *     error or a log line.
 *   createChirp3Verifier — Google Speech v2 model chirp_3, for Nepali only,
 *     because Saarika has no Nepali (it answers "Language 'ne-IN' is not
 *     supported by saarika:v2.5", checked live 2026-10-07). Chirp 3 is a
 *     different model generation from Chirp 2, but it only runs in the `us`
 *     multi-region. That is acceptable for THIS check alone: probe sentences
 *     are fixed synthetic text, never a parent's or a child's data. Never use
 *     this verifier for anything that carries personal data.
 *
 * Both accept the 8 kHz μ-law WAV the synthesizer produces as-is (Saarika
 * checked live on the R2 samples; Google decodes it with autoDecodingConfig).
 */

import type { ParentLanguage } from '@/types/sampark';
import type { SpeechVerifier } from '@/lib/sampark/ports';

import { adcAccessTokenProvider, DEFAULT_GCP_PROJECT, isTransientFetchError, type GoogleSpeechDeps } from './google-speech';

export const SARVAM_STT_ENDPOINT = 'https://api.sarvam.ai/speech-to-text';
export const SARVAM_STT_MODEL = 'saarika:v2.5';
/** The parent languages Saarika v2.5 recognises. */
export const SARVAM_STT_LANGUAGES: readonly string[] = ['bn-IN', 'hi-IN', 'en-IN'];

export const CHIRP3_LOCATION = 'us';
export const CHIRP3_MODEL = 'chirp_3';

const REQUEST_TIMEOUT_MS = 60_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface RetryOptions {
    fetchImpl: typeof fetch;
    maxRetries: number;
    backoffMs: number;
    sleep: (ms: number) => Promise<void>;
}

/**
 * POST with a timeout, retrying 429 / 5xx and dropped connections with
 * exponential backoff. `init` is rebuilt per attempt (a multipart body and a
 * fresh token each time). Returns the parsed JSON body of a 2xx reply, or the
 * failing status and a short detail for the caller to word.
 */
async function postWithRetry(
    opts: RetryOptions,
    url: string,
    init: () => Promise<RequestInit>,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; status: number; detail: string }> {
    for (let attempt = 0; ; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            let res: Response;
            try {
                res = await opts.fetchImpl(url, { ...(await init()), method: 'POST', signal: controller.signal });
            } catch (err) {
                if (isTransientFetchError(err) && attempt < opts.maxRetries) {
                    await opts.sleep(opts.backoffMs * 2 ** attempt + Math.floor(Math.random() * 250));
                    continue;
                }
                throw err;
            }
            if (res.ok) return { ok: true, json: (await res.json()) as Record<string, unknown> };
            const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
            if (RETRYABLE_STATUS.has(res.status) && attempt < opts.maxRetries) {
                const retryAfter = Number(res.headers?.get?.('retry-after'));
                const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : opts.backoffMs * 2 ** attempt;
                await opts.sleep(wait + Math.floor(Math.random() * 250));
                continue;
            }
            return { ok: false, status: res.status, detail };
        } finally {
            clearTimeout(timer);
        }
    }
}

// ── Sarvam Saarika ──────────────────────────────────────────────────────────

export interface SarvamVerifierDeps {
    fetchImpl?: typeof fetch;
    getApiKey?: () => Promise<string>;
    /** Retries on 429 / 5xx / dropped connections (default 3). */
    maxRetries?: number;
    /** Backoff base in ms (default 1000). */
    backoffMs?: number;
    sleep?: (ms: number) => Promise<void>;
}

async function defaultSarvamKey(): Promise<string> {
    // Imported lazily so loading this module (tests, the probe) never pulls in Secret Manager.
    const { getSecret } = await import('@/lib/secrets');
    return getSecret('SARVAM_AI_API_KEY');
}

/** Sarvam's error body is {"error":{"message","code"}}; keep the message and code only. */
function sarvamDetail(detail: string): string {
    try {
        const parsed = JSON.parse(detail) as { error?: { message?: unknown; code?: unknown } };
        const message = typeof parsed.error?.message === 'string' ? parsed.error.message : '';
        const code = typeof parsed.error?.code === 'string' ? parsed.error.code : '';
        if (message || code) return [code, message].filter(Boolean).join(': ');
    } catch {
        // not JSON: fall through to the raw (already truncated) text
    }
    return detail;
}

export function createSarvamVerifier(deps: SarvamVerifierDeps = {}): SpeechVerifier {
    const getApiKey = deps.getApiKey ?? defaultSarvamKey;
    const opts: RetryOptions = {
        fetchImpl: deps.fetchImpl ?? fetch,
        maxRetries: deps.maxRetries ?? 3,
        backoffMs: deps.backoffMs ?? 1000,
        sleep: deps.sleep ?? defaultSleep,
    };
    return {
        async transcribe({ audio, sttLanguageCode }) {
            if (!SARVAM_STT_LANGUAGES.includes(sttLanguageCode)) {
                throw new Error(`Sarvam ${SARVAM_STT_MODEL} does not recognise ${sttLanguageCode} (supported here: ${SARVAM_STT_LANGUAGES.join(', ')})`);
            }
            const apiKey = (await getApiKey()).trim();
            if (!apiKey) throw new Error('Sarvam STT: SARVAM_AI_API_KEY is empty');
            const what = `Sarvam STT ${SARVAM_STT_MODEL} ${sttLanguageCode}`;
            const result = await postWithRetry(opts, SARVAM_STT_ENDPOINT, async () => {
                const form = new FormData();
                form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'probe.wav');
                form.append('model', SARVAM_STT_MODEL);
                form.append('language_code', sttLanguageCode);
                return { headers: { 'api-subscription-key': apiKey }, body: form };
            });
            if (!result.ok) {
                // Never echo the key, even if a proxy ever reflected it back.
                const detail = sarvamDetail(result.detail).split(apiKey).join('[redacted]');
                if (result.status === 401 || result.status === 403) {
                    throw new Error(`${what} rejected the API key (HTTP ${result.status}${detail ? ` ${detail}` : ''}); check SARVAM_AI_API_KEY`);
                }
                throw new Error(`${what} failed: HTTP ${result.status}${detail ? ` ${detail}` : ''}`);
            }
            const transcript = result.json.transcript;
            if (typeof transcript !== 'string') throw new Error(`${what} returned no transcript`);
            // Saarika reports no confidence; the probe does not use one.
            return { transcript: transcript.trim(), confidence: 0 };
        },
    };
}

// ── Google Chirp 3 (Nepali) ─────────────────────────────────────────────────

export function chirp3RecognizeUrl(project: string): string {
    return `https://${CHIRP3_LOCATION}-speech.googleapis.com/v2/projects/${project}/locations/${CHIRP3_LOCATION}/recognizers/_:recognize`;
}

interface RecognizeResponse {
    results?: { alternatives?: { transcript?: string; confidence?: number }[] }[];
}

export function createChirp3Verifier(deps: GoogleSpeechDeps = {}): SpeechVerifier {
    const project = deps.project ?? process.env.SAMPARK_GCP_PROJECT ?? DEFAULT_GCP_PROJECT;
    const opts: RetryOptions = {
        fetchImpl: deps.fetchImpl ?? fetch,
        maxRetries: deps.maxRetries ?? 5,
        backoffMs: deps.backoffMs ?? 2000,
        sleep: deps.sleep ?? defaultSleep,
    };
    return {
        async transcribe({ audio, sttLanguageCode }) {
            const payload = JSON.stringify({
                config: { autoDecodingConfig: {}, languageCodes: [sttLanguageCode], model: CHIRP3_MODEL },
                content: audio.toString('base64'),
            });
            const result = await postWithRetry(opts, chirp3RecognizeUrl(project), async () => ({
                headers: {
                    Authorization: `Bearer ${await (deps.getAccessToken ?? adcAccessTokenProvider())()}`,
                    'Content-Type': 'application/json; charset=utf-8',
                    'x-goog-user-project': project,
                },
                body: payload,
            }));
            if (!result.ok) throw new Error(`STT ${CHIRP3_MODEL} ${sttLanguageCode} failed: HTTP ${result.status} ${result.detail}`);
            const json = result.json as RecognizeResponse;
            const best = (json.results ?? []).map((r) => r.alternatives?.[0]).filter((a): a is { transcript?: string; confidence?: number } => !!a);
            const transcript = best.map((a) => (a.transcript ?? '').trim()).filter(Boolean).join(' ');
            const confidences = best.map((a) => a.confidence).filter((c): c is number => typeof c === 'number');
            const confidence = confidences.length ? confidences.reduce((s, c) => s + c, 0) / confidences.length : 0;
            return { transcript, confidence };
        },
    };
}

/** Which independent recogniser checks a language's probe alongside Chirp 2. */
export function secondaryRecognizerFor(language: ParentLanguage): 'sarvam' | 'chirp3' {
    return language === 'Nepali' ? 'chirp3' : 'sarvam';
}
