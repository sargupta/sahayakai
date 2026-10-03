/**
 * Sampark voice bake-off. See docs/sampark/VOICE_BAKEOFF.md.
 *
 *   # prove the harness with no credentials (fake synthesizer + fake transcriber):
 *   npx tsx scripts/sampark/voice-bakeoff.ts --dry-run --out /tmp/bakeoff-dry
 *
 *   # real run (Google ADC or gcloud token; Sarvam and ElevenLabs only when flagged):
 *   npx tsx scripts/sampark/voice-bakeoff.ts --out ./bakeoff-2026-10 --lang ne,hi,bn,en
 *   SARVAM_BULBUL_ENABLED=1 SARVAM_API_KEY=... npx tsx scripts/sampark/voice-bakeoff.ts --out ./bakeoff --lang hi,bn --profiles hi-sarvam-priya,bn-sarvam-priya
 *   ELEVENLABS_BENCHMARK_ONLY=1 ELEVENLABS_API_KEY=... npx tsx scripts/sampark/voice-bakeoff.ts --out ./bakeoff --lang hi
 *
 * Flags: --out <dir> (required)  --lang en,hi,bn,ne  --groups <group,...>
 *        --profiles <id,...> (default: every current + candidate profile)
 *        --concurrency N (default 3)  --dry-run  --no-current (skip the current profiles)
 *
 * Writes <out>/<lang>/<profile>/<group>/*.wav, scorecard.json and SCORECARD.md.
 * Exit code 0 when the harness ran (a failing voice is data, not an error); 2 on a crash.
 * Auth: Application Default Credentials, else `gcloud auth print-access-token`.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { languageFromCode } from '@/lib/sampark/languages';
import { adcAccessTokenProvider, createChirpVerifier, type AccessTokenProvider } from '@/lib/sampark/speech/google-speech';
import { createSarvamSynthesizer, sarvamEnabled } from '@/lib/sampark/speech/sarvam-speech';
import { createGoogleProfileSynthesizer, type Synthesizer } from '@/lib/sampark/speech/synthesizer';
import { VOICE_PURPOSE_GROUPS, type VoicePurposeGroup } from '@/lib/sampark/voice-profile';
import type { ParentLanguageCode } from '@/types/sampark';

import { productionBakeoffProfiles, runBakeoff, writeScorecard, type BakeoffProfile } from './lib/bakeoff';
import { createElevenLabsBenchmarkSynthesizer, elevenLabsBenchmarkEnabled, loadBenchmarkProfiles } from './lib/elevenlabs-benchmark';
import { createFakeSpeech } from './lib/fakes';

interface Args {
    out: string;
    languages?: ParentLanguageCode[];
    groups?: VoicePurposeGroup[];
    profileIds?: string[];
    concurrency: number;
    dryRun: boolean;
    includeCurrent: boolean;
}

export function parseArgs(argv: string[]): Args {
    const get = (flag: string) => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const out = get('--out');
    if (!out) throw new Error('usage: voice-bakeoff.ts --out <dir> [--lang en,hi,bn,ne] [--groups ...] [--profiles id,id] [--concurrency 3] [--dry-run] [--no-current]');
    const lang = get('--lang');
    const groups = get('--groups');
    return {
        out: path.resolve(out),
        languages: lang
            ? lang.split(',').map((l) => {
                  const language = languageFromCode(l);
                  if (!language) throw new Error(`Unknown language: ${l}`);
                  return l.trim().toLowerCase() as ParentLanguageCode;
              })
            : undefined,
        groups: groups
            ? groups.split(',').map((g) => {
                  if (!(VOICE_PURPOSE_GROUPS as readonly string[]).includes(g.trim())) throw new Error(`Unknown purpose group: ${g}`);
                  return g.trim() as VoicePurposeGroup;
              })
            : undefined,
        profileIds: get('--profiles')?.split(',').map((s) => s.trim()),
        concurrency: Number(get('--concurrency') ?? 3),
        dryRun: argv.includes('--dry-run'),
        includeCurrent: !argv.includes('--no-current'),
    };
}

/** ADC first; the gcloud CLI token if ADC is not configured on this machine. */
function tokenProvider(): AccessTokenProvider {
    const adc = adcAccessTokenProvider();
    let useCli = false;
    let cli: { token: string; at: number } | null = null;
    return async () => {
        if (!useCli) {
            try {
                return await adc();
            } catch (err) {
                console.warn(`ADC unavailable (${err instanceof Error ? err.message : String(err)}); using gcloud auth print-access-token`);
                useCli = true;
            }
        }
        if (!cli || Date.now() - cli.at > 30 * 60_000) {
            cli = { token: execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim(), at: Date.now() };
        }
        return cli.token;
    };
}

export function selectProfiles(args: Pick<Args, 'profileIds' | 'includeCurrent'>, all: BakeoffProfile[]): BakeoffProfile[] {
    let profiles = all;
    if (args.profileIds) {
        const unknown = args.profileIds.filter((id) => !all.some((p) => p.id === id));
        if (unknown.length) throw new Error(`Unknown profile id(s): ${unknown.join(', ')}`);
        profiles = all.filter((p) => args.profileIds!.includes(p.id));
    }
    return args.includeCurrent ? profiles : profiles.filter((p) => p.status !== 'current');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const profiles = selectProfiles(args, [...productionBakeoffProfiles(), ...loadBenchmarkProfiles()]);

    let synthesizers: Partial<Record<string, Synthesizer>>;
    let verifier;
    const skipReasons: Partial<Record<string, string>> = {};
    if (args.dryRun) {
        const fake = createFakeSpeech();
        synthesizers = { 'gemini-tts': fake.synth, 'chirp3-hd': fake.synth, 'sarvam-bulbul': fake.synth, elevenlabs: fake.synth };
        verifier = fake.verifier;
        console.log('DRY RUN: fake synthesizer and fake transcriber. Nothing is sent to any provider.');
    } else {
        const getAccessToken = tokenProvider();
        const google = createGoogleProfileSynthesizer({ getAccessToken });
        synthesizers = { 'gemini-tts': google, 'chirp3-hd': google };
        verifier = createChirpVerifier({ getAccessToken });
        if (sarvamEnabled() && process.env.SARVAM_API_KEY) synthesizers['sarvam-bulbul'] = createSarvamSynthesizer();
        else skipReasons['sarvam-bulbul'] = 'set SARVAM_BULBUL_ENABLED=1 and SARVAM_API_KEY to run Sarvam (UNVERIFIED adapter)';
        if (elevenLabsBenchmarkEnabled() && process.env.ELEVENLABS_API_KEY) synthesizers.elevenlabs = createElevenLabsBenchmarkSynthesizer();
        else skipReasons.elevenlabs = 'benchmark-only: set ELEVENLABS_BENCHMARK_ONLY=1 and ELEVENLABS_API_KEY';
    }

    const cards = await runBakeoff({
        profiles,
        synthesizers,
        verifier,
        languages: args.languages,
        groups: args.groups,
        concurrency: args.concurrency,
        audioDir: args.dryRun ? undefined : args.out,
        skipReasons,
        onProgress: (line) => console.log(line),
    });
    const files = writeScorecard(args.out, cards, { dryRun: args.dryRun });
    console.log(`\nScorecard: ${files.markdown}\nJSON:      ${files.json}`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exitCode = 2;
    });
}
