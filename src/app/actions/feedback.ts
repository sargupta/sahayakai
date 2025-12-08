'use server';

import { getDb } from '@/lib/firebase-admin';

export async function submitFeedback(planId: string, rating: 'thumbs-up' | 'thumbs-down', comment?: string) {
    try {
        const db = await getDb();
        await db.collection('lesson_feedback').add({
            planId, // This could be the cache key or a generated ID
            rating,
            comment,
            createdAt: new Date().toISOString(),
        });
        return { success: true };
    } catch (error) {
        console.error("Feedback submission error", error);
        return { success: false };
    }
}
