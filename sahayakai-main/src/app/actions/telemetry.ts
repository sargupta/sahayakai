'use server';

import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export async function syncTelemetryEvents(events: any[]) {
    try {
        const db = await getDb();
        const batch = db.batch();

        // Limit batch size to 500 just in case
        const chunk = events.slice(0, 500);

        chunk.forEach(event => {
            const docRef = db.collection('telemetry_events').doc();
            batch.set(docRef, {
                ...event,
                syncedAt: new Date().toISOString(),
            });
        });

        await batch.commit();
        return { success: true, count: chunk.length };
    } catch (error) {
        logger.error("Telemetry sync error", error, 'TELEMETRY');
        return { success: false };
    }
}
