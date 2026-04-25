/**
 * Runtime AI persona pool.
 *
 * The static `AI_TEACHER_PERSONAS` array in ai-teacher-personas.ts is the
 * "founding teachers" — hand-authored deep profiles. This module adds a
 * Firestore-backed pool of generated personas that grows over time so the
 * community feed doesn't look like the same 24 names cycling forever.
 *
 * Storage: collection `ai_teacher_personas_runtime`, each doc keyed by id
 * (same shape as AITeacherPersona).
 *
 * Use `getAllPersonas()` everywhere we currently use AI_TEACHER_PERSONAS,
 * and `pickFromPool(pool, n, exclude)` everywhere we currently call
 * `pickRandomPersonas(n, exclude)`. This keeps the call sites simple
 * (sync helper that takes the already-loaded pool).
 */

import { AI_TEACHER_PERSONAS, AITeacherPersona } from './ai-teacher-personas';

const RUNTIME_COLLECTION = 'ai_teacher_personas_runtime';

let cached: { personas: AITeacherPersona[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 min — cron runs every 3h, plenty fresh

/**
 * Load static + runtime personas. Cached for 60 s to avoid a Firestore read
 * on every helper call within a single cron invocation.
 */
export async function getAllPersonas(): Promise<AITeacherPersona[]> {
    if (cached && Date.now() < cached.expiresAt) return cached.personas;

    const { getDb } = await import('./firebase-admin');
    const db = await getDb();

    const snap = await db.collection(RUNTIME_COLLECTION).get();
    const runtime = snap.docs
        .map((d) => d.data() as AITeacherPersona)
        // Defensive — discard malformed entries from older generator runs.
        .filter((p) => p && p.id && p.uid && p.displayName && p.primaryWritingLanguage);

    const all = [...AI_TEACHER_PERSONAS, ...runtime];
    cached = { personas: all, expiresAt: Date.now() + CACHE_TTL_MS };
    return all;
}

/**
 * Force-clear the cache. Used right after the grow-pool job writes new
 * personas so the next agent run sees them immediately.
 */
export function invalidatePersonaCache(): void {
    cached = null;
}

/**
 * Pick N random personas from a pre-loaded pool, optionally excluding ids.
 * Sync — the async work is loading the pool once at the top of a cron run.
 */
export function pickFromPool(
    pool: AITeacherPersona[],
    count: number,
    exclude: string[] = [],
): AITeacherPersona[] {
    const available = pool.filter((p) => !exclude.includes(p.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}
