/**
 * POST /api/sampark/[orgId]/proposals/[id]/dismiss — "Not now". The proposal is closed for good: the rules cannot
 * resurrect it (proposals are create-only).
 *
 * Input:  { note?: string }.
 * Output: the closed Proposal.
 * Auth:   x-user-id (401) + whoever may approve it (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   2 reads, 1 write, 1 audit write.
 * Done:   409 PROPOSAL_NOT_PENDING.
 */

import type { NextRequest } from 'next/server';

import { DocIdSchema } from '@/server/sampark/http';
import { dismissProposal } from '@/server/sampark/proposals';
import { DecisionBodySchema, runStaff } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
    const p = await params;
    return runStaff(req, p.orgId, 'SAMPARK_PROPOSAL_DISMISS', async ({ ctx, orgId, uid, isOrgAdmin }) => {
        const body = DecisionBodySchema.parse(await req.json().catch(() => ({})));
        return dismissProposal(ctx, orgId, DocIdSchema.parse(p.id), { uid, isOrgAdmin }, body.note ?? null);
    });
}
