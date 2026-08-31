/**
 * Firestore collection names for curriculum data — one definition, imported by
 * every reader and writer.
 *
 * Until 2026-08 the seed script wrote `ncert_chapters` while the read path
 * (`@/server/ncert`, behind /api/ncert/chapters) and /api/migrate-ncert queried
 * `ncert_curriculum`. Nothing read what the seed wrote, so every syllabus
 * correction shipped through the seed script verified green in CI and changed
 * nothing for a teacher, while `ncert_curriculum` kept serving a pre-NCF
 * snapshot. Import these constants rather than writing the string, so a future
 * divergence is a compile error instead of a silent one.
 *
 * `ncert_curriculum` is retained as NCERT_CHAPTERS_LEGACY only so the migration
 * script can drain it. Nothing else may read it.
 */

export const NCERT_CHAPTERS = 'ncert_chapters' as const;
export const NCERT_TEXTBOOKS = 'ncert_textbooks' as const;

/** @deprecated Pre-2026-08 read collection. Drain and delete; never query. */
export const NCERT_CHAPTERS_LEGACY = 'ncert_curriculum' as const;
