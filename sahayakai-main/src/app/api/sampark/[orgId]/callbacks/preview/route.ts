/**
 * POST /api/sampark/[orgId]/callbacks/preview — what scheduling this callback would do:
 *   { target, scheduledAt, timeZone } → { preview: CallbackPreview }
 * Runs every Riya check at scheduledAt; writes nothing. A refused time includes
 * `nextAllowedAt` so the person can choose a permitted one.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { callbackDeps, CallbackPreviewSchema, previewCallback } from '@/server/sampark/callbacks';
import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { errorResponse, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardRiyaRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, CallbackPreviewSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json({ preview: await previewCallback(await callbackDeps(await samparkContext()), guard.orgId, body.data) });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CALLBACK_PREVIEW');
    }
}
