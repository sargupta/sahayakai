/**
 * GET  /api/sampark/[orgId]/callbacks?from=ISO&to=ISO — callbacks scheduled in [from, to)
 *      (at most 62 days) plus every proposal waiting for a person.
 * POST /api/sampark/[orgId]/callbacks — schedule one callback.
 *
 * POST input: { target: { sourceCallId } | { purpose, guardianId, studentId, facts | campaignId },
 *               scheduledAt (ISO with offset), timeZone (IANA), requestKey (uuid),
 *               confirmedAnnouncement, note? }
 *   Every Riya check runs AT scheduledAt. A time outside calling hours is refused
 *   (409 OUTSIDE_CALLING_HOURS) with the next permitted time in the message, never moved.
 *   Status and execution fields are server-owned; the body cannot set them (strict schema).
 * Output: GET  { callbacks: CallbackView[], proposed: CallbackView[] }
 *         POST { callback: CallbackView, duplicate } (201, or 200 for a repeated requestKey)
 * Auth:   x-user-id (401) + requireOrgAdmin (403). Flags as the Riya routes (404 when off).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { callbackDeps, CallbackCreateSchema, CallbackListQuerySchema, createCallback, listCallbacks } from '@/server/sampark/callbacks';
import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { errorResponse, invalidRequest, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardRiyaRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const url = new URL(req.url);
    const q = CallbackListQuerySchema.safeParse({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
    if (!q.success) return invalidRequest(q.error);
    try {
        return NextResponse.json(await listCallbacks(await callbackDeps(await samparkContext()), guard.orgId, q.data.from, q.data.to));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CALLBACKS');
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardRiyaRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, CallbackCreateSchema);
    if ('response' in body) return body.response;
    try {
        const result = await createCallback(await callbackDeps(await samparkContext()), guard.orgId, guard.uid, body.data);
        return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CALLBACK_CREATE');
    }
}
