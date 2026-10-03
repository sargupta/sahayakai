/**
 * Sarvam Bulbul v3 text-to-speech adapter. BAKE-OFF ONLY for now.
 *
 * UNVERIFIED AGAINST THE LIVE API. This was written from Sarvam's published
 * REST shape without being able to call it (no key in the authoring sandbox):
 *
 *   POST https://api.sarvam.ai/text-to-speech
 *   header  api-subscription-key: <key>
 *   body    { text, target_language_code: "hi-IN", speaker: "priya", model: "bulbul:v3",
 *             pace?: 0.5..2.0, speech_sample_rate: 8000, output_audio_codec: "wav" }
 *   200     { request_id, audios: ["<base64 WAV>"] }
 *
 * Things the first live run must confirm, in this order (VOICE_BAKEOFF.md):
 *   1. the field names and the 8000 Hz sample rate are accepted for bulbul:v3;
 *   2. the returned WAV is 16-bit PCM (re-encoded to μ-law here) or μ-law;
 *   3. the speaker names ("priya", "ritu") exist for v3;
 *   4. the pace range (0.5-2.0) and any per-request character limit.
 *
 * Bulbul v3 has NO Nepali. This adapter refuses any locale not in
 * PROVIDER_LOCALES['sarvam-bulbul'], so a Nepali request fails before the
 * network, and voice-profile validation rejects such a profile at load time.
 *
 * Gated: it throws unless SARVAM_BULBUL_ENABLED=1 and SARVAM_API_KEY is set,
 * so nothing calls Sarvam by accident. Not wired into the production render job.
 */

import type { SynthesisResult } from '@/lib/sampark/ports';
import { PROVIDER_LOCALES, PROVIDER_PACE_RANGE } from '@/lib/sampark/voice-profile';

import { pcm16ToMulaw } from './g711';
import type { Synthesizer, SynthProfile } from './synthesizer';
import { buildMulawWav, isRiffWave, MULAW_FORMAT, mulawSamples, parseWav, TELEPHONY_SAMPLE_RATE } from './wav';

export const SARVAM_TTS_ENDPOINT = 'https://api.sarvam.ai/text-to-speech';
export const SARVAM_MODEL = 'bulbul:v3';
const REQUEST_TIMEOUT_MS = 60_000;

export interface SarvamDeps {
    fetchImpl?: typeof fetch;
    apiKey?: string;
    /** Defaults to process.env.SARVAM_BULBUL_ENABLED === '1'. */
    enabled?: boolean;
    maxRetries?: number;
    backoffMs?: number;
    sleep?: (ms: number) => Promise<void>;
}

export function sarvamEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.SARVAM_BULBUL_ENABLED === '1';
}

/** The exact request body for a text and profile (exported for tests). */
export function buildSarvamRequest(text: string, profile: SynthProfile): Record<string, unknown> {
    if (profile.provider !== 'sarvam-bulbul') throw new Error(`sarvam adapter cannot render provider ${profile.provider}`);
    if (!PROVIDER_LOCALES['sarvam-bulbul'][profile.localeCode]) {
        throw new Error(`Sarvam Bulbul v3 has no ${profile.localeCode} (it has no Nepali); refusing to send`);
    }
    if (profile.model !== SARVAM_MODEL) throw new Error(`Sarvam profile must be pinned to ${SARVAM_MODEL}`);
    const body: Record<string, unknown> = {
        text,
        target_language_code: profile.localeCode,
        speaker: profile.voice,
        model: SARVAM_MODEL,
        speech_sample_rate: TELEPHONY_SAMPLE_RATE,
        output_audio_codec: 'wav',
    };
    if (profile.speakingRate !== null) {
        const range = PROVIDER_PACE_RANGE['sarvam-bulbul']!;
        if (profile.speakingRate < range.min || profile.speakingRate > range.max) {
            throw new Error(`Sarvam pace ${profile.speakingRate} is outside ${range.min}-${range.max}`);
        }
        body.pace = profile.speakingRate;
    }
    return body;
}

/** Normalise Sarvam's WAV (16-bit PCM or μ-law, 8 kHz mono) to the telephony μ-law WAV. */
export function sarvamWavToTelephony(audio: Buffer): SynthesisResult {
    if (!isRiffWave(audio)) throw new Error('Sarvam response was not a WAV');
    const info = parseWav(audio);
    if (info.sampleRate !== TELEPHONY_SAMPLE_RATE || info.channels !== 1) {
        throw new Error(`Sarvam returned ${info.sampleRate} Hz / ${info.channels} ch; expected 8000 Hz mono (UNVERIFIED API behaviour)`);
    }
    let wav: Buffer;
    if (info.audioFormat === MULAW_FORMAT) wav = audio;
    else if (info.audioFormat === 1 && info.bitsPerSample === 16) {
        wav = buildMulawWav(pcm16ToMulaw(audio.subarray(info.dataOffset, info.dataOffset + info.dataBytes)));
    } else throw new Error(`Sarvam returned WAV format ${info.audioFormat}/${info.bitsPerSample}-bit; expected 16-bit PCM or μ-law`);
    const samples = mulawSamples(wav);
    return { audio: wav, mimeType: 'audio/wav', durationSeconds: samples.length / TELEPHONY_SAMPLE_RATE };
}

export function createSarvamSynthesizer(deps: SarvamDeps = {}): Synthesizer {
    return {
        id: 'sarvam',
        async synthesize({ text, profile }) {
            if (!(deps.enabled ?? sarvamEnabled())) throw new Error('Sarvam is disabled: set SARVAM_BULBUL_ENABLED=1 to run the bake-off against it');
            const apiKey = deps.apiKey ?? process.env.SARVAM_API_KEY;
            if (!apiKey) throw new Error('SARVAM_API_KEY is not set');
            if (!text.trim()) throw new Error('Cannot synthesise empty text');
            const payload = JSON.stringify(buildSarvamRequest(text, profile));
            const fetchImpl = deps.fetchImpl ?? fetch;
            const maxRetries = deps.maxRetries ?? 3;
            const backoffMs = deps.backoffMs ?? 2000;
            const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
            for (let attempt = 0; ; attempt++) {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
                try {
                    const res = await fetchImpl(SARVAM_TTS_ENDPOINT, {
                        method: 'POST',
                        headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
                        body: payload,
                        signal: controller.signal,
                    });
                    if (res.ok) {
                        const json = (await res.json()) as { audios?: unknown };
                        const first = Array.isArray(json.audios) ? json.audios[0] : undefined;
                        if (typeof first !== 'string' || !first) throw new Error('Sarvam response had no audios[0]');
                        return sarvamWavToTelephony(Buffer.from(first, 'base64'));
                    }
                    const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
                    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
                        await sleep(backoffMs * 2 ** attempt);
                        continue;
                    }
                    throw new Error(`Sarvam TTS failed: HTTP ${res.status} ${detail}`);
                } finally {
                    clearTimeout(timer);
                }
            }
        },
    };
}
