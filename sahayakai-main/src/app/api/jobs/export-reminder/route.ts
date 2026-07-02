/**
 * POST /api/jobs/export-reminder — Cron job: remind cancelling users to export
 *
 * Runs daily. Finds users in cancellation grace period who haven't exported,
 * and sends reminder notifications at day 1, 7, 21, and 28.
 *
 * Triggered by Cloud Scheduler or cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { writeAuditLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

const REMINDER_DAYS = [1, 7, 21, 28]; // Days after cancellation to send reminders

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret — required regardless of NODE_ENV (F12-P1-04).
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const now = new Date();

    // Find users with active grace periods
    const snap = await db.collection('users')
      .where('cancellation.gracePeriodEnd', '>', now.toISOString())
      .where('cancellation.dataExported', '==', false)
      .limit(100)
      .get();

    let remindersQueued = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const gracePeriodStart = new Date(data.cancellation.gracePeriodStart);
      const daysSinceCancellation = Math.floor(
        (now.getTime() - gracePeriodStart.getTime()) / (24 * 60 * 60 * 1000)
      );
      const remindersSent = data.cancellation.remindersSent || 0;

      // Check if we should send a reminder today
      const shouldRemind = REMINDER_DAYS.some(
        (day, index) => daysSinceCancellation >= day && remindersSent <= index
      );

      if (shouldRemind) {
        const daysRemaining = 30 - daysSinceCancellation;

        // Create notification
        await db.collection('users').doc(doc.id).collection('notifications').add({
          type: 'SYSTEM',
          title: 'Download Your Content',
          message: `Your SahayakAI data will be available for ${daysRemaining} more days. Download everything now from Settings > Export Data.`,
          isRead: false,
          createdAt: now.toISOString(),
        });

        // Update reminder count
        await db.collection('users').doc(doc.id).update({
          'cancellation.remindersSent': remindersSent + 1,
        });

        remindersQueued++;
      }
    }

    // Also handle expired grace periods — anonymize data
    const expiredSnap = await db.collection('users')
      .where('cancellation.gracePeriodEnd', '<=', now.toISOString())
      .where('cancellation.dataExported', '==', false)
      .limit(50)
      .get();

    // PII fields wiped on anonymisation. Kept as a single list so the wipe,
    // the verification re-read, and the audit entry can never drift apart.
    const PII_FIELDS = ['displayName', 'email', 'photoURL', 'schoolName', 'district', 'pincode', 'bio'] as const;

    let anonymized = 0;
    let verificationFailures = 0;
    for (const doc of expiredSnap.docs) {
      // Idempotency guard (F12-P1-04): skip already-anonymized users.
      const docData = doc.data();
      if (docData?.cancellation?.anonymized === true) {
        continue;
      }
      const anonEmail = `anonymized_${doc.id.slice(0, 8)}@sahayakai.app`;
      // Anonymize profile but keep content in read-only mode
      await doc.ref.update({
        'cancellation.anonymized': true,
        'cancellation.anonymizedAt': now.toISOString(),
        displayName: 'Former Teacher',
        email: anonEmail,
        photoURL: null,
        schoolName: null,
        district: null,
        pincode: null,
        bio: null,
      });

      // End-to-end verification: re-read the doc and confirm every PII field
      // is actually cleared before we treat the erasure as complete. Without
      // this, a partial write would leave residual PII that nobody notices.
      const after = (await doc.ref.get()).data() ?? {};
      const residualPII = PII_FIELDS.filter((f) => {
        if (f === 'displayName') return after.displayName !== 'Former Teacher';
        if (f === 'email') return after.email !== anonEmail;
        return after[f] !== null && after[f] !== undefined;
      });
      const verified = residualPII.length === 0;
      if (!verified) {
        verificationFailures++;
        logger.error('Anonymisation verification failed — residual PII remains', undefined, 'JOBS', {
          userId: doc.id, residualPII,
        });
      }

      // Immutable audit trail: prove WHEN this user was anonymised, WHAT was
      // cleared, and whether the post-write verification passed.
      await writeAuditLog({
        action: 'account.anonymized',
        targetType: 'user',
        targetId: doc.id,
        actor: 'job:export-reminder',
        details: {
          fieldsCleared: [...PII_FIELDS],
          verified,
          residualPII,
          gracePeriodEnd: docData?.cancellation?.gracePeriodEnd ?? null,
        },
      });
      anonymized++;
    }

    logger.info('Export reminder job completed', 'JOBS', {
      usersChecked: snap.size,
      remindersQueued,
      anonymized,
      verificationFailures,
    });

    return NextResponse.json({
      usersChecked: snap.size,
      remindersQueued,
      expiredAnonymized: anonymized,
      verificationFailures,
    });

  } catch (error) {
    logger.error('Export reminder job failed', error, 'JOBS');
    return NextResponse.json({ error: 'Job failed' }, { status: 500 });
  }
}
