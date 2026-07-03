/**
 * Moderation domain service — block/report v1 (tranche 6/7 trust & safety).
 *
 * Closes the systemic gap flagged by the 2026-07-02 security audit and the
 * 14-agent design review: a teacher social network with DMs had NO
 * block/report recourse.
 *
 * Data model:
 *   users/{uid}/blocks/{blockedUid}  — { blockedUid, createdAt } (owner-private)
 *   reports/{autoId}                 — { reporterId, targetType, targetId,
 *                                        reason, freeText, status, createdAt }
 *                                      (create via API only; admin reads via
 *                                      Admin SDK — no client read path)
 *
 * Every function takes the trusted `userId` derived by the API route from the
 * middleware-verified `x-user-id` header (docs/API_MIGRATION_PATTERN.md).
 * This module NEVER trusts a client-supplied identity.
 *
 * Enforcement points that consume this module:
 *   - src/server/messages.ts   → sendMessage / getOrCreateDirectConversation
 *     reject with the deliberately DIRECTION-NEUTRAL error
 *     'Cannot message this user' (never reveal who blocked whom).
 *   - src/server/community.ts  → feed reads filter out content authored by
 *     users the CALLER has blocked (read-time filter, caller's view only).
 */
import { getDb } from '@/lib/firebase-admin';
import { dbAdapter } from '@/lib/db/adapter';
import { logger } from '@/lib/logger';

export const REPORT_TARGET_TYPES = ['message', 'post', 'profile', 'resource'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = ['harassment', 'inappropriate', 'spam', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_FREETEXT_MAX = 500;
export const REPORTS_PER_DAY = 10;

// Bound the block list so a runaway client can't grow an unbounded
// subcollection scan on every feed read.
const MAX_BLOCKS = 500;

export interface BlockedUser {
    blockedUid: string;
    createdAt: string | null;
    displayName: string;
    photoURL: string | null;
}

// ── blockUser / unblockUser / listBlocks ────────────────────────────────────

export async function blockUser(callerId: string, blockedUid: string): Promise<void> {
    try {
        if (typeof blockedUid !== 'string' || !blockedUid.trim() || blockedUid.length > 128) {
            throw new Error('Invalid user id');
        }
        if (blockedUid === callerId) throw new Error('Cannot block yourself');

        const db = await getDb();
        // Idempotent set — re-blocking is a no-op. The blocked user is NEVER
        // notified (dignity-first: no side-effects visible to the other side).
        await db
            .collection('users').doc(callerId)
            .collection('blocks').doc(blockedUid)
            .set({ blockedUid, createdAt: new Date().toISOString() });
    } catch (err) {
        logger.error('blockUser failed', err, 'MODERATION', { userId: callerId });
        throw err;
    }
}

export async function unblockUser(callerId: string, blockedUid: string): Promise<void> {
    try {
        if (typeof blockedUid !== 'string' || !blockedUid.trim() || blockedUid.length > 128) {
            throw new Error('Invalid user id');
        }
        const db = await getDb();
        await db
            .collection('users').doc(callerId)
            .collection('blocks').doc(blockedUid)
            .delete();
    } catch (err) {
        logger.error('unblockUser failed', err, 'MODERATION', { userId: callerId });
        throw err;
    }
}

/**
 * List the caller's blocked users, hydrated with public display name/photo
 * so the blocked-users management UI can render without extra round-trips.
 * Only public-safe fields leave this function (no email/phone/plan).
 */
export async function listBlocks(callerId: string): Promise<BlockedUser[]> {
    try {
        const db = await getDb();
        const snap = await db
            .collection('users').doc(callerId)
            .collection('blocks')
            .limit(MAX_BLOCKS)
            .get();

        const rows = snap.docs.map((d) => ({
            blockedUid: (d.data()?.blockedUid as string) ?? d.id,
            createdAt: (d.data()?.createdAt as string) ?? null,
        }));
        if (rows.length === 0) return [];

        // Hydrate names in batches of 10 (Firestore 'in' query limit inside
        // dbAdapter.getUsers — same convention as messages.ts).
        const uids = rows.map((r) => r.blockedUid);
        const batches: Promise<any[]>[] = [];
        for (let i = 0; i < uids.length; i += 10) {
            batches.push(dbAdapter.getUsers(uids.slice(i, i + 10)));
        }
        const profiles = (await Promise.all(batches)).flat();
        const byUid = new Map<string, any>(profiles.map((p: any) => [p.uid ?? p.id, p]));

        return rows.map((r) => {
            const p = byUid.get(r.blockedUid);
            return {
                blockedUid: r.blockedUid,
                createdAt: r.createdAt,
                displayName: p?.displayName ?? 'Teacher',
                photoURL: p?.photoURL ?? null,
            };
        });
    } catch (err) {
        logger.error('listBlocks failed', err, 'MODERATION', { userId: callerId });
        throw err;
    }
}

// ── Enforcement helpers ──────────────────────────────────────────────────────

/**
 * True when either user has blocked the other. Used by the messaging write
 * path — errors propagate (fail CLOSED is acceptable there: the same request
 * performs other Firestore reads that would fail identically).
 */
export async function isBlockedEitherWay(uidA: string, uidB: string): Promise<boolean> {
    const db = await getDb();
    const [ab, ba] = await Promise.all([
        db.collection('users').doc(uidA).collection('blocks').doc(uidB).get(),
        db.collection('users').doc(uidB).collection('blocks').doc(uidA).get(),
    ]);
    return ab.exists || ba.exists;
}

/**
 * Set of uids the given user has blocked. Used by feed read-time filters.
 * Fails OPEN (empty set) on infrastructure errors so a moderation-store
 * hiccup can never blank the community feed — availability over filtering
 * on the read path only.
 */
export async function getBlockedUidSet(userId: string): Promise<Set<string>> {
    try {
        const db = await getDb();
        const snap = await db
            .collection('users').doc(userId)
            .collection('blocks')
            .limit(MAX_BLOCKS)
            .get();
        return new Set(snap.docs.map((d) => d.id));
    } catch (err) {
        logger.error('getBlockedUidSet failed (failing open)', err, 'MODERATION', { userId });
        return new Set();
    }
}

// ── reportContent ────────────────────────────────────────────────────────────

// Calendar-day (IST) report cap — mirrors the checkImageRateLimit pattern in
// src/lib/server-safety.ts (same `rate_limits` collection, `{date, count}`
// doc shape, midnight-IST reset, fail-open on infra errors). Kept local so
// the limit and the message live next to the feature they protect.
function getTodayIST(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

async function checkReportRateLimit(userId: string): Promise<void> {
    try {
        const db = await getDb();
        const limitRef = db.collection('rate_limits').doc(`${userId}_report`);
        const today = getTodayIST();

        const doc = await limitRef.get();
        let count = 0;
        if (doc.exists) {
            const data = doc.data();
            count = data?.date === today ? (data?.count ?? 0) : 0;
        }

        if (count >= REPORTS_PER_DAY) {
            throw new Error(`Rate limit exceeded. You can submit up to ${REPORTS_PER_DAY} reports per day.`);
        }

        await limitRef.set({ date: today, count: count + 1 });
    } catch (error: any) {
        if (error?.message?.startsWith('Rate limit exceeded')) throw error;
        // Fail open on infrastructure errors — a rate-limit hiccup must not
        // silence abuse reporting.
        logger.error('Report rate-limit check failed (failing open)', error, 'MODERATION', { userId });
    }
}

export interface ReportContentInput {
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    freeText?: string;
}

export async function reportContent(
    reporterId: string,
    { targetType, targetId, reason, freeText }: ReportContentInput,
): Promise<{ reportId: string }> {
    try {
        // Defense-in-depth validation (the route Zod-parses first, but this
        // module must stay safe if called from other server code).
        if (!REPORT_TARGET_TYPES.includes(targetType)) throw new Error('Invalid report target');
        if (typeof targetId !== 'string' || !targetId.trim() || targetId.length > 256) {
            throw new Error('Invalid report target');
        }
        if (!REPORT_REASONS.includes(reason)) throw new Error('Invalid report reason');
        if (freeText !== undefined) {
            if (typeof freeText !== 'string') throw new Error('Invalid report details');
            if (freeText.length > REPORT_FREETEXT_MAX) throw new Error('Report details too long');
        }

        await checkReportRateLimit(reporterId);

        const db = await getDb();
        const ref = await db.collection('reports').add({
            reporterId,
            targetType,
            targetId: targetId.trim(),
            reason,
            freeText: freeText?.trim() ?? '',
            status: 'open',
            createdAt: new Date().toISOString(),
        });
        return { reportId: ref.id };
    } catch (err) {
        logger.error('reportContent failed', err, 'MODERATION', { userId: reporterId });
        throw err;
    }
}
