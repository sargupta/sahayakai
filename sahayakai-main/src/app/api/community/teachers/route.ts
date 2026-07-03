/**
 * GET /api/community/teachers — full teacher directory (sanitized fields
 * only). Rate-limited per caller; caching (unstable_cache, 60s) lives in
 * src/server/community.ts. Optional ?self=<uid> preserves the legacy
 * currentUserId parameter (self-exclusion only — never used for authz).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAllTeachers } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const self = req.nextUrl.searchParams.get('self') ?? undefined;
    if (self !== undefined && self.length > 128) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    try {
        const teachers = await getAllTeachers(userId, self);
        return NextResponse.json(teachers);
    } catch (err) {
        return errorResponse(err);
    }
}
