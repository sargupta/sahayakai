/**
 * ElevenLabs: BENCHMARK ONLY. Never a production provider.
 *
 * This lets the founder hear what a premium voice sounds like next to the
 * Google and Sarvam candidates, to calibrate listening scores. It is
 * deliberately outside `src/`, is gated by ELEVENLABS_BENCHMARK_ONLY=1, and a
 * jest test asserts nothing under `src/` imports it or names this flag.
 * ElevenLabs is not a profile provider (voice-profile.ts rejects it), cannot
 * be `current`, and has no production adapter.
 *
 * UNVERIFIED AGAINST THE LIVE API (the authoring sandbox blocks elevenlabs.io):
 *   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=ulaw_8000
 *   header xi-api-key; body { text, model_id, voice_settings: { speed } }
 *   200 body = raw μ-law bytes at 8 kHz (wrapped here in a WAV).
 */

import type { Synthesizer, SynthProfile } from '@/lib/sampark/speech/synthesizer';
import { buildMulawWav } from '@/lib/sampark/speech/wav';

import type { BakeoffProfile } from './bakeoff';
import benchmark from './benchmark-candidates.json';

export const ELEVENLABS_FLAG = 'ELEVENLABS_BENCHMARK_ONLY';
export const ELEVENLABS_SPEED_RANGE = { min: 0.7, max: 1.2 } as const;
const PLACEHOLDER_VOICE = /^REPLACE_/;

export function elevenLabsBenchmarkEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env[ELEVENLABS_FLAG] === '1';
}

/** Problems with the benchmark-only profiles (empty = fine). Nepali is out of scope until ElevenLabs documents it. */
export function benchmarkProfileProblems(profiles: BakeoffProfile[]): string[] {
    const out: string[] = [];
    for (const p of profiles) {
        if (p.provider !== 'elevenlabs') out.push(`${p.id}: benchmark file may only hold provider "elevenlabs"`);
        if (p.status === 'current') out.push(`${p.id}: a benchmark-only profile can never be current`);
        if (p.language === 'ne') out.push(`${p.id}: Nepali is not benchmarked on ElevenLabs (not documented)`);
        if (p.speakingRate !== null && (p.speakingRate < ELEVENLABS_SPEED_RANGE.min || p.speakingRate > ELEVENLABS_SPEED_RANGE.max)) {
            out.push(`${p.id}: speed ${p.speakingRate} outside ${ELEVENLABS_SPEED_RANGE.min}-${ELEVENLABS_SPEED_RANGE.max}`);
        }
        if (p.stylePrompt !== null) out.push(`${p.id}: stylePrompt must be null`);
    }
    return out;
}

/** The benchmark-only profiles; empty unless the flag is on. */
export function loadBenchmarkProfiles(env: NodeJS.ProcessEnv = process.env): BakeoffProfile[] {
    if (!elevenLabsBenchmarkEnabled(env)) return [];
    const profiles = (benchmark as { profiles: BakeoffProfile[] }).profiles;
    const problems = benchmarkProfileProblems(profiles);
    if (problems.length) throw new Error(`Invalid benchmark profiles:\n - ${problems.join('\n - ')}`);
    return profiles;
}

export interface ElevenLabsDeps {
    fetchImpl?: typeof fetch;
    apiKey?: string;
    env?: NodeJS.ProcessEnv;
}

export function createElevenLabsBenchmarkSynthesizer(deps: ElevenLabsDeps = {}): Synthesizer {
    return {
        id: 'elevenlabs-benchmark',
        async synthesize({ text, profile }: { text: string; profile: SynthProfile }) {
            if (!elevenLabsBenchmarkEnabled(deps.env)) throw new Error(`ElevenLabs is benchmark-only: set ${ELEVENLABS_FLAG}=1`);
            const apiKey = deps.apiKey ?? process.env.ELEVENLABS_API_KEY;
            if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');
            if (profile.provider !== 'elevenlabs') throw new Error(`elevenlabs benchmark cannot render provider ${profile.provider}`);
            if (PLACEHOLDER_VOICE.test(profile.voice)) throw new Error(`Set a real ElevenLabs voice id for ${profile.voice} in benchmark-candidates.json`);
            const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(profile.voice)}?output_format=ulaw_8000`;
            const body: Record<string, unknown> = { text, model_id: profile.model };
            if (profile.speakingRate !== null) body.voice_settings = { speed: profile.speakingRate };
            const res = await (deps.fetchImpl ?? fetch)(url, {
                method: 'POST',
                headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`ElevenLabs TTS failed: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
            const raw = Buffer.from(await res.arrayBuffer());
            return { audio: buildMulawWav(raw), mimeType: 'audio/wav' as const, durationSeconds: raw.length / 8000 };
        },
    };
}
