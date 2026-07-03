/**
 * Lesson-plan cache domain service — tranche 5 API-boundary migration.
 *
 * Logic moved verbatim from src/app/actions/lesson-plan.ts (deleted). The
 * /api/lesson-plan/cache route is the thin shell; auth (Wave 1 gate against
 * anonymous cache scraping / poisoning) is enforced there via the
 * middleware-verified x-user-id header.
 */

import type { LessonPlanOutput } from '@/ai/flows/lesson-plan-generator';
import { logger } from '@/lib/logger';

/**
 * Normalizes the topic string for consistent cache keys.
 * Removes common stopwords to increase cache hits.
 * e.g., "Teach me about Gravity" -> "gravity"
 */
function normalizeKey(str: string): string {
    const stopWords = ['teach', 'me', 'about', 'how', 'to', 'explain', 'lesson', 'plan', 'for', 'the', 'a', 'an'];
    let normalized = str.trim().toLowerCase();

    // Remove punctuation
    normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

    // Remove stop words
    const words = normalized.split(/\s+/);
    const filtered = words.filter(w => !stopWords.includes(w));

    return filtered.join(' ') || normalized; // Fallback to original if everything was a stopword
}

/**
 * Detects potential PII (Email, Phone, generic Name patterns)
 */
function containsPII(text: string): boolean {
    // Basic email regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    // Basic phone regex (Indian context: 10 digits, maybe +91)
    const phoneRegex = /(\+91[\-\s]?)?[6-9]\d{9}/;

    return emailRegex.test(text) || phoneRegex.test(text);
}

/**
 * Generates a unique cache ID based on inputs.
 * Returns null if PII is detected to prevent unsafe caching.
 */
function generateCacheId(topic: string, grade: string, language: string): string | null {
    if (containsPII(topic)) {
        logger.warn(`PII detected in topic. Skipping cache generation.`, 'CACHE', { topic: "REDACTED" });
        return null; // Do not generate a cache ID for PII content
    }

    const normTopic = normalizeKey(topic);
    const normGrade = normalizeKey(grade);
    const normLang = normalizeKey(language);
    // Create a deterministic ID
    return `${normTopic}-${normGrade}-${normLang}`.replace(/[^a-z0-9-]/g, '-');
}

/**
 * Checks Firestore for a cached lesson plan.
 *
 * Auth is enforced by the route (Wave 1: rate-limits reads via the auth gate
 * to prevent anonymous cache scraping). Fails gracefully — returns null on
 * any error so the caller falls back to the AI flow.
 */
export async function getCachedLessonPlan(
    topic: string,
    grade: string,
    language: string
): Promise<LessonPlanOutput | null> {
    try {
        const cacheId = generateCacheId(topic, grade, language);

        // If PII was detected, cacheId is null. Return null immediately.
        if (!cacheId) return null;

        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();
        const docRef = db.collection('cached_lesson_plans').doc(cacheId);
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data()!;
            if (data._metadata?.expiresAt && data._metadata.expiresAt < Date.now()) {
                docRef.delete().catch(console.warn); // expire stale cache
                return null;
            }
            logger.info(`Cache HIT for lesson plan`, 'CACHE', { cacheId });
            return data as LessonPlanOutput;
        }

        logger.info(`Cache MISS for lesson plan`, 'CACHE', { cacheId });
        return null;
    } catch (error) {
        logger.error('Error fetching from cache', error, 'CACHE', { topic, grade, language });
        return null; // Fail gracefully, fall back to AI
    }
}

/**
 * Saves a generated lesson plan to Firestore cache.
 *
 * Wave 1 hardening preserved: the route requires an authenticated caller.
 * Previously a malicious anonymous client could poison the SHARED cache
 * (other teachers see the cached result on the same topic/grade/language)
 * with arbitrary content.
 *
 * Note: this still doesn't validate that the caller actually generated this
 * plan via the legitimate AI flow — just that they're a real user. A future
 * pass should verify the plan originated from a recent flow invocation
 * (e.g. via a signed cache token).
 */
export async function saveLessonPlanToCache(
    plan: LessonPlanOutput,
    topic: string,
    grade: string,
    language: string
): Promise<void> {
    try {
        const cacheId = generateCacheId(topic, grade, language);

        // If PII detected, do NOT save.
        if (!cacheId) {
            logger.info(`Skipping cache save for sensitive topic.`, 'CACHE');
            return;
        }

        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();
        await db.collection('cached_lesson_plans').doc(cacheId).set({
            ...plan,
            _metadata: {
                createdAt: new Date().toISOString(),
                originalTopic: topic,
                originalGrade: grade,
                originalLanguage: language,
                usageCount: 1,
                expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
            }
        });
        logger.info(`Saved lesson plan to cache`, 'CACHE', { cacheId });
    } catch (error) {
        logger.error('Error saving lesson plan to cache', error, 'CACHE', { topic, grade, language });
        // Don't throw, just log. Caching failure shouldn't break the app.
    }
}
