'use server';

import { getDb } from '@/lib/firebase-admin';
import { NCERTChapter } from '@/data/ncert';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth-helpers';

/**
 * Fetches NCERT chapters from Firestore.
 * Falls back to empty array if DB fails (client should handle fallback).
 *
 * Wave 1: gated to authenticated users. Curriculum data is public domain but
 * the auth gate prevents anonymous scraping / DOS.
 */
export async function getNCERTChapters(grade: number, subject?: string): Promise<NCERTChapter[]> {
    try {
        await requireAuth();
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
