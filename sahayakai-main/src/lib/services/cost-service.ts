import { dbAdapter } from '@/lib/db/adapter';
import { getDb } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { logger } from '../logger';
import { UsageMetricType } from '../usage-tracker';

const COSTS_COLLECTION = 'daily_costs';

export interface DailyCostRecord {
    date: string; // YYYY-MM-DD
    metrics: {
        gemini_tokens: number;
        tts_characters: number;
        image_generations: number;
        grounding_calls: number;
        firestore_writes: number;
        estimated_spend_usd: number;
    };
    updatedAt: Timestamp;
}

/**
 * Service to manage and aggregate daily operational costs.
 */
export const costService = {
    /**
     * Increment a specific metric for the current day.
     * This is an atomic operation using Firestore's increment().
     */
    async trackDailyUsage(type: UsageMetricType, value: number) {
        try {
            const db = await getDb();
            const today = new Date().toISOString().split('T')[0];
            const docRef = db.collection(COSTS_COLLECTION).doc(today);

            const fieldMap: Record<UsageMetricType, string> = {
                gemini_tokens: 'metrics.gemini_tokens',
                tts_characters: 'metrics.tts_characters',
                image_generation: 'metrics.image_generations',
                grounding_calls: 'metrics.grounding_calls',
                firestore_writes: 'metrics.firestore_writes'
            };

            const field = fieldMap[type];
            if (!field) return;

            // Atomic update to ensure accuracy under concurrent load
            await docRef.set({
                date: today,
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            await docRef.update({
                [field]: FieldValue.increment(value),
                'updatedAt': FieldValue.serverTimestamp()
            });

            // If it's Gemini, estimate spend (very rough: $0.10 per 1M tokens for Flash)
            if (type === 'gemini_tokens') {
                const estimatedCost = (value / 1000000) * 0.10;
                await docRef.update({
                    'metrics.estimated_spend_usd': FieldValue.increment(estimatedCost)
                });
            }
        } catch (error) {
            logger.error('Failed to update daily cost metrics', error, 'COST_SERVICE');
        }
    },

    async getDailyCosts(days: number = 7): Promise<DailyCostRecord[]> {
        try {
            const db = await getDb();
            const snapshot = await db.collection(COSTS_COLLECTION)
                .orderBy('date', 'desc')
                .limit(days)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as any));
        } catch (error) {
            logger.error('Failed to fetch daily costs', error, 'COST_SERVICE');
            return [];
        }
    }
};
