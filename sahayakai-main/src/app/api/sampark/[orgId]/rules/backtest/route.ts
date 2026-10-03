/**
 * POST /api/sampark/[orgId]/rules/backtest — "these N children would have been flagged last term; your teachers
 * already knew about K". Runs every rule over the school's own term on PROPOSED thresholds. Needs no adoption and
 * writes nothing.
 *
 * Input:  { weeks?: 1-20 (default 5), endDate?: YYYY-MM-DD, thresholds?: { [rule]: {...} } } — thresholds are
 *         validated against the plan floors.
 * Output: Backtest { asOfDates, attendanceWindow, results[] (per rule: flagged children, already-known count,
 *         reasons, suppressed children by plain reason), weeks[] (expected approvals per purpose and approver),
 *         unexplainedAbsenceDays, headlines[] }.
 * Auth:   x-user-id (401) + org admin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   one CRM signals pull; pure computation.
 * Done:   400 INVALID_THRESHOLDS; 409 NO_REST_CRM.
 */

import type { NextRequest } from 'next/server';

import { backtestSchool } from '@/server/sampark/proposals';
import { BacktestBodySchema, runAdmin } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const p = await params;
    return runAdmin(req, p.orgId, 'SAMPARK_BACKTEST', async ({ ctx, orgId }) => {
        const body = BacktestBodySchema.parse(await req.json().catch(() => ({})));
        return backtestSchool(ctx, orgId, body);
    });
}
