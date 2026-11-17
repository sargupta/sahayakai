/**
 * Route shell for the Riya routes: the Sampark shell (flag → 401 → 400 → 403) and then
 * SAMPARK_ELEVENLABS_ENABLED === 'true', else 404, so a deployment with Riya off reveals
 * nothing about it.
 */

import { NextResponse } from 'next/server';

import { riyaEnabled } from '@/server/sampark/conversation';
import { guardOrgRoute, type OrgGuard } from '@/server/sampark/http';

export async function guardRiyaRoute(req: Request, rawOrgId: string | undefined): Promise<OrgGuard> {
    const guard = await guardOrgRoute(req, rawOrgId);
    if ('response' in guard) return guard;
    if (!riyaEnabled()) return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    return guard;
}
