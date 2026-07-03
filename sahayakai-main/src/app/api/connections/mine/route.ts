/**
 * GET /api/connections/mine — the caller's full connection state
 * (connected uids + pending sent/received requests).
 * Migrated from getMyConnectionDataAction (tranche 5).
 */
import { NextResponse } from 'next/server';
import { getMyConnectionData } from '@/server/connections';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

export async function GET(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    try {
        const data = await getMyConnectionData(userId);
        return NextResponse.json(data);
    } catch (err) {
        return errorResponse(err, 'CONNECTIONS');
    }
}
