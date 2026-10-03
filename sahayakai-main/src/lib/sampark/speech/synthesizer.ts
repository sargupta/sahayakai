/**
 * The pluggable synthesizer behind the voice bake-off (docs/sampark/VOICE_BAKEOFF.md).
 *
 * `SpeechSynthesizer` (ports.ts) is what the production render job calls: it
 * receives an engine config. `Synthesizer` is the same job keyed on a whole
 * voice PROFILE, so a bake-off can swap providers behind one interface:
 *
 *   google (gemini-tts, chirp3-hd)  - this file, reusing the production request builder
 *   sarvam-bulbul                   - sarvam-speech.ts (behind an env flag, UNVERIFIED live)
 *   a benchmark-only provider       - lives under scripts/ (never src/), see VOICE_BAKEOFF.md
 *
 * Every Synthesizer must return 8 kHz mono G.711 μ-law in a WAV container,
 * the format the dialler plays, so clips from different providers are
 * measured, transcribed back and listened to as the parent would hear them.
 */

import { toSpeechConfig } from '@/lib/sampark/languages';
import type { SpeechSynthesizer, SynthesisResult } from '@/lib/sampark/ports';

import { createGoogleSynthesizer, type GoogleSpeechDeps } from './google-speech';

/** The slice of a voice profile a synthesizer needs (a bake-off may also carry non-production providers). */
export interface SynthProfile {
    provider: string;
    model: string | null;
    voice: string;
    localeCode: string;
    sttLanguageCode: string;
    speakingRate: number | null;
    stylePrompt: string | null;
}

export interface Synthesizer {
    readonly id: string;
    synthesize(req: { text: string; profile: SynthProfile; delivery: 'styled' | 'plain' }): Promise<SynthesisResult>;
}

/** Cloud TTS (Gemini-TTS and Chirp 3 HD) driven by a profile, via the production request builder. */
export function createGoogleProfileSynthesizer(deps: GoogleSpeechDeps = {}): Synthesizer {
    const inner = createGoogleSynthesizer(deps);
    return {
        id: 'google',
        async synthesize({ text, profile, delivery }) {
            if (profile.provider !== 'gemini-tts' && profile.provider !== 'chirp3-hd') {
                throw new Error(`google synthesizer cannot render provider ${profile.provider}`);
            }
            // `language` is informational only for the Google adapter.
            return inner.synthesize({ text, language: 'English', speech: toSpeechConfig({ ...profile, provider: profile.provider }), delivery });
        },
    };
}

/** Adapt a profile-keyed Synthesizer to the port the render job's `synthesizeClip` takes, pinned to one profile. */
export function asSpeechSynthesizer(synth: Synthesizer, profile: SynthProfile): SpeechSynthesizer {
    return { synthesize: ({ text, delivery }) => synth.synthesize({ text, profile, delivery: delivery ?? 'plain' }) };
}
