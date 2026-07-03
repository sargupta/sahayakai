/**
 * GET /api/community/teachers/recommended — People You May Know.
 * Recommendations are ALWAYS computed for the authenticated uid; the
 * optional ?userId= (legacy signature compat) is rejected with 403 unless it
 * matches the caller — cross-user scraping stays forbidden (see
 * src/server/community.ts). Cached per user (unstable_cache, 60s).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRecommendedTeachers } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const callerId = req.headers.get('x-user-id');
    if (!callerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = req.nextUrl.searchParams.get('userId') ?? undefined;
    if (userId !== undefined && userId.length > 128) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    try {
        const teachers = await getRecommendedTeachers(callerId, userId);
        return NextResponse.json(teachers);
    } catch (err) {
        return errorResponse(err);
    }
}
