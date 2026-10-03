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
