/**
 * GET /api/sampark/[orgId]/rules — the school's rules and what it has adopted.
 *
 * Input:  none.
 * Output: { statement, rules: RuleView[] } — every rule (A1-A5, C1, C2) with its code, who approves it, whether the
 *         school has adopted it, the current thresholds (or the plan's suggested defaults, shown for the adoption
 *         screen only) and who adopted it when. Rules ship OFF: an unadopted rule proposes nothing.
 * Auth:   x-user-id (401) + org admin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   2 reads.
 * Done:   a school that has adopted nothing sees seven rules, all off.
 */

import type { NextRequest } from 'next/server';

import { listRules } from '@/server/sampark/proposals';
import { runAdmin } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const p = await params;
    return runAdmin(req, p.orgId, 'SAMPARK_RULES', ({ ctx, orgId }) => listRules(ctx, orgId));
}
