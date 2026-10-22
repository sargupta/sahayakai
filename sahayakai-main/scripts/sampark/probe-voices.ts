/**
 * Hard-word probe against the LIVE APIs (voice phase contract §B; the class
 * gate for the 7 Oct 2026 Bengali voice bug).
 *
 *   npx tsx scripts/sampark/probe-voices.ts [--lang bn,ne] [--out <dir>] [--save]
 *
 * For every parent language (or those in --lang) it synthesises that
 * language's probe sentence with the voice configured in languages.ts, exactly
 * as the render job would (plain delivery, then loudness-normalised with
 * normaliseTelephonyWav), and transcribes it with Chirp 2 and
 * the language's independent second recogniser (Sarvam Saarika; Chirp 3 for
 * Nepali). It prints each recogniser's transcript and missing hard words and
 * exits 1 if any language fails or could not be probed.
 *
 *   --out <dir>  also writes each probe's audio (<code>-probe.wav) for listening.
 *   --save       stores each record with FirestoreSamparkRepo — ONLY in the
 *                Firestore emulator; refuses unless FIRESTORE_EMULATOR_HOST is set.
 *                Without it nothing is written anywhere.
 *
 * Auth: Google ADC, falling back to `gcloud auth print-access-token`; billing
 * project SAMPARK_GCP_PROJECT or sahayakai-b4248. Sarvam: SARVAM_AI_API_KEY
 * from the environment or .env.local (only that key and SAMPARK_* are read
 * from the file), else Secret Manager. Secrets are never printed. Probe
 * sentences are synthetic — no personal data leaves the machine. Cost: four
 * short TTS calls and eight short recognitions, well under ₹10.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import * as dotenv from 'dotenv';

import { languageFromCode, PARENT_LANGUAGE_INFO } from '@/lib/sampark/languages';
import type { SpeechSynthesizer, SpeechVerifier } from '@/lib/sampark/ports';
import { normaliseTelephonyWav } from '@/lib/sampark/speech/dsp';
import { adcAccessTokenProvider, createChirpVerifier, createGoogleSynthesizer, STT_MODEL, type AccessTokenProvider } from '@/lib/sampark/speech/google-speech';
import { PROBE_VERSION, PROBES, runVoiceProbe, type VoiceProbeRecord } from '@/lib/sampark/speech/probe';
import { CHIRP3_MODEL, createChirp3Verifier, createSarvamVerifier, SARVAM_STT_MODEL, secondaryRecognizerFor } from '@/lib/sampark/speech/secondary-recognizers';
import type { ParentLanguage } from '@/types/sampark';

interface Args {
    languages: ParentLanguage[];
    out: string | null;
    save: boolean;
}

function parseArgs(argv: string[]): Args {
    const get = (flag: string) => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const all = Object.keys(PARENT_LANGUAGE_INFO) as ParentLanguage[];
    const langArg = get('--lang');
    const languages = langArg
        ? langArg.split(',').map((l) => {
              const lang = languageFromCode(l) ?? all.find((p) => p.toLowerCase() === l.trim().toLowerCase());
              if (!lang) throw new Error(`Unknown language: ${l}`);
              return lang;
          })
        : all;
    const out = get('--out');
    return { languages, out: out ? path.resolve(out) : null, save: argv.includes('--save') };
}

/** Only the keys this script needs, and never over an existing environment value. */
function loadLocalEnv(): void {
    const file = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(file)) return;
    const parsed = dotenv.parse(fs.readFileSync(file));
    for (const [k, v] of Object.entries(parsed)) {
        if ((k === 'SARVAM_AI_API_KEY' || k.startsWith('SAMPARK_')) && !process.env[k]) process.env[k] = v;
    }
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

function describeSpeech(language: ParentLanguage): string {
    const s = PARENT_LANGUAGE_INFO[language].speech;
    return `${s.engine} ${s.ttsLanguageCode} voice=${s.voice} model=${s.model ?? '-'} stt=${s.sttLanguageCode}`;
}

function printRecord(record: VoiceProbeRecord): void {
    console.log(`\n${record.status === 'passed' ? 'PASS' : 'FAIL'}  ${record.language}  ${describeSpeech(record.language)}  key=${record.key.slice(0, 12)}…`);
    console.log(`  sentence:   ${PROBES[record.language].sentence}`);
    console.log(`  hard words: ${PROBES[record.language].hardWords.join(' | ')}`);
    for (const r of record.recognizers) {
        console.log(`  ${r.name.padEnd(14)} missing: ${r.missing.length ? r.missing.join(', ') : '—'}`);
        console.log(`  ${''.padEnd(14)} heard:   "${r.transcript}"`);
    }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    loadLocalEnv();
    if (args.save && !process.env.FIRESTORE_EMULATOR_HOST?.trim()) {
        console.error('Refusing --save: FIRESTORE_EMULATOR_HOST is not set. Probe records are only ever written to the emulator from this script.');
        process.exit(2);
    }
    if (args.out) fs.mkdirSync(args.out, { recursive: true });

    const getAccessToken = tokenProvider();
    const google = createGoogleSynthesizer({ getAccessToken });
    const chirp2 = createChirpVerifier({ getAccessToken });
    const secondaries: Record<'sarvam' | 'chirp3', { name: string; verifier: SpeechVerifier }> = {
        sarvam: { name: SARVAM_STT_MODEL, verifier: createSarvamVerifier() },
        chirp3: { name: `${CHIRP3_MODEL} (us)`, verifier: createChirp3Verifier({ getAccessToken }) },
    };

    const repo = args.save
        ? await (async () => {
              const { getApps, initializeApp } = await import('firebase-admin/app');
              const { getFirestore } = await import('firebase-admin/firestore');
              const { FirestoreSamparkRepo } = await import('@/lib/sampark/repo/firestore');
              const projectId = process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sahayakai-b4248';
              return new FirestoreSamparkRepo(getFirestore(getApps()[0] ?? initializeApp({ projectId })));
          })()
        : null;

    console.log(`Hard-word probe v${PROBE_VERSION} — ${new Date().toISOString()} — primary ${STT_MODEL}`);
    const results: { language: ParentLanguage; status: 'passed' | 'failed' | 'error'; detail?: string }[] = [];

    for (const language of args.languages) {
        const info = PARENT_LANGUAGE_INFO[language];
        let lastAudio: Buffer | null = null;
        const synth: SpeechSynthesizer = {
            async synthesize(req) {
                const out = await google.synthesize(req);
                lastAudio = normaliseTelephonyWav(out.audio).wav; // the same audio the recognisers hear
                return out;
            },
        };
        try {
            const record = await runVoiceProbe(
                {
                    synth,
                    primary: { name: STT_MODEL, verifier: chirp2 },
                    secondary: secondaries[secondaryRecognizerFor(language)],
                    clock: { now: () => new Date() },
                    normalise: (wav) => normaliseTelephonyWav(wav).wav,
                },
                language,
                info.speech,
            );
            printRecord(record);
            if (args.out && lastAudio) {
                const file = path.join(args.out, `${info.code}-probe.wav`);
                fs.writeFileSync(file, lastAudio);
                console.log(`  audio:      ${file}`);
            }
            if (repo) await repo.saveVoiceProbe(record);
            results.push({ language, status: record.status });
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            console.log(`\nERROR ${language}  ${describeSpeech(language)}\n  ${detail}`);
            results.push({ language, status: 'error', detail });
        }
    }

    console.log('\nSummary');
    for (const r of results) console.log(`  ${r.language.padEnd(8)} ${r.status.toUpperCase()}${r.detail ? ` — ${r.detail}` : ''}`);
    if (repo) console.log(`Saved ${results.filter((r) => r.status !== 'error').length} record(s) to the emulator (sampark_voice_probes).`);
    process.exit(results.every((r) => r.status === 'passed') ? 0 : 1);
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
