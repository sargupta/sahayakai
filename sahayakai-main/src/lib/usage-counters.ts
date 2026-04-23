import 'server-only';
import type { GatedFeature } from './plan-config';

/**
 * Usage counter system for subscription gating.
 *
 * Schema: usageCounters/{userId} — single doc per user with fields like:
 *   lesson-plan_2026-03: 7
 *   quiz_2026-03: 3
 *   instant-answer_daily_2026-03-26: 15
 *
 * Uses Firestore FieldValue.increment() for atomic updates.
 * Reads are cached in-memory for 60s to avoid per-request Firestore reads.
 */

import { FieldValue } from 'firebase-admin/firestore';

// --- Helpers ---

/** Get current month key in YYYY-MM format (IST). */
function getMonthKey(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7);
}

/** Get today's date key in YYYY-MM-DD format (IST). */
function getTodayKey(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getMonthlyField(feature: GatedFeature): string {
    return `${feature}_${getMonthKey()}`;
}

function getDailyField(feature: GatedFeature): string {
    return `${feature}_daily_${getTodayKey()}`;
}

// --- In-memory cache (60s TTL) ---

interface CacheEntry {
    data: Record<string, number>;
    expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

async function getUserCounters(userId: string): Promise<Record<string, number>> {
    const cached = cache.get(userId);
    if (cached && Date.now() < cached.expiresAt) return cached.data;

    const { getDb } = await import('./firebase-admin');
    const db = await getDb();
    const doc = await db.collection('usageCounters').doc(userId).get();
    const data = (doc.exists ? doc.data() : {}) as Record<string, number>;

    cache.set(userId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
}

/** Invalidate cache for a user after incrementing. */
function invalidateCache(userId: string): void {
    cache.delete(userId);
}

// --- Public API ---

/**
 * Get current monthly usage for a feature.
 * Returns the count used this month.
 */
export async function getMonthlyUsage(userId: string, feature: GatedFeature): Promise<number> {
    const counters = await getUserCounters(userId);
    return counters[getMonthlyField(feature)] ?? 0;
}

/**
 * Get current daily usage for a feature (used for Instant Answer daily cap).
 */
export async function getDailyUsage(userId: string, feature: GatedFeature): Promise<number> {
    const counters = await getUserCounters(userId);
    return counters[getDailyField(feature)] ?? 0;
}

/**
 * Increment usage for a feature (both monthly and daily counters).
 * Call AFTER successful AI generation.
 *
 * DEPRECATED for gating: use reserveQuota() instead, which does atomic
 * check-and-increment to prevent race conditions. Retained for admin/backfill tools.
 */
export async function incrementUsage(userId: string, feature: GatedFeature): Promise<void> {
    const { getDb } = await import('./firebase-admin');
    const db = await getDb();

    const ref = db.collection('usageCounters').doc(userId);
    await ref.set(
        {
            [getMonthlyField(feature)]: FieldValue.increment(1),
            [getDailyField(feature)]: FieldValue.increment(1),
            lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    invalidateCache(userId);
}

/**
 * Atomically check-and-reserve quota for a feature.
 *
 * Runs inside a Firestore transaction so that concurrent requests from the
 * same user cannot both pass the limit check and then both increment.
 *
 * Returns { ok: true } on success (quota decremented, caller should proceed).
 * Returns { ok: false, reason, used, limit } if limit exceeded (caller should 429).
 *
 * If the handler downstream fails, call rollbackQuota() to return the unit.
 */
export async function reserveQuota(
    userId: string,
    feature: GatedFeature,
    monthlyLimit: number,
    dailyLimit?: number
): Promise<
    | { ok: true }
    | { ok: false; reason: 'monthly' | 'daily'; used: number; limit: number }
> {
    const { getDb } = await import('./firebase-admin');
    const db = await getDb();
    const ref = db.collection('usageCounters').doc(userId);
    const monthlyField = getMonthlyField(feature);
    const dailyField = getDailyField(feature);

    try {
        const result = await db.runTransaction(async (tx) => {
            const doc = await tx.get(ref);
            const data = (doc.exists ? doc.data() : {}) as Record<string, number>;
            const monthlyUsed = data[monthlyField] ?? 0;
            const dailyUsed = data[dailyField] ?? 0;

            if (monthlyLimit !== -1 && monthlyUsed >= monthlyLimit) {
                return { ok: false as const, reason: 'monthly' as const, used: monthlyUsed, limit: monthlyLimit };
            }
            if (dailyLimit !== undefined && dailyLimit !== -1 && dailyUsed >= dailyLimit) {
                return { ok: false as const, reason: 'daily' as const, used: dailyUsed, limit: dailyLimit };
            }

            tx.set(
                ref,
                {
                    [monthlyField]: FieldValue.increment(1),
                    [dailyField]: FieldValue.increment(1),
                    lastUpdated: FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
            return { ok: true as const };
        });
        invalidateCache(userId);
        return result;
    } catch (error) {
        // Fail CLOSED on Firestore outage: treat as quota exhausted to prevent abuse.
        // This returns 429, which is retryable — better than silently giving free access.
        console.error(`[UsageCounters] reserveQuota failed for ${userId}/${feature}:`, error);
        return { ok: false, reason: 'monthly', used: -1, limit: monthlyLimit };
    }
}

/**
 * Roll back a quota reservation (decrement both monthly and daily counters).
 * Call when the handler fails after a successful reserveQuota() to avoid
 * charging users for requests that never produced value.
 */
export async function rollbackQuota(userId: string, feature: GatedFeature): Promise<void> {
    try {
        const { getDb } = await import('./firebase-admin');
        const db = await getDb();
        const ref = db.collection('usageCounters').doc(userId);
        await ref.set(
            {
                [getMonthlyField(feature)]: FieldValue.increment(-1),
                [getDailyField(feature)]: FieldValue.increment(-1),
                lastUpdated: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
        invalidateCache(userId);
    } catch (error) {
        // If rollback fails, the user loses one quota unit for a failed call.
        // Log WARN so we can detect if this is happening frequently.
        console.warn(`[UsageCounters] rollbackQuota failed for ${userId}/${feature}:`, error);
    }
}

// --- Voice cloud minute accumulation (separate from count-based features) ---
//
// Voice cloud TTS/STT is metered in MINUTES, not call count, because a single
// long-form lesson narration consumes far more provider cost than a 5-second
// utterance. This is intentionally separate from the atomic reserveQuota /
// rollbackQuota flow above — voice minutes are estimated post-call (from
// char count or audio bytes), so a transactional pre-reserve doesn't apply.
// Field name `voiceCloudMinutes_YYYY-MM` lives alongside the per-feature
// counters in the same usageCounters/{uid} doc.

function getVoiceMinutesField(): string {
    return `voiceCloudMinutes_${getMonthKey()}`;
}

/** Read this month's accumulated voice cloud minutes for a user. */
export async function getMonthlyVoiceCloudMinutes(userId: string): Promise<number> {
    const counters = await getUserCounters(userId);
    return counters[getVoiceMinutesField()] ?? 0;
}

/**
 * Add `minutes` to the user's monthly voice cloud counter. Fractional minutes
 * are stored as-is (FieldValue.increment supports floats). Fail-open on error
 * so a Firestore blip doesn't block paying users.
 */
export async function incrementVoiceCloudMinutes(userId: string, minutes: number): Promise<void> {
    if (!minutes || minutes <= 0) return;
    try {
        const { getDb } = await import('./firebase-admin');
        const db = await getDb();

        const ref = db.collection('usageCounters').doc(userId);
        await ref.set(
            {
                [getVoiceMinutesField()]: FieldValue.increment(minutes),
                lastUpdated: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        invalidateCache(userId);
    } catch (error) {
        console.error(`[UsageCounters] Failed to increment voice minutes for ${userId}:`, error);
    }
}

/**
 * Get all usage data for a user (for client-side display).
 * Returns { feature: { used, limit } } for the current month.
 */
export async function getUserUsageSummary(
    userId: string,
    plan: import('./plan-utils').PlanType
): Promise<Record<string, { used: number; limit: number }>> {
    const { PLAN_CONFIG } = await import('./plan-config');
    const counters = await getUserCounters(userId);
    const config = PLAN_CONFIG[plan];
    const result: Record<string, { used: number; limit: number }> = {};

    for (const [feature, limit] of Object.entries(config.limits)) {
        if (limit === 0) continue; // feature not available
        result[feature] = {
            used: counters[getMonthlyField(feature as GatedFeature)] ?? 0,
            limit,
        };
    }

    return result;
}
