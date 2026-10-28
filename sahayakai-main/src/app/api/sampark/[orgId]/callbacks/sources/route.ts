/**
 * GET /api/sampark/[orgId]/callbacks/sources — recent Riya calls a callback can follow up
 * (they carry the facts the call was started with): { sources: [...] }. Names and
 * record ids only; never a phone number.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { callbackDeps, callbackSources } from '@/server/sampark/callbacks';
import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { errorResponse, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardRiyaRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json({ sources: await callbackSources(await callbackDeps(await samparkContext()), guard.orgId) });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CALLBACK_SOURCES');
    }
}
