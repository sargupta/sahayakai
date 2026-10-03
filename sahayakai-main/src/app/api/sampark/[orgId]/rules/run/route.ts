/**
 * POST /api/sampark/[orgId]/rules/run — run the adopted rules now and create proposals (create-only, so running
 * twice creates nothing new and a dismissed proposal is never resurrected).
 *
 * Input:  none.
 * Output: RunSummary { evaluated, inert, created, existing, skippedCooldown, autoApproved, expired, excluded[] }.
 * Auth:   x-user-id (401) + org admin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first). Creates proposals and, at approval, intents only; it
 *         never places a call (the dispatcher does, in practice mode, inside the calling window).
 * Cost:   as preview, plus one write per new proposal.
 * Done:   409 NO_REST_CRM until a CRM is connected.
 */

import type { NextRequest } from 'next/server';

import { runRules } from '@/server/sampark/proposals';
import { runAdmin } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const p = await params;
    return runAdmin(req, p.orgId, 'SAMPARK_RULES_RUN', ({ ctx, orgId, uid }) => runRules(ctx, orgId, { actor: uid }));
}
