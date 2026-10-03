/**
 * GET    /api/sampark/[orgId]/roles — who holds which Sampark role.
 * POST   /api/sampark/[orgId]/roles — grant a role { uid, role, sections, displayName } (class teachers need sections).
 * DELETE /api/sampark/[orgId]/roles — revoke { uid, role }.
 *
 * The platform's organisations know only "admin" and "teacher"; Sampark roles (principal, coordinator, class teacher,
 * accounts, transport, office, counsellor) are granted here by the organisation admin (plan §8). They decide who sees
 * and may decide which proposals.
 *
 * Output: GET { roles: RoleAssignment[] }; POST the RoleAssignment; DELETE { ok: true }.
 * Auth:   x-user-id (401) + org admin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 read or 1 write + 1 audit write.
 * Done:   400 INVALID_ROLE with a plain message.
 */

import type { NextRequest } from 'next/server';

import { grantRole, listRoles, revokeRole } from '@/server/sampark/proposals';
import { RevokeBodySchema, RoleBodySchema, runAdmin } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const p = await params;
    return runAdmin(req, p.orgId, 'SAMPARK_ROLES', async ({ ctx, orgId }) => ({ roles: await listRoles(ctx, orgId) }));
}

export async function POST(req: NextRequest, { params }: Params) {
    const p = await params;
    return runAdmin(req, p.orgId, 'SAMPARK_ROLE_GRANT', async ({ ctx, orgId, uid }) => {
        const body = RoleBodySchema.parse(await req.json().catch(() => undefined));
        return grantRole(ctx, orgId, body, uid);
    });
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const p = await params;
    return runAdmin(req, p.orgId, 'SAMPARK_ROLE_REVOKE', async ({ ctx, orgId, uid }) => {
        const body = RevokeBodySchema.parse(await req.json().catch(() => undefined));
        await revokeRole(ctx, orgId, body.uid, body.role, uid);
        return { ok: true };
    });
}
