import { NextResponse } from 'next/server';
import { applyPilotOrgAction } from '@/lib/access/pilots';
import {
    errorResponse,
    isSafeDocId,
    readJsonObject,
    requireSahayakAdmin,
    toErrorResponse,
} from '@/lib/access/route-helpers';

export const dynamic = 'force-dynamic';
// Sweeps every member of the organization (claims + access per member).
export const maxDuration = 120;

/**
 * POST /api/admin/access/pilot-orgs/{orgId} — extend, convert or end a pilot.
 * SahayakAI administrators only.
 *
 * Body { action: "extend"|"convert"|"expire", days? } -> { ok: true }
 */
export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
    try {
        const actor = await requireSahayakAdmin(request);
        const { orgId } = await context.params;
        if (!isSafeDocId(orgId)) return errorResponse(404, 'Organization not found');

        const body = await readJsonObject(request);
        if (body.action !== 'extend' && body.action !== 'convert' && body.action !== 'expire') {
            return errorResponse(400, 'action must be "extend", "convert" or "expire"');
        }
        await applyPilotOrgAction({ orgId, action: body.action, days: body.days, actor });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return toErrorResponse(err, '[admin/access/pilot-orgs/orgId]');
    }
}
