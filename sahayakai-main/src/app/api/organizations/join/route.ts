import { NextResponse } from 'next/server';
import { redeemJoinLink } from '@/lib/access/join-links';
import { callerUid, errorResponse, readJsonObject, toErrorResponse } from '@/lib/access/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/organizations/join — redeem a school join link.
 *
 * Reachable while NOT entitled (allowlisted in
 * src/lib/access/access-state.ts): this is how a new teacher gets in.
 *
 * Body { code, acceptTerms: true }
 * -> { ok: true, orgId, orgName, state, expiresAt|null }
 * 404 invalid or revoked, 410 expired, 409 no seats or member of another
 * school. The client must refresh its ID token afterwards to pick up the new
 * claims.
 */
export async function POST(request: Request) {
    const uid = callerUid(request);
    if (!uid) return errorResponse(401, 'Unauthorized');
    try {
        const body = await readJsonObject(request);
        const result = await redeemJoinLink({ code: body.code, uid, acceptTerms: body.acceptTerms });
        return NextResponse.json({
            ok: true,
            orgId: result.orgId,
            orgName: result.orgName,
            state: result.state,
            expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null,
        });
    } catch (err) {
        return toErrorResponse(err, '[organizations/join]');
    }
}
