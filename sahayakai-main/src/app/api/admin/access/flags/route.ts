import { NextResponse } from 'next/server';
import { listAccessFlags } from '@/lib/access/anomaly';
import { requireSahayakAdmin, toErrorResponse } from '@/lib/access/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/access/flags — accounts flagged by the nightly anomaly scan.
 * SahayakAI administrators only. -> { flags: [...] }
 */
export async function GET(request: Request) {
    try {
        await requireSahayakAdmin(request);
        return NextResponse.json({ flags: await listAccessFlags() });
    } catch (err) {
        return toErrorResponse(err, '[admin/access/flags]');
    }
}
