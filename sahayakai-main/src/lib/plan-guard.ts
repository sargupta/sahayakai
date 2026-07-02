import 'server-only';
import { NextResponse } from 'next/server';
import type { GatedFeature } from './plan-config';
import { PLAN_CONFIG, getMinimumPlan, PLAN_DISPLAY_NAMES } from './plan-config';
import { normalizePlan } from './plan-utils';
import { reserveQuota, rollbackQuota } from './usage-counters';

/**
 * Higher-order function that wraps an API route handler with plan-based gating.
 *
 * WARNING: Do NOT read request.json() in this function — the body stream can only
 * be consumed once. The wrapped handler needs the body. If you need body data here,
 * clone the request first: `const cloned = request.clone()`.
 *
 * Checks:
 * 1. Feature flag (subscription_enabled) — if disabled, pass through (no gating)
 * 2. User has a plan that allows the feature (limit > 0)
 * 3. User has not exceeded monthly limit
 * 4. For instant-answer: daily limit check
 *
 * On success: calls the handler, then increments usage counter (fire-and-forget).
 * On failure: returns 403 (feature unavailable) or 429 (limit reached).
 */
/**
 * Result of a plan-quota reservation. On success, `rollback` returns the
 * reserved quota (idempotent) — call it if the downstream work fails.
 */
export type PlanQuotaResult =
    | { ok: true; rollback: () => Promise<void> }
    | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Shared plan-gate: feature-flag check → plan/limit check → atomic
 * check-and-reserve. Used by both `withPlanCheck` (NextResponse routes) and
 * SSE/streaming routes that cannot use the HOF because they return a native
 * `Response`. This keeps a SINGLE enforcement implementation — the streaming
 * lesson-plan/exam-paper endpoints previously exported the bare handler and
 * bypassed gating entirely.
 */
export async function reservePlanQuota(request: Request, feature: GatedFeature): Promise<PlanQuotaResult> {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
        return { ok: false, status: 401, body: { error: 'Unauthorized' } };
    }

    // Feature flag — if subscription gating is disabled, pass through.
    const gatingEnabled = await isSubscriptionEnabled();
    if (!gatingEnabled) {
        return { ok: true, rollback: async () => { /* no reservation made */ } };
    }

    const rawPlan = request.headers.get('x-user-plan') || 'free';
    const plan = normalizePlan(rawPlan);
    const config = PLAN_CONFIG[plan];
    const limit = config.limits[feature];

    if (limit === 0) {
        const minPlan = getMinimumPlan(feature);
        return {
            ok: false,
            status: 403,
            body: {
                error: 'PLAN_UPGRADE_REQUIRED',
                message: `This feature requires ${PLAN_DISPLAY_NAMES[minPlan]} plan or higher.`,
                requiredPlan: minPlan,
                currentPlan: plan,
                feature,
            },
        };
    }

    // Atomically check-and-reserve quota BEFORE the handler runs.
    const dailyLimitMap: Partial<Record<GatedFeature, number>> = {
        'instant-answer': config.instantAnswerDailyLimit,
        'assistant': config.assistantDailyLimit,
    };
    const dailyCap = dailyLimitMap[feature];

    const reservation = await reserveQuota(userId, feature, limit, dailyCap);
    if (!reservation.ok) {
        const isDaily = reservation.reason === 'daily';
        return {
            ok: false,
            status: 429,
            body: {
                error: isDaily ? 'DAILY_LIMIT_REACHED' : 'USAGE_LIMIT_REACHED',
                message: isDaily
                    ? `You've used all ${reservation.limit} ${feature.replace(/-/g, ' ')} interactions for today. Try again tomorrow.`
                    : `You've used all ${reservation.limit} ${feature.replace('-', ' ')} generations this month. Resets next month.`,
                used: reservation.used,
                limit: reservation.limit,
                feature,
                currentPlan: plan,
            },
        };
    }

    let rolledBack = false;
    return {
        ok: true,
        rollback: async () => {
            if (rolledBack) return;
            rolledBack = true;
            await rollbackQuota(userId, feature);
        },
    };
}

export function withPlanCheck(feature: GatedFeature) {
    return function <T extends Request>(handler: (request: T) => Promise<NextResponse>) {
        return async function (request: T): Promise<NextResponse> {
            const gate = await reservePlanQuota(request, feature);
            if (!gate.ok) {
                return NextResponse.json(gate.body, { status: gate.status });
            }

            // Execute the actual handler. Roll back the reservation on any failure
            // (thrown error or non-2xx response) so users aren't charged for
            // failed calls that never delivered value.
            try {
                const response = await handler(request);
                if (!response.ok) {
                    await gate.rollback();
                }
                return response;
            } catch (err: any) {
                await gate.rollback();

                // Surface AI quota exhaustion as a user-friendly 503 with
                // Retry-After so the client shows "try again in a minute"
                // instead of a generic error toast.
                if (err?.name === 'AIQuotaExhaustedError') {
                    const retryAfter = typeof err.retryAfterSeconds === 'number' ? err.retryAfterSeconds : 60;
                    return NextResponse.json(
                        {
                            error: 'AI_SERVICE_BUSY',
                            message: err.message || 'AI service is temporarily overloaded. Please try again in a minute.',
                            retryAfterSeconds: retryAfter,
                            feature,
                        },
                        {
                            status: 503,
                            headers: { 'Retry-After': String(retryAfter) },
                        }
                    );
                }

                throw err;
            }
        };
    };
}

// --- Feature flag check ---

let _flagCache: { enabled: boolean; expiresAt: number } | null = null;
const FLAG_CACHE_TTL = 30_000; // 30s

async function isSubscriptionEnabled(): Promise<boolean> {
    if (_flagCache && Date.now() < _flagCache.expiresAt) return _flagCache.enabled;

    // Env-var override (authoritative) — use this to disable gating in dev/staging
    // without risking a Firestore outage silently disabling gating in prod.
    if (process.env.SUBSCRIPTION_GATING_ENABLED === 'false') {
        _flagCache = { enabled: false, expiresAt: Date.now() + FLAG_CACHE_TTL };
        return false;
    }

    try {
        const { getDb } = await import('./firebase-admin');
        const db = await getDb();
        const doc = await db.collection('system_config').doc('feature_flags').get();
        // Default to ENABLED when doc missing or field not set — we want gating ON
        // in prod by default, so a missing config never costs us money.
        const enabled = doc.exists ? (doc.data()?.subscriptionEnabled !== false) : true;
        _flagCache = { enabled, expiresAt: Date.now() + FLAG_CACHE_TTL };
        return enabled;
    } catch (err) {
        // FAIL CLOSED: if Firestore is unreachable, assume gating is ON.
        // Previously this failed OPEN (returned false = gating disabled), which
        // meant any Firestore outage silently gave every user unlimited access.
        console.error('[plan-guard] Failed to read feature_flags, failing closed (gating ON):', err);
        return true;
    }
}
