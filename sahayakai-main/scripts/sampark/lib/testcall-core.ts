/**
 * Core of the one-off Vobiz keypad-capture test call.
 *
 * STANDALONE. This file imports only the Vobiz client, the calling-hours rule,
 * the phone classifier and node builtins. No Firestore, no Sampark engine, no
 * model client (a static test enforces it). It places at most ONE call, to the
 * single number in TEST_PHONE_E164, and the destination is never read from any
 * HTTP request.
 *
 * TOKENS. `src/lib/vobiz/tokens.ts` signs with a key fetched from Secret
 * Manager and is wired to engine domains; adding a test-only domain there would
 * touch a shared module and drag the GCP SDK into a laptop script. So this file
 * implements a small local HMAC with the SAME wire format
 * (`<id>.<exp>.<sig>`, sig = base64url HMAC-SHA256 of `<domain>.<id>.<exp>`),
 * with its own domains and a random per-run key that exists only in memory.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { checkCallingWindow } from '../../../src/lib/calling-hours';
import { classifyPhone, phoneLast4 } from '../../../src/lib/sampark/phone';
import {
    hangupVobizCall,
    placeVobizCall,
    readVobizConfig,
    type VobizConfig,
} from '../../../src/lib/vobiz/client';

import type { ClipSet } from './testcall-audio';

// ---------------------------------------------------------------- tokens

export const TESTCALL_DOMAINS = {
    answer: 'vobiz-testcall-answer',
    gather: 'vobiz-testcall-gather',
    status: 'vobiz-testcall-status',
    audio: 'vobiz-testcall-audio',
} as const;
export type TestCallDomain = (typeof TESTCALL_DOMAINS)[keyof typeof TESTCALL_DOMAINS];

/** Short: the whole call is capped at 180 s by default. */
export const TESTCALL_TOKEN_TTL_SECONDS = 600;

export function newRunKey(): string {
    return crypto.randomBytes(32).toString('hex');
}

function sign(key: string, domain: string, id: string, exp: number): string {
    return crypto.createHmac('sha256', key).update(`${domain}.${id}.${exp}`, 'utf8').digest('base64url');
}

export function mintToken(
    key: string, domain: TestCallDomain, runId: string, nowMs: number, ttl = TESTCALL_TOKEN_TTL_SECONDS,
): string {
    const exp = Math.floor(nowMs / 1000) + ttl;
    return `${runId}.${exp}.${sign(key, domain, runId, exp)}`;
}

/** Returns the run id the token authorises, or null. */
export function verifyToken(key: string, domain: TestCallDomain, token: string | null | undefined, nowMs: number): string | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [id, expRaw, sig] = parts;
    const exp = Number.parseInt(expRaw, 10);
    if (!Number.isFinite(exp) || !id || !sig || exp < Math.floor(nowMs / 1000)) return null;
    const a = Buffer.from(sign(key, domain, id, exp));
    const b = Buffer.from(sig);
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? id : null;
}

// ---------------------------------------------------------------- guards

export interface GuardResult {
    ok: boolean;
    guard: string;
    reason: string;
}

const pass = (guard: string): GuardResult => ({ ok: true, guard, reason: '' });
const fail = (guard: string, reason: string): GuardResult => ({ ok: false, guard, reason });

export function guardFlag(present: boolean): GuardResult {
    return present ? pass('flag') : fail('flag', 'refusing: --i-own-this-number is required (you confirm the destination is your own phone)');
}

export function guardTestPhone(raw: string | undefined): GuardResult {
    const v = (raw ?? '').trim();
    if (!v) return fail('test_phone', 'TEST_PHONE_E164 is not set');
    if (!/^\+[1-9]\d{9,14}$/.test(v)) return fail('test_phone', 'TEST_PHONE_E164 must be E.164, e.g. +919876543210');
    if (classifyPhone(v) === 'synthetic') return fail('test_phone', 'TEST_PHONE_E164 is in the synthetic +915 range; that cannot ring a real phone');
    return pass('test_phone');
}

export function guardBaseUrl(raw: string | undefined, allowHttpLocal = false): GuardResult {
    const v = (raw ?? '').trim();
    if (!v) return fail('base_url', 'PUBLIC_BASE_URL is not set');
    let u: URL;
    try { u = new URL(v); } catch { return fail('base_url', 'PUBLIC_BASE_URL is not a valid URL'); }
    if (u.protocol === 'https:') return pass('base_url');
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol === 'http:' && local && allowHttpLocal) return pass('base_url');
    return fail('base_url', 'PUBLIC_BASE_URL must be https (a tunnel URL); http is accepted only for a localhost dry run');
}

export function guardWindow(now: Date): GuardResult {
    const v = checkCallingWindow(now);
    return v.allowed ? pass('calling_window') : fail('calling_window', `outside 09:00-21:00 IST (now ${v.istTime}); ${v.reason}`);
}

export function guardSigningKey(key: string | undefined): GuardResult {
    return key && key.length >= 32 ? pass('signing_key') : fail('signing_key', 'per-run signing key must be at least 32 chars');
}

export interface GuardInput {
    flag: boolean;
    env: NodeJS.ProcessEnv;
    now: Date;
    /** Dry runs tolerate an http localhost base URL. */
    allowHttpLocal?: boolean;
}

/** All dial-time guards. Every one is reported, not just the first failure. */
export function evaluateGuards(input: GuardInput): { ok: boolean; results: GuardResult[] } {
    const results = [
        guardFlag(input.flag),
        guardTestPhone(input.env.TEST_PHONE_E164),
        guardBaseUrl(input.env.PUBLIC_BASE_URL, input.allowHttpLocal),
        readVobizConfig(input.env) ? pass('vobiz_config') : fail('vobiz_config', 'VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN / VOBIZ_FROM_NUMBER not all set'),
        guardWindow(input.now),
    ];
    return { ok: results.every((r) => r.ok), results };
}

/** Env vars whose absence forces a dry run. */
export const REQUIRED_ENV = ['TEST_PHONE_E164', 'PUBLIC_BASE_URL', 'VOBIZ_AUTH_ID', 'VOBIZ_AUTH_TOKEN', 'VOBIZ_FROM_NUMBER'] as const;

export function missingEnv(env: NodeJS.ProcessEnv): string[] {
    return REQUIRED_ENV.filter((k) => !env[k]?.trim());
}

// ---------------------------------------------------------------- XML

export function xmlEscape(s: string): string {
    return s
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export interface XmlTokens {
    gather: string;
    audio: string;
}

export interface XmlOptions {
    baseUrl: string;
    tokens: XmlTokens;
    /** Names of clips available (from the ClipSet). */
    clips: ReadonlySet<string>;
}

const trimBase = (b: string) => b.replace(/\/+$/, '');

function audioUrl(o: XmlOptions, name: string): string {
    return xmlEscape(`${trimBase(o.baseUrl)}/audio/${name}.wav?t=${encodeURIComponent(o.tokens.audio)}`);
}

function gatherEl(o: XmlOptions): string {
    const action = xmlEscape(`${trimBase(o.baseUrl)}/gather?t=${encodeURIComponent(o.tokens.gather)}`);
    return `<Gather action="${action}" method="POST" numDigits="1" timeout="10"><Play>${audioUrl(o, 'notice')}</Play></Gather>`;
}

function playIf(o: XmlOptions, name: string): string {
    return o.clips.has(name) ? `<Play>${audioUrl(o, name)}</Play>` : '';
}

/** /answer: Gather(Play notice), then no_input (if we have one), then Hangup. */
export function buildAnswerXml(o: XmlOptions): string {
    return `<Response>${gatherEl(o)}${playIf(o, 'no_input')}<Hangup/></Response>`;
}

/** The answer XML for the not-allowed / failed-auth cases. */
export const EMPTY_RESPONSE_XML = '<Response/>';

export type DigitRoute = 'confirm_1' | 'confirm_2' | 'opt_out_done';
const DIGIT_CLIP: Record<string, DigitRoute> = { '1': 'confirm_1', '2': 'confirm_2', '9': 'opt_out_done' };

/**
 * /gather response. `invalidSoFar` counts earlier invalid/empty attempts: the
 * first one repeats the Gather once; after that, no_input + Hangup. With only
 * the opener clip there is no confirmation audio, so a valid digit just hangs up.
 */
export function buildGatherResultXml(o: XmlOptions, digit: string | null, invalidSoFar: number): string {
    const route = digit ? DIGIT_CLIP[digit] : undefined;
    if (route) return `<Response>${playIf(o, route)}<Hangup/></Response>`;
    if (invalidSoFar === 0) return `<Response>${gatherEl(o)}${playIf(o, 'no_input')}<Hangup/></Response>`;
    return `<Response>${playIf(o, 'no_input')}<Hangup/></Response>`;
}

// ---------------------------------------------------------------- request parsing

/** Case-insensitive first match among candidate names. */
function pick(params: Record<string, string>, names: string[]): string | null {
    const lower = new Map(Object.entries(params).map(([k, v]) => [k.toLowerCase(), v]));
    for (const n of names) {
        const v = lower.get(n.toLowerCase());
        if (v !== undefined) return v;
    }
    return null;
}

/** Digits tolerant of Digits / digits / Digit. Returns only keypad characters, or null. */
export function parseGatherDigits(params: Record<string, string>): string | null {
    const raw = pick(params, ['Digits', 'Digit']);
    if (raw === null) return null;
    const cleaned = raw.replace(/[^0-9*#]/g, '');
    return cleaned === '' ? null : cleaned;
}

/** Call id tolerant of CallUUID / call_uuid / CallSid. */
export function parseCallId(params: Record<string, string>): string | null {
    const v = pick(params, ['CallUUID', 'call_uuid', 'CallSid']);
    return v && /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : null;
}

export function parseCause(params: Record<string, string>): string | null {
    const v = pick(params, ['HangupCause', 'hangup_cause', 'Cause', 'CallStatus', 'EndReason']);
    return v === null ? null : v.slice(0, 64);
}

export function parseDuration(params: Record<string, string>): number | null {
    const v = pick(params, ['Duration', 'BillDuration', 'CallDuration']);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
}

/** Merge query-string and form/JSON body parameters (body wins). */
export function parseParams(url: URL, body: string, contentType: string | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { out[k] = v; });
    const ct = (contentType ?? '').toLowerCase();
    if (body) {
        if (ct.includes('json')) {
            try {
                const j = JSON.parse(body) as Record<string, unknown>;
                for (const [k, v] of Object.entries(j)) if (typeof v === 'string' || typeof v === 'number') out[k] = String(v);
            } catch { /* ignore malformed body */ }
        } else {
            new URLSearchParams(body).forEach((v, k) => { out[k] = v; });
        }
    }
    return out;
}

// ---------------------------------------------------------------- events

export interface TestCallEvent {
    ts: string;
    type: string;
    [k: string]: unknown;
}

const TOKEN_SHAPE = /[A-Za-z0-9_-]+\.\d{9,11}\.[A-Za-z0-9_-]{20,}/g;

export interface EventLog {
    events: TestCallEvent[];
    log: (type: string, fields?: Record<string, unknown>) => void;
}

/**
 * Event log. Every line is scrubbed of the known secrets (and of anything
 * shaped like a signed token) before it reaches the sink.
 */
export function createEventLog(
    now: () => Date, secrets: string[], sink?: (line: string) => void,
): EventLog {
    const events: TestCallEvent[] = [];
    const needles = secrets.filter((s) => s && s.length >= 4);
    return {
        events,
        log(type, fields = {}) {
            let line = JSON.stringify({ ts: now().toISOString(), type, ...fields });
            for (const s of needles) line = line.split(s).join('[redacted]');
            line = line.replace(TOKEN_SHAPE, '[token]');
            events.push(JSON.parse(line) as TestCallEvent);
            sink?.(line);
        },
    };
}

export function fileSink(path: string): (line: string) => void {
    return (line) => fs.appendFileSync(path, `${line}\n`);
}

// ---------------------------------------------------------------- run state / server

export interface RunState {
    callUuid: string;
    answered: boolean;
    answerAtMs: number | null;
    firstAudioAtMs: number | null;
    digits: string[];
    digit: string | null;
    invalidGathers: number;
    audioFetched: Set<string>;
    rawNames: { answer: Set<string>; gather: Set<string>; status: Set<string>; ring: Set<string> };
    hangupCause: string | null;
    hangupDurationSec: number | null;
    hangupSeen: boolean;
    dialCategory: string | null;
    dialled: boolean;
}

export function newRunState(): RunState {
    return {
        callUuid: '', answered: false, answerAtMs: null, firstAudioAtMs: null, digits: [], digit: null,
        invalidGathers: 0, audioFetched: new Set(), rawNames: { answer: new Set(), gather: new Set(), status: new Set(), ring: new Set() },
        hangupCause: null, hangupDurationSec: null, hangupSeen: false, dialCategory: null, dialled: false,
    };
}

export interface ServerDeps {
    key: string;
    runId: string;
    baseUrl: () => string;
    clips: ClipSet;
    now: () => Date;
    events: EventLog;
    state: RunState;
    onHangup: () => void;
}

const MAX_BODY = 64 * 1024;

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (c: Buffer) => { size += c.length; if (size <= MAX_BODY) chunks.push(c); });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', () => resolve(''));
    });
}

/** Build the request handler. Exported so tests can mount it on a port-0 server. */
export function createHandler(d: ServerDeps): http.RequestListener {
    const sendXml = (res: http.ServerResponse, status: number, xml: string) => {
        const body = Buffer.from(xml, 'utf8');
        res.writeHead(status, { 'Content-Type': 'text/xml; charset=utf-8', 'Content-Length': body.length });
        res.end(body);
    };
    const deny = (res: http.ServerResponse, route: string) => {
        d.events.log('auth_failed', { route });
        sendXml(res, 403, EMPTY_RESPONSE_XML);
    };
    const xmlOpts = (): XmlOptions => ({
        baseUrl: d.baseUrl(),
        tokens: {
            gather: mintToken(d.key, TESTCALL_DOMAINS.gather, d.runId, d.now().getTime()),
            audio: mintToken(d.key, TESTCALL_DOMAINS.audio, d.runId, d.now().getTime()),
        },
        clips: new Set(d.clips.keys()),
    });
    const noteCallId = (p: Record<string, string>) => {
        const id = parseCallId(p);
        if (id && !d.state.callUuid) d.state.callUuid = id;
    };

    return async (req, res) => {
        const method = req.method ?? 'GET';
        const url = new URL(req.url ?? '/', 'http://local');
        const nowMs = d.now().getTime();
        const isAudio = url.pathname.startsWith('/audio/');
        const route = isAudio ? 'audio' : url.pathname.replace(/^\//, '');

        if (!['answer', 'gather', 'status', 'audio'].includes(route)) return sendXml(res, 404, EMPTY_RESPONSE_XML);
        if (!['GET', 'POST', ...(isAudio ? ['HEAD'] : [])].includes(method)) return sendXml(res, 405, EMPTY_RESPONSE_XML);

        const params = parseParams(url, method === 'POST' ? await readBody(req) : '', req.headers['content-type']);
        const token = params.t;
        const names = Object.keys(params).filter((k) => k !== 't').sort();

        if (route === 'answer') {
            if (verifyToken(d.key, TESTCALL_DOMAINS.answer, token, nowMs) !== d.runId) return deny(res, route);
            names.forEach((n) => d.state.rawNames.answer.add(n));
            noteCallId(params);
            const verdict = checkCallingWindow(d.now());
            if (!verdict.allowed) {
                d.events.log('answer_webhook', { rawFieldNames: names, blocked: 'outside_calling_window', istTime: verdict.istTime });
                return sendXml(res, 200, EMPTY_RESPONSE_XML);
            }
            d.state.answered = true;
            d.state.answerAtMs = nowMs;
            d.events.log('answer_webhook', { rawFieldNames: names, blocked: null });
            return sendXml(res, 200, buildAnswerXml(xmlOpts()));
        }

        if (route === 'gather') {
            if (verifyToken(d.key, TESTCALL_DOMAINS.gather, token, nowMs) !== d.runId) return deny(res, route);
            names.forEach((n) => d.state.rawNames.gather.add(n));
            noteCallId(params);
            const digit = parseGatherDigits(params);
            d.events.log('gather_webhook', { digit, rawFieldNames: names });
            if (digit) d.state.digits.push(digit);
            const valid = digit !== null && digit in DIGIT_CLIP;
            if (valid && d.state.digit === null) d.state.digit = digit;
            const xml = buildGatherResultXml(xmlOpts(), digit, d.state.invalidGathers);
            if (!valid) d.state.invalidGathers += 1;
            return sendXml(res, 200, xml);
        }

        if (route === 'status') {
            if (verifyToken(d.key, TESTCALL_DOMAINS.status, token, nowMs) !== d.runId) return deny(res, route);
            const kind = params.kind === 'hangup' ? 'hangup' : 'ring';
            names.forEach((n) => d.state.rawNames[kind === 'hangup' ? 'status' : 'ring'].add(n));
            noteCallId(params);
            const cause = parseCause(params);
            const duration = parseDuration(params);
            d.events.log('status_webhook', { kind, cause, duration, rawFieldNames: names });
            sendXml(res, 200, EMPTY_RESPONSE_XML);
            if (kind === 'hangup') {
                d.state.hangupSeen = true;
                d.state.hangupCause = cause;
                d.state.hangupDurationSec = duration;
                d.onHangup();
            }
            return;
        }

        // audio
        if (verifyToken(d.key, TESTCALL_DOMAINS.audio, token, nowMs) !== d.runId) return deny(res, route);
        const name = decodeURIComponent(url.pathname.slice('/audio/'.length)).replace(/\.wav$/, '');
        const clip = d.clips.get(name); // Map lookup: no path traversal possible
        if (!clip) return sendXml(res, 404, EMPTY_RESPONSE_XML);
        d.state.audioFetched.add(name);
        if (d.state.firstAudioAtMs === null) d.state.firstAudioAtMs = nowMs;
        d.events.log('audio_served', { name, bytes: clip.length });
        res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': clip.length });
        res.end(method === 'HEAD' ? undefined : clip);
    };
}

// ---------------------------------------------------------------- runner

export interface RunOptions {
    iOwnThisNumber: boolean;
    env: NodeJS.ProcessEnv;
    clips: ClipSet;
    /** Free-text description of the audio source for the summary, e.g. "openers:Hindi mulaw". */
    audioLabel: string;
    port?: number;
    eventsPath?: string;
    sink?: (line: string) => void;
    maxDurationMs?: number;
    fetchImpl?: typeof fetch;
    now?: () => Date;
    /** Test hook: override the key (default is always a fresh random one). */
    key?: string;
}

export interface RunHandle {
    /** Resolves with the summary when the run is over. */
    done: Promise<RunResult>;
    /** Resolves with the bound local port once the server is listening (-1 if refused before listening). */
    ready: Promise<number>;
    /** Ctrl-C / SIGTERM path: hang up if a call is live, then shut down. */
    abort: (reason: string) => void;
}

export interface RunResult {
    outcome: 'refused' | 'dial_failed' | 'completed' | 'timeout' | 'aborted';
    guards: GuardResult[];
    state: RunState;
    events: TestCallEvent[];
    summary: string;
}

/**
 * Run exactly one test call. Never retries: `dialled` latches before the
 * provider is contacted and a second invocation of the dial step throws.
 */
export function runTestCall(opts: RunOptions): RunHandle {
    const now = opts.now ?? (() => new Date());
    const key = opts.key ?? newRunKey();
    const runId = crypto.randomBytes(8).toString('hex');
    const config = readVobizConfig(opts.env);
    const secrets = [key, config?.authToken ?? '', config?.authId ?? '', opts.env.TEST_PHONE_E164 ?? ''];
    const sink = opts.sink ?? (opts.eventsPath ? fileSink(opts.eventsPath) : undefined);
    const events = createEventLog(now, secrets, sink);
    const state = newRunState();
    const guardKey = guardSigningKey(key);

    let finish: (r: RunResult) => void = () => {};
    const done = new Promise<RunResult>((r) => { finish = r; });
    let listening: (p: number) => void = () => {};
    const ready = new Promise<number>((r) => { listening = r; });

    const g = evaluateGuards({ flag: opts.iOwnThisNumber, env: opts.env, now: now() });
    const results = [...g.results, guardKey];
    if (!results.every((r) => r.ok) || !config) {
        const failed = results.filter((r) => !r.ok);
        events.log('shutdown', { reason: 'guards_refused', failed: failed.map((f) => f.guard) });
        finish({ outcome: 'refused', guards: results, state, events: events.events, summary: summarize(state, events.events, 'refused', opts.audioLabel, failed) });
        listening(-1);
        return { done, ready, abort: () => {} };
    }

    const fetchImpl = opts.fetchImpl ?? fetch;
    const phone = opts.env.TEST_PHONE_E164!.trim(); // the ONLY destination
    const base = opts.env.PUBLIC_BASE_URL!.trim().replace(/\/+$/, '');
    const maxMs = opts.maxDurationMs ?? 180_000;

    let server: http.Server | null = null;
    let ended = false;
    let timer: NodeJS.Timeout | null = null;
    let outcome: RunResult['outcome'] = 'completed';

    const shutdown = async (why: RunResult['outcome'], reason: string, failed: GuardResult[] = []) => {
        if (ended) return;
        ended = true;
        outcome = why;
        if (timer) clearTimeout(timer);
        if ((why === 'timeout' || why === 'aborted') && state.callUuid && !state.hangupSeen) {
            events.log('hangup_requested', { reason });
            const ok = await hangupVobizCall(config as VobizConfig, state.callUuid, fetchImpl);
            events.log('hangup_result', { ok });
        }
        events.log('shutdown', { reason, outcome: why });
        if (server) {
            const s = server;
            server = null;
            await new Promise<void>((r) => { s.close(() => r()); s.closeAllConnections?.(); });
        }
        finish({ outcome: why, guards: results, state, events: events.events, summary: summarize(state, events.events, why, opts.audioLabel, failed) });
    };

    const deps: ServerDeps = {
        key, runId, baseUrl: () => base, clips: opts.clips, now, events, state,
        // Let the hangup response flush before closing.
        onHangup: () => { setTimeout(() => void shutdown('completed', 'call_ended'), 50); },
    };
    server = http.createServer(createHandler(deps));

    server.on('error', (e) => { listening(-1); void shutdown('dial_failed', `listen_error:${(e as NodeJS.ErrnoException).code ?? 'unknown'}`); });
    server.listen(opts.port ?? 8787, '127.0.0.1', () => {
        listening((server?.address() as AddressInfo).port);
        void (async () => {
            // Dial-time window re-check, immediately before the one provider call.
            const w = guardWindow(now());
            if (!w.ok) return shutdown('refused', 'outside_calling_window', [w]);

            if (state.dialled) return; // one call per run, ever
            state.dialled = true;
            const t = (d: TestCallDomain) => encodeURIComponent(mintToken(key, d, runId, now().getTime()));
            events.log('dial_requested', { toLast4: phoneLast4(phone) });
            const result = await placeVobizCall(config, {
                to: phone,
                answerUrl: `${base}/answer?t=${t(TESTCALL_DOMAINS.answer)}`,
                hangupUrl: `${base}/status?t=${t(TESTCALL_DOMAINS.status)}&kind=hangup`,
                ringUrl: `${base}/status?t=${t(TESTCALL_DOMAINS.status)}&kind=ring`,
                ringTimeout: 30,
            }, fetchImpl);
            if (!result.ok) {
                state.dialCategory = result.failure.category;
                events.log('dial_result', { ok: false, category: result.failure.category, status: result.failure.status ?? null });
                return shutdown('dial_failed', 'dial_failed');
            }
            if (!state.callUuid) state.callUuid = result.handle.requestUuid;
            events.log('dial_result', { ok: true, hasRequestUuid: result.handle.requestUuid !== '' });
            timer = setTimeout(() => void shutdown('timeout', 'max_duration'), maxMs);
        })();
    });
    return { done, ready, abort: (reason) => void shutdown('aborted', reason) };
}

// ---------------------------------------------------------------- summary

export function summarize(
    state: RunState, events: TestCallEvent[], outcome: string, audioLabel: string, failed: GuardResult[] = [],
): string {
    const ms = state.answerAtMs !== null && state.firstAudioAtMs !== null ? state.firstAudioAtMs - state.answerAtMs : null;
    const names = (s: Set<string>) => [...s].sort();
    const paste = {
        outcome,
        answered: state.answered,
        digitPressed: state.digit,
        allDigitsSeen: state.digits,
        hangupCause: state.hangupCause,
        hangupDurationSec: state.hangupDurationSec,
        answerToFirstAudioFetchMs: ms,
        audioFetched: names(state.audioFetched),
        dialFailureCategory: state.dialCategory,
        audio: audioLabel,
        rawParamNames: {
            answer: names(state.rawNames.answer), gather: names(state.rawNames.gather),
            status: names(state.rawNames.status), ring: names(state.rawNames.ring),
        },
        eventCount: events.length,
    };
    const lines = [
        '=== Vobiz test call summary ===',
        `outcome:            ${outcome}`,
        ...(failed.length ? [`refused by:         ${failed.map((f) => `${f.guard} (${f.reason})`).join('; ')}`] : []),
        `answered:           ${state.answered ? 'yes' : 'no'}`,
        `digit pressed:      ${state.digit ?? (state.digits.length ? `invalid (${state.digits.join(',')})` : 'none')}`,
        `hangup cause:       ${state.hangupCause ?? 'n/a'}   duration: ${state.hangupDurationSec ?? 'n/a'} s`,
        `audio fetched:      ${state.audioFetched.size ? names(state.audioFetched).join(', ') : 'no'}` + (ms !== null ? ` (first fetch ${ms} ms after answer)` : ''),
        `raw param names:    answer=[${paste.rawParamNames.answer}] gather=[${paste.rawParamNames.gather}] status=[${paste.rawParamNames.status}] ring=[${paste.rawParamNames.ring}]`,
        '',
        '----- PASTE THIS BACK -----',
        JSON.stringify(paste, null, 2),
        '----- END -----',
    ];
    return lines.join('\n');
}
