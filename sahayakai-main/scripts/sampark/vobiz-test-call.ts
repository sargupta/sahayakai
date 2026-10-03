/**
 * ONE real Vobiz call to the founder's own phone, to prove keypad capture.
 *
 * STANDALONE: no Firestore, no Sampark engine, no model client. See
 * docs/sampark/REAL_TEST_CALL_RUNBOOK.md.
 *
 *   # dry run (prints XML + guard results, dials nothing). Also the automatic
 *   # behaviour when any required env var is missing.
 *   npx tsx scripts/sampark/vobiz-test-call.ts --i-own-this-number --use-openers Hindi --dry-run
 *
 *   # the real call (needs TEST_PHONE_E164, PUBLIC_BASE_URL, VOBIZ_*)
 *   npx tsx scripts/sampark/vobiz-test-call.ts --i-own-this-number --use-openers Hindi
 *
 * Flags: --i-own-this-number (required) --lang <Language> --use-openers <Language>
 *        --clips <dir> --pcm --port <n> --events <path> --max-seconds <n> --dry-run
 */

import {
    SUPPORTED_LANGUAGES, isSupportedLanguage, loadClipDir, loadOpenerClips, type ClipSet,
} from './lib/testcall-audio';
import {
    buildAnswerXml, buildGatherResultXml, evaluateGuards, guardBaseUrl, mintToken, missingEnv,
    newRunKey, runTestCall, TESTCALL_DOMAINS,
} from './lib/testcall-core';

export * from './lib/testcall-audio';
export * from './lib/testcall-core';

export interface CliArgs {
    iOwn: boolean;
    lang: string;
    useOpeners: string | null;
    clipsDir: string | null;
    pcm: boolean;
    port: number;
    events: string;
    maxSeconds: number;
    dryRun: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
    const val = (n: string): string | null => {
        const i = argv.indexOf(n);
        return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null;
    };
    return {
        iOwn: argv.includes('--i-own-this-number'),
        lang: val('--lang') ?? 'English',
        useOpeners: val('--use-openers'),
        clipsDir: val('--clips'),
        pcm: argv.includes('--pcm'),
        port: Number(val('--port') ?? 8787),
        events: val('--events') ?? './testcall-events.jsonl',
        maxSeconds: Number(val('--max-seconds') ?? 180),
        dryRun: argv.includes('--dry-run'),
    };
}

function out(line: string): void { process.stdout.write(`${line}\n`); }

export function loadClips(a: CliArgs): { clips: ClipSet; label: string } {
    const lang = a.useOpeners ?? a.lang;
    if (!isSupportedLanguage(lang)) throw new Error(`unsupported language "${lang}". Use one of: ${SUPPORTED_LANGUAGES.join(', ')}`);
    const enc = a.pcm ? 'pcm16' : 'mulaw';
    if (a.useOpeners) return { clips: loadOpenerClips(lang, a.pcm), label: `openers:${lang}:${enc}` };
    if (a.clipsDir) return { clips: loadClipDir(a.clipsDir, a.pcm), label: `clips:${lang}:${enc}` };
    throw new Error('choose an audio source: --use-openers <Language> or --clips <dir>');
}

export function dryRunReport(a: CliArgs, env: NodeJS.ProcessEnv, clips: ClipSet, now = new Date()): string {
    const base = env.PUBLIC_BASE_URL?.trim() || 'https://example.invalid';
    const key = newRunKey();
    const ms = now.getTime();
    const xmlOpts = {
        baseUrl: base,
        tokens: { gather: mintToken(key, TESTCALL_DOMAINS.gather, 'dryrun', ms), audio: mintToken(key, TESTCALL_DOMAINS.audio, 'dryrun', ms) },
        clips: new Set(clips.keys()),
    };
    const g = evaluateGuards({ flag: a.iOwn, env, now, allowHttpLocal: true });
    const missing = missingEnv(env);
    const lines = [
        'DRY RUN: nothing is dialled.',
        missing.length ? `missing env (forces dry run): ${missing.join(', ')}` : 'all required env present',
        `base url guard (http allowed for localhost in dry run): ${guardBaseUrl(env.PUBLIC_BASE_URL, true).ok ? 'ok' : 'FAIL'}`,
        'guards:',
        ...g.results.map((r) => `  [${r.ok ? 'pass' : 'FAIL'}] ${r.guard}${r.reason ? ` - ${r.reason}` : ''}`),
        `would dial: ${g.ok && !missing.length ? 'YES (drop --dry-run)' : 'NO'}`,
        '',
        '/answer XML:', buildAnswerXml(xmlOpts),
        '',
        ...['1', '2', '9', 'x'].flatMap((d) => [`/gather digit=${d} (first attempt):`, buildGatherResultXml(xmlOpts, d, 0), '']),
        `clips: ${[...clips.entries()].map(([n, b]) => `${n}(${b.length}B)`).join(', ')}`,
    ];
    return lines.join('\n');
}

export async function main(argv = process.argv.slice(2), env = process.env): Promise<number> {
    const a = parseArgs(argv);
    let loaded: { clips: ClipSet; label: string };
    try { loaded = loadClips(a); } catch (e) { out(`error: ${(e as Error).message}`); return 2; }

    const missing = missingEnv(env);
    if (a.dryRun || missing.length) {
        if (!a.dryRun) out(`Missing env: ${missing.join(', ')}. Falling back to --dry-run (nothing will be dialled).\n`);
        out(dryRunReport(a, env, loaded.clips));
        return 0;
    }

    const handle = runTestCall({
        iOwnThisNumber: a.iOwn, env, clips: loaded.clips, audioLabel: loaded.label,
        port: a.port, eventsPath: a.events, maxDurationMs: a.maxSeconds * 1000,
    });
    const stop = (sig: string) => { out(`\n${sig}: hanging up and shutting down`); handle.abort(sig); };
    process.once('SIGINT', () => stop('SIGINT'));
    process.once('SIGTERM', () => stop('SIGTERM'));
    const port = await handle.ready;
    if (port > 0) out(`listening on 127.0.0.1:${port}; events -> ${a.events}; waiting for the call (max ${a.maxSeconds}s)`);
    const result = await handle.done;
    out(result.summary);
    return result.outcome === 'completed' ? 0 : 1;
}

if (typeof require !== 'undefined' && require.main === module) {
    main().then((c) => process.exit(c), (e) => { out(`fatal: ${(e as Error).message}`); process.exit(1); });
}
