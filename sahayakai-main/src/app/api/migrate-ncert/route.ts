/**
 * POST /api/migrate-ncert
 *
 * One-off / occasional migration that (re)seeds the `ncert_curriculum`
 * collection from the bundled NCERT dataset. This is a DESTRUCTIVE bulk write
 * (overwrites curated curriculum docs), so it is gated behind CRON_SECRET and
 * fails closed. Trigger manually with:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" <host>/api/migrate-ncert
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { allNCERTChapters } from '@/data/ncert';
import { logger } from '@/lib/logger';
import { requireCronAuth } from '@/lib/cron-auth';

export async function POST(request: Request) {
    const denied = requireCronAuth(request);
    if (denied) return denied;

    try {
        const db = await getDb();
        const batch = db.batch();
        let count = 0;

        for (const chapter of allNCERTChapters) {
            const docRef = db.collection('ncert_curriculum').doc(chapter.id);
            batch.set(docRef, chapter);
            count++;
        }

        await batch.commit();
        return NextResponse.json({ success: true, count, message: 'Migration completed successfully' });
    } catch (error) {
        logger.error('Migration failed', error, 'MIGRATION');
        // Do not leak internal error detail to the caller.
        return NextResponse.json({ success: false, error: 'Migration failed' }, { status: 500 });
    }
}
