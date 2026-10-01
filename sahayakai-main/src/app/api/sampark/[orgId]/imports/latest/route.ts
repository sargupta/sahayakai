/**
 * GET /api/sampark/[orgId]/imports/latest — the most recent import run.
 *
 * Input:  none.
 * Output: ImportRun | null.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 indexed query (orderBy startedAt desc, limit 1).
 * Done:   the console shows the last run's counts and rejected rows.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, guardOrgRoute, samparkContext } from '@/server/sampark/http';
import { getLatestImport } from '@/server/sampark/imports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json(await getLatestImport(await samparkContext(), guard.orgId));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_IMPORT');
    }
}
