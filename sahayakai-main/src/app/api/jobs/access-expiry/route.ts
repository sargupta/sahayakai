/**
 * POST /api/jobs/access-expiry — nightly access-gate housekeeping.
 *
 *   1. Expire pilot organizations whose end date has passed and return their
 *      members to their base access state.
 *   2. Tidy individual grants whose expiry has passed.
 *   3. Run the anomaly scan and raise flags for review.
 *
 * Members are already cut off at the edge by their `accessExp` claim; this
 * job brings the stored state in line and is safe to re-run at any time.
 *
 * Triggered by Cloud Scheduler with the CRON_SECRET bearer (same contract as
 * the other /api/jobs routes). Suggested schedule: daily, 02:30 IST.
 * Runbook: docs/ACCESS_GATE_RUNBOOK.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { detectAccessAnomalies } from '@/lib/access/anomaly';
import { expireDuePilotOrganizations, expireDueUserGrants } from '@/lib/access/pilots';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
    // Verify cron secret — required regardless of NODE_ENV (F12-P1-04).
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    try {
        const organizations = await expireDuePilotOrganizations(now);
        const users = await expireDueUserGrants(now);

        // The anomaly scan is advisory; its failure must not fail the expiry run.
        let anomalies: Awaited<ReturnType<typeof detectAccessAnomalies>> | { error: string };
        try {
            anomalies = await detectAccessAnomalies(now);
        } catch (err) {
            logger.error('Access anomaly scan failed', err, 'ACCESS');
            anomalies = { error: 'anomaly scan failed' };
        }

        logger.info('Access expiry job completed', 'ACCESS', { organizations, users, anomalies });
        return NextResponse.json({ ok: true, organizations, users, anomalies });
    } catch (err) {
        logger.error('Access expiry job failed', err, 'ACCESS');
        return NextResponse.json({ error: 'Job failed' }, { status: 500 });
    }
}
