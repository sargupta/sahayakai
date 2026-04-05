import 'server-only';
import { getSecret } from '@/lib/secrets';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Sarvam AI API Client — TTS (Bulbul v3) + STT (Saaras v3)
// Docs: https://docs.sarvam.ai
// ---------------------------------------------------------------------------

const SARVAM_BASE_URL = 'https://api.sarvam.ai';

// Bulbul v3 hard limit — requests > 2500 chars are rejected
const TTS_MAX_CHARS = 2500;
const TTS_TIMEOUT_MS = 8_000;
const STT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

// Warm female voice for VIDYA persona (tested: priya is clear and warm)
const DEFAULT_SPEAKER = 'priya';

/** Language codes supported by Sarvam TTS (Bulbul v3) */
const SARVAM_TTS_LANGUAGES = new Set([
    'bn-IN', 'en-IN', 'gu-IN', 'hi-IN', 'kn-IN',
    'ml-IN', 'mr-IN', 'od-IN', 'pa-IN', 'ta-IN', 'te-IN',
]);

/**
 * Map our internal BCP-47 codes to Sarvam's codes.
 * All match exactly — the only special case is Odia which Google doesn't support
 * but Sarvam does as 'od-IN'. Callers may also pass the detectLangCode output
 * which won't include Odia (it falls through to en-IN) — the TTS route handles
 * Odia detection separately via Unicode \u0B00-\u0B7F.
 */
export function toSarvamLangCode(bcp47: string): string | null {
    if (SARVAM_TTS_LANGUAGES.has(bcp47)) return bcp47;
    // Odia text detected by Unicode but coded as or-IN internally
    if (bcp47 === 'or-IN') return 'od-IN';
    return null; // unsupported language — caller should fall back to Google
}

// ---- Internal helpers -------------------------------------------------------

let _apiKeyCache: string | null = null;

async function getApiKey(): Promise<string> {
    if (_apiKeyCache) return _apiKeyCache;
    _apiKeyCache = await getSecret('SARVAM_AI_API_KEY');
    return _apiKeyCache;
}

async function fetchWithRetry(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    retries = MAX_RETRIES,
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const res = await fetch(url, { ...init, signal: controller.signal });

            // Retry only on transient errors
            if (res.status === 429 || res.status >= 500) {
                const body = await res.text().catch(() => '');
                lastError = new Error(`Sarvam ${res.status}: ${body.slice(0, 200)}`);
                if (attempt < retries) {
                    const delay = (attempt + 1) * 1000; // 1s, 2s
                    logger.warn(`[Sarvam] ${res.status} on attempt ${attempt + 1}, retrying in ${delay}ms`, 'SARVAM');
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                throw lastError;
            }

            // Non-retryable client errors (400, 403, 422) — throw immediately
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Sarvam ${res.status}: ${body.slice(0, 300)}`);
            }

            return res;
        } catch (err: any) {
            if (err.name === 'AbortError') {
                lastError = new Error(`Sarvam timeout after ${timeoutMs}ms`);
            } else {
                lastError = err;
            }
            if (attempt < retries && (err.name === 'AbortError' || err.message?.includes('fetch failed'))) {
                const delay = (attempt + 1) * 1000;
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw lastError;
        } finally {
            clearTimeout(timer);
        }
    }

    throw lastError ?? new Error('Sarvam request failed');
}

// ---- TTS (Bulbul v3) --------------------------------------------------------

/**
 * Split text into chunks ≤ maxLen on sentence boundaries.
 * Handles English (.), Hindi/Devanagari (।), and pipe separator (|).
 */
function chunkText(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
            chunks.push(remaining);
            break;
        }

        // Find the last sentence boundary within maxLen
        const slice = remaining.slice(0, maxLen);
        // Search backwards for sentence enders: . ? ! । ।। (Devanagari danda)
        let splitIdx = -1;
        for (let i = slice.length - 1; i >= Math.floor(maxLen * 0.5); i--) {
            const ch = slice[i];
            if (ch === '.' || ch === '?' || ch === '!' || ch === '।' || ch === '|') {
                splitIdx = i + 1;
                break;
            }
        }

        // If no sentence boundary found in the last half, split at last space
        if (splitIdx === -1) {
            splitIdx = slice.lastIndexOf(' ');
            if (splitIdx === -1) splitIdx = maxLen; // worst case: hard cut
        }

        chunks.push(remaining.slice(0, splitIdx).trim());
        remaining = remaining.slice(splitIdx).trim();
    }

    return chunks.filter(c => c.length > 0);
}

/**
 * Concatenate multiple base64-encoded MP3 chunks into one.
 * MP3 frames are independently decodable, so simple concatenation works.
 */
function concatBase64Mp3(chunks: string[]): string {
    if (chunks.length === 1) return chunks[0];
    const buffers = chunks.map(c => Buffer.from(c, 'base64'));
    return Buffer.concat(buffers).toString('base64');
}

export interface SarvamTTSOptions {
    speaker?: string;
    pace?: number;
}

/**
 * Generate speech audio from text using Sarvam Bulbul v3.
 * Returns base64-encoded MP3 audio matching the contract expected by our TTS route.
 *
 * Handles text > 2500 chars by chunking on sentence boundaries.
 * Throws on unrecoverable errors — caller should fall back to Google.
 */
export async function sarvamTTS(
    text: string,
    langCode: string,
    options?: SarvamTTSOptions,
): Promise<{ audioContent: string }> {
    const apiKey = await getApiKey();
    const chunks = chunkText(text, TTS_MAX_CHARS);

    const audioChunks: string[] = [];

    for (const chunk of chunks) {
        const res = await fetchWithRetry(
            `${SARVAM_BASE_URL}/text-to-speech`,
            {
                method: 'POST',
                headers: {
                    'api-subscription-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: chunk,
                    target_language_code: langCode,
                    model: 'bulbul:v3',
                    speaker: options?.speaker ?? DEFAULT_SPEAKER,
                    pace: options?.pace ?? 0.92,
                    output_audio_codec: 'mp3',
                    speech_sample_rate: '24000',
                }),
            },
            TTS_TIMEOUT_MS,
        );

        const data = await res.json();
        if (!data.audios?.[0]) {
            throw new Error('Sarvam TTS returned empty audio');
        }
        audioChunks.push(data.audios[0]);
    }

    return { audioContent: concatBase64Mp3(audioChunks) };
}

// ---- STT (Saaras v3) --------------------------------------------------------

export interface SarvamSTTResult {
    text: string;
    language?: string;
}

/**
 * Transcribe audio using Sarvam Saaras v3.
 * Accepts a File/Blob (from FormData) or a Buffer.
 * Returns { text, language } matching the contract expected by our voice-to-text route.
 */
export async function sarvamSTT(
    audioFile: File | Blob,
    langCode?: string,
): Promise<SarvamSTTResult> {
    const apiKey = await getApiKey();

    const formData = new FormData();
    formData.append('file', audioFile, 'recording.webm');
    formData.append('model', 'saaras:v3');
    formData.append('mode', 'transcribe');
    if (langCode) {
        formData.append('language_code', langCode);
    }

    const res = await fetchWithRetry(
        `${SARVAM_BASE_URL}/speech-to-text`,
        {
            method: 'POST',
            headers: {
                'api-subscription-key': apiKey,
                // Content-Type is set automatically by FormData
            },
            body: formData as any,
        },
        STT_TIMEOUT_MS,
    );

    const data = await res.json();

    if (!data.transcript) {
        throw new Error('Sarvam STT returned empty transcript');
    }

    // Normalize Sarvam's BCP-47 (hi-IN) to our 2-letter code (hi)
    const detectedLang = data.language_code
        ? data.language_code.split('-')[0]
        : undefined;

    return {
        text: data.transcript,
        language: detectedLang,
    };
}
