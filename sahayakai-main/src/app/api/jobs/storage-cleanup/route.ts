/**
 * POST /api/jobs/storage-cleanup
 *
 * Receives Pub/Sub push messages for GCS file cleanup after content soft-deletion.
 * Also accepts direct invocation by Cloud Scheduler for any manual / scheduled runs.
 *
 * Pub/Sub push subscription delivers messages as:
 *   { message: { data: "<base64-encoded-json>" }, subscription: "..." }
 *
 * Authentication: Cloud Scheduler adds an `Authorization: Bearer <OIDC-token>` header
 * which Cloud Run validates automatically. For Pub/Sub push, add the service-account
 * audience to the push subscription config in the GCP console.
 *
 * Setup (run once in GCP):
 *   gcloud pubsub topics create sahayakai-storage-cleanup
 *   gcloud pubsub subscriptions create sahayakai-storage-cleanup-push \
 *     --topic=sahayakai-storage-cleanup \
 *     --push-endpoint=https://<your-app>/api/jobs/storage-cleanup \
 *     --ack-deadline=60 \
 *     --max-delivery-attempts=5 \
 *     --dead-letter-topic=sahayakai-storage-cleanup-dlq
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { StorageCleanupMessage } from '@/lib/pubsub';

export const maxDuration = 60; // seconds

export async function POST(request: Request) {
    try {
        const body = await request.json();

        let message: StorageCleanupMessage;

        // Pub/Sub push format: { message: { data: "<base64>" }, subscription: "..." }
        if (body?.message?.data) {
            const decoded = Buffer.from(body.message.data, 'base64').toString('utf8');
            message = JSON.parse(decoded) as StorageCleanupMessage;
        } else if (body?.storagePath) {
            // Direct invocation (e.g. Cloud Scheduler or manual POST for testing)
            message = body as StorageCleanupMessage;
        } else {
            return NextResponse.json({ error: 'Unrecognised payload shape' }, { status: 400 });
        }

        const { storagePath, userId, contentId } = message;

        if (!storagePath) {
            // Nothing to clean up — acknowledge the message
            return NextResponse.json({ ok: true, skipped: true });
        }

        const { getStorageInstance } = await import('@/lib/firebase-admin');
        const storage = await getStorageInstance();

        try {
            await storage.bucket().file(storagePath).delete();
            logger.info('GCS cleanup succeeded', 'STORAGE', { userId, contentId, storagePath });
        } catch (err: any) {
            // 404 means the file was already deleted — treat as success
            if (err?.code === 404) {
                logger.info('GCS cleanup: file already absent', 'STORAGE', { userId, contentId, storagePath });
            } else {
                // Re-throw so Pub/Sub retries (nack)
                throw err;
            }
        }

        return NextResponse.json({ ok: true });

    } catch (error) {
        logger.error('Storage cleanup job failed', error, 'STORAGE_JOB');
        // Return 500 so Pub/Sub retries the message up to the configured max-delivery-attempts
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
