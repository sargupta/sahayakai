/**
 * POST /api/jobs/sampark-google-calendar — Cloud Scheduler / local ticker job.
 *
 * Input:  none. `Authorization: Bearer <CRON_SECRET>`.
 * Output: GoogleCalendarTickReport { schools, synced, renewed, errors }.
 *         For every connected school: renew its push channel when it expires within
 *         a day (only when GOOGLE_CALENDAR_WEBHOOK_URL is set), and re-sync when the
 *         last sync is older than 15 minutes — the fallback for missed or expired
 *         notifications, and the only automatic sync path on localhost.
 * Auth:   requireCronAuth (503 if CRON_SECRET unset, 401 on a wrong bearer).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Never places a call.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/cron-auth';
import { googleCalendarDeps, runGoogleCalendarTick } from '@/server/sampark/google-calendar';
import { errorResponse, samparkDisabledResponse } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const disabled = samparkDisabledResponse();
    if (disabled) return disabled;
    const denied = requireCronAuth(req);
    if (denied) return denied;
    try {
        return NextResponse.json(await runGoogleCalendarTick(await googleCalendarDeps()));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_TICK');
    }
}
