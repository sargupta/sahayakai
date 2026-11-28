import { NextResponse } from 'next/server';
import { listOrganizationsForAdmin, parsePilotOrgInput, provisionPilotOrganization } from '@/lib/access/pilots';
import { readJsonObject, requireSahayakAdmin, toErrorResponse } from '@/lib/access/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/access/pilot-orgs — provision a pilot school.
 * SahayakAI administrators only.
 *
 * Body { name, type, adminEmail, seats, pilotDays?, plan?, verification }
 * -> { orgId }
 *
 * `verification` must record how the school's identity was checked (board
 * affiliation number, call to the listed landline, and so on). 404 when the
 * admin email has never signed in; 409 when that account is already in an
 * organization.
 */
/**
 * GET /api/admin/access/pilot-orgs -> { organizations: AdminOrgSummary[] }
 * SahayakAI administrators only. Newest 100 organisations of any status.
 */
export async function GET(request: Request) {
    try {
        await requireSahayakAdmin(request);
        return NextResponse.json({ organizations: await listOrganizationsForAdmin() });
    } catch (err) {
        return toErrorResponse(err, '[admin/access/pilot-orgs]');
    }
}

export async function POST(request: Request) {
    try {
        const actor = await requireSahayakAdmin(request);
        const input = parsePilotOrgInput(await readJsonObject(request));
        const { orgId } = await provisionPilotOrganization({ ...input, actor });
        return NextResponse.json({ orgId });
    } catch (err) {
        return toErrorResponse(err, '[admin/access/pilot-orgs]');
    }
}
