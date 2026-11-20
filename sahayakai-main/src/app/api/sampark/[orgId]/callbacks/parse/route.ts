/**
 * POST /api/sampark/[orgId]/callbacks/parse — read a typed time ("in 20 minutes",
 * "tomorrow at 5 PM") in a zone: { text, timeZone } →
 *   { parse: { status: 'exact', at } | { status: 'ambiguous', reason, candidates } | { status: 'invalid', reason }, labels }
 * Ambiguous text is never resolved silently: the console asks the person to choose.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { CallbackParseSchema, parseCallbackRequest } from '@/server/sampark/callbacks';
import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { errorResponse, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardRiyaRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, CallbackParseSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(parseCallbackRequest(await samparkContext(), body.data.text, body.data.timeZone));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CALLBACK_PARSE');
    }
}
