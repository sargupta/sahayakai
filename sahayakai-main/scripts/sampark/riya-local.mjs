#!/usr/bin/env node
/**
 * One-command local Riya × Sahayak (development only). Run from sahayakai-main:
 *
 *   node scripts/sampark/riya-local.mjs            start everything, then an interactive menu
 *   node scripts/sampark/riya-local.mjs --stop     stop what a previous run left behind
 *
 * Options:
 *   --reuse-emulator   use a Firestore emulator already listening on 127.0.0.1:8080
 *   --real-clock       never shift the Sampark clock (calls refused outside the demo school's 10:00–19:00 IST)
 *   --no-open          do not open the browser
 *   --port <n>         Next.js port (default 3000)
 *   --ticker           also run the local scheduler (scripts/sampark/ticker.ts, every 30 s), the
 *                      stand-in for Cloud Scheduler: due callbacks and campaigns then run from the
 *                      server with no browser open. Practice only: nothing rings.
 *   --demo-family      after switching the school on (needs --admin), add the synthetic family
 *                      (same as menu key f), so a Practice call and its callback can be tried at once
 *   --real-call        the ONE authorised real Riya test call (docs/sampark/RIYA_LOCAL_SETUP.md §11.6):
 *                      reads ELEVENLABS_API_KEY from this shell (refuses without it), uses the
 *                      configured agent and number, live dialling on, the emulator's separate
 *                      `sampark-nonprod` database, only +918431339732 allowed, 1 call per day,
 *                      real clock. Seeds the non-demo school riya-test-local.
 *   --persist          keep the emulator data between runs (%LOCALAPPDATA%\riya-local\emulator-data,
 *                      imported at start, exported on exit) and reuse the same LOCAL disposable keys
 *                      (%LOCALAPPDATA%\riya-local\local-keys.json, outside the repository) so the
 *                      stored encrypted test numbers stay readable. Local emulator data only.
 *   --vobiz-call       REAL calls through Vobiz + the SahayakAI bridge (Riya on Gemini Live), from the
 *                      website, for the Sargvision class only: Test mode, provider "Vobiz Calls", the
 *                      roster contacts ring their own numbers, but ONLY those named by --vobiz-allow
 *                      (roster ids, comma separated; default sv-alyssa) are allow-listed. Needs
 *                      --public-base <https URL to this app> and --bridge-base <https URL to the bridge>
 *                      (temporary tunnels: Vobiz must reach both), SAHAYAKAI_REQUEST_SIGNING_KEY in this
 *                      shell (shared with the bridge), and the Vobiz credentials file (VOBIZ_CRED_FILE,
 *                      default E:\sargvision\VOBIZCRED.txt; never printed). Real clock; cap 2/day per contact (--test-cap N, 1-5).
 *   --batch-real       with --vobiz-call only: allow REAL class-wide batch calls (Class-Wide Outreach).
 *                      Off by default, so a batch is refused unless this is given. Rolling scheduler:
 *                      up to 3 calls at once (lowered to the Vobiz account limit, read live at start),
 *                      a new call at most every 60 s; only the --vobiz-allow contacts; each batch
 *                      needs explicit confirmation.
 *   --no-menu          run without the interactive menu (stop with --stop)
 *   --admin <uid>      also make this signed-in account an admin of hillview-demo and switch
 *                      Sampark on for it in Practice mode, so opening SamparkAI goes straight to
 *                      the demo school's workspace (emulator only; repeatable)
 *   --no-voice         do not start the VIDYA voice sidecar (hands-free Live VIDYA then says
 *                      "Voice isn't available")
 *   --webpack          run `next dev` with webpack instead of Turbopack. Turbopack is the default:
 *                      a page's first compile drops from 10–40 s to 1–4 s on this machine. Use this
 *                      only if a page misbehaves under Turbopack.
 *   --no-warm          skip the background warm-up that compiles the Sampark pages and APIs right
 *                      after start (read-only GETs), so the first click on each is not a compile wait
 *
 * Every run seeds the Sargvision sample class (scripts/sampark/sargvision-roster.json) on the
 * emulator's `sampark-nonprod` database. Without --real-call it is in Practice mode (simulated
 * calls, nothing rings); --real-call switches it to Test mode for the allow-listed roster.
 *
 * VIDYA voice: when .env.development.local turns hands-free Live VIDYA on
 * (NEXT_PUBLIC_VIDYA_LIVE_VOICE=1), the sidecar (../sahayakai-agents/scripts/run_local_voice.py,
 * Vertex Gemini Live with your own gcloud ADC) is started on the port of
 * NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL. Without it every tap on VIDYA ends in "I lost the connection".
 *
 * What it does, in order, and what it refuses:
 *   1. Checks Node >= 20 and Java >= 11 (the Firestore emulator is a Java program).
 *   2. Writes a Firestore-only Firebase config OUTSIDE the repository (os.tmpdir()). The repo's
 *      firebase.json declares Hosting with a web-framework backend, and `emulators:start` checks
 *      that even with `--only firestore`, failing with "the experiment webframeworks is not
 *      enabled". The separate config has no Hosting section, so that check never runs; nothing
 *      in the repository and no global experiment is changed.
 *   3. Starts the emulator for project `demo-sahayakai` (a demo- id never resolves to a real
 *      project) and waits for a real TCP connection on 127.0.0.1:8080.
 *   4. Makes a disposable SAMPARK_PII_KEY, pepper and webhook secret in THIS process's memory
 *      only (never written to a file) and passes the same values to the seed and the app.
 *   5. Seeds hillview-demo, starts `next dev` with the documented flags and waits for HTTP.
 *   6. Menu: seed the synthetic family (after you enable Sampark in the UI), run the signed
 *      local-webhook checks, or quit (which stops every process it started).
 *
 * Without --real-call it never uses a real ElevenLabs key and never enables live dialling. The
 * webhook checks post only to localhost.
 */

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

const argv = process.argv.slice(2);

// --real-call: the configured Riya agent and its Vobiz number, Varunesh's source agent (from his
// export; refused as the target) and the single destination the user authorised.
const REAL_CALL = {
    // The unified SARGVISION agent (Sampark + Athithi Vani), 2026-11-04. Sampark calls route to its
    // school workflows only with product_context "sampark", which the ElevenLabs client always sends.
    agentId: 'agent_0601m6hcjz53fa8rbc8mkn46vmw8',
    // +917965853645 on the Vobiz SIP trunk (TLS), imported for and assigned to the unified agent
    // (the earlier phnum_9701… and phnum_1501… resources are superseded).
    // Riya's caller ID — never a contact's number.
    phoneNumberId: 'phnum_5301m6hd2e5de5qaqf79txqf1hbq',
    sourceAgentId: 'agent_9201m4wq7tahfedr03vcf5es80bq',
    allowedNumber: '+918431339732',
};
const has = (f) => argv.includes(`--${f}`);
/** Real test calls per contact per day: --test-cap N (1-5, default 2). Local testing only. */
const testCap = () => {
    const n = Number(argv.includes('--test-cap') ? argv[argv.indexOf('--test-cap') + 1] : 2);
    return String(Number.isInteger(n) && n >= 1 && n <= 5 ? n : 2);
};
const opt = (f, d) => {
    const i = argv.indexOf(`--${f}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

const WIN = process.platform === 'win32';
const ORG = 'hillview-demo';
const PROJECT = 'demo-sahayakai';
const EMU_HOST = '127.0.0.1';
const EMU_PORT = 8080;
// The Storage emulator: the Library keeps each lesson plan, quiz, rubric … as a file, so without
// it nothing a teacher generates locally can be saved or opened again.
const STORAGE_PORT = 9199;
const APP_PORT = Number(opt('port', '3000'));
const STATE_DIR = join(tmpdir(), 'riya-local');
const PID_FILE = join(STATE_DIR, 'pids.json'); // process ids only — no secrets
const EMU_CONFIG = join(STATE_DIR, 'firebase.riya-emulator.json');
const EMU_STORAGE_RULES = join(STATE_DIR, 'storage.riya-emulator.rules');
// --persist: emulator data and the local disposable keys survive restarts (outside the repository).
const PERSIST_DIR = join(process.env.LOCALAPPDATA ?? homedir(), 'riya-local');
const EMU_DATA_DIR = join(PERSIST_DIR, 'emulator-data');
const LOCAL_KEYS_FILE = join(PERSIST_DIR, 'local-keys.json');
const SARGVISION_ROSTER_FILE = join('scripts', 'sampark', 'sargvision-roster.json');
const NPM_CACHE = WIN ? join(process.env.LOCALAPPDATA ?? homedir(), 'npm-cache-riya-firestore') : join(homedir(), '.npm-cache-riya-firestore');
const LOCAL_AGENT = 'agent_localtestlocaltestlocaltest0';
const WEB_ENV_LOCAL = '.env.development.local';
const AGENTS_DIR = join('..', 'sahayakai-agents');
// The sidecar's venv: this checkout's own, else the main checkout's (same pinned requirements).
const AGENTS_PYTHONS = [
    join(AGENTS_DIR, '.venv', WIN ? 'Scripts' : 'bin', WIN ? 'python.exe' : 'python'),
    'E:\\sargvision\\sahayakai\\sahayakai-agents\\.venv\\Scripts\\python.exe',
];

const NODE = process.execPath;
const TSX = join('node_modules', 'tsx', 'dist', 'cli.mjs');
const NEXT = join('node_modules', 'next', 'dist', 'bin', 'next');
const tsx = (script, ...rest) => [TSX, script, ...rest];
/** Quote a path for the Windows shell (npx needs one there); a no-op elsewhere. */
const q = (a) => (WIN && /\s/.test(a) ? `"${a}"` : a);

const say = (s = '') => process.stdout.write(`${s}\n`);
const step = (s) => say(`\n== ${s}`);
const fail = (s) => {
    process.stderr.write(`\nSTOPPED: ${s}\n`);
    stopAll();
    process.exit(1);
};

// ── processes ────────────────────────────────────────────────────────────────

const children = [];

function start(name, cmd, args, env, logFile) {
    mkdirSync(STATE_DIR, { recursive: true });
    const child = spawn(cmd, args, {
        env,
        // Only the npx shim needs a shell on Windows; every argument here is a constant.
        shell: WIN && cmd === 'npx',
        detached: !WIN, // own process group on Linux/macOS, so stop kills the whole tree
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const log = [];
    const onData = (d) => {
        const text = d.toString();
        log.push(text);
        if (log.length > 400) log.shift();
        if (logFile) writeFileSync(logFile, log.join(''));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    children.push({ name, child });
    savePids();
    return { child, log };
}

function savePids() {
    mkdirSync(STATE_DIR, { recursive: true });
    // The launcher itself goes last, so --stop also ends the waiting launcher window.
    writeFileSync(PID_FILE, JSON.stringify([...children.map((c) => ({ name: c.name, pid: c.child.pid })), { name: 'launcher', pid: process.pid }]));
}

function killTree(pid) {
    if (!pid) return;
    try {
        if (WIN) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
        else process.kill(-pid, 'SIGTERM');
    } catch {
        /* already gone */
    }
}

function stopAll() {
    // A run that started nothing (e.g. it found the stack already up) must not delete the PID
    // file of the run that did: Stop-Sahayak-Demo would lose track of those processes.
    if (children.length === 0) return;
    for (const c of children.reverse()) killTree(c.child.pid);
    children.length = 0;
    try {
        rmSync(PID_FILE, { force: true });
    } catch {
        /* ignore */
    }
}

/**
 * --persist keeps emulator data in EMU_DATA_DIR via --export-on-exit, but that export only runs on
 * a graceful shutdown, and stopping here is a forced process-tree kill, so a session's saved
 * lesson plans, quizzes … were silently lost on every stop. Ask the emulator hub to export first.
 * Only when a persist directory exists (a --persist run); otherwise nothing is written.
 */
async function exportEmulatorData() {
    if (!existsSync(join(EMU_DATA_DIR, 'firebase-export-metadata.json')) && !existsSync(EMU_DATA_DIR)) return;
    try {
        const res = await fetch(`http://${EMU_HOST}:4400/_admin/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: EMU_DATA_DIR, initiatedBy: 'riya-local --stop' }),
            signal: AbortSignal.timeout(60000),
        });
        say(res.ok ? `saved emulator data to ${EMU_DATA_DIR}` : `could not save emulator data (hub HTTP ${res.status}); recent changes may be lost`);
    } catch {
        /* no emulator hub running: nothing to save */
    }
}

async function stopPrevious() {
    if (!existsSync(PID_FILE)) {
        say('Nothing recorded from a previous run.');
        return;
    }
    // After a reboot (or a crash) the recorded PIDs are stale and Windows may have reused them
    // for unrelated programs: never kill by an old file when none of our ports is listening.
    if (!(await tcpOpen('127.0.0.1', APP_PORT)) && !(await tcpOpen(EMU_HOST, EMU_PORT))) {
        say('Nothing from a previous run is listening (stale record, e.g. after a restart); nothing to stop.');
        rmSync(PID_FILE, { force: true });
        return;
    }
    await exportEmulatorData();
    const pids = JSON.parse(readFileSync(PID_FILE, 'utf8'));
    for (const p of pids) {
        killTree(p.pid);
        say(`stopped ${p.name} (pid ${p.pid})`);
    }
    rmSync(PID_FILE, { force: true });
}

function run(cmd, args, env) {
    const r = spawnSync(cmd, args, { env, shell: false, encoding: 'utf8' });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
        .split('\n')
        .filter((l) => !/MetadataLookupWarning|trace-warnings/.test(l))
        .join('\n')
        .trim();
    return { code: r.status ?? 1, out };
}

// ── checks ───────────────────────────────────────────────────────────────────

function tcpOpen(host, port, timeoutMs = 1000) {
    return new Promise((resolve) => {
        const s = createConnection({ host, port });
        const done = (ok) => {
            s.destroy();
            resolve(ok);
        };
        s.setTimeout(timeoutMs, () => done(false));
        s.once('connect', () => done(true));
        s.once('error', () => done(false));
    });
}

async function waitFor(what, test, seconds, proc) {
    for (let i = 0; i < seconds; i++) {
        if (await test()) return true;
        if (proc && proc.child.exitCode !== null) return false;
        if (i > 0 && i % 15 === 0) say(`   still waiting for ${what} (${i}s)…`);
        await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
}

async function httpStatus(url) {
    try {
        const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(60000) });
        return res.status;
    } catch {
        return 0;
    }
}

// ── warm-up ──────────────────────────────────────────────────────────────────

/**
 * Compiles the Sampark pages and API routes people open first, one at a time in the background,
 * so a first click is not a compile wait. Read-only: page GETs and API GETs (a POST-only route
 * answers 405 to GET but is compiled all the same). Never sends a body, never starts a call.
 */
const WARM_PATHS = [
    '/sampark', '/sampark/demo', '/sampark/demo/teacher', '/sampark/demo/teacher/classes', '/sampark/demo/teacher/calls',
    '/sampark/demo/teacher/outreach', '/sampark/demo/teacher/follow-ups', '/sampark/demo/teacher/calendar',
    '/sampark/demo/admin', '/sampark/demo/admin/classes', '/sampark/demo/admin/calls', '/sampark/demo/admin/families',
    '/sampark/sargvision-local', '/sampark/sargvision-local/riya', '/sampark/sargvision-local/families',
    '/sampark/sargvision-local/calls', '/sampark/sargvision-local/campaigns', '/sampark/sargvision-local/callbacks', '/',
    '/api/sampark/sargvision-local/school', '/api/sampark/sargvision-local/riya', '/api/sampark/sargvision-local/riya/preview',
    '/api/sampark/sargvision-local/riya/warm-up', '/api/sampark/sargvision-local/riya/warm-up/reconcile',
    '/api/sampark/sargvision-local/guardians?limit=500', '/api/sampark/sargvision-local/campaigns',
    '/api/sampark/sargvision-local/calls', '/api/sampark/sargvision-local/callbacks', '/api/webhooks/elevenlabs-riya',
    // The SahayakAI teacher tools people click first in a demo (pages only; no generation runs).
    '/lesson-plan', '/quiz-generator', '/rubric-generator', '/worksheet-wizard', '/exam-paper', '/instant-answer',
    '/teacher-training', '/virtual-field-trip', '/visual-aid-designer', '/my-library', '/community', '/messages',
    '/my-profile', '/settings', '/notifications', '/organization/dashboard', '/sampark/choose-provider',
    '/api/content/list?limit=1',
];

/**
 * The Vobiz account's own call capacity (read-only GET of the Account object; nothing is dialled).
 * `concurrent_calls_limit` and `cps_limit` are documented on the Account object; the limit is
 * account-wide, shared by every school and product on these credentials. Never prints credentials.
 * Note: `/Account/{id}/` (trailing slash) 307-redirects to a plain-http host, so the slash-less
 * path is used. Returns null when it cannot be read.
 */
async function readVobizAccountLimits(cred) {
    const base = (cred.VOBIZ_BASE_URL || 'https://api.vobiz.ai/api/v1').replace(/\/+$/, '');
    try {
        const res = await fetch(`${base}/Account/${encodeURIComponent(cred.VOBIZ_AUTH_ID)}`, {
            headers: { 'X-Auth-ID': cred.VOBIZ_AUTH_ID, 'X-Auth-Token': cred.VOBIZ_AUTH_TOKEN, Accept: 'application/json' },
            redirect: 'manual',
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return null;
        const body = await res.json();
        const concurrent = Number(body?.concurrent_calls_limit);
        const cps = Number(body?.cps_limit);
        return Number.isInteger(concurrent) && concurrent > 0 ? { concurrent, cps: Number.isFinite(cps) ? cps : null } : null;
    } catch {
        return null;
    }
}

async function warmUp(base) {
    const started = Date.now();
    let ok = 0;
    for (const path of WARM_PATHS) {
        try {
            await fetch(`${base}${path}`, { redirect: 'manual', headers: { Cookie: 'auth-token=dev-token' }, signal: AbortSignal.timeout(180000) });
            ok += 1;
        } catch {
            /* a slow or failed warm-up only means that page compiles on first use */
        }
    }
    say(`   warm-up: ${ok}/${WARM_PATHS.length} pages and APIs compiled in ${Math.round((Date.now() - started) / 1000)} s; first clicks are now instant.`);
}

/** Hands-free Live VIDYA settings from .env.development.local (never returns the key itself). */
function liveVoiceSettings() {
    let text = '';
    try {
        text = readFileSync(WEB_ENV_LOCAL, 'utf8');
    } catch {
        return { enabled: false, port: 0, signingKey: false };
    }
    const value = (k) => text.split(/\r?\n/).find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim() ?? '';
    const url = value('NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL');
    const port = Number(url.match(/^http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/)?.[1] ?? 0);
    return {
        enabled: value('NEXT_PUBLIC_VIDYA_LIVE_VOICE') === '1',
        port,
        signingKey: value('SAHAYAKAI_REQUEST_SIGNING_KEY').length >= 32,
        // The same Google Cloud project the web app's Vertex calls use (src/ai/genkit.ts).
        vertexProject: value('VERTEX_AI_PROJECT'),
    };
}

/** The Sargvision roster's numbers, for the local allow-list only (never printed). */
function sargvisionNumbers() {
    try {
        const roster = JSON.parse(readFileSync(SARGVISION_ROSTER_FILE, 'utf8'));
        return roster.contacts.map((c) => c.phone).filter((p) => /^\+91[6-9]\d{9}$/.test(p));
    } catch {
        return [];
    }
}

function istHour(now = new Date()) {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(now));
}

function istDate(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
    if (has('stop')) {
        await stopPrevious();
        return;
    }
    if (!existsSync('package.json') || !existsSync('scripts/sampark/seed-emulator.ts')) fail('run this from the sahayakai-main folder.');

    step('1. Checks');
    const nodeMajor = Number(process.versions.node.split('.')[0]);
    if (nodeMajor < 20) fail(`Node ${process.versions.node}: Node 20 or newer is required.`);
    say(`   Node ${process.versions.node}  ok`);
    if (!existsSync(NEXT) || !existsSync(TSX)) fail('dependencies are missing: run `npm ci` first.');
    if (!has('reuse-emulator')) {
        const java = spawnSync('java', ['-version'], { encoding: 'utf8', shell: WIN });
        const text = `${java.stderr ?? ''}${java.stdout ?? ''}`;
        const m = text.match(/version "(\d+)(?:\.(\d+))?/);
        const major = m ? (m[1] === '1' ? Number(m[2]) : Number(m[1])) : 0;
        if (java.status !== 0 || major < 11) fail('Java 11 or newer must be on PATH (the Firestore emulator is a Java program).');
        say(`   Java ${major}  ok`);
    }
    // A record left by a run that is no longer up (reboot, closed window) is stale: drop it so
    // this run's record is the only one and Stop never targets reused PIDs.
    if (existsSync(PID_FILE) && !(await tcpOpen('127.0.0.1', APP_PORT)) && !(await tcpOpen(EMU_HOST, EMU_PORT))) rmSync(PID_FILE, { force: true });
    if (await tcpOpen('127.0.0.1', APP_PORT)) {
        // One-click re-runs: if THIS launcher's stack is already up and healthy, hand it over
        // instead of failing or starting duplicates. Anything else on the port is not ours.
        // Readiness = the home page answers 200. (/api/health reports 503 locally by design:
        // it checks production-only secrets that local development does not use.)
        const ours = existsSync(PID_FILE);
        const health = await httpStatus(`http://localhost:${APP_PORT}/`);
        if (ours && health === 200) {
            const url = `http://localhost:${APP_PORT}/`;
            say(`   Sahayak is already running (started by this launcher): ${url}`);
            say('   Stop it with Stop-Sahayak-Demo.cmd (or: node scripts/sampark/riya-local.mjs --stop).');
            if (!has('no-open') && WIN) spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
            process.exit(0);
        }
        fail(ours
            ? `port ${APP_PORT} is in use but the app is not answering (GET / → ${health || 'no answer'}). Run Stop-Sahayak-Demo.cmd, then start again.`
            : `port ${APP_PORT} is already in use by a process this launcher did not start. Stop that server, then retry.`);
    }

    step('2. Firestore + Storage emulators (config outside the repository)');
    mkdirSync(STATE_DIR, { recursive: true });
    // Emulator-only Storage rules, outside the repository: the app's server (Admin SDK) bypasses
    // rules and browsers get nothing — the repository's storage.rules is neither loosened nor used.
    writeFileSync(
        EMU_STORAGE_RULES,
        ["rules_version = '2';", 'service firebase.storage {', '  match /b/{bucket}/o {', '    match /{allPaths=**} {', '      allow read, write: if false;', '    }', '  }', '}', ''].join('\n'),
    );
    writeFileSync(
        EMU_CONFIG,
        `${JSON.stringify({ firestore: {}, storage: { rules: 'storage.riya-emulator.rules' /* relative to this config file */ }, emulators: { firestore: { host: EMU_HOST, port: EMU_PORT }, storage: { host: EMU_HOST, port: STORAGE_PORT }, ui: { enabled: false }, singleProjectMode: true } }, null, 2)}\n`,
    );
    say(`   config: ${EMU_CONFIG}`);
    const already = await tcpOpen(EMU_HOST, EMU_PORT);
    if (already && !has('reuse-emulator')) fail(`something is already listening on ${EMU_HOST}:${EMU_PORT}. If it is your Firestore emulator, re-run with --reuse-emulator; otherwise stop it.`);
    if (!already && has('reuse-emulator')) fail(`--reuse-emulator was given but nothing listens on ${EMU_HOST}:${EMU_PORT}.`);
    const startedEmulator = !already;
    if (!already) {
        const env = { ...process.env, npm_config_cache: NPM_CACHE };
        const persistArgs = has('persist')
            ? (mkdirSync(EMU_DATA_DIR, { recursive: true }), [...(existsSync(join(EMU_DATA_DIR, 'firebase-export-metadata.json')) ? ['--import', q(EMU_DATA_DIR)] : []), '--export-on-exit', q(EMU_DATA_DIR)])
            : [];
        if (has('persist')) say(`   persistent data: ${EMU_DATA_DIR}`);
        const emu = start('firestore-emulator', 'npx', ['-y', 'firebase-tools@13', 'emulators:start', '--only', 'firestore,storage', '--project', PROJECT, '--config', q(EMU_CONFIG), ...persistArgs], env, join(STATE_DIR, 'emulator.log'));
        say('   starting (the first run downloads the emulator, about 60 MB)…');
        const up = await waitFor('the emulator', () => tcpOpen(EMU_HOST, EMU_PORT), 240, emu);
        if (!up) {
            const text = emu.log.join('');
            const hint = /download failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|status 403/i.test(text)
                ? '\nThe emulator JAR could not be downloaded. This machine must reach https://storage.googleapis.com once (proxy/firewall), after which it is cached in ' +
                  join(homedir(), '.cache', 'firebase', 'emulators') + '. Nothing else is wrong.'
                : /webframeworks/i.test(text)
                  ? '\nThe CLI read a config with Hosting. This launcher passes --config ' + EMU_CONFIG + '; check that file has no "hosting" key.'
                  : /java/i.test(text) && /not found|ENOENT|not recognized/i.test(text)
                    ? '\nJava was not found by the Firebase CLI: put Java 17 on PATH or set JAVA_HOME.'
                    : '';
            fail(`the emulator did not open ${EMU_HOST}:${EMU_PORT}. Last output:\n${text.slice(-2500)}${hint}\nFull log: ${join(STATE_DIR, 'emulator.log')}`);
        }
    }
    say(`   TCP ${EMU_HOST}:${EMU_PORT} accepts connections  ok`);
    // Storage starts with Firestore; an emulator reused from elsewhere may not have it.
    const storageUp = await waitFor('the Storage emulator', () => tcpOpen(EMU_HOST, STORAGE_PORT), startedEmulator ? 30 : 2);
    say(storageUp
        ? `   TCP ${EMU_HOST}:${STORAGE_PORT} (Storage) accepts connections  ok`
        : `   Storage emulator not found on ${EMU_HOST}:${STORAGE_PORT}: generated content will not be saved to the Library in this run.`);

    step(has('persist') ? '3. Local disposable values (kept outside the repository with --persist)' : '3. Disposable local values (memory only)');
    const localKeys = (() => {
        const fresh = { piiKey: randomBytes(32).toString('base64'), pepper: `local-${randomBytes(12).toString('hex')}`, webhookSecret: randomBytes(24).toString('hex') };
        if (!has('persist')) return fresh;
        mkdirSync(PERSIST_DIR, { recursive: true });
        if (existsSync(LOCAL_KEYS_FILE)) return JSON.parse(readFileSync(LOCAL_KEYS_FILE, 'utf8'));
        writeFileSync(LOCAL_KEYS_FILE, JSON.stringify(fresh), { mode: 0o600 });
        return fresh;
    })();
    const appEnv = {
        ...process.env,
        NODE_ENV: 'development',
        FIRESTORE_EMULATOR_HOST: `${EMU_HOST}:${EMU_PORT}`,
        ...(storageUp ? { FIREBASE_STORAGE_EMULATOR_HOST: `${EMU_HOST}:${STORAGE_PORT}` } : {}),
        GCLOUD_PROJECT: PROJECT,
        SAMPARK_PII_KEY: localKeys.piiKey,
        SAMPARK_PHONE_PEPPER: localKeys.pepper,
        SAMPARK_ENABLED: 'true',
        SAMPARK_ELEVENLABS_ENABLED: 'true',
        SAMPARK_RIYA_PURPOSES: 'ptm_invitation',
        // Disposable placeholders so the webhook receiver can be tested. Not a real key: Test mode
        // stays refused because live dialling is off and this is not the non-production database.
        ELEVENLABS_WEBHOOK_SECRET: localKeys.webhookSecret,
        ELEVENLABS_API_KEY: 'local-placeholder-not-a-key',
        ELEVENLABS_AGENT_ID: LOCAL_AGENT,
        ELEVENLABS_AGENT_PHONE_NUMBER_ID: 'phnum_localtestlocaltestlocaltest0',
        ELEVENLABS_SOURCE_AGENT_ID: 'agent_sourcesourcesourcesource0000',
        PORT: String(APP_PORT),
        // Disposable, memory-only: authorises the scheduler routes (/api/jobs/*) for --ticker.
        CRON_SECRET: randomBytes(24).toString('hex'),
    };
    // Node >= 22.6 strips TypeScript types itself and then loads tailwind.config.ts as an ES
    // module, where its `require(...)` plugins throw "require is not defined" and no page
    // compiles. Keep Next's own loader in charge of .ts config files.
    const [appNodeMajor, appNodeMinor] = process.versions.node.split('.').map(Number);
    if (appNodeMajor > 22 || (appNodeMajor === 22 && appNodeMinor >= 6)) {
        appEnv.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--no-experimental-strip-types'].filter(Boolean).join(' ');
    }
    // Google Calendar (docs/sampark/GOOGLE_CALENDAR.md). With GOOGLE_CALENDAR_CLIENT_ID and
    // _CLIENT_SECRET in this shell, the real OAuth client is used (its redirect URI must list
    // http://localhost:<port>/api/sampark/google-calendar/oauth/callback). Without them, the
    // local fake Google (mock mode): no real account, clearly labelled in the app.
    appEnv.SAMPARK_GCAL_TOKEN_KEY = randomBytes(32).toString('base64');
    appEnv.GOOGLE_CALENDAR_REDIRECT_URI = `http://localhost:${APP_PORT}/api/sampark/google-calendar/oauth/callback`;
    if (!(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET)) appEnv.GOOGLE_CALENDAR_MODE = 'mock';
    delete appEnv.GOOGLE_CALENDAR_WEBHOOK_URL; // Google cannot reach localhost; sync runs on the ticker and "Sync now".
    delete appEnv.SAMPARK_LIVE_DIAL_ENABLED;
    // The Sargvision sample class lives on the emulator's separate non-production database, and the
    // demo teacher/principal views show it (src/server/sampark/sargvision.ts). Practice mode unless
    // --real-call: simulated calls only.
    appEnv.SAMPARK_FIRESTORE_DATABASE = 'sampark-nonprod';
    appEnv.SAMPARK_DEMO_ENABLED = 'true';
    appEnv.SAMPARK_SARGVISION_ROSTER = 'true';
    delete appEnv.GOOGLE_APPLICATION_CREDENTIALS;
    delete appEnv.FIREBASE_SERVICE_ACCOUNT_KEY;
    const hour = istHour();
    if (!has('real-clock') && (hour < 10 || hour >= 19)) {
        // Emulator-only rehearsal clock (src/lib/sampark/repo/factory.ts devClockFromEnv): ignored
        // in production and without the emulator. Webhook signatures still use the real clock.
        appEnv.SAMPARK_DEV_NOW = `${istDate()}T11:00:00+05:30`;
        say(`   It is ${hour}:xx IST, outside the demo school's 10:00–19:00 calling window: the app's Sampark clock starts at ${appEnv.SAMPARK_DEV_NOW} (emulator only). Use --real-clock to keep real time.`);
    }
    if (has('real-call')) {
        // The key comes only from the operator's shell; it is never printed, written or defaulted.
        const realKey = process.env.ELEVENLABS_API_KEY?.trim() ?? '';
        if (realKey.length < 20 || realKey === 'local-placeholder-not-a-key') fail('--real-call needs ELEVENLABS_API_KEY in this shell (Start-Riya-Local.ps1 -RealCall asks for it with hidden input).');
        Object.assign(appEnv, {
            ELEVENLABS_API_KEY: realKey,
            ELEVENLABS_AGENT_ID: REAL_CALL.agentId,
            ELEVENLABS_AGENT_PHONE_NUMBER_ID: REAL_CALL.phoneNumberId,
            ELEVENLABS_SOURCE_AGENT_ID: REAL_CALL.sourceAgentId,
            SAMPARK_LIVE_DIAL_ENABLED: 'true',
            // The test phone plus the Sargvision roster (scripts/sampark/sargvision-roster.json): nothing else can ring.
            SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: [REAL_CALL.allowedNumber, ...sargvisionNumbers()].filter((n, i, all) => all.indexOf(n) === i).join(','),
            // Per contact on the roster, per school elsewhere.
            SAMPARK_RIYA_TEST_DAILY_CAP: testCap(),
            // School notices plus the four attendance-outreach workflows (absence, academic, behaviour, achievement).
            SAMPARK_RIYA_PURPOSES: 'ptm_invitation,event_invitation,holiday_notice,exam_schedule_notice,emergency_closure,absence_notice,academic_performance,classroom_behaviour,student_achievement',
            // Verified on the agent 2026-10-29 (record_voice=false, delete_audio, 7-day retention):
            // the console must not tell staff calls are recorded.
            SAMPARK_RIYA_RECORDING_OFF_CONFIRMED: 'true',
            // Staff read the transcript under Details; kept 7 days, the same as the agent's retention.
            SAMPARK_RIYA_STORE_TRANSCRIPTS: 'true',
            SAMPARK_RIYA_TRANSCRIPT_DAYS: '7',
        });
        delete appEnv.SAMPARK_DEV_NOW; // a real call keeps the real calling hours
        say(`   Sargvision roster: ${sargvisionNumbers().length} contacts allow-listed (numbers not shown).`);
        say(`   REAL CALL MODE: agent ${REAL_CALL.agentId.slice(-6)}, number id ${REAL_CALL.phoneNumberId.slice(-6)}, test phone ending ${REAL_CALL.allowedNumber.slice(-4)} + Sargvision roster, cap ${testCap()}/day per contact, database sampark-nonprod in the emulator. Key read from this shell (not shown).`);
    }
    if (has('vobiz-call')) {
        // Vobiz credentials from the operator's file: read here, passed only to the app process.
        const credFile = process.env.VOBIZ_CRED_FILE?.trim() || 'E:\\sargvision\\VOBIZCRED.txt';
        if (!existsSync(credFile)) fail(`--vobiz-call needs the Vobiz credentials file (${credFile}).`);
        const cred = {};
        for (const line of readFileSync(credFile, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*[=:]\s*(.*)$/);
            if (m) cred[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
        }
        for (const k of ['VOBIZ_AUTH_ID', 'VOBIZ_AUTH_TOKEN', 'VOBIZ_FROM_NUMBER']) if (!cred[k]) fail(`--vobiz-call: ${k} is missing from the credentials file.`);
        const publicBase = opt('public-base', '');
        const bridgeBase = opt('bridge-base', '');
        if (!/^https:\/\//.test(publicBase) || !/^https:\/\//.test(bridgeBase)) fail('--vobiz-call needs --public-base and --bridge-base https URLs (tunnels Vobiz can reach).');
        const key = process.env.SAHAYAKAI_REQUEST_SIGNING_KEY?.trim() ?? '';
        if (key.length < 32) fail('--vobiz-call needs SAHAYAKAI_REQUEST_SIGNING_KEY (>= 32 chars) in this shell, the same value the bridge uses.');
        // Effective batch concurrency = min(3, configured, VERIFIED Vobiz account limit, AI capacity).
        // The account limit is read live; an operator value can only lower it.
        const limits = await readVobizAccountLimits(cred);
        const opLimit = Number(process.env.SAMPARK_VOBIZ_MAX_CONCURRENT_CALLS);
        const verifiedLimit = limits ? (Number.isInteger(opLimit) && opLimit > 0 ? Math.min(opLimit, limits.concurrent) : limits.concurrent) : null;
        if (limits) say(`   Vobiz account capacity (read live): ${limits.concurrent} concurrent call(s), ${limits.cps ?? '?'} call(s)/second. Batch lines capped at ${Math.min(3, verifiedLimit)}.`);
        else say('   WARNING: could not read the Vobiz account limits; batches use the app ceiling (3) and back off on any 429.');
        let roster = [];
        try { roster = JSON.parse(readFileSync(SARGVISION_ROSTER_FILE, 'utf8')).contacts; } catch { /* checked below */ }
        const allowIds = opt('vobiz-allow', 'sv-alyssa').split(',').map((s) => s.trim()).filter(Boolean);
        const allowed = roster.filter((c) => allowIds.includes(c.id)).map((c) => c.phone).filter((p) => /^\+91[6-9]\d{9}$/.test(p));
        if (allowed.length !== allowIds.length) fail(`--vobiz-allow: unknown roster id(s) in ${allowIds.join(',')}.`);
        Object.assign(appEnv, {
            VOBIZ_AUTH_ID: cred.VOBIZ_AUTH_ID,
            VOBIZ_AUTH_TOKEN: cred.VOBIZ_AUTH_TOKEN,
            VOBIZ_FROM_NUMBER: cred.VOBIZ_FROM_NUMBER,
            ...(cred.VOBIZ_BASE_URL ? { VOBIZ_BASE_URL: cred.VOBIZ_BASE_URL } : {}),
            SAMPARK_VOBIZ_RIYA_ENABLED: 'true',
            SAMPARK_PUBLIC_BASE_URL: publicBase.replace(/\/+$/, ''),
            VOBIZ_STREAM_BASE_URL: bridgeBase.replace(/\/+$/, ''),
            SAHAYAKAI_REQUEST_SIGNING_KEY: key,
            SAMPARK_LIVE_DIAL_ENABLED: 'true',
            // Only the named roster contacts can ring; the rest of the class is visible but refused.
            SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: allowed.join(','),
            SAMPARK_RIYA_TEST_DAILY_CAP: testCap(),
            SAMPARK_RIYA_PURPOSES: 'ptm_invitation,event_invitation,holiday_notice,exam_schedule_notice,emergency_closure,absence_notice,academic_performance,classroom_behaviour,student_achievement',
            // The bridge records no audio; transcripts are kept 7 days for staff (Details).
            SAMPARK_RIYA_RECORDING_OFF_CONFIRMED: 'true',
            SAMPARK_RIYA_STORE_TRANSCRIPTS: 'true',
            SAMPARK_RIYA_TRANSCRIPT_DAYS: '7',
            SAMPARK_CALLBACKS_REAL_PROVIDER: 'false',
            // Class-wide batches ring real phones only with --batch-real (still: allow-list, consent,
            // hours, caps and an explicit confirmation per batch). Without it a real batch is refused.
            SAMPARK_BATCH_REAL_CALLS: has('batch-real') ? 'true' : 'false',
            // Rolling scheduler: up to 3 calls at once, a new one at most every 60 s.
            SAMPARK_BATCH_MAX_CONCURRENCY: process.env.SAMPARK_BATCH_MAX_CONCURRENCY ?? '3',
            SAMPARK_BATCH_DIAL_GAP_SECONDS: process.env.SAMPARK_BATCH_DIAL_GAP_SECONDS ?? '60',
            SAMPARK_VOBIZ_MAX_CONCURRENT_CALLS: verifiedLimit ? String(verifiedLimit) : (process.env.SAMPARK_VOBIZ_MAX_CONCURRENT_CALLS ?? ''),
            SAMPARK_RIYA_MAX_CONCURRENT_SESSIONS: process.env.SAMPARK_RIYA_MAX_CONCURRENT_SESSIONS ?? '',
        });
        delete appEnv.SAMPARK_DEV_NOW; // real calls keep the real calling hours
        if (has('batch-real')) say('   CLASS-WIDE BATCH: real batch calls ON (rolling: up to 3 at once, a new call at most every 60 s, allow-listed contacts only, confirmation required).');
        say(`   VOBIZ CALL MODE: Sargvision class, provider Vobiz Calls; allow-listed: ${allowIds.join(', ')} (numbers not shown); cap ${testCap()}/day per contact. Credentials read from file (not shown).`);
        say(`   Vobiz calls back on ${appEnv.SAMPARK_PUBLIC_BASE_URL}; media stream to ${appEnv.VOBIZ_STREAM_BASE_URL}.`);
    }
    say('   PII key, pepper and webhook secret generated; they exist only in this window.');
    say(`   Google Calendar: ${appEnv.GOOGLE_CALENDAR_MODE === 'mock' ? 'local MOCK Google (no real account; set GOOGLE_CALENDAR_CLIENT_ID/_SECRET for real Google)' : 'real Google OAuth client from this shell'}; token key is per run (reconnect after a restart).`);

    const addTestStudent = () => {
        const r = run(NODE, tsx('scripts/sampark/seed-emulator.ts', '--riya-test-student'), appEnv);
        say(r.out.replace(/^/gm, '   '));
        if (r.code === 3) say('   → Enable school calls for Riya Test School (local) in the browser first, then press a.');
        else if (r.code !== 0) say(`   seed failed (exit ${r.code}).`);
    };

    step(`4. Seed ${ORG}`);
    const adminArgs = argv.flatMap((a, i) => (a === '--admin' && argv[i + 1] && !argv[i + 1].startsWith('--') ? ['--admin', argv[i + 1]] : []));
    const seed = run(NODE, tsx('scripts/sampark/seed-emulator.ts', ...adminArgs, '--sargvision-org', ...(has('real-call') ? ['--riya-test-school'] : [])), appEnv);
    say(seed.out.replace(/^/gm, '   '));
    if (seed.code !== 0) fail(`seeding failed (exit ${seed.code}).`);

    step('5. VIDYA voice sidecar (hands-free Live VIDYA)');
    const voice = liveVoiceSettings();
    if (has('no-voice') || !voice.enabled) {
        say(`   skipped (${has('no-voice') ? '--no-voice' : `${WEB_ENV_LOCAL} does not set NEXT_PUBLIC_VIDYA_LIVE_VOICE=1`}); VIDYA uses the turn-based voice path.`);
    } else if (!voice.port || voice.port === EMU_PORT || voice.port === APP_PORT) {
        say(`   NOT started: NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL in ${WEB_ENV_LOCAL} must be http://localhost:<port> on a free port (not ${EMU_PORT} or ${APP_PORT}), e.g. 8090.`);
    } else if (!voice.signingKey) {
        say(`   NOT started: SAHAYAKAI_REQUEST_SIGNING_KEY (>= 32 chars) is missing from ${WEB_ENV_LOCAL}; the app and the sidecar share it.`);
    } else if (await tcpOpen('127.0.0.1', voice.port)) {
        say(`   something already listens on 127.0.0.1:${voice.port}: using it as the sidecar.`);
    } else {
        const python = AGENTS_PYTHONS.find((py) => existsSync(py));
        if (!python) {
            say(`   NOT started: no sidecar venv (${AGENTS_PYTHONS.join(' or ')}). In ../sahayakai-agents: python -m venv .venv, then pip install -e .`);
        } else {
            // A real Google client (Vertex Live with your gcloud ADC): it must not inherit the app's
            // emulator project or Firestore emulator host.
            // NO_COLOR: the sidecar's output goes to a log file. With FORCE_COLOR inherited (IDE
            // terminals and CI set it) structlog insists on colorama, which the Windows venv does
            // not have, and the sidecar dies at import — VIDYA then has no voice at all.
            const voiceEnv = { ...process.env, PYTHONIOENCODING: 'utf-8', NO_COLOR: '1' };
            for (const k of ['FIRESTORE_EMULATOR_HOST', 'GCLOUD_PROJECT', 'GOOGLE_APPLICATION_CREDENTIALS', 'FORCE_COLOR']) delete voiceEnv[k];
            if (voice.vertexProject && !voiceEnv.GOOGLE_CLOUD_PROJECT) voiceEnv.GOOGLE_CLOUD_PROJECT = voice.vertexProject;
            const sidecar = start('vidya-voice-sidecar', python, [join(AGENTS_DIR, 'scripts', 'run_local_voice.py'), '--port', String(voice.port)], voiceEnv, join(STATE_DIR, 'vidya-voice.log'));
            const upVoice = await waitFor('the VIDYA voice sidecar', () => tcpOpen('127.0.0.1', voice.port), 90, sidecar);
            const health = upVoice ? await httpStatus(`http://127.0.0.1:${voice.port}/healthz`) : 0;
            say(upVoice
                ? `   http://localhost:${voice.port} up (GET /healthz → HTTP ${health}); Vertex Gemini Live via your gcloud ADC. Log: ${join(STATE_DIR, 'vidya-voice.log')}`
                : `   the sidecar did not start; VIDYA voice will say "I lost the connection". Last output:\n${sidecar.log.join('').slice(-1500)}`);
        }
    }

    // Turbopack compiles a page in 1–4 s where webpack took 10–40 s here; --webpack keeps the old path.
    const turbo = !has('webpack');
    step(`6. Sahayak (next dev, ${turbo ? 'Turbopack' : 'webpack'})`);
    const base = `http://localhost:${APP_PORT}`;
    // The dev server downloads the Google font files on its first compile. When that download
    // goes wrong (a slow network, or Google answering with a font URL Turbopack cannot read) the
    // root layout fails to build and EVERY page answers 500 for as long as that process lives.
    // It is decided once per start, so a fresh start is the cure: check a real page, and start
    // again (at most twice) instead of handing over an app that is down.
    let dev;
    let pageStatus = 0;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        dev = start('next-dev', NODE, [NEXT, 'dev', ...(turbo ? ['--turbopack'] : []), '-p', String(APP_PORT)], appEnv, join(STATE_DIR, 'next-dev.log'));
        const upApp = await waitFor('Next.js', async () => (await httpStatus(`${base}/api/health`)) > 0, 300, dev);
        if (!upApp) fail(`Next.js did not start. Last output:\n${dev.log.join('').slice(-2500)}`);
        // Probe the HOME page: it compiles the root layout (and its Google fonts). The Riya page
        // answers 307 before rendering, so a broken font build went unnoticed and every page
        // then served 500 for the whole session.
        say('   compiling the home page (first time takes a minute)…');
        pageStatus = await httpStatus(`${base}/`);
        say(`   GET / → HTTP ${pageStatus}`);
        const fontBuildFailed = pageStatus >= 500 && /internal\/font\/google|next\/font\/google/.test(dev.log.join(''));
        if (!fontBuildFailed) break;
        if (attempt === 3) {
            say('   The pages still fail to build because the Google font download keeps failing. Check the internet connection, then run this launcher again.');
            break;
        }
        say(`   the page failed to build: the Google font download went wrong on this start. Restarting next dev (attempt ${attempt + 1} of 3)…`);
        killTree(dev.child.pid);
        const gone = children.findIndex((c) => c.child === dev.child);
        if (gone >= 0) children.splice(gone, 1);
        savePids();
        await waitFor('the port to free', async () => !(await tcpOpen('127.0.0.1', APP_PORT)), 30);
    }

    if (adminArgs.length > 0) {
        // Switch the demo school on through the app's own route, as the seeded admin (the
        // development-only dev-token). Practice mode: nothing can ring.
        // The first request compiles the route, so retry until the app answers.
        let status = 0;
        let lastError = '';
        for (let attempt = 0; attempt < 5 && status !== 200; attempt += 1) {
            try {
                const res = await fetch(`${base}/api/sampark/${ORG}/enable`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Cookie: 'auth-token=dev-token' },
                    body: JSON.stringify({ displayName: 'Hillview Demo School' }),
                    signal: AbortSignal.timeout(180000),
                });
                status = res.status;
            } catch (err) {
                lastError = err instanceof Error ? err.message : String(err);
                await new Promise((r) => setTimeout(r, 5000));
            }
        }
        say(status === 200
            ? `   POST /api/sampark/${ORG}/enable → HTTP 200 (Practice mode: nothing rings)`
            : `   could not switch Sampark on for ${ORG} (HTTP ${status}${lastError ? `, ${lastError}` : ''}); use "Enable school calls" in the browser.`);
        if (status === 200 && has('demo-family')) {
            const fam = run(NODE, tsx('scripts/sampark/seed-emulator.ts', '--riya-demo-family'), appEnv);
            say(fam.out.replace(/^/gm, '   '));
        }
    }

    if (has('real-call')) {
        // Switch Sampark on for the non-demo test school (Practice mode: nothing rings yet), then
        // add Alyssa. Test phone and Test mode are set by a person in the console.
        let status = 0;
        for (let attempt = 0; attempt < 5 && status !== 200; attempt += 1) {
            try {
                const res = await fetch(`${base}/api/sampark/riya-test-local/enable`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Cookie: 'auth-token=dev-token' },
                    body: JSON.stringify({ displayName: 'Riya Test School (local)' }),
                    signal: AbortSignal.timeout(180000),
                });
                status = res.status;
            } catch {
                await new Promise((r) => setTimeout(r, 5000));
            }
        }
        say(`   POST /api/sampark/riya-test-local/enable → HTTP ${status} (Practice mode until Test mode is chosen in the console)`);
        addTestStudent();
    }

    // The Sargvision sample class (every run): enable the non-demo school, seed the roster
    // (idempotent: fixed ids, re-runs reuse every contact). Test mode only with --real-call.
    let svStatus = 0;
    try {
        const res = await fetch(`${base}/api/sampark/sargvision-local/enable`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: 'auth-token=dev-token' },
            body: JSON.stringify({ displayName: 'Sargvision (sample class, local test)', spokenName: { English: 'Sargvision', Hindi: 'Sargvision', Bengali: 'Sargvision', Nepali: 'Sargvision' } }),
            signal: AbortSignal.timeout(180000),
        });
        svStatus = res.status;
    } catch {
        /* reported below */
    }
    say(`   POST /api/sampark/sargvision-local/enable → HTTP ${svStatus}`);
    const hourNow = istHour();
    const realSv = has('real-call') || has('vobiz-call');
    const sv = run(NODE, tsx('scripts/sampark/seed-emulator.ts', '--sargvision',
        ...(realSv ? (hourNow < 10 || hourNow >= 20 ? ['--arm-sargvision-after-hours'] : []) : ['--sargvision-mode', 'practice']),
        ...(has('vobiz-call') ? ['--sargvision-provider', 'vobiz'] : [])), appEnv);
    say(sv.out.replace(/^/gm, '   '));
    say(`   Teacher: ${base}/sampark/demo/teacher/classes (Anjali Rai → Sargvision) · Principal: ${base}/sampark/demo/admin/classes · Console: ${base}/sampark/sargvision-local/riya`);
    if (!has('no-warm')) warmUp(base);

    if (has('ticker')) {
        start('ticker', NODE, tsx('scripts/sampark/ticker.ts', '--interval', '30'), { ...appEnv, SAMPARK_BASE_URL: base }, join(STATE_DIR, 'ticker.log'));
        say(`   Local scheduler running every 30 s (log: ${join(STATE_DIR, 'ticker.log')}). Due callbacks run from the server.`);
    }

    const url = has('open-home') ? `${base}/` : `${base}/sampark`;
    step('7. In your browser');
    say(`   READY: ${base}/  (logs: ${STATE_DIR})`);
    say(`   1) Open ${url}`);
    say('   2) DevTools console (F12):  document.cookie="auth-token=dev-token; path=/"   then reload.');
    say('      (development-only login; the middleware maps it to dev-user-123, the seeded school admin)');
    say('   3) Click "Enable school calls" for Hillview Demo School (stays in Practice: nothing rings).');
    say(`   4) Come back here and press f to add the synthetic family, then open ${base}/sampark/${ORG}/riya`);
    if (!has('no-open')) {
        try {
            if (WIN) spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
            else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
        } catch {
            /* print-only */
        }
    }

    if (has('no-menu')) {
        say('\nRunning without the menu. Stop with: node scripts/sampark/riya-local.mjs --stop');
        process.on('SIGINT', async () => { if (startedEmulator && has('persist')) await exportEmulatorData(); stopAll(); process.exit(0); });
        await new Promise(() => {});
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const quit = async () => {
        rl.close();
        say('\nStopping the app and the emulator…');
        if (startedEmulator && has('persist')) await exportEmulatorData();
        stopAll();
        say(startedEmulator ? 'Stopped. The emulator kept no data on disk.' : 'Stopped the app. The emulator you started yourself is still running.');
        process.exit(0);
    };
    process.on('SIGINT', quit);
    for (;;) {
        const a = (await rl.question(`\n[f] add synthetic family   ${has('real-call') ? '[a] add test student Alyssa   ' : ''}[w] run local webhook checks   [s] status   [q] quit > `)).trim().toLowerCase();
        if (a === 'q') await quit();
        else if (a === 'a' && has('real-call')) addTestStudent();
        else if (a === 'f') {
            const r = run(NODE, tsx('scripts/sampark/seed-emulator.ts', '--riya-demo-family'), appEnv);
            say(r.out.replace(/^/gm, '   '));
            if (r.code === 3) say('   → Enable school calls in the browser first (step 3), then press f again.');
            else if (r.code !== 0) say(`   seed failed (exit ${r.code}).`);
        } else if (a === 'w') {
            const conv = `conv_local_${Date.now().toString(36)}`;
            const fx = run(NODE, tsx('scripts/sampark/seed-riya-webhook-fixture.ts', '--conversation', conv), appEnv);
            say(fx.out.replace(/^/gm, '   '));
            if (fx.code !== 0) {
                say(fx.code === 3 ? '   → Run one Practice call in the Riya tab first, then press w again.' : `   fixture failed (exit ${fx.code}).`);
                continue;
            }
            const send = (extra) => run(NODE, ['scripts/sampark/send-test-riya-webhook.mjs', '--url', `${base}/api/webhooks/elevenlabs-riya`, '--conversation', conv, ...extra], appEnv).out;
            const rows = [
                ['bad signature', '401', send(['--bad-signature'])],
                ['stale signature', '401', send(['--stale'])],
                ['another agent', '200 (ignored)', send(['--agent', 'agent_otherotherotherotherother000'])],
                ['authentic post-call', '200', send([])],
                ['duplicate post-call', '200 (no change)', send([])],
                ['late failure event', '200 (no regression)', send(['--type', 'failure'])],
                ['unlinked conversation', '503 (retryable)', run(NODE, ['scripts/sampark/send-test-riya-webhook.mjs', '--url', `${base}/api/webhooks/elevenlabs-riya`, '--conversation', `conv_unlinked_${Date.now().toString(36)}`], appEnv).out],
            ];
            for (const [what, expected, got] of rows) say(`   ${what.padEnd(22)} expected ${expected.padEnd(20)} got ${got}`);
            // Read the stored record back through the console's own API (the dev login, development only).
            try {
                const res = await fetch(`${base}/api/sampark/${ORG}/riya`, { headers: { cookie: 'auth-token=dev-token' } });
                const data = await res.json();
                const c = (data.calls ?? []).find((x) => x.providerConversationId === conv);
                say(c ? `   stored: state ${c.state} · ${c.durationSeconds ?? '—'} s · ${c.callSuccessful ?? '—'} · answers ${JSON.stringify(c.dataCollection)}` : `   stored record not found (HTTP ${res.status})`);
            } catch (err) {
                say(`   could not read the record back: ${err instanceof Error ? err.message : String(err)}`);
            }
            say('   The Riya tab shows the same call (Test phone · Conversation ended · Coming to the meeting: Can attend). Press Refresh there.');
        } else if (a === 's') {
            say(`   emulator ${(await tcpOpen(EMU_HOST, EMU_PORT)) ? 'up' : 'DOWN'} · GET /sampark → HTTP ${await httpStatus(`${base}/sampark`)} · logs in ${STATE_DIR}`);
        }
    }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
