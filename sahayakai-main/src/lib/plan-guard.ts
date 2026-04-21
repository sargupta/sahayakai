import 'server-only';
import { NextResponse } from 'next/server';
import type { GatedFeature } from './plan-config';
import { PLAN_CONFIG, getMinimumPlan, PLAN_DISPLAY_NAMES } from './plan-config';
import { normalizePlan } from './plan-utils';
import { getMonthlyUsage, getDailyUsage, incrementUsage } from './usage-counters';

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
export function withPlanCheck(feature: GatedFeature) {
    return function <T extends Request>(handler: (request: T) => Promise<NextResponse>) {
        return async function (request: T): Promise<NextResponse> {
            const userId = request.headers.get('x-user-id');
            if (!userId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            // Check feature flag — if subscription gating is disabled, pass through
            const gatingEnabled = await isSubscriptionEnabled();
            if (!gatingEnabled) {
                return handler(request);
            }

            const rawPlan = request.headers.get('x-user-plan') || 'free';
            const plan = normalizePlan(rawPlan);
            const config = PLAN_CONFIG[plan];
            const limit = config.limits[feature];

            // Feature not available on this plan
            if (limit === 0) {
                const minPlan = getMinimumPlan(feature);
                return NextResponse.json(
                    {
                        error: 'PLAN_UPGRADE_REQUIRED',
                        message: `This feature requires ${PLAN_DISPLAY_NAMES[minPlan]} plan or higher.`,
                        requiredPlan: minPlan,
                        currentPlan: plan,
                        feature,
                    },
                    { status: 403 }
                );
            }

            // Check monthly limit (skip if unlimited)
            if (limit !== -1) {
                const used = await getMonthlyUsage(userId, feature);
                if (used >= limit) {
                    return NextResponse.json(
                        {
                            error: 'USAGE_LIMIT_REACHED',
                            message: `You've used all ${limit} ${feature.replace('-', ' ')} generations this month. Resets next month.`,
                            used,
                            limit,
                            feature,
                            currentPlan: plan,
                        },
                        { status: 429 }
                    );
                }
            }

            // Check daily limit for features with per-day caps
            const dailyLimitMap: Partial<Record<GatedFeature, number>> = {
                'instant-answer': config.instantAnswerDailyLimit,
                'assistant': config.assistantDailyLimit,
            };
            const dailyCap = dailyLimitMap[feature];
            if (dailyCap !== undefined && dailyCap !== -1) {
                const dailyUsed = await getDailyUsage(userId, feature);
                if (dailyUsed >= dailyCap) {
                    return NextResponse.json(
                        {
                            error: 'DAILY_LIMIT_REACHED',
                            message: `You've used all ${dailyCap} ${feature.replace(/-/g, ' ')} interactions for today. Try again tomorrow.`,
                            used: dailyUsed,
                            limit: dailyCap,
                            feature,
                            currentPlan: plan,
                        },
                        { status: 429 }
                    );
                }
            }

            // Execute the actual handler
            const response = await handler(request);

            // Increment usage AFTER success (fire-and-forget)
            if (response.ok) {
                incrementUsage(userId, feature).catch(() => {});
            }

            return response;
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
