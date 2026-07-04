/**
 * GET /api/profile/school-location?schoolName=… — dominant state/district for
 * a school name (tranche 5 migration of
 * src/app/actions/profile.ts::lookupSchoolDominantLocationAction).
 * Aggregate only — never reveals an individual teacher. Auth required so the
 * directory isn't exposed anonymously.
 */
import { NextRequest, NextResponse } from 'next/server';
import { lookupSchoolDominantLocationAction } from '@/server/profile';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    try {
        const schoolName = req.nextUrl.searchParams.get('schoolName') ?? '';
        const result = await lookupSchoolDominantLocationAction(schoolName);
        return NextResponse.json({ result });
    } catch (error) {
        return errorResponse(error, 'PROFILE');
    }
}
