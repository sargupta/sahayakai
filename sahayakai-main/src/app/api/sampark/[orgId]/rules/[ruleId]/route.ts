/**
 * PUT    /api/sampark/[orgId]/rules/[ruleId] — adopt a rule with its thresholds, in writing.
 * DELETE /api/sampark/[orgId]/rules/[ruleId] — withdraw it (it becomes inert; waiting proposals expire).
 *
 * Input:  PUT { thresholds, adopterName, acknowledged: true }. Thresholds are validated against the plan's floors
 *         (a school may be stricter, never looser): 400 INVALID_THRESHOLDS with a plain message.
 * Output: the immutable Adoption record (version n+1; history is append-only, so what the school agreed to is provable).
 * Auth:   x-user-id (401) + org admin (403) — the principal adopts rules.
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1-2 reads, 1 write, 1 audit write.
 * Done:   409 RULE_NOT_ADOPTED on withdrawing a rule that is not adopted.
 */

import type { NextRequest } from 'next/server';

import { adoptRule, withdrawRule } from '@/server/sampark/proposals';
import { AdoptBodySchema, runAdmin } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ orgId: string; ruleId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
    const p = await params;
    return runAdmin(req, p.orgId, 'SAMPARK_RULE_ADOPT', async ({ ctx, orgId, uid }) => {
        const body = AdoptBodySchema.parse(await req.json().catch(() => undefined)); // a ZodError becomes a 400
        return adoptRule(ctx, orgId, p.ruleId, body, { uid, isOrgAdmin: true });
    });
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const p = await params;
    return runAdmin(req, p.orgId, 'SAMPARK_RULE_WITHDRAW', ({ ctx, orgId, uid }) => withdrawRule(ctx, orgId, p.ruleId, { uid, isOrgAdmin: true }));
}
