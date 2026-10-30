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
 *   --no-menu          run without the interactive menu (stop with --stop)
 *   --admin <uid>      also make this signed-in account an admin of hillview-demo and switch
 *                      Sampark on for it in Practice mode, so opening SamparkAI goes straight to
 *                      the demo school's workspace (emulator only; repeatable)
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
    agentId: 'agent_9601m63tk4rtfqbvd190w9nvb1v4',
    phoneNumberId: 'phnum_1501m63v1ns0ewb974m87d5q7wze',
    sourceAgentId: 'agent_9201m4wq7tahfedr03vcf5es80bq',
    allowedNumber: '+918431339732',
};
const has = (f) => argv.includes(`--${f}`);
const opt = (f, d) => {
    const i = argv.indexOf(`--${f}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

const WIN = process.platform === 'win32';
const ORG = 'hillview-demo';
const PROJECT = 'demo-sahayakai';
const EMU_HOST = '127.0.0.1';
const EMU_PORT = 8080;
const APP_PORT = Number(opt('port', '3000'));
const STATE_DIR = join(tmpdir(), 'riya-local');
const PID_FILE = join(STATE_DIR, 'pids.json'); // process ids only — no secrets
const EMU_CONFIG = join(STATE_DIR, 'firebase.riya-emulator.json');
// --persist: emulator data and the local disposable keys survive restarts (outside the repository).
const PERSIST_DIR = join(process.env.LOCALAPPDATA ?? homedir(), 'riya-local');
const EMU_DATA_DIR = join(PERSIST_DIR, 'emulator-data');
const LOCAL_KEYS_FILE = join(PERSIST_DIR, 'local-keys.json');
const SARGVISION_ROSTER_FILE = join('scripts', 'sampark', 'sargvision-roster.json');
const NPM_CACHE = WIN ? join(process.env.LOCALAPPDATA ?? homedir(), 'npm-cache-riya-firestore') : join(homedir(), '.npm-cache-riya-firestore');
const LOCAL_AGENT = 'agent_localtestlocaltestlocaltest0';

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
    writeFileSync(PID_FILE, JSON.stringify(children.map((c) => ({ name: c.name, pid: c.child.pid }))));
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
    for (const c of children.reverse()) killTree(c.child.pid);
    children.length = 0;
    try {
        rmSync(PID_FILE, { force: true });
    } catch {
        /* ignore */
    }
}

function stopPrevious() {
    if (!existsSync(PID_FILE)) {
        say('Nothing recorded from a previous run.');
        return;
    }
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
        stopPrevious();
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
    if (await tcpOpen('127.0.0.1', APP_PORT)) fail(`port ${APP_PORT} is already in use. Stop the other server (or run with --stop), then retry.`);

    step('2. Firestore emulator (Firestore only, config outside the repository)');
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(
        EMU_CONFIG,
        `${JSON.stringify({ firestore: {}, emulators: { firestore: { host: EMU_HOST, port: EMU_PORT }, ui: { enabled: false }, singleProjectMode: true } }, null, 2)}\n`,
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
        const emu = start('firestore-emulator', 'npx', ['-y', 'firebase-tools@13', 'emulators:start', '--only', 'firestore', '--project', PROJECT, '--config', q(EMU_CONFIG), ...persistArgs], env, join(STATE_DIR, 'emulator.log'));
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
    delete appEnv.SAMPARK_FIRESTORE_DATABASE;
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
            SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
            // The test phone plus the Sargvision roster (scripts/sampark/sargvision-roster.json): nothing else can ring.
            SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: [REAL_CALL.allowedNumber, ...sargvisionNumbers()].filter((n, i, all) => all.indexOf(n) === i).join(','),
            // Per contact on the roster, per school elsewhere.
            SAMPARK_RIYA_TEST_DAILY_CAP: '2',
            SAMPARK_RIYA_PURPOSES: 'ptm_invitation,event_invitation,holiday_notice,exam_schedule_notice,emergency_closure',
            SAMPARK_DEMO_ENABLED: 'true',
            SAMPARK_SARGVISION_ROSTER: 'true',
            // Verified on the agent 2026-10-29 (record_voice=false, delete_audio, 7-day retention):
            // the console must not tell staff calls are recorded.
            SAMPARK_RIYA_RECORDING_OFF_CONFIRMED: 'true',
            // Staff read the transcript under Details; kept 7 days, the same as the agent's retention.
            SAMPARK_RIYA_STORE_TRANSCRIPTS: 'true',
            SAMPARK_RIYA_TRANSCRIPT_DAYS: '7',
        });
        delete appEnv.SAMPARK_DEV_NOW; // a real call keeps the real calling hours
        say(`   Sargvision roster: ${sargvisionNumbers().length} contacts allow-listed (numbers not shown).`);
        say(`   REAL CALL MODE: agent ${REAL_CALL.agentId.slice(-6)}, number id ${REAL_CALL.phoneNumberId.slice(-6)}, test phone ending ${REAL_CALL.allowedNumber.slice(-4)} + Sargvision roster, cap 2/day per contact, database sampark-nonprod in the emulator. Key read from this shell (not shown).`);
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
    const seed = run(NODE, tsx('scripts/sampark/seed-emulator.ts', ...adminArgs, ...(has('real-call') ? ['--riya-test-school', '--sargvision-org'] : [])), appEnv);
    say(seed.out.replace(/^/gm, '   '));
    if (seed.code !== 0) fail(`seeding failed (exit ${seed.code}).`);

    step('5. Sahayak (next dev)');
    const dev = start('next-dev', NODE, [NEXT, 'dev', '-p', String(APP_PORT)], appEnv, join(STATE_DIR, 'next-dev.log'));
    const base = `http://localhost:${APP_PORT}`;
    const upApp = await waitFor('Next.js', async () => (await httpStatus(`${base}/api/health`)) > 0, 300, dev);
    if (!upApp) fail(`Next.js did not start. Last output:\n${dev.log.join('').slice(-2500)}`);
    say('   compiling the Riya page (first time takes a minute)…');
    const pageStatus = await httpStatus(`${base}/sampark/${ORG}/riya`);
    say(`   GET /sampark/${ORG}/riya → HTTP ${pageStatus}`);

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

        // The Sargvision sample class: enable the non-demo school, seed the roster, Test mode.
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
        const sv = run(NODE, tsx('scripts/sampark/seed-emulator.ts', '--sargvision', ...(hourNow < 10 || hourNow >= 20 ? ['--arm-sargvision-after-hours'] : [])), appEnv);
        say(sv.out.replace(/^/gm, '   '));
        say(`   Teacher: ${base}/sampark/demo/teacher/classes (Anjali Rai → Sargvision) · Principal: ${base}/sampark/demo/admin/classes · Console: ${base}/sampark/sargvision-local/riya`);
    }

    if (has('ticker')) {
        start('ticker', NODE, tsx('scripts/sampark/ticker.ts', '--interval', '30'), { ...appEnv, SAMPARK_BASE_URL: base }, join(STATE_DIR, 'ticker.log'));
        say(`   Local scheduler running every 30 s (log: ${join(STATE_DIR, 'ticker.log')}). Due callbacks run from the server.`);
    }

    const url = `${base}/sampark`;
    step('6. In your browser');
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
        process.on('SIGINT', () => { stopAll(); process.exit(0); });
        await new Promise(() => {});
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const quit = () => {
        rl.close();
        say('\nStopping the app and the emulator…');
        stopAll();
        say(startedEmulator ? 'Stopped. The emulator kept no data on disk.' : 'Stopped the app. The emulator you started yourself is still running.');
        process.exit(0);
    };
    process.on('SIGINT', quit);
    for (;;) {
        const a = (await rl.question(`\n[f] add synthetic family   ${has('real-call') ? '[a] add test student Alyssa   ' : ''}[w] run local webhook checks   [s] status   [q] quit > `)).trim().toLowerCase();
        if (a === 'q') quit();
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
