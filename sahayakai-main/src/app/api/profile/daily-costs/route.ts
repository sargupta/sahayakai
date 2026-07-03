/**
 * GET /api/profile/daily-costs?days=N — admin-only AI cost aggregates
 * (tranche 5 migration of src/app/actions/profile.ts::getDailyCostsAction).
 * Admin gate (validateAdmin) preserved inside the service — non-admin → 403.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDailyCostsAction } from '@/server/profile';
import { unauthorizedResponse } from '@/server/api-error';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const daysRaw = Number(req.nextUrl.searchParams.get('days') ?? '7');
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(Math.trunc(daysRaw), 1), 90) : 7;

    try {
        const data = await getDailyCostsAction(days);
        return NextResponse.json(data);
    } catch (error) {
        // validateAdmin throws for non-admins; don't leak details beyond that.
        const msg = error instanceof Error ? error.message : '';
        if (/admin|forbidden/i.test(msg)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (/unauthorized/i.test(msg)) {
            return unauthorizedResponse();
        }
        logger.error('daily-costs route failed', error, 'PROFILE', { userId });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
