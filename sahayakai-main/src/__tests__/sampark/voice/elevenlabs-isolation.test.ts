/**
 * @jest-environment node
 *
 * ElevenLabs is benchmark-only. Production code (everything under src/ except tests) must never
 * import the benchmark provider, name its flag, or reach into scripts/. It is also not a legal
 * voice-profile provider, so it can never become `current`.
 */

import fs from 'node:fs';
import path from 'node:path';

import { profileProblems, VOICE_PROVIDERS, currentProfile } from '@/lib/sampark/voice-profile';

import {
    benchmarkProfileProblems,
    createElevenLabsBenchmarkSynthesizer,
    ELEVENLABS_FLAG,
    elevenLabsBenchmarkEnabled,
    loadBenchmarkProfiles,
} from '../../../../scripts/sampark/lib/elevenlabs-benchmark';
import type { BakeoffProfile } from '../../../../scripts/sampark/lib/bakeoff';

const SRC = path.resolve(__dirname, '../../..'); // src/

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : sourceFiles(p);
        return /\.(ts|tsx|js|jsx|mjs|json)$/.test(e.name) ? [p] : [];
    });
}

describe('ElevenLabs is benchmark-only', () => {
    const files = sourceFiles(SRC);

    it('scans a meaningful number of production files', () => {
        expect(files.length).toBeGreaterThan(100);
    });

    it('no production module imports or names the benchmark provider or its flag', () => {
        const offenders = files.filter((f) => /elevenlabs-benchmark|ELEVENLABS_BENCHMARK_ONLY|createElevenLabsBenchmarkSynthesizer/.test(fs.readFileSync(f, 'utf8')));
        expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
    });

    it('no production Sampark module imports anything from scripts/ (so no benchmark code can ride along)', () => {
        const sampark = files.filter((f) => /sampark/i.test(path.relative(SRC, f)));
        expect(sampark.length).toBeGreaterThan(30);
        const offenders = sampark.filter((f) => /from\s+['"](\.\.\/)+scripts\/|from\s+['"]@\/\.\.\/scripts|require\(['"](\.\.\/)+scripts\//.test(fs.readFileSync(f, 'utf8')));
        expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
    });

    it('is not a voice-profile provider and cannot be configured as a profile', () => {
        expect(VOICE_PROVIDERS).not.toContain('elevenlabs');
        const hi = currentProfile('hi', 'ptm_event_invite');
        expect(profileProblems({ ...hi, id: 'x', provider: 'elevenlabs' as never }).join()).toMatch(/ElevenLabs is benchmark-only/);
    });
});

describe('the benchmark provider itself', () => {
    const env = (v?: string) => ({ [ELEVENLABS_FLAG]: v }) as NodeJS.ProcessEnv;

    it('loads no profiles and refuses to synthesize unless ELEVENLABS_BENCHMARK_ONLY=1', async () => {
        expect(elevenLabsBenchmarkEnabled(env())).toBe(false);
        expect(loadBenchmarkProfiles(env())).toEqual([]);
        const synth = createElevenLabsBenchmarkSynthesizer({ env: env(), apiKey: 'k', fetchImpl: (async () => { throw new Error('network!'); }) as never });
        const profile = { provider: 'elevenlabs', model: 'm', voice: 'v', localeCode: 'hi-IN', sttLanguageCode: 'hi-IN', speakingRate: null, stylePrompt: null };
        await expect(synth.synthesize({ text: 'x', profile, delivery: 'plain' })).rejects.toThrow(/benchmark-only/);
    });

    it('with the flag: ships en/hi/bn candidates only (no Nepali), never current, valid speeds', () => {
        const profiles = loadBenchmarkProfiles(env('1'));
        expect(profiles.map((p) => p.language).sort()).toEqual(['bn', 'en', 'hi']);
        expect(benchmarkProfileProblems(profiles)).toEqual([]);
        expect(benchmarkProfileProblems([{ ...profiles[0], language: 'ne' }, { ...profiles[0], status: 'current' }, { ...profiles[0], speakingRate: 2 }, { ...profiles[0], provider: 'gemini-tts' }] as BakeoffProfile[]).length).toBe(4);
    });

    it('refuses a placeholder voice id and requests ulaw_8000, wrapping the bytes in an 8 kHz WAV', async () => {
        const calls: { url: string; init: RequestInit }[] = [];
        const impl = (async (url: string, init: RequestInit) => {
            calls.push({ url, init });
            return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(8000).fill(0x55).buffer, text: async () => '' };
        }) as unknown as typeof fetch;
        const synth = createElevenLabsBenchmarkSynthesizer({ env: env('1'), apiKey: 'k', fetchImpl: impl });
        const base = { provider: 'elevenlabs', model: 'eleven_multilingual_v2', voice: 'abc123', localeCode: 'hi-IN', sttLanguageCode: 'hi-IN', speakingRate: 1.1, stylePrompt: null };
        const out = await synth.synthesize({ text: 'x', profile: base, delivery: 'plain' });
        expect(calls[0].url).toBe('https://api.elevenlabs.io/v1/text-to-speech/abc123?output_format=ulaw_8000');
        expect(JSON.parse(String(calls[0].init.body))).toEqual({ text: 'x', model_id: 'eleven_multilingual_v2', voice_settings: { speed: 1.1 } });
        expect(out.durationSeconds).toBe(1);
        await expect(synth.synthesize({ text: 'x', profile: { ...base, voice: 'REPLACE_HI_VOICE_ID' }, delivery: 'plain' })).rejects.toThrow(/real ElevenLabs voice id/);
        await expect(synth.synthesize({ text: 'x', profile: { ...base, provider: 'chirp3-hd' }, delivery: 'plain' })).rejects.toThrow(/cannot render/);
    });
});
