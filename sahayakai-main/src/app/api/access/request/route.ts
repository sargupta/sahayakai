import { NextResponse } from 'next/server';
import {
    getAccessRequest,
    parseAccessRequestInput,
    submitAccessRequest,
} from '@/lib/access/requests';
import { callerUid, errorResponse, readJsonObject, toErrorResponse } from '@/lib/access/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * /api/access/request — the signed-in caller's own access request.
 *
 * Reachable while NOT entitled (allowlisted in
 * src/lib/access/access-state.ts), so every input is validated and
 * length-capped, and identity comes only from the verified token headers.
 *
 * GET  -> { request | null }
 * POST -> { ok: true, status: "pending" }   409 once a decision exists
 */
export async function GET(request: Request) {
    const uid = callerUid(request);
    if (!uid) return errorResponse(401, 'Unauthorized');
    try {
        return NextResponse.json({ request: await getAccessRequest(uid) });
    } catch (err) {
        return toErrorResponse(err, '[access/request GET]');
    }
}

export async function POST(request: Request) {
    const uid = callerUid(request);
    if (!uid) return errorResponse(401, 'Unauthorized');
    try {
        const input = parseAccessRequestInput(await readJsonObject(request));
        // Trusted identity: set by the middleware from the verified ID token.
        const email = request.headers.get('x-user-email') || null;
        const displayName = request.headers.get('x-user-name') || null;
        const result = await submitAccessRequest({ uid, email, displayName, input });
        return NextResponse.json({ ok: true, status: result.status });
    } catch (err) {
        return toErrorResponse(err, '[access/request POST]');
    }
}
