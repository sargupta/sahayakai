/**
 * The call log (plan §4⑪): every attempt with its outcome, joined to the
 * guardian's and children's display names. Last-4 only — never a number.
 */

import { z } from 'zod';

import type { CallLogEntry, Intent } from '@/types/sampark';
import type { SamparkCtx } from '@/server/sampark/http';
import { getSchoolOrThrow } from '@/server/sampark/school';

export const CallQuerySchema = z.object({
    campaignId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type CallQuery = z.infer<typeof CallQuerySchema>;

export async function listCallLog(ctx: SamparkCtx, orgId: string, query: CallQuery): Promise<CallLogEntry[]> {
    await getSchoolOrThrow(ctx, orgId);
    const calls = await ctx.repo.listCalls(orgId, { campaignId: query.campaignId, limit: query.limit });
    if (calls.length === 0) return [];

    const guardianIds = [...new Set(calls.map((c) => c.guardianId))];
    const intentIds = [...new Set(calls.map((c) => c.intentId))];
    const [guardians, students, intents] = await Promise.all([
        ctx.repo.listGuardians(orgId, guardianIds),
        ctx.repo.listStudents(orgId),
        query.campaignId
            ? ctx.repo.listIntentsByCampaign(orgId, query.campaignId)
            : Promise.all(intentIds.map((id) => ctx.repo.getIntent(orgId, id))).then((xs) => xs.filter((x): x is Intent => !!x)),
    ]);
    const guardianById = new Map(guardians.map((g) => [g.id, g]));
    const studentById = new Map(students.map((s) => [s.id, s]));
    const intentById = new Map(intents.map((i) => [i.id, i]));

    return calls.map((c) => {
        const studentIds = intentById.get(c.intentId)?.studentIds ?? guardianById.get(c.guardianId)?.studentIds ?? [];
        return {
            id: c.id,
            campaignId: c.campaignId,
            purpose: c.purpose,
            language: c.language,
            variant: c.variant,
            attempt: c.attempt,
            state: c.state,
            outcome: c.outcome,
            durationSeconds: c.durationSeconds,
            billedSeconds: c.billedSeconds,
            costPaise: c.costPaise,
            phoneLast4: c.phoneLast4,
            createdAt: c.createdAt,
            endedAt: c.endedAt,
            carrier: c.carrier,
            callerId: c.callerId ?? null,
            guardianDisplayName: guardianById.get(c.guardianId)?.displayName ?? 'Unknown guardian',
            studentDisplayNames: studentIds.map((id) => studentById.get(id)?.displayName).filter((n): n is string => !!n),
        };
    });
}
