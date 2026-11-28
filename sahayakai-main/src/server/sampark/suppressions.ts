/**
 * The suppression list (plan §4②, §5.1): keyed by phone hash so it survives
 * CRM re-keying, shown with last-4 only. Written by the dispatcher (keypad 9)
 * in slice 1; office verification and manual entries arrive in a later slice.
 */

import type { Suppression } from '@/types/sampark';
import type { SamparkCtx } from '@/server/sampark/http';
import { getSchoolOrThrow } from '@/server/sampark/school';

export async function listSuppressions(ctx: SamparkCtx, orgId: string): Promise<Suppression[]> {
    await getSchoolOrThrow(ctx, orgId);
    const all = await ctx.repo.listSuppressions(orgId);
    return [...all].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/**
 * Reverse a suppression (mark as reversed by office verification).
 * Audit trail: writes a new Suppression document with officeVerification='reversed',
 * preserving the original for audit. The office must provide a reason.
 */
export async function reverseSuppression(
    ctx: SamparkCtx,
    orgId: string,
    phoneHash: string,
    reason: string,
    adminUid: string
): Promise<Suppression> {
    await getSchoolOrThrow(ctx, orgId);
    const existing = await ctx.repo.getSuppression(orgId, phoneHash);
    if (!existing) {
        throw new Error('Suppression not found');
    }
    if (existing.officeVerification === 'reversed') {
        throw new Error('Suppression already reversed');
    }
    const now = new Date().toISOString();
    const reversed: Suppression = {
        ...existing,
        officeVerification: 'reversed',
        reversedAt: now,
        reversedBy: adminUid,
        reversedReason: reason,
    };
    await ctx.repo.upsertSuppression(reversed);
    return reversed;
}
