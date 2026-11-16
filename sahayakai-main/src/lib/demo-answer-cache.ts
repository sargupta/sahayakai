/**
 * LOCAL DEMO ONLY — instant answers for requests that were already generated once.
 *
 * In a live demo the on-screen templates (Lesson Plan quick starts, Instant Answer examples, …)
 * are clicked again and again; each one waited 15–60 s for the model although the answer to
 * that exact request already existed. With SAHAYAK_DEMO_ANSWER_CACHE=true (set only by the
 * local demo launcher, which also pre-generates every on-screen template in the background), a
 * generator request whose feature + body exactly match an earlier successful one is answered
 * from this cache at once.
 *
 * Never in production: it needs NODE_ENV === 'development' AND the explicit flag. Answers are
 * kept in a local file (SAHAYAK_DEMO_ANSWER_CACHE_FILE, outside the repository) so the warm-up
 * survives restarts. Library identity fields are dropped from a served answer, so a cached
 * answer never claims another user's saved item; the teacher saves it with Save as usual.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const STRIP = ['id', 'contentId', 'savedContentId', 'isSaved', 'libraryId'] as const;
const MAX_ENTRIES = 500;

export function demoAnswerCacheEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.NODE_ENV === 'development' && env.SAHAYAK_DEMO_ANSWER_CACHE === 'true';
}

/**
 * Per-request identifiers the client mints fresh on every click (e.g. the lesson plan's
 * `contentId`): they say nothing about WHAT is asked, so they never take part in the match.
 */
export const VOLATILE_KEYS = new Set(['contentId', 'requestId', 'idempotencyKey', 'clientRequestId', 'sessionId', 'timestamp', 'nonce']);

/** Same JSON regardless of key order, whitespace or per-request ids. */
export function canonicalBody(text: string): string {
    try {
        const sort = (v: unknown): unknown =>
            Array.isArray(v)
                ? v.map(sort)
                : v && typeof v === 'object'
                  ? Object.fromEntries(Object.keys(v as object).filter((k) => !VOLATILE_KEYS.has(k)).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]))
                  : typeof v === 'string'
                    ? v.trim()
                    : v;
        return JSON.stringify(sort(JSON.parse(text)));
    } catch {
        return text.trim();
    }
}

export function demoAnswerKey(feature: string, bodyText: string): string {
    return createHash('sha256').update(`${feature}\n${canonicalBody(bodyText)}`).digest('hex');
}

/** A served answer never carries library identity (it belongs to whoever generated it first). */
export function sanitizeDemoAnswer<T>(answer: T): T {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return answer;
    const out = { ...(answer as Record<string, unknown>) };
    for (const k of STRIP) delete out[k];
    return out as T;
}

let store: Map<string, unknown> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | undefined;

function file(): string | null {
    return process.env.SAHAYAK_DEMO_ANSWER_CACHE_FILE?.trim() || null;
}

function load(): Map<string, unknown> {
    if (store) return store;
    store = new Map();
    const f = file();
    if (f && existsSync(f)) {
        try {
            const data = JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>;
            for (const [k, v] of Object.entries(data)) store.set(k, v);
        } catch {
            /* a damaged cache file only means a cold start */
        }
    }
    return store;
}

function persist() {
    const f = file();
    if (!f) return;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
        try {
            mkdirSync(dirname(f), { recursive: true });
            writeFileSync(f, JSON.stringify(Object.fromEntries(load())));
        } catch {
            /* best effort */
        }
    }, 500);
}

export function getDemoAnswer(feature: string, bodyText: string): unknown | undefined {
    const v = load().get(demoAnswerKey(feature, bodyText));
    return v === undefined ? undefined : sanitizeDemoAnswer(v);
}

export function putDemoAnswer(feature: string, bodyText: string, answer: unknown): void {
    if (!answer || typeof answer !== 'object') return;
    const s = load();
    s.set(demoAnswerKey(feature, bodyText), sanitizeDemoAnswer(answer));
    while (s.size > MAX_ENTRIES) s.delete(s.keys().next().value as string);
    persist();
}

/** Tests only. */
export function _resetDemoAnswerCacheForTest() {
    store = null;
}
