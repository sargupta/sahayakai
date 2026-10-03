/**
 * GET /api/sampark/[orgId]/proposals?status= — the proposals this person may decide: each with its evidence (staff's
 * own words, for the approver only), why it is routed to them, and what the parent will hear in four languages.
 *
 * Input:  optional ?status=pending|approved|dismissed|handled_by_person|needs_attention|expired.
 * Output: { proposals: ProposalView[] } — only the caller's own work: a class teacher sees their section, accounts the
 *         fee calls, the coordinator conduct requests, the principal and org admin everything.
 * Auth:   x-user-id (401) + org admin or any Sampark role holder (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   3 reads and a template render per proposal (no audio, no model).
 * Done:   nothing here dials; approving (a separate call) creates intents the dispatcher reads.
 */

import type { NextRequest } from 'next/server';

import { listProposalViews } from '@/server/sampark/proposals';
import { ProposalStatusSchema, runStaff } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const p = await params;
    return runStaff(req, p.orgId, 'SAMPARK_PROPOSALS', async ({ ctx, orgId, uid, isOrgAdmin }) => {
        const raw = new URL(req.url).searchParams.get('status');
        const status = raw ? ProposalStatusSchema.parse(raw) : undefined;
        return { proposals: await listProposalViews(ctx, orgId, { uid, isOrgAdmin }, { status }) };
    });
}
