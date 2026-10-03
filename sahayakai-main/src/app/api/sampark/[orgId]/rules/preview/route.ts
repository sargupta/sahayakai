/**
 * GET /api/sampark/[orgId]/rules/preview — what the ADOPTED rules would propose right now, and which children
 * they would not, with a plain reason for each. Writes nothing.
 *
 * Input:  none.
 * Output: { wouldPropose[], excluded[] (child, rule, plain reason), evaluated[], inert[] }.
 * Auth:   x-user-id (401) + org admin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   reads the school's students, the adoptions and the CRM signals (a REST pull).
 * Done:   409 NO_REST_CRM until a CRM is connected.
 */

import type { NextRequest } from 'next/server';

import { previewRules } from '@/server/sampark/proposals';
import { runAdmin } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const p = await params;
    return runAdmin(req, p.orgId, 'SAMPARK_RULES_PREVIEW', ({ ctx, orgId }) => previewRules(ctx, orgId));
}
