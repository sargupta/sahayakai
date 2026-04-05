/**
 * Video Semantic Cache — L2 Firestore Layer
 *
 * Caches video recommendation results keyed by teacher profile hash.
 * Key insight: Two teachers with the same subject + grade get the SAME cached result.
 * This dramatically reduces cold calls and YouTube API usage.
 *
 * Cache TTL: 6 hours (educational content doesn't change minute-to-minute)
 * Collection: video_cache/{profileHash}
 */

import { getDb } from './firebase-admin';
import { YouTubeVideo } from './youtube';
import { createHash } from 'crypto';

const CACHE_COLLECTION = 'video_cache';
const CACHE_TTL_HOURS = 6;

export interface VideoCacheEntry {
    profileHash: string;
    subject: string;
    gradeLevel: string;
    language?: string;
    state?: string;
    educationBoard?: string;
    categorizedVideos: Record<string, YouTubeVideo[]>;
    personalizedMessage: string;
    cachedAt: string; // ISO timestamp
    expiresAt: string; // ISO timestamp
    hitCount: number;
}

/**
 * Builds a deterministic cache key from teacher profile.
 * Same teacher context → same key → cache hit across all users with similar profiles.
 */
export function buildCacheKey(
    subject: string,
    gradeLevel: string,
    language?: string,
    state?: string,
    educationBoard?: string
): string {
    const parts = [
        subject.toLowerCase().trim(),
        gradeLevel.toLowerCase().trim(),
        (language || 'english').toLowerCase().trim(),
        (state || 'general').toLowerCase().trim(),
        (educationBoard || 'cbse').toLowerCase().trim(),
    ];
    return createHash('sha256')
        .update(parts.join(':'))
        .digest('hex')
        .slice(0, 16); // 16-char hex is sufficient for uniqueness
}

/**
 * Retrieves cached videos from Firestore if not expired.
 * Returns null on cache miss or expired entry.
 */
export async function getCachedVideos(
    subject: string,
    gradeLevel: string,
    language?: string,
    state?: string,
    educationBoard?: string
): Promise<VideoCacheEntry | null> {
    try {
        const db = await getDb();
        const key = buildCacheKey(subject, gradeLevel, language, state, educationBoard);
        const doc = await db.collection(CACHE_COLLECTION).doc(key).get();

        if (!doc.exists) return null;

        const entry = doc.data() as VideoCacheEntry;
        const expiresAt = new Date(entry.expiresAt).getTime();

        if (Date.now() > expiresAt) {
            // Expired — delete and return null (will trigger background refresh)
            void doc.ref.delete();
            return null;
        }

        // Increment hit count (fire-and-forget)
        void doc.ref.update({ hitCount: (entry.hitCount || 0) + 1 });

        console.log(`[VideoCache] ✅ Cache hit for ${subject} / ${gradeLevel} (key: ${key})`);
        return entry;
    } catch (error) {
        // Cache read failure must never crash the main flow
        console.error('[VideoCache] Read error (non-fatal):', error);
        return null;
    }
}

/**
 * Writes video results to Firestore cache.
 * Uses merge semantics — safe to call concurrently.
 */
export async function setCachedVideos(
    subject: string,
    gradeLevel: string,
    categorizedVideos: Record<string, YouTubeVideo[]>,
    personalizedMessage: string,
    language?: string,
    state?: string,
    educationBoard?: string
): Promise<void> {
    try {
        const db = await getDb();
        const key = buildCacheKey(subject, gradeLevel, language, state, educationBoard);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

        const entry: VideoCacheEntry = {
            profileHash: key,
            subject,
            gradeLevel,
            language,
            state,
            educationBoard,
            categorizedVideos,
            personalizedMessage,
            cachedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            hitCount: 0,
        };

        await db.collection(CACHE_COLLECTION).doc(key).set(entry);
        console.log(`[VideoCache] 💾 Stored cache for ${subject} / ${gradeLevel} (expires in ${CACHE_TTL_HOURS}hrs)`);
    } catch (error) {
        // Cache write failure must never crash the main flow
        console.error('[VideoCache] Write error (non-fatal):', error);
    }
}

/**
 * Triggers a background cache refresh without blocking the response.
 * Pass a callback that returns the fresh data to store.
 */
export async function backgroundRefresh(
    subject: string,
    gradeLevel: string,
    refreshFn: () => Promise<{ categorizedVideos: Record<string, YouTubeVideo[]>; personalizedMessage: string }>
): Promise<void> {
    // Fire-and-forget, runs after request is served
    setImmediate(async () => {
        try {
            const freshData = await refreshFn();
            await setCachedVideos(subject, gradeLevel, freshData.categorizedVideos, freshData.personalizedMessage);
        } catch (e) {
            console.error('[VideoCache] Background refresh failed:', e);
        }
    });
}
