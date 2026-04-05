/**
 * POST /api/jobs/community-chat-cleanup
 *
 * Deletes community_chat messages older than 90 days.
 * Intended to run daily via Cloud Scheduler.
 *
 * Cloud Scheduler setup (run once in GCP):
 *   gcloud scheduler jobs create http sahayakai-community-chat-cleanup \
 *     --schedule="0 2 * * *" \
 *     --uri="https://<your-app>/api/jobs/community-chat-cleanup" \
 *     --http-method=POST \
 *     --oidc-service-account-email=<service-account>@<project>.iam.gserviceaccount.com \
 *     --oidc-token-audience="https://<your-app>" \
 *     --location=asia-south1
 *
 * Authentication: Cloud Scheduler adds an OIDC token which Cloud Run validates automatically.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

const RETENTION_DAYS = 90;

export async function POST(request: Request) {
    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

        const snapshot = await db
            .collection('community_chat')
            .where('timestamp', '<', cutoff.toISOString())
            .limit(500) // Firestore batch delete limit
            .get();

        if (snapshot.empty) {
            logger.info('Community chat cleanup: no old messages', 'CHAT_CLEANUP');
            return NextResponse.json({ ok: true, deleted: 0 });
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        logger.info('Community chat cleanup complete', 'CHAT_CLEANUP', {
            deleted: snapshot.size,
            cutoffDate: cutoff.toISOString(),
        });

        return NextResponse.json({ ok: true, deleted: snapshot.size });

    } catch (error) {
        logger.error('Community chat cleanup job failed', error, 'CHAT_CLEANUP');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
