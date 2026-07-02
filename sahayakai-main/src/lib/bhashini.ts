import 'server-only';
import { getSecret } from '@/lib/secrets';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Bhashini (ULCA / Dhruva) TTS client.
//
// Why this exists — voice equity. Sarvam (Bulbul v3) is our primary Indic
// voice and covers all 11 languages, but when Sarvam is down our only
// fallback is Google Cloud TTS, whose Indic catalogue is uneven: Telugu and
// Marathi get Standard-tier voices and Odia has NO Google voice at all (it is
// read phonetically through a Hindi voice). Bhashini — the Government of
// India's national language platform — has genuine native models for exactly
// these under-served languages, so we slot it BETWEEN Sarvam and Google for
// te / mr / or to close the quality gap.
//
// Integration model: the ULCA pipeline-config handshake (model discovery +
// per-request auth) is operationally heavy. In production we cache the
// resolved Dhruva inference endpoint, its auth header, and the per-language
// TTS serviceId as config, then call the compute endpoint directly. All of it
// is gated behind env / Secret Manager keys: if Bhashini is not configured,
// `bhashiniTTS` throws a clear "not configured" error and the caller falls
// through to Google exactly as before.
// ---------------------------------------------------------------------------

// Languages we route to Bhashini as a fallback tier. These are precisely the
// ones where Google's voice quality is weakest (Standard-only or absent).
const BHASHINI_FALLBACK_LANGS = new Set(['te-IN', 'mr-IN', 'or-IN']);

const TTS_TIMEOUT_MS = 9_000;
// Bhashini TTS output is a single WAV per call. WAV blobs cannot be safely
// concatenated by raw byte-append (each carries its own RIFF header), so we do
// NOT chunk: a single call returns one valid blob. Reject very long input and
// let the caller fall through to Google (which does chunk) rather than emit a
// corrupt stitched WAV.
const MAX_INPUT_CHARS = 2000;

/** True if we should attempt Bhashini for this BCP-47 code. */
export function bhashiniSupportsLang(bcp47: string): boolean {
    return BHASHINI_FALLBACK_LANGS.has(bcp47);
}

/** Map our internal BCP-47 codes to Bhashini's 2-letter source-language codes. */
function toBhashiniLangCode(bcp47: string): string | null {
    switch (bcp47) {
        case 'te-IN': return 'te';
        case 'mr-IN': return 'mr';
        case 'or-IN': return 'or';
        default: return null;
    }
}

interface BhashiniConfig {
    inferenceUrl: string;
    apiKey: string;
    /** Per-language TTS serviceId, JSON map e.g. {"te":"...","mr":"...","or":"..."} */
    serviceIds: Record<string, string>;
}

let _configCache: BhashiniConfig | null = null;

/**
 * Resolve Bhashini config from Secret Manager / env. Throws if anything
 * required is missing so the caller treats Bhashini as unavailable and falls
 * through to Google.
 */
async function getConfig(): Promise<BhashiniConfig> {
    if (_configCache) return _configCache;

    const inferenceUrl = (await getSecret('BHASHINI_INFERENCE_URL').catch(() => '')).trim();
    const apiKey = (await getSecret('BHASHINI_INFERENCE_API_KEY').catch(() => '')).trim();
    const serviceIdsRaw = (await getSecret('BHASHINI_TTS_SERVICE_IDS').catch(() => '')).trim();

    if (!inferenceUrl || !apiKey || !serviceIdsRaw) {
        throw new Error('Bhashini not configured');
    }

    let serviceIds: Record<string, string>;
    try {
        serviceIds = JSON.parse(serviceIdsRaw);
    } catch {
        throw new Error('Bhashini BHASHINI_TTS_SERVICE_IDS is not valid JSON');
    }

    _configCache = { inferenceUrl, apiKey, serviceIds };
    return _configCache;
}

/**
 * Synthesise speech via Bhashini Dhruva. Returns base64 audio (WAV).
 * Throws on any failure — caller should fall back to Google.
 */
export async function bhashiniTTS(text: string, bcp47: string): Promise<{ audioContent: string }> {
    const lang = toBhashiniLangCode(bcp47);
    if (!lang) throw new Error(`Bhashini does not handle ${bcp47}`);
    if (text.length > MAX_INPUT_CHARS) {
        throw new Error(`Bhashini input ${text.length} chars exceeds ${MAX_INPUT_CHARS} cap`);
    }

    const cfg = await getConfig();
    const serviceId = cfg.serviceIds[lang];
    if (!serviceId) throw new Error(`Bhashini has no serviceId for ${lang}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
    try {
        const res = await fetch(cfg.inferenceUrl, {
            method: 'POST',
            headers: {
                'Authorization': cfg.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pipelineTasks: [{
                    taskType: 'tts',
                    config: {
                        language: { sourceLanguage: lang },
                        serviceId,
                        gender: 'female',
                        samplingRate: 22050,
                    },
                }],
                inputData: { input: [{ source: text }] },
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Bhashini ${res.status}: ${body.slice(0, 200)}`);
        }

        const data = await res.json();
        const audioContent: string | undefined =
            data?.pipelineResponse?.[0]?.audio?.[0]?.audioContent;
        if (!audioContent) throw new Error('Bhashini returned empty audio');

        return { audioContent };
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error(`Bhashini timeout after ${TTS_TIMEOUT_MS}ms`);
        }
        logger.warn(`[Bhashini] TTS failed for ${bcp47}: ${err?.message}`, 'BHASHINI');
        throw err;
    } finally {
        clearTimeout(timer);
    }
}
