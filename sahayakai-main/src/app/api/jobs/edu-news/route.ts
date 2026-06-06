/**
 * POST /api/jobs/edu-news
 *
 * REMOVED — replaced by /api/jobs/daily-briefing.
 *
 * F12-P1-03: the previous implementation forwarded `Object.fromEntries(request.headers)`
 * to daily-briefing, replaying the caller's `Authorization` header. That created a
 * header-replay surface for any attacker probing cron auth. Replaced with a single
 * permanent redirect — Cloud Scheduler jobs that still hit /edu-news should be
 * migrated to /daily-briefing directly.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function redirectToDailyBriefing(request: Request) {
    logger.warn('edu-news route called — deprecated, returning 301 to daily-briefing', 'EDU_NEWS');
    const url = new URL(request.url);
    const dest = `${url.protocol}//${url.host}/api/jobs/daily-briefing`;
    return NextResponse.redirect(dest, 301);
}

export async function POST(request: Request) {
    return redirectToDailyBriefing(request);
}

export async function GET(request: Request) {
    return redirectToDailyBriefing(request);
}
