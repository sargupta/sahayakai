/**
 * Live engine adapters for the call-quality bench. Every adapter takes its fetch and its key
 * getter as dependencies, so tests run them against a fake network. Keys are never logged or
 * echoed in an error.
 *
 *   Voices:      Google (the configured school voice per language, and Chirp 3 HD), Sarvam
 *                Bulbul v3, ElevenLabs (streaming; the first-byte time is real).
 *   Recognisers: Google Chirp 2 and Chirp 3, Sarvam Saarika, ElevenLabs Scribe.
 */

import { mulawEncode, resampleTo8k } from '@/lib/sampark/speech/dsp';
import { buildMulawWav, isRiffWave, parseWav, TELEPHONY_SAMPLE_RATE } from '@/lib/sampark/speech/wav';
import type { SpeechSynthesizer, SpeechVerifier } from '@/lib/sampark/ports';
import type { SpeechEngineConfig } from '@/lib/sampark/languages';
import type { ParentLanguage } from '@/types/sampark';

import type { SttEngine, TtsEngine } from './bench';

const ISO1: Record<ParentLanguage, string> = { English: 'en', Hindi: 'hi', Bengali: 'bn', Nepali: 'ne' };
const INDIA: Record<ParentLanguage, string> = { English: 'en-IN', Hindi: 'hi-IN', Bengali: 'bn-IN', Nepali: 'ne-IN' };

type KeyGetter = () => Promise<string>;

function redact(text: string, key: string): string {
    return key ? text.split(key).join('[redacted]') : text;
}

async function failure(res: Response, what: string, key: string): Promise<Error> {
    const body = redact((await res.text().catch(() => '')).slice(0, 200), key);
    return new Error(`${what}: HTTP ${res.status}${body ? ` ${body.replace(/\s+/g, ' ')}` : ''}`);
}

/** 16-bit PCM WAV at any rate ≥ 8 kHz → 8 kHz mono μ-law WAV (the phone line's format). */
export function pcmWavToTelephony(wav: Buffer): Buffer {
    const info = parseWav(wav);
    if (info.audioFormat === 7 && info.sampleRate === TELEPHONY_SAMPLE_RATE && info.channels === 1) return wav; // already μ-law 8 kHz
    if (info.audioFormat !== 1 || info.bitsPerSample !== 16) throw new Error(`expected 16-bit PCM WAV, got format ${info.audioFormat} ${info.bitsPerSample}-bit`);
    const frames = Math.floor(info.dataBytes / (2 * info.channels));
    const pcm = new Int16Array(frames);
    for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < info.channels; c++) sum += wav.readInt16LE(info.dataOffset + (i * info.channels + c) * 2);
        pcm[i] = Math.round(sum / info.channels);
    }
    const narrow = info.sampleRate === TELEPHONY_SAMPLE_RATE ? pcm : resampleTo8k(pcm, info.sampleRate);
    const mulaw = Buffer.alloc(narrow.length);
    for (let i = 0; i < narrow.length; i++) mulaw[i] = mulawEncode(narrow[i]);
    return buildMulawWav(mulaw);
}

// ── Google ──────────────────────────────────────────────────────────────────

/** A Google voice: `configFor` returns the engine config for a language, or null if this voice has none. */
export function googleVoice(name: string, synth: SpeechSynthesizer, configFor: (language: ParentLanguage) => SpeechEngineConfig | null): TtsEngine {
    return {
        name,
        streaming: false,
        supports: (language) => configFor(language) !== null,
        async synthesize(text, language) {
            const speech = configFor(language);
            if (!speech) throw new Error(`${name} has no voice for ${language}`);
            return { wav: (await synth.synthesize({ text, language, speech, delivery: 'plain' })).audio };
        },
    };
}

/** Chirp 3 HD: Indian English, Hindi and Bengali voices exist; Nepali (ne-NP) does not. */
export function chirp3HdConfig(voice = 'Kore') {
    return (language: ParentLanguage): SpeechEngineConfig | null =>
        language === 'Nepali'
            ? null
            : { engine: 'chirp3-hd', ttsLanguageCode: INDIA[language], voice: `${INDIA[language]}-Chirp3-HD-${voice}`, model: null, sttLanguageCode: INDIA[language] };
}

/** A recogniser behind the SpeechVerifier port (Chirp 2, Chirp 3, Saarika). */
export function verifierRecogniser(name: string, verifier: SpeechVerifier, codeFor: (language: ParentLanguage) => string | null): SttEngine {
    return {
        name,
        supports: (language) => codeFor(language) !== null,
        async transcribe(wav, language) {
            const code = codeFor(language);
            if (!code) throw new Error(`${name} does not recognise ${language}`);
            return (await verifier.transcribe({ audio: wav, mimeType: 'audio/wav', language, sttLanguageCode: code })).transcript;
        },
    };
}

// ── Sarvam ──────────────────────────────────────────────────────────────────

export const SARVAM_TTS_ENDPOINT = 'https://api.sarvam.ai/text-to-speech';
export const SARVAM_TTS_MODEL = 'bulbul:v3';
const SARVAM_TTS_LANGUAGES: readonly ParentLanguage[] = ['English', 'Hindi', 'Bengali'];

export function sarvamVoice(deps: { getApiKey: KeyGetter; fetchImpl?: typeof fetch; speaker?: string }): TtsEngine {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const speaker = deps.speaker ?? 'priya';
    return {
        name: `sarvam-${SARVAM_TTS_MODEL}-${speaker}`,
        streaming: false,
        supports: (language) => SARVAM_TTS_LANGUAGES.includes(language),
        async synthesize(text, language) {
            const key = (await deps.getApiKey()).trim();
            const res = await fetchImpl(SARVAM_TTS_ENDPOINT, {
                method: 'POST',
                headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, target_language_code: INDIA[language], model: SARVAM_TTS_MODEL, speaker, speech_sample_rate: '8000', output_audio_codec: 'wav' }),
            });
            if (!res.ok) throw await failure(res, `Sarvam TTS ${INDIA[language]}`, key);
            const json = (await res.json()) as { audios?: unknown[] };
            const b64 = json.audios?.[0];
            if (typeof b64 !== 'string' || !b64) throw new Error('Sarvam TTS returned no audio');
            const audio = Buffer.from(b64, 'base64');
            if (!isRiffWave(audio)) throw new Error('Sarvam TTS did not return a WAV');
            return { wav: pcmWavToTelephony(audio) };
        },
    };
}

// ── ElevenLabs ──────────────────────────────────────────────────────────────

export const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
/** Riya's voice on the hosted agent (RIYA_ELEVENLABS_INTEGRATION.md §1). Not a secret. */
export const RIYA_ELEVENLABS_VOICE_ID = 'zELrJnEGQSGWhiTNcUKq';

export function elevenLabsVoice(deps: {
    getApiKey: KeyGetter;
    now: () => number;
    fetchImpl?: typeof fetch;
    voiceId?: string;
    modelId?: string;
    languages?: readonly ParentLanguage[];
}): TtsEngine {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const voiceId = deps.voiceId ?? RIYA_ELEVENLABS_VOICE_ID;
    const modelId = deps.modelId ?? 'eleven_flash_v2_5';
    const languages = deps.languages ?? ['English', 'Hindi'];
    return {
        name: `elevenlabs-${modelId}`,
        streaming: true,
        supports: (language) => languages.includes(language),
        async synthesize(text, language) {
            const key = (await deps.getApiKey()).trim();
            const t0 = deps.now();
            const res = await fetchImpl(`${ELEVENLABS_API}/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=ulaw_8000`, {
                method: 'POST',
                headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/basic' },
                body: JSON.stringify({ text, model_id: modelId, language_code: ISO1[language] }),
            });
            if (!res.ok) throw await failure(res, `ElevenLabs TTS ${modelId} ${language}`, key);
            const chunks: Buffer[] = [];
            let firstAudioMs: number | undefined;
            if (res.body) {
                const reader = res.body.getReader();
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value && value.length) {
                        if (firstAudioMs === undefined) firstAudioMs = deps.now() - t0;
                        chunks.push(Buffer.from(value));
                    }
                }
            } else {
                // A runtime without streamed bodies: the first byte is only known with the last.
                chunks.push(Buffer.from(await res.arrayBuffer()));
                firstAudioMs = deps.now() - t0;
            }
            const raw = Buffer.concat(chunks);
            if (raw.length === 0) throw new Error('ElevenLabs TTS returned no audio');
            return { wav: isRiffWave(raw) ? pcmWavToTelephony(raw) : buildMulawWav(raw), firstAudioMs };
        },
    };
}

export function elevenLabsScribe(deps: { getApiKey: KeyGetter; fetchImpl?: typeof fetch; modelId?: string }): SttEngine {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const modelId = deps.modelId ?? 'scribe_v1';
    return {
        name: `elevenlabs-${modelId}`,
        supports: () => true,
        async transcribe(wav, language) {
            const key = (await deps.getApiKey()).trim();
            const form = new FormData();
            form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'reply.wav');
            form.append('model_id', modelId);
            form.append('language_code', ISO1[language]);
            const res = await fetchImpl(`${ELEVENLABS_API}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': key }, body: form });
            if (!res.ok) throw await failure(res, `ElevenLabs STT ${modelId} ${language}`, key);
            const json = (await res.json()) as { text?: unknown };
            if (typeof json.text !== 'string') throw new Error('ElevenLabs STT returned no text');
            return json.text.trim();
        },
    };
}
