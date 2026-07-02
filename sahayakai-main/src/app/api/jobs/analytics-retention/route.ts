/**
 * POST /api/jobs/analytics-retention — Cron job: enforce 1-year analytics retention
 *
 * `analytics-consent.ts` promises users their detailed activity data is kept for
 * at most one year. That promise was never enforced — `scheduleDataDeletion` was
 * a TODO. This job is the enforcement: it deletes the per-day analytics aggregate
 * docs (`users/{uid}/analytics/{YYYY-MM-DD}`) older than the retention window and
 * writes one immutable audit entry per deleted doc so the erasure is provable.
 *
 * Runs daily. Triggered by Cloud Scheduler with the CRON_SECRET bearer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { writeAuditLogBatch } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RETENTION_DAYS = 365;
// Firestore caps a delete batch at 500; stay under it per run. The job is
// idempotent and runs daily, so a backlog drains over consecutive runs.
const BATCH_LIMIT = 400;

export async function POST(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = await getDb();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

        // collectionGroup spans every user's `analytics` subcollection. `lastUpdated`
        // is a serverTimestamp written on each aggregation, so it is the authoritative
        // "last touched" marker for the day-bucket.
        const snap = await db
            .collectionGroup('analytics')
            .where('lastUpdated', '<', cutoff)
            .limit(BATCH_LIMIT)
            .get();

        if (snap.empty) {
            logger.info('Analytics retention: nothing past cutoff', 'JOBS', {
                cutoff: cutoff.toISOString(),
            });
            return NextResponse.json({ deleted: 0, cutoff: cutoff.toISOString() });
        }

        const batch = db.batch();
        const audited: { targetId: string; details?: Record<string, unknown> }[] = [];
        for (const doc of snap.docs) {
            batch.delete(doc.ref);
            // doc.ref.path = users/{uid}/analytics/{YYYY-MM-DD}
            audited.push({ targetId: doc.ref.path, details: { bucket: doc.id } });
        }
        await batch.commit();

        await writeAuditLogBatch('analytics.purged', 'analytics_daily', 'job:analytics-retention', audited);

        logger.info('Analytics retention complete', 'JOBS', {
            deleted: snap.size,
            cutoff: cutoff.toISOString(),
        });

        return NextResponse.json({ deleted: snap.size, cutoff: cutoff.toISOString() });
    } catch (error) {
        logger.error('Analytics retention job failed', error, 'JOBS');
        return NextResponse.json({ error: 'Job failed' }, { status: 500 });
    }
}
