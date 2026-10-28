/**
 * POST /api/sampark/[orgId]/google-calendar/connect — begin the Google consent.
 * Output: { authUrl } — the browser navigates there. The state (single use, 10 min,
 * bound to this user and school) and the PKCE verifier stay on the server.
 * Auth:   x-user-id (401) + requireOrgAdmin (403). Sampark flag (404).
 *         409 GCAL_NOT_CONFIGURED when the server has no OAuth client.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { googleCalendarDeps, startGoogleConnect } from '@/server/sampark/google-calendar';
import { errorResponse, guardOrgRoute } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json(await startGoogleConnect(await googleCalendarDeps(), guard.orgId, guard.uid));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_CONNECT');
    }
}
