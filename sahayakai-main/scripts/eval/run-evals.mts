/**
 * AI flow eval runner — tranche 4 of docs/EXECUTION_PLAN_2026-07.md.
 *
 * Runs golden datasets (src/ai/eval-datasets/<flow>/{english,bengali,tamil}.json)
 * through the real flow wrappers and validates:
 *   1. the call succeeds and returns a truthy result (flows Zod-validate
 *      their own output, so success == schema-valid);
 *   2. for non-English datasets, the user-visible output fields declared in
 *      meta.json `outputScriptFields` actually contain the target script
 *      (Bengali / Tamil Unicode ranges) — the "is it really Bengali?" gate
 *      the product's 11-language promise was missing;
 *   3. optional per-case `expect` shallow assertions (used by the router).
 *
 * Usage:
 *   npx tsx scripts/eval/run-evals.mts --all
 *   npx tsx scripts/eval/run-evals.mts --flows lesson-plan,quiz
 *   npx tsx scripts/eval/run-evals.mts --all --dry     # validate datasets only
 *
 * Exit code 1 on any failure — this script is a BLOCKING CI gate.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'node:fs';
import path from 'node:path';

const DATASETS_ROOT = path.resolve(process.cwd(), 'src/ai/eval-datasets');
const LANG_FILES = ['english.json', 'bengali.json', 'tamil.json'] as const;

// Unicode script ranges for "output is actually in the target language".
const SCRIPT_RANGES: Record<string, RegExp> = {
    'bengali.json': /[ঀ-৿]/g,
    'tamil.json': /[஀-௿]/g,
};
// Minimum count of target-script characters across the checked fields for a
// case to count as "in language" — low enough to tolerate code/latin tokens,
// high enough that an all-English answer can't pass.
const MIN_SCRIPT_CHARS = 40;

const CASE_TIMEOUT_MS = 180_000;
const CONCURRENCY = 3;

type Meta = {
    module: string;
    export: string;
    flowName?: string;
    languageInputPath: string | null;
    outputScriptFields: string[];
    expectField?: string;
    minScriptChars?: number;
    notes?: string;
};
type Case = { label: string; input: unknown; expect?: Record<string, unknown> };

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ALL = args.includes('--all');
const flowsArg = args.find((a) => a.startsWith('--flows'));
const onlyFlows = flowsArg ? (flowsArg.split('=')[1] ?? args[args.indexOf(flowsArg) + 1] ?? '').split(',').filter(Boolean) : [];

if (!ALL && onlyFlows.length === 0) {
    console.error('usage: run-evals.mts --all | --flows <dir,dir,...> [--dry]');
    process.exit(2);
}

/** Resolve 'a.b', 'items[].text' style paths into an array of leaf values. */
function resolvePath(obj: unknown, p: string): unknown[] {
    let current: unknown[] = [obj];
    for (const segment of p.split('.')) {
        const isArray = segment.endsWith('[]');
        const key = isArray ? segment.slice(0, -2) : segment;
        const next: unknown[] = [];
        for (const item of current) {
            if (item == null || typeof item !== 'object') continue;
            const v = (item as Record<string, unknown>)[key];
            if (v === undefined) continue;
            if (isArray && Array.isArray(v)) next.push(...v);
            else next.push(v);
        }
        current = next;
    }
    return current;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        p,
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms: ${label}`)), ms)),
    ]);
}

type Failure = { flow: string; file: string; label: string; reason: string };

async function runFlowDir(dir: string, failures: Failure[]): Promise<{ ran: number; passed: number }> {
    const metaPath = path.join(DATASETS_ROOT, dir, 'meta.json');
    if (!fs.existsSync(metaPath)) {
        failures.push({ flow: dir, file: 'meta.json', label: '-', reason: 'meta.json missing' });
        return { ran: 0, passed: 0 };
    }
    const meta: Meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    let fn: ((input: unknown) => Promise<unknown>) | null = null;

    if (!DRY) {
        const mod = await import(path.resolve(process.cwd(), meta.module));
        const adapterPath = path.resolve(process.cwd(), 'scripts/eval/adapters', `${dir}.mts`);
        if (fs.existsSync(adapterPath)) {
            const adapter = (await import(adapterPath)).default as (m: unknown, i: unknown) => Promise<unknown>;
            fn = (input: unknown) => adapter(mod, input);
        } else {
            fn = mod[meta.export];
        }
        if (typeof fn !== 'function') {
            failures.push({ flow: dir, file: 'meta.json', label: '-', reason: `export ${meta.export} not found in ${meta.module}` });
            return { ran: 0, passed: 0 };
        }
    }

    let ran = 0;
    let passed = 0;

    for (const langFile of LANG_FILES) {
        const fp = path.join(DATASETS_ROOT, dir, langFile);
        if (!fs.existsSync(fp)) continue;
        const cases: Case[] = JSON.parse(fs.readFileSync(fp, 'utf8'));
        const scriptRe = SCRIPT_RANGES[langFile];
        // Language-script assertions only apply when the flow takes a
        // language input at all.
        const checkScript = Boolean(scriptRe && meta.languageInputPath && meta.outputScriptFields.length);

        // Bounded concurrency without extra deps.
        const queue = [...cases.entries()];
        const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
            while (queue.length) {
                const [idx, testCase] = queue.shift()!;
                const label = testCase.label ?? `case ${idx}`;
                ran += 1;
                if (DRY) { passed += 1; continue; }
                try {
                    const out = await withTimeout(fn!(testCase.input), CASE_TIMEOUT_MS, `${dir}/${langFile}#${idx}`);
                    if (!out) throw new Error('flow returned empty result');

                    if (checkScript) {
                        const text = meta.outputScriptFields
                            .flatMap((f) => resolvePath(out, f))
                            .filter((v): v is string => typeof v === 'string')
                            .join(' ');
                        const hits = text.match(scriptRe!)?.length ?? 0;
                        const minChars = meta.minScriptChars ?? MIN_SCRIPT_CHARS;
                        if (hits < minChars) {
                            throw new Error(`language regression: only ${hits} target-script chars in checked fields (need >= ${minChars})`);
                        }
                    }

                    if (testCase.expect) {
                        for (const [k, v] of Object.entries(testCase.expect)) {
                            const actual = resolvePath(out, k)[0];
                            if (actual !== v) throw new Error(`expect ${k}=${JSON.stringify(v)}, got ${JSON.stringify(actual)}`);
                        }
                    }

                    passed += 1;
                    console.log(`  PASS ${dir}/${langFile} — ${label}`);
                } catch (err) {
                    failures.push({ flow: dir, file: langFile, label, reason: (err as Error).message.slice(0, 300) });
                    console.log(`  FAIL ${dir}/${langFile} — ${label}: ${(err as Error).message.slice(0, 160)}`);
                }
            }
        });
        await Promise.all(workers);
    }
    return { ran, passed };
}

async function main() {
    const available = fs.readdirSync(DATASETS_ROOT, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
    const targets = ALL ? available : onlyFlows.filter((f) => {
        if (!available.includes(f)) console.warn(`(skipping unknown flow dir: ${f})`);
        return available.includes(f);
    });

    if (targets.length === 0) {
        console.log('No eval targets — nothing to do.');
        return;
    }
    if (!DRY && !process.env.GOOGLE_GENAI_API_KEY && !process.env.GEMINI_API_KEY) {
        console.error('GOOGLE_GENAI_API_KEY missing — cannot run live evals. (Use --dry for dataset validation.)');
        process.exit(1);
    }

    console.log(`Running evals for: ${targets.join(', ')}${DRY ? ' (dry: dataset structure only)' : ''}`);
    const failures: Failure[] = [];
    let ran = 0;
    let passed = 0;
    for (const dir of targets) {
        console.log(`\n== ${dir} ==`);
        const r = await runFlowDir(dir, failures);
        ran += r.ran;
        passed += r.passed;
    }

    console.log(`\n──────── eval summary ────────`);
    console.log(`cases: ${ran}  passed: ${passed}  failed: ${failures.length}`);
    const report = { when: 'ci', targets, ran, passed, failures };
    fs.mkdirSync('eval-results', { recursive: true });
    fs.writeFileSync('eval-results/report.json', JSON.stringify(report, null, 2));
    if (failures.length) {
        console.error('\nFailures:');
        for (const f of failures) console.error(`  - [${f.flow}/${f.file}] ${f.label}: ${f.reason}`);
        process.exit(1);
    }
}

// Flow internals occasionally reject outside the awaited chain (e.g.
// fire-and-forget persistence). Log, mark the run failed, but do NOT let
// the process abort mid-run — per-case accounting stays meaningful.
let unhandled = 0;
process.on('unhandledRejection', (reason) => {
    unhandled += 1;
    console.error('[unhandledRejection]', reason);
});
main().then(() => {
    if (unhandled > 0) {
        console.error(`${unhandled} unhandled rejection(s) during the run`);
        process.exit(1);
    }
}).catch((err) => { console.error(err); process.exit(1); });
