'use server';

import { getDb } from '@/lib/firebase-admin';
import { LessonPlanOutput } from '@/ai/flows/lesson-plan-generator';

/**
 * Normalizes the topic string for consistent cache keys.
 * e.g., "  Photosynthesis  " -> "photosynthesis"
 */
function normalizeKey(str: string): string {
    return str.trim().toLowerCase().replace(/\s+/g, ' ');
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
        console.warn(`[Privacy] PII detected in topic: "${topic}". Skipping cache generation.`);
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

        const db = await getDb();
        const docRef = db.collection('cached_lesson_plans').doc(cacheId);
        const doc = await docRef.get();

        if (doc.exists) {
            console.log(`Cache HIT for: ${cacheId}`);
            return doc.data() as LessonPlanOutput;
        }

        console.log(`Cache MISS for: ${cacheId}`);
        return null;
    } catch (error) {
        console.error('Error fetching from cache:', error);
        return null; // Fail gracefully, fall back to AI
    }
}

/**
 * Saves a generated lesson plan to Firestore cache.
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
            console.log(`[Privacy] Skipping cache save for sensitive topic.`);
            return;
        }

        const db = await getDb();
        await db.collection('cached_lesson_plans').doc(cacheId).set({
            ...plan,
            _metadata: {
                createdAt: new Date().toISOString(),
                originalTopic: topic,
                originalGrade: grade,
                originalLanguage: language,
                usageCount: 1
            }
        });
        console.log(`Saved to cache: ${cacheId}`);
    } catch (error) {
        console.error('Error saving to cache:', error);
        // Don't throw, just log. Caching failure shouldn't break the app.
    }
}
