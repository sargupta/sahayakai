import { logger } from './logger';
import { costService } from './services/cost-service';

export type UsageMetricType =
    | 'gemini_tokens'
    | 'tts_characters'
    | 'image_generation'
    | 'grounding_calls'
    | 'firestore_writes';

/**
 * F14-003 (2026-06-06) — usage enforcement.
 *
 * Per-user daily caps that protect against runaway spend on any single
 * teacher. Read by `checkUsage` and compared against the per-user
 * counter at `daily_user_usage/{uid}_{YYYY-MM-DD}`. Counters are
 * incremented inside `logUsage` after a successful tracked call. The
 * cap protects the NEXT call after a user crosses the limit, so a
 * single runaway request cannot exceed it by more than one call.
 *
 * Caps are intentionally conservative. The 'free' plan is the floor;
 * Pro can be raised by reading the user's plan via plan-service if/when
 * the caller wires it. Default-to-free until that lands.
 */
export const DAILY_USAGE_CAPS = {
    free: {
        gemini_tokens: 500_000,
        tts_characters: 50_000,
        image_generation: 10, // mirrors checkImageRateLimit
        grounding_calls: 5,
        firestore_writes: 10_000,
    },
    pro: {
        gemini_tokens: 5_000_000,
        tts_characters: 500_000,
        image_generation: 50,
        grounding_calls: 50,
        firestore_writes: 100_000,
    },
} as const satisfies Record<string, Record<UsageMetricType, number>>;

export class PlanLimitExceededError extends Error {
    public readonly type: UsageMetricType;
    public readonly used: number;
    public readonly limit: number;
    constructor(type: UsageMetricType, used: number, limit: number) {
        super(`Daily limit reached for ${type}: ${used}/${limit}. Try again tomorrow or upgrade your plan.`);
        this.name = 'PlanLimitExceededError';
        this.type = type;
        this.used = used;
        this.limit = limit;
    }
}

interface UsagePayload {
    userId: string;
    type: UsageMetricType;
    value: number;
    metadata?: Record<string, any>;
}

const USER_USAGE_COLLECTION = 'daily_user_usage';

function todayUTC(): string {
    return new Date().toISOString().split('T')[0];
}

async function getUserPlanTier(userId: string): Promise<keyof typeof DAILY_USAGE_CAPS> {
    // Default to 'free' if anything fails — fail closed for cost safety,
    // never open. A misconfigured user is treated as the smallest cap.
    try {
        const { getDb } = await import('./firebase-admin');
        const db = await getDb();
        const userDoc = await db.collection('users').doc(userId).get();
        const data = userDoc.data();
        // Canonical field is `planType` (written by the Razorpay webhook,
        // billing-reconciliation, and middleware). Legacy `plan`/subscription
        // fields are read only as a fallback.
        const { normalizePlan } = await import('./plan-utils');
        const raw = data?.planType ?? data?.plan ?? data?.subscription?.plan;
        const plan = normalizePlan(raw);
        // DAILY_USAGE_CAPS only defines 'free' and 'pro' tiers; any paid tier
        // (pro/gold/premium) maps to the 'pro' cap. Free stays free.
        return plan === 'free' ? 'free' : 'pro';
    } catch (err) {
        logger.warn?.(`Failed to read plan for ${userId}; defaulting to free`, 'USAGE_GUARD', { err: String(err) });
        return 'free';
    }
}

/**
 * Read the per-user daily counter for `type` and throw
 * `PlanLimitExceededError` when the user has reached their plan cap.
 *
 * Fails OPEN on infrastructure errors (logs + lets the call through) so
 * a Firestore hiccup cannot ground the entire product. Cost is bounded
 * by the other gates (image rate-limit, server rate-limit, Gemini's own
 * quota) so failing open here is recoverable.
 */
export async function checkUsage(userId: string, type: UsageMetricType): Promise<void> {
    if (!userId || userId === 'anonymous_user') return;
    try {
        const { getDb } = await import('./firebase-admin');
        const db = await getDb();
        const docId = `${userId}_${todayUTC()}`;
        const docRef = db.collection(USER_USAGE_COLLECTION).doc(docId);
        const snap = await docRef.get();
        const used = (snap.exists ? ((snap.data() as any)?.[type] ?? 0) : 0) as number;
        const tier = await getUserPlanTier(userId);
        const limit = DAILY_USAGE_CAPS[tier][type];
        if (used >= limit) {
            throw new PlanLimitExceededError(type, used, limit);
        }
    } catch (error: any) {
        if (error instanceof PlanLimitExceededError) throw error;
        logger.error(`checkUsage failed for ${userId}/${type} (failing open)`, error, 'USAGE_GUARD');
    }
}

async function incrementUserUsage(userId: string, type: UsageMetricType, value: number): Promise<void> {
    const { getDb } = await import('./firebase-admin');
    const { FieldValue } = await import('firebase-admin/firestore');
    const db = await getDb();
    const docId = `${userId}_${todayUTC()}`;
    const docRef = db.collection(USER_USAGE_COLLECTION).doc(docId);
    await docRef.set({
        userId,
        date: todayUTC(),
        [type]: FieldValue.increment(value),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

// ═════════════════════════════════════════════════════════════════════════
// Daily feature-quota gate (video-storyteller — the most expensive flow).
//
// Separate from `UsageMetricType` on purpose: metric types feed the
// cost-service field map (exhaustive Record), while these are pure
// per-feature daily gates. Counters live in the SAME
// `daily_user_usage/{uid}_{YYYY-MM-DD}` doc under their own field names,
// so the existing dashboard/TTL story applies unchanged.
// ═════════════════════════════════════════════════════════════════════════

/**
 * FOUNDER-TUNABLE daily caps per plan tier.
 * `free` is the floor; every paid tier (pro/gold/premium) maps to `pro`
 * (same mapping as `getUserPlanTier` above).
 */
export const DAILY_FEATURE_QUOTAS = {
    video_storyteller: {
        free: 3,   // FOUNDER-TUNABLE — free tier: 3 recommendation runs/day
        pro: 30,   // FOUNDER-TUNABLE — paid tiers: 30 runs/day
    },
} as const;

export type GatedDailyFeature = keyof typeof DAILY_FEATURE_QUOTAS;

export type DailyQuotaResult =
    | { ok: true; used: number; limit: number; plan: 'free' | 'pro' }
    | { ok: false; used: number; limit: number; plan: 'free' | 'pro' };

/**
 * Atomically check-and-reserve one unit of a daily feature quota.
 *
 * Runs a Firestore transaction (read counter → compare to cap → increment)
 * so concurrent requests from the same user cannot both pass the check.
 * Returns { ok: false } when the cap is reached — caller should 429.
 *
 * Fails OPEN on infrastructure errors (same policy as `checkUsage` above,
 * documented there): a Firestore hiccup must not ground the product; cost
 * stays bounded by the server rate-limiter and Gemini's own quota.
 */
export async function reserveDailyQuota(
    userId: string,
    feature: GatedDailyFeature
): Promise<DailyQuotaResult> {
    const tier = await getUserPlanTier(userId);
    const limit = DAILY_FEATURE_QUOTAS[feature][tier];
    try {
        const { getDb } = await import('./firebase-admin');
        const { FieldValue } = await import('firebase-admin/firestore');
        const db = await getDb();
        const docRef = db.collection(USER_USAGE_COLLECTION).doc(`${userId}_${todayUTC()}`);

        return await db.runTransaction(async (tx) => {
            const snap = await tx.get(docRef);
            const used = (snap.exists ? ((snap.data() as any)?.[feature] ?? 0) : 0) as number;
            if (used >= limit) {
                return { ok: false as const, used, limit, plan: tier };
            }
            tx.set(
                docRef,
                {
                    userId,
                    date: todayUTC(),
                    [feature]: FieldValue.increment(1),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
            return { ok: true as const, used: used + 1, limit, plan: tier };
        });
    } catch (error) {
        logger.error(`reserveDailyQuota failed for ${userId}/${feature} (failing open)`, error as Error, 'USAGE_GUARD');
        return { ok: true, used: 0, limit, plan: tier };
    }
}

/**
 * Return one reserved unit after a downstream failure, so users aren't
 * charged quota for calls that never delivered value. Best-effort.
 */
export async function rollbackDailyQuota(userId: string, feature: GatedDailyFeature): Promise<void> {
    try {
        const { getDb } = await import('./firebase-admin');
        const { FieldValue } = await import('firebase-admin/firestore');
        const db = await getDb();
        await db.collection(USER_USAGE_COLLECTION).doc(`${userId}_${todayUTC()}`).set(
            {
                [feature]: FieldValue.increment(-1),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    } catch (error) {
        logger.error(`rollbackDailyQuota failed for ${userId}/${feature}`, error as Error, 'USAGE_GUARD');
    }
}

/**
 * Centralized utility for tracking resource usage and costs.
 * Logs structured data that can be picked up by GCP Logging and aggregated.
 */
export const UsageTracker = {
    logUsage({ userId, type, value, metadata }: UsagePayload) {
        logger.info(`Usage Tracked: ${type}`, 'COST_MONITORING', {
            userId,
            metric_type: type,
            value,
            ...metadata,
            labels: {
                metric_type: type,
                user_id: userId,
                cost_tracking: 'true'
            }
        });

        // Atomic update in Firestore for real-time dashboard
        costService.trackDailyUsage(type, value).catch(err =>
            logger.error(`Failed to persist usage for ${type}`, err, 'COST_MONITORING')
        );

        // F14-003 — per-user counter for enforcement gate (`checkUsage`).
        // Fire-and-forget; failures swallowed. Without this counter,
        // `checkUsage` always reads 0 and a runaway user is uncapped.
        if (userId && userId !== 'anonymous_user') {
            void incrementUserUsage(userId, type, value).catch(err =>
                logger.error(`Failed to increment per-user usage ${type}`, err, 'COST_MONITORING')
            );
        }
    },

    trackTTS(userId: string, characterCount: number, cacheHit: boolean = false, provider: 'google' | 'sarvam' | 'bhashini' = 'google') {
        this.logUsage({
            userId,
            type: 'tts_characters',
            value: characterCount,
            metadata: { cacheHit, provider }
        });
    },

    trackGemini(userId: string, tokens: number, model: string) {
        this.logUsage({
            userId,
            type: 'gemini_tokens',
            value: tokens,
            metadata: { model }
        });
    },

    trackGrounding(userId: string, query: string) {
        this.logUsage({
            userId,
            type: 'grounding_calls',
            value: 1,
            metadata: { query }
        });
    },

    trackImageGen(userId: string) {
        this.logUsage({
            userId,
            type: 'image_generation',
            value: 1
        });
    }
};
