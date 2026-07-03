/**
 * Typed client for the /api/lesson-plan/cache boundary — tranche 5.
 *
 * Signatures are IDENTICAL to the migrated server actions
 * (src/app/actions/lesson-plan.ts, deleted). Both functions preserve the
 * actions' graceful-failure semantics: the shared cache is best-effort, so
 * lookups return null and saves swallow errors (including 401s — an
 * unauthenticated user simply misses the cache and falls through to the
 * normal auth-gated generation path).
 */

import { apiFetch } from '@/lib/api/client';
import type { LessonPlanOutput } from '@/ai/flows/lesson-plan-generator';

/**
 * Checks the shared Firestore cache for a lesson plan. Null on miss or any
 * error — caller falls back to the AI flow.
 */
export async function getCachedLessonPlan(
    topic: string,
    grade: string,
    language: string,
): Promise<LessonPlanOutput | null> {
    try {
        const params = new URLSearchParams({ topic, grade, language });
        return await apiFetch<LessonPlanOutput | null>(`/api/lesson-plan/cache?${params.toString()}`);
    } catch {
        return null; // Fail gracefully, fall back to AI
    }
}

/**
 * Saves a generated lesson plan to the shared cache. Best-effort — caching
 * failure never breaks the app.
 */
export async function saveLessonPlanToCache(
    plan: LessonPlanOutput,
    topic: string,
    grade: string,
    language: string,
): Promise<void> {
    try {
        await apiFetch('/api/lesson-plan/cache', {
            method: 'POST',
            body: { plan, topic, grade, language },
        });
    } catch {
        // Don't throw, just drop. Caching failure shouldn't break the app.
    }
}
