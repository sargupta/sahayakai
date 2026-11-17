/**
 * Route shell for class-wide outreach (/api/sampark/[orgId]/batch-calls/…): the same order as
 * every Sampark route (flag 404 → 401 → 400), then Riya enabled (404), then school staff: an org
 * admin, or a teacher with classes assigned on their server-managed member record (403). Each
 * service call then checks the specific class (canManageClass).
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { isSchoolStaffForOutreach } from '@/server/sampark/auth';
import { riyaEnabled } from '@/server/sampark/conversation';
import { invalidRequest, OrgIdSchema, samparkDisabledResponse, type OrgGuard } from '@/server/sampark/http';

export async function guardBatchRoute(req: Request, rawOrgId: string | undefined): Promise<OrgGuard> {
    const disabled = samparkDisabledResponse();
    if (disabled) return { response: disabled };
    const uid = req.headers.get('x-user-id');
    if (!uid) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    const org = OrgIdSchema.safeParse(rawOrgId);
    if (!org.success) return { response: invalidRequest(org.error) };
    if (!riyaEnabled()) return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    let allowed = false;
    try {
        allowed = await isSchoolStaffForOutreach(org.data, uid);
    } catch (err) {
        logger.error('Sampark staff check failed', err, 'SAMPARK_BATCH', { orgId: org.data });
        return { response: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) };
    }
    if (!allowed) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    return { uid, orgId: org.data };
}
