'use server';

import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth-helpers';

/**
 * Persist a batch of telemetry events from the client.
 *
 * Wave 1 hardening:
 * - Gated to authenticated users (was wide open — anyone could spam telemetry
 *   collection or DOS the Firestore writes).
 * - Stamps the authenticated uid on every event server-side so clients can't
 *   lie about whose actions they are.
 * - Caps batch size at 500 (was already enforced; left as-is).
 */
export async function syncTelemetryEvents(events: any[]) {
    let userId: string;
    try {
        userId = await requireAuth();
    } catch {
        // Anonymous telemetry not supported — silently drop. Returning success
        // keeps the client's offline queue happy without revealing the auth gate.
        return { success: true, count: 0 };
    }

    if (!Array.isArray(events) || events.length === 0) {
        return { success: true, count: 0 };
    }

    try {
        const db = await getDb();
        const batch = db.batch();

        // Cap at 500 (Firestore batch limit).
        const chunk = events.slice(0, 500);

        chunk.forEach(event => {
            const docRef = db.collection('telemetry_events').doc();
            batch.set(docRef, {
                ...event,
                // Server-stamped fields override anything the client supplied.
                userId,
                syncedAt: new Date().toISOString(),
            });
        });

        await batch.commit();
        return { success: true, count: chunk.length };
    } catch (error) {
        logger.error("Telemetry sync error", error, 'TELEMETRY', { userId });
        return { success: false };
    }
}
