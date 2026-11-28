import { NextResponse } from 'next/server';
import { decideAccessRequest } from '@/lib/access/requests';
import {
    errorResponse,
    isSafeDocId,
    readJsonObject,
    requireSahayakAdmin,
    toErrorResponse,
} from '@/lib/access/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/access/requests/{uid} — approve or reject an access request.
 * SahayakAI administrators only.
 *
 * Body { decision: "approve"|"reject", state?: "pilot"|"active",
 *        expiresInDays?, note? } -> { ok: true }
 *
 * Approve defaults to a 14-day pilot (cap 90). Reject records the decision
 * and leaves the account pending. 409 if already decided.
 */
export async function POST(request: Request, context: { params: Promise<{ uid: string }> }) {
    try {
        const actor = await requireSahayakAdmin(request);
        const { uid } = await context.params;
        if (!isSafeDocId(uid)) return errorResponse(404, 'Access request not found');

        const body = await readJsonObject(request);
        if (body.decision !== 'approve' && body.decision !== 'reject') {
            return errorResponse(400, 'decision must be "approve" or "reject"');
        }
        if (body.state !== undefined && body.state !== 'pilot' && body.state !== 'active') {
            return errorResponse(400, 'state must be "pilot" or "active"');
        }
        await decideAccessRequest({
            uid,
            decision: body.decision,
            state: body.state,
            expiresInDays: body.expiresInDays,
            note: typeof body.note === 'string' ? body.note : undefined,
            actor,
        });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return toErrorResponse(err, '[admin/access/requests/uid]');
    }
}
