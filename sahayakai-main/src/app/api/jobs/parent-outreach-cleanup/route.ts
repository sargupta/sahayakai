/**
 * POST /api/jobs/parent-outreach-cleanup — Cron job: purge expired call transcripts
 *
 * A parent's voice-derived transcript + AI summary are the most sensitive data in
 * `parent_outreach`. DPDP Act 2023 storage-limitation: keep them only as long as
 * needed. Each record carries `transcriptExpiresAt` (set at call start, 90 days
 * out — see PARENT_OUTREACH_RETENTION_DAYS). This job strips the transcript and
 * other voice-derived PII from records whose window has passed, while keeping the
 * non-sensitive call metadata (status, duration, dates) the teacher still needs.
 *
 * Runs daily. Triggered by Cloud Scheduler with the CRON_SECRET bearer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { writeAuditLogBatch } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_LIMIT = 400;

// Voice-derived / contact PII cleared once the retention window passes. Kept as a
// single list so the wipe and the audit entry can never drift apart.
const PURGED_FIELDS = [
    'transcript',
    'callSummary',
    'generatedMessage',
    'teacherNote',
    'parentPhone',
    'performanceContext',
] as const;

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
        const { FieldValue } = await import('firebase-admin/firestore');
        const nowIso = new Date().toISOString();

        const snap = await db
            .collection('parent_outreach')
            .where('transcriptExpiresAt', '<=', nowIso)
            .limit(BATCH_LIMIT)
            .get();

        if (snap.empty) {
            logger.info('Parent outreach cleanup: nothing expired', 'JOBS');
            return NextResponse.json({ purged: 0 });
        }

        const batch = db.batch();
        const audited: { targetId: string; details?: Record<string, unknown> }[] = [];
        let purged = 0;
        for (const doc of snap.docs) {
            const data = doc.data();
            // Idempotency guard: skip records already stripped.
            if (data?.transcriptPurgedAt) continue;

            const clear: Record<string, unknown> = {
                transcriptPurgedAt: nowIso,
            };
            for (const f of PURGED_FIELDS) clear[f] = FieldValue.delete();
            batch.update(doc.ref, clear);

            audited.push({
                targetId: doc.id,
                details: {
                    fieldsCleared: [...PURGED_FIELDS],
                    transcriptExpiresAt: data?.transcriptExpiresAt ?? null,
                },
            });
            purged++;
        }

        if (purged === 0) {
            logger.info('Parent outreach cleanup: all candidates already purged', 'JOBS');
            return NextResponse.json({ purged: 0 });
        }

        await batch.commit();
        await writeAuditLogBatch('parent_outreach.purged', 'parent_outreach', 'job:parent-outreach-cleanup', audited);

        logger.info('Parent outreach cleanup complete', 'JOBS', { purged });
        return NextResponse.json({ purged });
    } catch (error) {
        logger.error('Parent outreach cleanup job failed', error, 'JOBS');
        return NextResponse.json({ error: 'Job failed' }, { status: 500 });
    }
}
