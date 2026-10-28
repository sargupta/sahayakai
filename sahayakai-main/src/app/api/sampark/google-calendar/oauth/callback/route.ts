/**
 * GET /api/sampark/google-calendar/oauth/callback?code&state[&error] — Google's
 * redirect after consent (the exact GOOGLE_CALENDAR_REDIRECT_URI).
 *
 * The school comes from the STORED state, never from the request. The state is
 * single use, expires after 10 minutes and must belong to the signed-in user, who
 * must still be an org admin of that school. Always answers with a redirect to the
 * school's Google Calendar page carrying `gcal=<outcome>`; no token or code is
 * ever echoed back.
 * Auth: x-user-id from the auth cookie (middleware). Sampark flag (404).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { requireOrgAdmin } from '@/server/sampark/auth';
import { completeGoogleConnect, googleCalendarDeps, type ConnectResult } from '@/server/sampark/google-calendar';
import { samparkDisabledResponse } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const disabled = samparkDisabledResponse();
    if (disabled) return disabled;
    const url = new URL(req.url);
    let result: ConnectResult;
    try {
        result = await completeGoogleConnect(await googleCalendarDeps(), {
            state: url.searchParams.get('state'),
            code: url.searchParams.get('code'),
            error: url.searchParams.get('error'),
            uid: req.headers.get('x-user-id'),
            isAdmin: requireOrgAdmin,
        });
    } catch (err) {
        logger.error('Google Calendar connect failed', err, 'SAMPARK_GCAL_CALLBACK');
        result = { ok: false, orgId: null, reason: 'exchange_failed' };
    }
    const outcome = result.ok ? 'connected' : result.reason;
    const path = result.orgId ? `/sampark/${encodeURIComponent(result.orgId)}/calendar/google` : '/sampark/workspace';
    const target = new URL(path, url.origin);
    target.searchParams.set('gcal', outcome);
    const res = NextResponse.redirect(target, 303);
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Referrer-Policy', 'no-referrer');
    return res;
}
