import 'server-only';
import { NextResponse } from 'next/server';
import { logger } from './logger';

/**
 * The app-side half of the billing kill-switch.
 *
 * `infra/billing-killswitch/` has been deployed since 2026-08. On a budget
 * breach it sets Firestore `system_config/ai_killswitch.enabled = false`. Its own
 * header says what was missing:
 *
 *   "Every /api/ai/* route + /api/assistant must read system_config/ai_killswitch
 *    at the top and, when enabled === false, return the graceful 503 fallback
 *    instead of calling Gemini. Until that read exists, this function arms the
 *    trip but the app won't honour it."
 *
 * That read never landed, so for two months the kill-switch was a function that
 * wrote a flag nothing read. Production bills to a cash card at roughly ₹2,250 a
 * day and relinking to credits is a confirmed dead end, which makes this the only
 * spend control that exists at all. The empirical scale: one extra fire-and-forget
 * model call per request cost about $3,800 a month at 1k calls/day during the
 * shadow-diff incident.
 *
 * Three properties, in order of how much they matter:
 *
 * FAIL-SAFE TO ON. A missing document, an unreadable field, a Firestore outage,
 * or a thrown error all mean AI stays enabled. A cost guard that takes the
 * product down when its own datastore blips is a worse outage than the bill it
 * prevents, and the infra function only ever writes `false`, so absence of the
 * flag genuinely means "never tripped".
 *
 * TRIP-ONLY FROM THE APP'S SIDE. Nothing here re-enables anything. A human flips
 * the flag back after understanding the spend.
 *
 * CHEAP. The check is cached for 30 seconds, matching the subscription
 * feature-flag cache in plan-guard.ts. A Firestore read on every AI request would
 * add its own latency and its own cost to the thing it is trying to bound.
 */

let _cache: { enabled: boolean; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

/** Test seam. Not exported from the module's public surface by accident: the
 *  30s cache would otherwise make every test after the first one meaningless. */
export function __resetAiKillSwitchCacheForTests(): void {
    _cache = null;
}

/**
 * True when AI generation is permitted. Fail-safe: returns true on any error.
 */
export async function isAiEnabled(): Promise<boolean> {
    if (_cache && Date.now() < _cache.expiresAt) return _cache.enabled;

    // Env override, authoritative and checked first. Mirrors
    // SUBSCRIPTION_GATING_ENABLED in plan-guard.ts, and gives an operator a way
    // to stop spend in seconds without waiting on a Firestore write to
    // propagate — or to keep a local/dev environment working if the shared
    // system_config document is tripped.
    const override = process.env.AI_KILLSWITCH_ENABLED;
    if (override === 'false') {
        _cache = { enabled: false, expiresAt: Date.now() + CACHE_TTL_MS };
        return false;
    }
    if (override === 'true') {
        _cache = { enabled: true, expiresAt: Date.now() + CACHE_TTL_MS };
        return true;
    }

    try {
        const { getDb } = await import('./firebase-admin');
        const db = await getDb();
        const doc = await db.collection('system_config').doc('ai_killswitch').get();
        // Only an explicit `false` disables. Missing doc, missing field, or any
        // other value means enabled — see FAIL-SAFE TO ON above.
        const enabled = doc.exists ? doc.data()?.enabled !== false : true;
        _cache = { enabled, expiresAt: Date.now() + CACHE_TTL_MS };
        if (!enabled) {
            logger.warn(
                'AI kill-switch is TRIPPED — refusing AI generation',
                'AI_KILLSWITCH',
                {
                    trippedBy: doc.data()?.trippedBy ?? 'unknown',
                    reason: doc.data()?.reason ?? 'no reason recorded',
                },
            );
        }
        return enabled;
    } catch (err) {
        // Deliberately does NOT cache the failure: a transient Firestore error
        // should be retried on the next request, not pinned for 30 seconds.
        logger.warn(
            'AI kill-switch read failed — failing safe and allowing AI',
            'AI_KILLSWITCH',
            { error: err instanceof Error ? err.message : String(err) },
        );
        return true;
    }
}

/** The 503 body returned while the switch is tripped. */
export const AI_KILLSWITCH_RESPONSE_BODY = {
    error: 'AI_TEMPORARILY_UNAVAILABLE',
    message:
        'AI features are paused right now. Your saved work is safe and nothing has been lost. Please try again later.',
} as const;

/**
 * Returns a 503 NextResponse when the switch is tripped, otherwise null.
 * Call at the top of a route, before any model call and before reserving quota:
 * a teacher must not spend a monthly generation on a request that cannot run.
 */
export async function aiKillSwitchGate(): Promise<NextResponse | null> {
    if (await isAiEnabled()) return null;
    const response = NextResponse.json(AI_KILLSWITCH_RESPONSE_BODY, { status: 503 });
    // Set on the constructed Headers rather than passing `headers` in the init
    // object. NextResponse.json silently discards init.headers under the test
    // runtime, so the idiomatic one-liner produces a 503 with no Retry-After and
    // a test that asserts the header cannot tell the difference. Mutating the
    // real Headers works in both runtimes.
    response.headers.set('Retry-After', '3600');
    return response;
}

/**
 * Wrapper for routes that do not go through `withPlanCheck` / `reservePlanQuota`
 * and therefore have no other choke point.
 */
export function withAiKillSwitch<T extends Request>(
    handler: (request: T) => Promise<Response>,
): (request: T) => Promise<Response> {
    return async function (request: T): Promise<Response> {
        const blocked = await aiKillSwitchGate();
        if (blocked) return blocked;
        return handler(request);
    };
}
