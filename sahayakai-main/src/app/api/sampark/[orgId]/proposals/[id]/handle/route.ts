/**
 * POST /api/sampark/[orgId]/proposals/[id]/handle — "I'll call myself". Closes the proposal as handled by a person;
 * no call is placed by the system.
 *
 * Input:  none.
 * Output: the closed Proposal.
 * Auth:   x-user-id (401) + whoever may approve it (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   2 reads, 1 write, 1 audit write.
 * Done:   409 PROPOSAL_NOT_PENDING.
 */

import type { NextRequest } from 'next/server';

import { DocIdSchema } from '@/server/sampark/http';
import { handleProposalMyself } from '@/server/sampark/proposals';
import { runStaff } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
    const p = await params;
    return runStaff(req, p.orgId, 'SAMPARK_PROPOSAL_HANDLE', ({ ctx, orgId, uid, isOrgAdmin }) =>
        handleProposalMyself(ctx, orgId, DocIdSchema.parse(p.id), { uid, isOrgAdmin }),
    );
}
