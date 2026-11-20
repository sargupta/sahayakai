/**
 * GET   /api/sampark/[orgId]/callbacks/[callbackId] — one callback (its call's state joined)
 *       and its audit trail (`history`, newest first: created, confirmed, rescheduled,
 *       cancelled, started with its Riya call id, retried, failed, missed).
 * PATCH /api/sampark/[orgId]/callbacks/[callbackId] — one action:
 *   { action: 'preview', scheduledAt, timeZone }                                   nothing written
 *   { action: 'reschedule' | 'confirm', scheduledAt, timeZone, confirmedAnnouncement, expectedVersion }
 *   { action: 'cancel', expectedVersion }
 * State changes go through the callback state machine inside a transaction: a stale
 * expectedVersion → 409 CALLBACK_CHANGED; a call being started → 409 CALLBACK_IN_PROGRESS.
 * Auth:   x-user-id (401) + requireOrgAdmin (403); the id is read only inside this school.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { callbackDeps, CallbackUpdateSchema, getCallback, getCallbackHistory, updateCallback } from '@/server/sampark/callbacks';
import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { DocIdSchema, errorResponse, invalidRequest, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ orgId: string; callbackId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const p = await params;
    const guard = await guardRiyaRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse(p.callbackId);
    if (!id.success) return invalidRequest(id.error);
    try {
        const deps = await callbackDeps(await samparkContext());
        const [callback, history] = await Promise.all([getCallback(deps, guard.orgId, id.data), getCallbackHistory(deps, guard.orgId, id.data)]);
        return NextResponse.json({ callback, history });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CALLBACK');
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    const p = await params;
    const guard = await guardRiyaRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse(p.callbackId);
    if (!id.success) return invalidRequest(id.error);
    const body = await parseBody(req, CallbackUpdateSchema);
    if ('response' in body) return body.response;
    try {
        const result = await updateCallback(await callbackDeps(await samparkContext()), guard.orgId, guard.uid, id.data, body.data);
        return NextResponse.json(body.data.action === 'preview' ? { preview: result } : { callback: result });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CALLBACK_UPDATE');
    }
}
