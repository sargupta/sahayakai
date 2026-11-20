/**
 * Call-quality bench against the LIVE speech APIs: every voice and every recogniser on the same
 * test set, scored the same way (src/lib/sampark/quality/*).
 *
 *   npx tsx scripts/sampark/call-quality-bench.ts [--lang en,hi,bn,ne] [--out <dir>] [--repeats 2]
 *                                                  [--noise-snr 15] [--skip sarvam,elevenlabs]
 *
 * Writes to --out (default: a new folder under the OS temp dir, printed at the end):
 *   REPORT.md              latency, word error rate and lost key words per engine and language
 *   results.json           everything, without audio
 *   clips/*.wav            each voice's rendering of each agent line (8 kHz μ-law, as a phone hears it)
 *   replies/*.wav          the parent replies as the recognisers received them
 *   listening/C001.wav…    the same clips under blind ids, with listening-sheet.csv for native
 *                          listeners and listening-key.csv (which engine is which — keep it from them)
 *
 * Engines that have no key are skipped and listed in the report:
 *   Google (school voice per languages.ts, Chirp 3 HD, Chirp 2, Chirp 3): Application Default
 *     Credentials, else `gcloud auth print-access-token`; project SAMPARK_GCP_PROJECT or sahayakai-b4248.
 *   Sarvam (Bulbul v3 voice, Saarika recogniser): SARVAM_AI_API_KEY, else Secret Manager.
 *   ElevenLabs (Riya's voice on Flash v2.5, streaming; Scribe): ELEVENLABS_API_KEY, else Secret Manager.
 * Keys come from the environment or .env.local (only those names are read) and are never printed.
 *
 * The audio is synthetic (no child, family or phone number). Cost per full run (4 languages,
 * 2 repeats): roughly 100 short TTS calls and 150 short recognitions — well under ₹200.
 * Times include the network path from THIS machine; run it from asia-south1 for production-like numbers.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as dotenv from 'dotenv';

import { languageFromCode, PARENT_LANGUAGE_INFO } from '@/lib/sampark/languages';
import { runBench, summarise, type SttEngine, type TtsEngine } from '@/lib/sampark/quality/bench';
import { chirp3HdConfig, elevenLabsScribe, elevenLabsVoice, googleVoice, sarvamVoice, verifierRecogniser } from '@/lib/sampark/quality/engines';
import { clipFileName, renderListeningSheet, renderReport, replyFileName, runToJson } from '@/lib/sampark/quality/report';
import { adcAccessTokenProvider, createChirpVerifier, createGoogleSynthesizer, STT_MODEL, type AccessTokenProvider } from '@/lib/sampark/speech/google-speech';
import { CHIRP3_MODEL, createChirp3Verifier, createSarvamVerifier, SARVAM_STT_LANGUAGES, SARVAM_STT_MODEL } from '@/lib/sampark/speech/secondary-recognizers';
import type { SpeechEngineConfig } from '@/lib/sampark/languages';
import type { ParentLanguage } from '@/types/sampark';

interface Args {
    languages: ParentLanguage[];
    out: string;
    repeats: number;
    noiseSnrDb: number | null;
    skip: string[];
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
              const lang = languageFromCode(l.trim()) ?? all.find((p) => p.toLowerCase() === l.trim().toLowerCase());
              if (!lang) throw new Error(`Unknown language: ${l}`);
              return lang;
          })
        : all;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const out = path.resolve(get('--out') ?? path.join(os.tmpdir(), 'sampark-call-quality', stamp));
    const repeats = Number(get('--repeats') ?? 2);
    if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10) throw new Error('--repeats must be 1–10');
    const snr = get('--noise-snr');
    const noiseSnrDb = snr === undefined ? null : Number(snr);
    if (noiseSnrDb !== null && !Number.isFinite(noiseSnrDb)) throw new Error('--noise-snr must be a number (dB)');
    const skip = (get('--skip') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return { languages, out, repeats, noiseSnrDb, skip };
}

const KEY_NAMES = ['SARVAM_AI_API_KEY', 'ELEVENLABS_API_KEY'];

/** Only the keys this script needs (and SAMPARK_*), never over an existing environment value. */
function loadLocalEnv(): void {
    const file = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(file)) return;
    const parsed = dotenv.parse(fs.readFileSync(file));
    for (const [k, v] of Object.entries(parsed)) {
        if ((KEY_NAMES.includes(k) || k.startsWith('SAMPARK_')) && !process.env[k]) process.env[k] = v;
    }
}

/** The key from the environment, else Secret Manager; null (with the reason) when neither has it. */
async function resolveKey(name: string): Promise<{ key: string } | { missing: string }> {
    const fromEnv = process.env[name]?.trim();
    if (fromEnv) return { key: fromEnv };
    try {
        const { getSecret } = await import('@/lib/secrets');
        const v = (await getSecret(name)).trim();
        return v ? { key: v } : { missing: `${name} is empty in Secret Manager` };
    } catch (err) {
        return { missing: `${name} not in the environment, and Secret Manager said: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}` };
    }
}

function tokenProvider(): AccessTokenProvider {
    const adc = adcAccessTokenProvider();
    let useCli = false;
    let cli: { token: string; at: number } | null = null;
    return async () => {
        if (!useCli) {
            try {
                return await adc();
            } catch {
                useCli = true;
            }
        }
        if (!cli || Date.now() - cli.at > 30 * 60_000) {
            cli = { token: execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim(), at: Date.now() };
        }
        return cli.token;
    };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    loadLocalEnv();
    const now = () => performance.now();
    const skipped = (name: string) => args.skip.some((s) => name.toLowerCase().includes(s));
    const notes: string[] = [];

    const getAccessToken = tokenProvider();
    const google = createGoogleSynthesizer({ getAccessToken });
    const schoolVoice = (l: ParentLanguage) => PARENT_LANGUAGE_INFO[l].speech;

    const tts: TtsEngine[] = [
        googleVoice('school-voice', google, schoolVoice),
        googleVoice('google-chirp3-hd-kore', google, chirp3HdConfig('Kore')),
    ];
    const stt: SttEngine[] = [
        verifierRecogniser(`google-${STT_MODEL}`, createChirpVerifier({ getAccessToken }), (l) => schoolVoice(l).sttLanguageCode),
        verifierRecogniser(`google-${CHIRP3_MODEL}`, createChirp3Verifier({ getAccessToken }), (l) => schoolVoice(l).sttLanguageCode),
    ];

    if (!skipped('sarvam')) {
        const k = await resolveKey('SARVAM_AI_API_KEY');
        if ('key' in k) {
            const getApiKey = async () => k.key;
            tts.push(sarvamVoice({ getApiKey }));
            const india = { English: 'en-IN', Hindi: 'hi-IN', Bengali: 'bn-IN', Nepali: 'ne-IN' } as const;
            stt.push(verifierRecogniser(`sarvam-${SARVAM_STT_MODEL}`, createSarvamVerifier({ getApiKey }), (l) => (SARVAM_STT_LANGUAGES.includes(india[l]) ? india[l] : null)));
        } else notes.push(`Sarvam not measured: ${k.missing}`);
    }
    if (!skipped('elevenlabs')) {
        const k = await resolveKey('ELEVENLABS_API_KEY');
        if ('key' in k) {
            const getApiKey = async () => k.key;
            tts.push(elevenLabsVoice({ getApiKey, now }));
            stt.push(elevenLabsScribe({ getApiKey }));
        } else notes.push(`ElevenLabs not measured: ${k.missing}`);
    }
    const ttsUsed = tts.filter((e) => !skipped(e.name));
    const sttUsed = stt.filter((e) => !skipped(e.name));

    // The parents' voice: a different speaker from every candidate school voice.
    const replyVoice = (l: ParentLanguage): TtsEngine | null => {
        const cfg: SpeechEngineConfig | null = l === 'Nepali' ? { ...schoolVoice(l), voice: 'Puck' } : chirp3HdConfig('Puck')(l);
        return cfg ? googleVoice('reply-voice', google, () => cfg) : null;
    };

    fs.mkdirSync(args.out, { recursive: true });
    console.log(`Call-quality bench → ${args.out}`);
    console.log(`Voices: ${ttsUsed.map((e) => e.name).join(', ')}`);
    console.log(`Recognisers: ${sttUsed.map((e) => e.name).join(', ')}`);
    for (const n of notes) console.log(`Note: ${n}`);

    const run = await runBench({ tts: ttsUsed, stt: sttUsed, replyVoice, now }, {
        languages: args.languages,
        repeats: args.repeats,
        noiseSnrDb: args.noiseSnrDb,
        onProgress: (line) => console.log(`  ${line}`),
    });
    const summary = summarise(run);

    for (const dir of ['clips', 'replies', 'listening']) fs.mkdirSync(path.join(args.out, dir), { recursive: true });
    for (const r of run.tts) if (r.audio) fs.writeFileSync(path.join(args.out, 'clips', clipFileName(r.language, r.engine, r.itemId)), r.audio);
    for (const [k, audio] of Object.entries(run.replyAudio)) {
        const [language, itemId] = k.split('/');
        fs.writeFileSync(path.join(args.out, 'replies', replyFileName(language, itemId)), audio);
    }
    const listening = renderListeningSheet(run);
    for (const c of listening.clips) if (c.result.audio) fs.writeFileSync(path.join(args.out, 'listening', `${c.id}.wav`), c.result.audio);
    fs.writeFileSync(path.join(args.out, 'listening-sheet.csv'), '﻿' + listening.sheet);
    fs.writeFileSync(path.join(args.out, 'listening-key.csv'), '﻿' + listening.key);
    fs.writeFileSync(path.join(args.out, 'results.json'), runToJson(run, summary));
    const report = renderReport(run, summary, { measuredFrom: process.env.BENCH_MEASURED_FROM ?? `this machine (${process.platform})`, notes });
    fs.writeFileSync(path.join(args.out, 'REPORT.md'), report);

    console.log(`\nDone. Report: ${path.join(args.out, 'REPORT.md')}`);
    const failures = run.tts.filter((r) => !r.ok).length + run.stt.filter((r) => !r.ok).length;
    if (failures) console.log(`${failures} item(s) failed — see the report.`);
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
