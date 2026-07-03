/**
 * GET /api/logs?limit=&severity= — recent application logs for admins
 * (tranche 5 migration of src/app/actions/logs.ts::getLogsAction).
 *
 * Admin gate (validateAdmin) preserved inside the service; non-admin callers
 * get the action's historic `{ logs: [], error }` shape (200) rather than a
 * leaky status — matching what the log dashboard already renders.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getLogsAction } from '@/server/logs';
import { unauthorizedResponse } from '@/server/api-error';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? '50');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 50;
    const severity = req.nextUrl.searchParams.get('severity') ?? undefined;

    const result = await getLogsAction(limit, severity);
    return NextResponse.json(result);
}
