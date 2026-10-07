/**
 * GET /api/sampark/me — the schools the caller administers, and whether
 * Sampark is enabled for each.
 *
 * Input:  none.
 * Output: { schools: { orgId, displayName, enabled }[] }
 * Auth:   x-user-id (middleware, 401 without). No org check — the list IS the
 *         set of orgs requireOrgAdmin would accept (src/server/sampark/auth.ts).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 org query + 1 profile read + 1 Sampark school read per org.
 * Done:   a principal sees their school with enabled=false before enabling,
 *         true after; a teacher sees an empty list.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { listAdministeredOrgs } from '@/server/sampark/auth';
import { errorResponse, samparkContext, samparkDisabledResponse } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const disabled = samparkDisabledResponse();
    if (disabled) return disabled;
    const uid = req.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const orgs = await listAdministeredOrgs(uid);
        const ctx = await samparkContext();
        const schools = await Promise.all(
            orgs.map(async (o) => {
                const school = await ctx.repo.getSchool(o.orgId);
                return { orgId: o.orgId, displayName: school?.displayName ?? o.name, enabled: !!school };
            }),
        );
        return NextResponse.json({ schools });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_ME');
    }
}
