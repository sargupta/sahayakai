import crypto from 'crypto';
import { StructuredLogger } from '@/lib/logger/structured-logger';

const CACHE_COLLECTION = 'lesson_plan_cache';
const CACHE_TTL_HOURS = 24;

interface CacheKeyParams {
  topic: string;
  gradeLevels?: string[];
  language?: string;
  resourceLevel?: string;
  difficultyLevel?: string;
  subject?: string;
}

/**
 * Generate a deterministic cache key from lesson plan parameters.
 * Normalizes inputs to maximize cache hits (lowercase, sorted, trimmed).
 */
export function generateLessonPlanCacheKey(params: CacheKeyParams): string {
  const normalized = [
    (params.topic || '').toLowerCase().trim(),
    (params.gradeLevels || []).sort().join(',').toLowerCase(),
    (params.language || 'english').toLowerCase().trim(),
    (params.resourceLevel || 'low').toLowerCase(),
    (params.difficultyLevel || 'standard').toLowerCase(),
    (params.subject || '').toLowerCase().trim(),
  ].join('|');

  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * Look up a cached lesson plan from Firestore.
 * Returns null on miss or expired entry.
 */
export async function getCachedLessonPlan(cacheKey: string): Promise<any | null> {
  try {
    const { getDb } = await import('@/lib/firebase-admin');
    const db = await getDb();
    const doc = await db.collection(CACHE_COLLECTION).doc(cacheKey).get();

    if (!doc.exists) return null;

    const data = doc.data();
    if (!data) return null;

    // Check TTL
    const cachedAt = data.cachedAt?.toDate?.() || new Date(data.cachedAt);
    const ageHours = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);

    if (ageHours > CACHE_TTL_HOURS) {
      // Expired — don't block on delete
      db.collection(CACHE_COLLECTION).doc(cacheKey).delete().catch(() => {});
      return null;
    }

    StructuredLogger.info('Lesson plan cache HIT', {
      service: 'lesson-plan-cache',
      operation: 'get',
      metadata: { cacheKey, ageHours: Math.round(ageHours * 10) / 10, hitCount: (data.hitCount || 0) + 1 }
    });

    // Increment hit count (non-blocking)
    db.collection(CACHE_COLLECTION).doc(cacheKey).update({
      hitCount: (data.hitCount || 0) + 1,
      lastHitAt: new Date(),
    }).catch(() => {});

    return data.output;
  } catch (error) {
    StructuredLogger.warn('Lesson plan cache lookup failed (serving fresh)', {
      service: 'lesson-plan-cache',
      operation: 'get',
      metadata: { cacheKey, error: String(error) }
    });
    return null;
  }
}

/**
 * Store a generated lesson plan in Firestore cache.
 */
export async function setCachedLessonPlan(
  cacheKey: string,
  output: any,
  params: CacheKeyParams
): Promise<void> {
  try {
    const { getDb } = await import('@/lib/firebase-admin');
    const db = await getDb();

    await db.collection(CACHE_COLLECTION).doc(cacheKey).set({
      output,
      params: {
        topic: params.topic,
        gradeLevels: params.gradeLevels || [],
        language: params.language || 'English',
        resourceLevel: params.resourceLevel || 'low',
        difficultyLevel: params.difficultyLevel || 'standard',
        subject: params.subject || '',
      },
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000),
      hitCount: 0,
      lastHitAt: null,
    });

    StructuredLogger.info('Lesson plan cached', {
      service: 'lesson-plan-cache',
      operation: 'set',
      metadata: { cacheKey, topic: params.topic }
    });
  } catch (error) {
    // Non-blocking — if cache write fails, the user still gets their plan
    StructuredLogger.warn('Lesson plan cache write failed', {
      service: 'lesson-plan-cache',
      operation: 'set',
      metadata: { cacheKey, error: String(error) }
    });
  }
}
