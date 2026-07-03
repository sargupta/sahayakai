/**
 * NCERT curriculum domain service — tranche 5 API-boundary migration.
 *
 * Logic moved verbatim from src/app/actions/ncert.ts (deleted). The
 * /api/ncert/chapters route is the thin shell; auth (Wave 1 gate against
 * anonymous scraping / DOS) is enforced there via the middleware-verified
 * x-user-id header.
 */

import { getDb } from '@/lib/firebase-admin';
import { NCERTChapter } from '@/data/ncert';
import { logger } from '@/lib/logger';

/**
 * Fetches NCERT chapters from Firestore.
 * Falls back to empty array if DB fails (client should handle fallback).
 */
export async function getNCERTChapters(grade: number, subject?: string): Promise<NCERTChapter[]> {
    try {
        const db = await getDb();
        let query = db.collection('ncert_curriculum').where('grade', '==', grade);

        if (subject) {
            query = query.where('subject', '==', subject);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            return [];
        }

        // Sort by chapter number
        return snapshot.docs
            .map(doc => doc.data() as NCERTChapter)
            .sort((a, b) => a.number - b.number);

    } catch (error) {
        logger.error("Error fetching NCERT chapters from DB", error, 'NCERT', { grade, subject });
        return [];
    }
}
