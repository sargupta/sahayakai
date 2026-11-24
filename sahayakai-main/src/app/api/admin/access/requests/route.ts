import { NextResponse } from 'next/server';
import { isAccessRequestStatus, listAccessRequests } from '@/lib/access/requests';
import { errorResponse, requireSahayakAdmin, toErrorResponse } from '@/lib/access/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/access/requests?status=pending|approved|rejected
 * SahayakAI administrators only. Defaults to pending. -> { requests: [...] }
 */
export async function GET(request: Request) {
    try {
        await requireSahayakAdmin(request);
        const raw = new URL(request.url).searchParams.get('status') ?? 'pending';
        if (!isAccessRequestStatus(raw)) return errorResponse(400, 'Invalid status');
        return NextResponse.json({ requests: await listAccessRequests(raw) });
    } catch (err) {
        return toErrorResponse(err, '[admin/access/requests]');
    }
}
