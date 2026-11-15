/**
 * The rolling-scheduler rules for class-wide batch calling: how many calls may ring at once, when
 * the next launch may go out, and which call records count as "active" or as "an accepted launch".
 *
 * Everything here is pure, so each rule is unit-tested with a fake clock and fixed call records.
 * The SOURCE OF TRUTH for both is the CALL RECORD, never a counter the scheduler keeps: a call is
 * active while its record is non-terminal (webhooks move it to terminal), and a launch counts
 * against the interval only once the provider accepted it. Both survive a scheduler restart,
 * because both are recomputed from the records on every pass.
 */

import { isRealProvider, isTerminalConversationState, type ConversationCall } from '@/lib/sampark/conversation/types';

import type { BatchCapacitySource } from './types';

type Env = Record<string, string | undefined>;

/**
 * The approved safety ceiling for simultaneous Riya calls for one school. No configuration — and
 * nothing a browser can send — raises the scheduler above this.
 */
export const BATCH_CONCURRENCY_HARD_MAX = 3;
/** Calls in flight at once when nothing is configured. */
export const BATCH_DEFAULT_CONCURRENCY = 3;
/** Minimum seconds between two launches the provider accepted, when nothing is configured. */
export const BATCH_DEFAULT_MIN_INTERVAL_SECONDS = 60;
/** Backoff after a provider rate-limit refusal: 60 s, doubling, capped. */
export const BATCH_BACKOFF_BASE_MS = 60_000;
export const BATCH_BACKOFF_MAX_MS = 15 * 60_000;

export interface BatchCapacity {
    /** What the scheduler uses: the smallest of the limits below. */
    effective: number;
    /** min(SAMPARK_BATCH_MAX_CONCURRENCY, BATCH_CONCURRENCY_HARD_MAX). */
    app: number;
    /** The telephony account / trunk limit, when an operator has verified and configured one. */
    provider: number | null;
    /** The conversation backend's session limit (Gemini Live + ASR + TTS), when configured. */
    ai: number | null;
    /** Which of the three produced `effective`. */
    source: BatchCapacitySource;
}

function positiveInt(raw: string | undefined, max: number): number | null {
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

/**
 * Effective concurrency = min(approved app limit, verified provider/account limit, AI backend
 * capacity). An unset provider or AI limit means "not verified here": it does not raise the app
 * limit, it simply does not lower it.
 */
export function batchCapacity(env: Env, provider: ConversationCall['provider']): BatchCapacity {
    const app = positiveInt(env.SAMPARK_BATCH_MAX_CONCURRENCY, BATCH_CONCURRENCY_HARD_MAX) ?? BATCH_DEFAULT_CONCURRENCY;
    // Practice rings nothing and starts no conversation session: only the app limit applies.
    const real = isRealProvider(provider);
    const providerLimit = real ? positiveInt(env.SAMPARK_VOBIZ_MAX_CONCURRENT_CALLS, 1000) : null;
    const ai = real ? positiveInt(env.SAMPARK_RIYA_MAX_CONCURRENT_SESSIONS, 1000) : null;
    let effective = app;
    let source: BatchCapacitySource = 'app';
    if (providerLimit !== null && providerLimit < effective) {
        effective = providerLimit;
        source = 'provider';
    }
    if (ai !== null && ai < effective) {
        effective = ai;
        source = 'ai';
    }
    return { effective, app, provider: providerLimit, ai, source };
}

/** Minimum gap between two accepted launches (ms). Practice needs none: nothing rings. */
export function batchMinIntervalMs(env: Env, provider: ConversationCall['provider']): number {
    if (!isRealProvider(provider)) return 0;
    const n = Number(env.SAMPARK_BATCH_DIAL_GAP_SECONDS);
    const seconds = Number.isFinite(n) && n >= 0 && n <= 3600 ? n : BATCH_DEFAULT_MIN_INTERVAL_SECONDS;
    return seconds * 1000;
}

type CallFacts = Pick<ConversationCall, 'provider' | 'state' | 'createdAt' | 'providerConversationId' | 'failureReason' | 'batch'> & { providerStatus?: string | null };

/**
 * A launch the provider refused outright never rang and never used provider capacity, so it does
 * not start the interval either (the next family may go out at once). Everything else — accepted,
 * or an unknown outcome where the phone may be ringing — counts.
 */
export function isAcceptedLaunch(c: Pick<CallFacts, 'state' | 'providerConversationId' | 'failureReason'>): boolean {
    return !(c.state === 'failed' && !c.providerConversationId && (c.failureReason ?? '').startsWith('rejected:'));
}

/** True while this call may still be occupying a line at the provider. */
export function isActiveCall(c: Pick<CallFacts, 'state'>): boolean {
    return !isTerminalConversationState(c.state);
}

/**
 * When the last launch this school's batches made and the provider accepted went out — across
 * EVERY campaign, so two campaigns cannot each dial once a minute. Null when there is none.
 * Practice calls are ignored: they ring nothing.
 */
export function lastAcceptedLaunchAt(calls: readonly CallFacts[]): string | null {
    let best: string | null = null;
    for (const c of calls) {
        if (!c.batch || !isRealProvider(c.provider)) continue;
        if (!isAcceptedLaunch(c)) continue;
        if (!best || c.createdAt > best) best = c.createdAt;
    }
    return best;
}

/**
 * Whether a call still holds one of the school's lines. A call holds its line until the PROVIDER
 * says it ended — never because a local timer ran out:
 *   - a final state (completed / no answer / busy / failed / unknown) → released;
 *   - Vobiz reported the line itself ended (hangup callback or lookup: providerStatus
 *     'carrier_ended') while the bridge's result is still on its way → released: nothing is
 *     connected any more;
 *   - anything else holds the line, however old. Reconciliation (provider lookup, then the
 *     documented recovery past the provider-enforced time limit) is what moves an overdue call on.
 *   - one exception the other way: a dial whose outcome we could not read (network error / 5xx /
 *     lost mid-request) is recorded 'unknown' but may really be ringing, so it HOLDS its line
 *     until the provider must have ended it (`hardEndMs` after it was placed: ring timeout + Vobiz
 *     time_limit + margin). That bound is enforced by the provider, not assumed by us.
 */
export function holdsLine(c: Pick<CallFacts, 'state' | 'providerStatus' | 'failureReason' | 'createdAt'>, nowMs: number, hardEndMs: number): boolean {
    if (isActiveCall(c)) return c.providerStatus !== 'carrier_ended';
    if (c.state === 'unknown' && isUnreadDial(c.failureReason)) return nowMs - Date.parse(c.createdAt) <= hardEndMs;
    return false;
}

/** A dial whose acceptance we never read: the phone may be ringing. */
export function isUnreadDial(failureReason: string | null | undefined): boolean {
    const r = failureReason ?? '';
    return r.startsWith('unknown:') || r === 'lost_while_initiating';
}

/**
 * Riya calls in flight for this school right now — batch AND individual, because they share the
 * same per-school lock slots and the same provider lines. The call records are the only source:
 * nothing is counted in memory, so a restart or a second worker sees the same number.
 */
export function countActiveCalls(calls: readonly CallFacts[], now: Date, hardEndMs: number): number {
    let n = 0;
    for (const c of calls) if (isRealProvider(c.provider) && holdsLine(c, now.getTime(), hardEndMs)) n += 1;
    return n;
}

/** Seconds the provider asked us to wait, when a refusal carried a Retry-After. */
export function retryAfterSeconds(failureReason: string | null | undefined): number | null {
    const m = /retry_after=(\d{1,6})/.exec(failureReason ?? '');
    return m ? Number(m[1]) : null;
}

/**
 * The school-wide rate-limit backoff, recomputed from the call records (so every campaign and every
 * worker obeys the same one, and it survives a restart): the refusals that came after the last
 * launch the provider accepted, counted from the newest; the wait is 60 s doubling per refusal
 * (capped), or the provider's Retry-After if longer, measured from the newest refusal.
 * Null when the last real launch was accepted (or there is none).
 */
export function rateLimitBackoffUntil(calls: readonly CallFacts[]): { until: string; refusals: number } | null {
    const launches = calls.filter((c) => c.batch && isRealProvider(c.provider)).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    let refusals = 0;
    let newest: CallFacts | null = null;
    for (const c of launches) {
        if (isRateLimitRefusal(c.failureReason) && !c.providerConversationId) {
            refusals += 1;
            newest = newest ?? c;
            continue;
        }
        if (isAcceptedLaunch(c)) break; // an accepted launch ends the run of refusals
        // Any other refusal (invalid number …) neither starts nor ends a rate-limit run.
    }
    if (!newest) return null;
    const wait = Math.max(backoffMs(refusals), (retryAfterSeconds(newest.failureReason) ?? 0) * 1000);
    return { until: new Date(Date.parse(newest.createdAt) + wait).toISOString(), refusals };
}

/** The earliest the next launch may go out, or null when it may go out now. */
export function nextLaunchAt(lastAccepted: string | null, minIntervalMs: number, now: Date): string | null {
    if (minIntervalMs <= 0 || !lastAccepted) return null;
    const due = Date.parse(lastAccepted) + minIntervalMs;
    return due > now.getTime() ? new Date(due).toISOString() : null;
}

/** Backoff after `failures` consecutive rate-limit refusals: 60 s, 120 s, 240 s … capped. */
export function backoffMs(failures: number): number {
    const n = Math.max(1, Math.floor(failures));
    return Math.min(BATCH_BACKOFF_BASE_MS * 2 ** (n - 1), BATCH_BACKOFF_MAX_MS);
}

/** Whether a provider refusal means "too fast / too many", so the batch must wait before re-submitting. */
export function isRateLimitRefusal(failureReason: string | null | undefined): boolean {
    return (failureReason ?? '').startsWith('rejected:rate_limited');
}
