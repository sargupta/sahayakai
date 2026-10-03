/**
 * POST /api/sampark/[orgId]/proposals/[id]/approve — approve a proposal into calls.
 *
 * Input:  none.
 * Output: ApprovalOutcome { proposal, dialable, blocked[] (plain reasons), needsAttention }. One create-only intent per
 *         guardian of record is written, gated at the materialise stage, never earlier than the first allowed moment
 *         (never Friday or Saturday for a request to talk, 10:00-19:00 for fees). Nothing is dialled here; the existing
 *         dispatcher places simulated calls in practice mode only.
 * Auth:   x-user-id (401) + the role the purpose needs for this child's section, or the principal / org admin (403
 *         APPROVAL_FORBIDDEN with a plain reason).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   a few reads, one intent write per guardian, 1 audit write.
 * Done:   409 PROPOSAL_NOT_PENDING / PROPOSAL_EXPIRED. If no parent can be called the proposal becomes
 *         'needs_attention' with a plain "please phone the family" note.
 */

import type { NextRequest } from 'next/server';

import { DocIdSchema } from '@/server/sampark/http';
import { approveProposal } from '@/server/sampark/proposals';
import { runStaff } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
    const p = await params;
    return runStaff(req, p.orgId, 'SAMPARK_PROPOSAL_APPROVE', ({ ctx, orgId, uid, isOrgAdmin }) =>
        approveProposal(ctx, orgId, DocIdSchema.parse(p.id), { uid, isOrgAdmin }),
    );
}
