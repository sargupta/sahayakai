/**
 * Data-lifecycle audit trail.
 *
 * DPDP Act 2023 storage-limitation + accountability: a stated retention or
 * erasure commitment is only verifiable if something records that it actually
 * happened. Every automated purge / anonymisation writes one immutable entry
 * here so a regulator (or the operator) can later prove WHEN data was removed,
 * WHAT was removed, and WHICH job did it.
 *
 * Writes are best-effort: an audit-log failure must never abort the lifecycle
 * action it is recording (we would rather purge-without-log than skip a purge),
 * so callers do not need to wrap this in try/catch.
 */

import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export type AuditAction =
    | 'account.anonymized'
    | 'analytics.purged'
    | 'parent_outreach.purged'
    | 'community_chat.purged'
    | 'storage.deleted';

export interface AuditLogEntry {
    /** What happened. */
    action: AuditAction;
    /** The kind of record acted on (e.g. 'user', 'parent_outreach', 'gcs_object'). */
    targetType: string;
    /** The id / path of the record acted on. */
    targetId: string;
    /** Who triggered it — usually the cron job name or 'system'. */
    actor: string;
    /** Optional structured context (counts, fields cleared, cutoff date, …). */
    details?: Record<string, unknown>;
}

const AUDIT_COLLECTION = 'audit_log';

/**
 * Append one immutable audit entry. Never throws.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
        const db = await getDb();
        await db.collection(AUDIT_COLLECTION).add({
            ...entry,
            details: entry.details ?? {},
            at: new Date().toISOString(),
        });
    } catch (err) {
        // Surface to Cloud Logging but do not propagate — the lifecycle action
        // is more important than its receipt.
        logger.error('Failed to write audit-log entry', err, 'AUDIT', {
            action: entry.action,
            targetId: entry.targetId,
        });
    }
}

/**
 * Batch helper — records one entry per target with a shared action/actor.
 * Used by cleanup jobs that purge many docs in a single run.
 */
export async function writeAuditLogBatch(
    action: AuditAction,
    targetType: string,
    actor: string,
    targets: { targetId: string; details?: Record<string, unknown> }[],
): Promise<void> {
    if (targets.length === 0) return;
    try {
        const db = await getDb();
        const at = new Date().toISOString();
        // Firestore caps a batch at 500 writes; chunk to stay under it.
        for (let i = 0; i < targets.length; i += 450) {
            const slice = targets.slice(i, i + 450);
            const batch = db.batch();
            for (const t of slice) {
                const ref = db.collection(AUDIT_COLLECTION).doc();
                batch.set(ref, {
                    action,
                    targetType,
                    targetId: t.targetId,
                    actor,
                    details: t.details ?? {},
                    at,
                });
            }
            await batch.commit();
        }
    } catch (err) {
        logger.error('Failed to write audit-log batch', err, 'AUDIT', { action, count: targets.length });
    }
}
