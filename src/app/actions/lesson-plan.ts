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
 * Generates a unique cache ID based on inputs.
 */
function generateCacheId(topic: string, grade: string, language: string): string {
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
        const db = await getDb();
        const cacheId = generateCacheId(topic, grade, language);

        // Try to fetch by exact ID first (fastest)
        const docRef = db.collection('cached_lesson_plans').doc(cacheId);
        const doc = await docRef.get();

        if (doc.exists) {
            console.log(`Cache HIT for: ${cacheId}`);
            return doc.data() as LessonPlanOutput;
        }

        // Optional: We could search by 'topic' field if we wanted fuzzy matching,
        // but for now, exact normalized match is safer and cheaper.
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
        const db = await getDb();
        const cacheId = generateCacheId(topic, grade, language);

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
