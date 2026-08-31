/**
 * NCERT curriculum domain service — tranche 5 API-boundary migration.
 *
 * Logic moved verbatim from src/app/actions/ncert.ts (deleted). The
 * /api/ncert/chapters route is the thin shell; auth (Wave 1 gate against
 * anonymous scraping / DOS) is enforced there via the middleware-verified
 * x-user-id header.
 *
 * Reads NCERT_CHAPTERS — the collection the seed script writes. Until 2026-08
 * this queried `ncert_curriculum`, which nothing had written since before the
 * NCF-2023 refresh, so the API served pre-NCF chapters over the corrected
 * static data. Import the collection constant; never inline the string.
 */

import { getDb } from '@/lib/firebase-admin';
import { NCERTChapter, type ChapterBoard } from '@/data/ncert';
import { NCERT_CHAPTERS } from '@/lib/ncert/collections';
import { logger } from '@/lib/logger';

/**
 * Fetches NCERT chapters from Firestore.
 * Falls back to empty array if DB fails (client should handle fallback).
 *
 * Retired chapters (`isActive: false`) are filtered out in memory rather than
 * in the query, so a document written before the field existed still shows.
 */
export async function getNCERTChapters(
    grade: number,
    subject?: string,
    board?: ChapterBoard,
): Promise<NCERTChapter[]> {
    try {
        const db = await getDb();
        let query = db.collection(NCERT_CHAPTERS).where('grade', '==', grade);

        if (subject) {
            query = query.where('subject', '==', subject);
        }
        if (board) {
            query = query.where('board', '==', board);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            return [];
        }

        return snapshot.docs
            .map(doc => doc.data() as NCERTChapter)
            .filter(c => c.isActive !== false)
            .sort((a, b) => a.number - b.number);

    } catch (error) {
        logger.error("Error fetching NCERT chapters from DB", error, 'NCERT', { grade, subject, board });
        return [];
    }
}
