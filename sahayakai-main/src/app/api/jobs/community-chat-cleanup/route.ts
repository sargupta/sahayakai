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
import { writeAuditLogBatch } from '@/lib/audit-log';

export const maxDuration = 60;

const RETENTION_DAYS = 90;

export async function POST(request: Request) {
    // Auth gate: CRON_SECRET required.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

        // F12-P1-08: schema migrated to `createdAt` (Timestamp). Query by `createdAt`
        // using a Date cutoff. Legacy docs that only have `timestamp` are handled by
        // the backfill script: scripts/migrate-community-chat-timestamp-to-createdat.ts
        const snapshot = await db
            .collection('community_chat')
            .where('createdAt', '<', cutoff)
            .limit(500) // Firestore batch delete limit
            .get();

        if (snapshot.empty) {
            logger.info('Community chat cleanup: no old messages', 'CHAT_CLEANUP');
            return NextResponse.json({ ok: true, deleted: 0 });
        }

        const batch = db.batch();
        const audited: { targetId: string; details?: Record<string, unknown> }[] = [];
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            audited.push({ targetId: doc.id });
        });
        await batch.commit();

        await writeAuditLogBatch(
            'community_chat.purged',
            'community_chat',
            'job:community-chat-cleanup',
            audited,
        );

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
