/**
 * POST /api/migrate-ncert
 *
 * One-off / occasional migration that (re)seeds NCERT_CHAPTERS from the bundled
 * dataset and retires the legacy `ncert_curriculum` collection, which nothing
 * reads as of 2026-08. This is a DESTRUCTIVE bulk write (overwrites curated
 * curriculum docs), so it is gated behind CRON_SECRET and fails closed.
 * Trigger manually with:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" <host>/api/migrate-ncert
 *
 * Prefer `npx tsx --env-file=.env.local src/scripts/seed-ncert.ts`, which also
 * reconciles removed chapters and seeds the textbook records. This route exists
 * for environments where the script cannot be run.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { allNCERTChapters, boardOf } from '@/data/ncert';
import { NCERT_CHAPTERS, NCERT_CHAPTERS_LEGACY } from '@/lib/ncert/collections';
import { logger } from '@/lib/logger';
import { requireCronAuth } from '@/lib/cron-auth';

const BATCH_SIZE = 400; // Firestore caps a batch at 500

export async function POST(request: Request) {
    const denied = requireCronAuth(request);
    if (denied) return denied;

    try {
        const db = await getDb();
        let count = 0;

        while (count < allNCERTChapters.length) {
            const slice = allNCERTChapters.slice(count, count + BATCH_SIZE);
            const batch = db.batch();
            for (const chapter of slice) {
                batch.set(
                    db.collection(NCERT_CHAPTERS).doc(chapter.id),
                    { ...chapter, board: boardOf(chapter), isActive: chapter.isActive ?? true },
                    { merge: true },
                );
            }
            await batch.commit();
            count += slice.length;
        }

        // Retire the legacy collection in place rather than deleting it, so a
        // stale reader — if one is ever reintroduced — gets nothing rather than
        // pre-NCF chapters. Deleting the documents is a separate, manual call.
        const legacy = await db.collection(NCERT_CHAPTERS_LEGACY).select().get();
        let retired = 0;
        while (retired < legacy.docs.length) {
            const slice = legacy.docs.slice(retired, retired + BATCH_SIZE);
            const batch = db.batch();
            for (const doc of slice) {
                batch.set(doc.ref, { isActive: false, retiredReason: 'legacy-collection' }, { merge: true });
            }
            await batch.commit();
            retired += slice.length;
        }

        return NextResponse.json({
            success: true,
            count,
            legacyRetired: retired,
            message: 'Migration completed successfully',
        });
    } catch (error) {
        logger.error('Migration failed', error, 'MIGRATION');
        // Do not leak internal error detail to the caller.
        return NextResponse.json({ success: false, error: 'Migration failed' }, { status: 500 });
    }
}
