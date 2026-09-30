/**
 * Sampark voice verification against the REAL Google APIs.
 *
 * Renders every available purpose × language × variant with realistic sample
 * facts (Hillview Demo School; PTM Sat 10 Oct 2026 10:00 in the school hall for
 * Class 7 B; Annual Day; rain/landslide closure Thu 8 Oct 2026, buses not
 * running), synthesises each clip exactly as the render job does (Gemini-TTS /
 * Chirp 3 HD, 8 kHz μ-law, lead-in silence on the message), transcribes every
 * clip back with Chirp 2, and writes the .wav files plus a markdown report.
 *
 *   npx tsx scripts/sampark/verify-voice.ts --out <dir> [--lang ne,hi] [--concurrency 4]
 *
 * Runs per language can be split across invocations; each writes
 * report-<code>.json and REPORT.md is rebuilt from every report-*.json in <dir>.
 * Pass criteria (plan §4⑥, §7): every message clip transcribes back at
 * similarity ≥ 0.85 and runs ≤ 38 s including the lead-in.
 *
 * Auth: Application Default Credentials; if ADC is not configured, falls back
 * to `gcloud auth print-access-token`. Billing project: SAMPARK_GCP_PROJECT or
 * sahayakai-b4248. Cost: well under ₹50 for a full run.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { availablePurposes } from '@/lib/sampark/catalogue';
import { languageFromCode, languageInfo } from '@/lib/sampark/languages';
import { estimateSeconds, MESSAGE_AND_MENU_BUDGET_SECONDS } from '@/lib/sampark/scripts/render';
import { SAMPLE_SCHOOL, SAMPLE_SECTION_AUDIENCE, sampleFactsFor } from '@/lib/sampark/scripts/samples';
import { adcAccessTokenProvider, createChirpVerifier, createGoogleSynthesizer, type AccessTokenProvider } from '@/lib/sampark/speech/google-speech';
import { MESSAGE_LEAD_IN_SECONDS, neededClips, synthesizeClip, type NeededClip } from '@/lib/sampark/speech/render-job';
import { VERIFY_THRESHOLD } from '@/lib/sampark/speech/verify';
import { PARENT_LANGUAGES, type ParentLanguage, type PurposeId } from '@/types/sampark';

interface Args {
    out: string;
    languages: ParentLanguage[];
    concurrency: number;
}

function parseArgs(argv: string[]): Args {
    const get = (flag: string) => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const out = get('--out');
    if (!out) throw new Error('usage: verify-voice.ts --out <dir> [--lang en,hi,bn,ne] [--concurrency 4]');
    const langArg = get('--lang');
    const languages = langArg
        ? langArg.split(',').map((l) => {
              const lang = languageFromCode(l) ?? PARENT_LANGUAGES.find((p) => p.toLowerCase() === l.trim().toLowerCase());
              if (!lang) throw new Error(`Unknown language: ${l}`);
              return lang;
          })
        : [...PARENT_LANGUAGES];
    return { out: path.resolve(out), languages, concurrency: Number(get('--concurrency') ?? 4) };
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

interface ClipRow {
    language: ParentLanguage;
    purpose: PurposeId | 'common';
    variant: string;
    kind: string;
    key: string;
    file: string;
    chars: number;
    estimateSeconds: number;
    durationSeconds: number;
    speechSeconds: number;
    similarity: number | null;
    transcript: string;
    text: string;
    ok: boolean;
    error?: string;
}

async function mapBounded<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
            while (next < items.length) await fn(items[next++]);
        }),
    );
}

function clipsFor(language: ParentLanguage): (NeededClip & { purpose: PurposeId | 'common' })[] {
    const byKey = new Map<string, NeededClip & { purpose: PurposeId | 'common' }>();
    for (const spec of availablePurposes()) {
        const needed = neededClips(spec.id, sampleFactsFor(spec.id), SAMPLE_SCHOOL, SAMPLE_SECTION_AUDIENCE, [language]);
        for (const clip of needed) {
            if (byKey.has(clip.key)) continue;
            const common = ['opt_out_confirm', 'opt_out_done', 'no_input', 'fallback_office'].includes(clip.kind);
            byKey.set(clip.key, { ...clip, purpose: common ? 'common' : spec.id });
        }
    }
    return [...byKey.values()];
}

async function runLanguage(language: ParentLanguage, args: Args, getAccessToken: AccessTokenProvider): Promise<ClipRow[]> {
    const deps = {
        synth: createGoogleSynthesizer({ getAccessToken }),
        verifier: createChirpVerifier({ getAccessToken }),
        clock: { now: () => new Date() },
    };
    const code = languageInfo(language).code;
    const dir = path.join(args.out, code);
    fs.mkdirSync(dir, { recursive: true });
    const rows: ClipRow[] = [];
    await mapBounded(clipsFor(language), args.concurrency, async (clip) => {
        const file = path.join(dir, `${clip.purpose}-${clip.variant}-${clip.kind}.wav`);
        const base = {
            language,
            purpose: clip.purpose,
            variant: clip.variant,
            kind: clip.kind,
            key: clip.key,
            file: path.relative(args.out, file),
            chars: Array.from(clip.text).length,
            estimateSeconds: estimateSeconds(clip.text, language),
            text: clip.text,
        };
        try {
            const result = await synthesizeClip(deps, clip, { verifyAll: true, retries: clip.kind === 'message' ? 1 : 0 });
            fs.writeFileSync(file, result.audio);
            const speechSeconds = Math.round((result.durationSeconds - (clip.kind === 'message' ? MESSAGE_LEAD_IN_SECONDS : 0)) * 100) / 100;
            const similarity = result.verification.similarity;
            const ok =
                clip.kind !== 'message' ||
                ((similarity ?? 0) >= VERIFY_THRESHOLD && result.durationSeconds <= MESSAGE_AND_MENU_BUDGET_SECONDS);
            rows.push({ ...base, durationSeconds: result.durationSeconds, speechSeconds, similarity, transcript: result.verification.transcript ?? '', ok });
            console.log(`${ok ? 'ok  ' : 'FAIL'} ${code} ${clip.purpose}/${clip.variant}/${clip.kind} ${result.durationSeconds}s sim=${similarity}`);
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            rows.push({ ...base, durationSeconds: 0, speechSeconds: 0, similarity: null, transcript: '', ok: false, error });
            console.log(`ERR  ${code} ${clip.purpose}/${clip.variant}/${clip.kind}: ${error}`);
        }
    });
    const order = (r: ClipRow) => `${r.purpose === 'common' ? 'z' : r.purpose}|${r.variant}|${['message', 'confirm_1', 'confirm_2'].indexOf(r.kind) + 1 || 9}|${r.kind}`;
    return rows.sort((a, b) => order(a).localeCompare(order(b)));
}

function esc(s: string): string {
    return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function writeReport(outDir: string): string {
    const rows: ClipRow[] = fs
        .readdirSync(outDir)
        .filter((f) => /^report-[a-z]{2}\.json$/.test(f))
        .flatMap((f) => JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')) as ClipRow[]);
    const langOrder = (l: ParentLanguage) => PARENT_LANGUAGES.indexOf(l);
    rows.sort((a, b) => langOrder(a.language) - langOrder(b.language));
    const messages = rows.filter((r) => r.kind === 'message');
    const lines: string[] = [];
    lines.push('# Sampark voice verification', '');
    lines.push(`Generated ${new Date().toISOString()} against the live Google Cloud TTS (Gemini-TTS / Chirp 3 HD) and Speech-to-Text (Chirp 2) APIs.`, '');
    lines.push(
        `Pass criteria: every **message** clip (message + menu, with ${MESSAGE_LEAD_IN_SECONDS} s lead-in) transcribes back at similarity ≥ ${VERIFY_THRESHOLD} and lasts ≤ ${MESSAGE_AND_MENU_BUDGET_SECONDS} s.`,
        '',
    );
    const failed = messages.filter((r) => !r.ok);
    lines.push(`**Result: ${failed.length === 0 && messages.length > 0 ? 'PASS' : 'FAIL'}** — ${messages.length - failed.length}/${messages.length} message clips pass; ${rows.length} clips rendered in total.`, '');
    lines.push('## Message clips', '');
    lines.push('| Language | Purpose | Variant | Chars | Estimate (s) | Duration (s) | Similarity | Pass |');
    lines.push('|---|---|---|---:|---:|---:|---:|---|');
    for (const r of messages) {
        lines.push(`| ${r.language} | ${r.purpose} | ${r.variant} | ${r.chars} | ${r.estimateSeconds} | ${r.durationSeconds} | ${r.similarity ?? '—'} | ${r.ok ? 'yes' : 'NO'} |`);
    }
    lines.push('', '## Measured speaking rate (all clips, lead-in excluded)', '');
    lines.push('| Language | Chars | Speech (s) | Chars/s | Calibrated chars/s |', '|---|---:|---:|---:|---:|');
    for (const language of PARENT_LANGUAGES) {
        const rs = rows.filter((r) => r.language === language && r.speechSeconds > 0);
        if (!rs.length) continue;
        const chars = rs.reduce((s, r) => s + r.chars, 0);
        const secs = rs.reduce((s, r) => s + r.speechSeconds, 0);
        const cal = rs[0].estimateSeconds > 0 ? Math.round((rs[0].chars / rs[0].estimateSeconds) * 10) / 10 : 0;
        lines.push(`| ${language} | ${chars} | ${Math.round(secs * 10) / 10} | ${Math.round((chars / secs) * 10) / 10} | ${cal} |`);
    }
    lines.push('', '## Every clip', '');
    lines.push('| Language | Purpose | Variant | Kind | Chars | Est (s) | Dur (s) | Similarity | File | Transcript |');
    lines.push('|---|---|---|---|---:|---:|---:|---:|---|---|');
    for (const r of rows) {
        lines.push(
            `| ${r.language} | ${r.purpose} | ${r.variant} | ${r.kind} | ${r.chars} | ${r.estimateSeconds} | ${r.durationSeconds} | ${r.similarity ?? '—'} | ${r.file} | ${esc(r.error ? `ERROR: ${r.error}` : r.transcript)} |`,
        );
    }
    lines.push('', '## Texts sent to TTS', '');
    for (const r of messages) lines.push(`- **${r.language} ${r.purpose} ${r.variant}** — ${esc(r.text)}`);
    const md = lines.join('\n') + '\n';
    fs.writeFileSync(path.join(outDir, 'REPORT.md'), md);
    return md;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    fs.mkdirSync(args.out, { recursive: true });
    const getAccessToken = tokenProvider();
    for (const language of args.languages) {
        const rows = await runLanguage(language, args, getAccessToken);
        fs.writeFileSync(path.join(args.out, `report-${languageInfo(language).code}.json`), JSON.stringify(rows, null, 2));
    }
    const md = writeReport(args.out);
    const summary = md.split('## Measured speaking rate')[0];
    console.log('\n' + summary);
    console.log(`Full report: ${path.join(args.out, 'REPORT.md')}`);
    const failed = args.languages.flatMap((l) =>
        (JSON.parse(fs.readFileSync(path.join(args.out, `report-${languageInfo(l).code}.json`), 'utf8')) as ClipRow[]).filter((r) => r.kind === 'message' && !r.ok),
    );
    process.exitCode = failed.length ? 1 : 0;
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 2;
});
