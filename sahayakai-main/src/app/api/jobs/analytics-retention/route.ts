/**
 * POST /api/jobs/analytics-retention
 *
 * DPDP data-minimisation: deletes per-user daily activity-analytics docs
 * (`users/{uid}/analytics/{YYYY-MM-DD}`) older than the retention window.
 * The consent screen tells teachers their detailed activity data is kept for
 * one year (`data_retention_acknowledged`); until now nothing enforced that
 * promise — src/lib/analytics-consent.ts scheduleDataDeletion() was an empty
 * stub. This job is the enforcement.
 *
 * Runs daily via Cloud Scheduler (same OIDC/CRON_SECRET pattern as the other
 * jobs in this directory). Because Firestore caps a batch delete at 500 and a
 * single day can accumulate more than that across all users, the job drains
 * up to MAX_BATCHES per invocation; a daily cadence clears any backlog within
 * a few days and then holds steady.
 *
 * Cloud Scheduler setup (run once in GCP):
 *   gcloud scheduler jobs create http sahayakai-analytics-retention \
 *     --schedule="30 2 * * *" \
 *     --uri="https://<your-app>/api/jobs/analytics-retention" \
 *     --http-method=POST \
 *     --headers="Authorization=Bearer <CRON_SECRET>" \
 *     --location=asia-south1
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const maxDuration = 300;

// Matches the consent copy: "data kept for 1 year". FOUNDER-TUNABLE — keep in
// sync with the retention table in docs/compliance/DPDP_DATA_PROTECTION.md and
// the consent screen (data_retention_acknowledged).
const RETENTION_DAYS = 365;
const BATCH_SIZE = 500;
const MAX_BATCHES = 20; // ≤10k deletions per run — bounded work under maxDuration

export async function POST(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

        let deleted = 0;
        let batches = 0;
        // Collection-group query across every user's `analytics` subcollection.
        // Needs the COLLECTION_GROUP index on `lastUpdated` (firestore.indexes.json).
        for (; batches < MAX_BATCHES; batches++) {
            const snapshot = await db
                .collectionGroup('analytics')
                .where('lastUpdated', '<', cutoff)
                .limit(BATCH_SIZE)
                .get();

            if (snapshot.empty) break;

            const batch = db.batch();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
            deleted += snapshot.size;

            if (snapshot.size < BATCH_SIZE) break; // drained
        }

        const drained = batches < MAX_BATCHES;
        logger.info('Analytics retention sweep complete', 'ANALYTICS_RETENTION', {
            deleted,
            batches,
            drained, // false ⇒ more remain; next daily run continues
            retentionDays: RETENTION_DAYS,
            cutoffDate: cutoff.toISOString(),
        });

        return NextResponse.json({ ok: true, deleted, drained });
    } catch (error) {
        logger.error('Analytics retention job failed', error, 'ANALYTICS_RETENTION');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
