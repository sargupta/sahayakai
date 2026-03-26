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
 * Call AFTER successful AI generation (fire-and-forget).
 */
export async function incrementUsage(userId: string, feature: GatedFeature): Promise<void> {
    try {
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
    } catch (error) {
        // Fail open — better to give a free call than block a paying user
        console.error(`[UsageCounters] Failed to increment ${feature} for ${userId}:`, error);
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
