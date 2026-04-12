/**
 * POST /api/jobs/edu-news
 *
 * DEPRECATED — Replaced by /api/jobs/daily-briefing
 * which covers CBSE + ICSE + AI-in-education + state-level news
 * with Gemini curation and multilingual translation at 8 AM IST.
 *
 * This route forwards to the new pipeline so any existing
 * Cloud Scheduler jobs continue to work until migrated.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const maxDuration = 180;

export async function POST(request: Request) {
    logger.info('edu-news called — forwarding to daily-briefing (deprecated route)', 'EDU_NEWS');

    try {
        const baseUrl = request.url.replace('/api/jobs/edu-news', '/api/jobs/daily-briefing');
        const forwardRes = await fetch(baseUrl, {
            method: 'POST',
            headers: Object.fromEntries(request.headers),
        });
        const body = await forwardRes.json();
        return NextResponse.json(
            { ...body, _forwardedFrom: 'edu-news (deprecated)' },
            { status: forwardRes.status },
        );
    } catch (err: any) {
        logger.error('Forward to daily-briefing failed', err, 'EDU_NEWS');
        return NextResponse.json(
            { error: 'Forward to daily-briefing failed', message: err?.message },
            { status: 500 },
        );
    }
}
