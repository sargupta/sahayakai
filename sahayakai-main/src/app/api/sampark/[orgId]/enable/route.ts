/**
 * POST /api/sampark/[orgId]/enable — switch Sampark on for a school.
 *
 * Input:  { displayName: string, spokenName?: Record<ParentLanguage, string> }
 *         (spokenName is an optional addition; Indic names must be in their own script)
 * Output: SamparkSchoolView — created in PRACTICE mode if absent (simulated
 *         carrier only), returned unchanged if it already exists. `isDemo` is
 *         copied from organizations/{orgId}.isDemoData (class gate 4: a demo
 *         org can never reach a real carrier).
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   2 reads + 1 write + 1 audit write.
 * Done:   the school appears in /api/sampark/me with enabled=true.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getOrganizationFacts } from '@/server/sampark/auth';
import { errorResponse, guardOrgRoute, parseBody, samparkContext } from '@/server/sampark/http';
import { EnableSchoolSchema, enableSchool, schoolView } from '@/server/sampark/school';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, EnableSchoolSchema);
    if ('response' in body) return body.response;
    try {
        const org = await getOrganizationFacts(guard.orgId);
        if (!org) return NextResponse.json({ error: 'ORG_NOT_FOUND', message: 'Organisation not found' }, { status: 404 });
        const ctx = await samparkContext();
        const school = await enableSchool(ctx, guard.orgId, guard.uid, { displayName: body.data.displayName, spokenName: body.data.spokenName, isDemo: org.isDemo });
        // Never the raw record: it carries the test phone's ciphertext and hash.
        return NextResponse.json(schoolView(school));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_ENABLE');
    }
}
