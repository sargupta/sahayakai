/**
 * GET    /api/sampark/[orgId]/google-calendar/events/[eventId] — one event (a series
 *        master when asked by its id).
 * PATCH  { event: EventInput, scope: 'this' | 'series' } — edit one occurrence or the
 *        whole series it belongs to.
 * DELETE ?scope=this|series — cancel one occurrence or the whole series. Cancelling
 *        an event already gone succeeds with `alreadyCancelled: true`.
 * Auth:  x-user-id (401) + requireOrgAdmin (403). Sampark flag (404).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { EventInputSchema, EventScopeSchema } from '@/lib/sampark/google-calendar/types';
import { cancelGoogleEvent, getGoogleEvent, googleCalendarDeps, updateGoogleEvent } from '@/server/sampark/google-calendar';
import { errorResponse, guardOrgRoute, invalidRequest, parseBody } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };
const EventIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,1024}$/, 'invalid eventId');
const PatchSchema = z.object({ event: EventInputSchema, scope: EventScopeSchema }).strict();

async function guardEvent(req: NextRequest, ctx: Ctx) {
    const p = await ctx.params;
    const guard = await guardOrgRoute(req, p.orgId);
    if ('response' in guard) return guard;
    const id = EventIdSchema.safeParse(p.eventId);
    if (!id.success) return { response: invalidRequest(id.error) };
    return { ...guard, eventId: id.data };
}

export async function GET(req: NextRequest, ctx: Ctx) {
    const g = await guardEvent(req, ctx);
    if ('response' in g) return g.response;
    try {
        return NextResponse.json(await getGoogleEvent(await googleCalendarDeps(), g.orgId, g.eventId));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_EVENT');
    }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
    const g = await guardEvent(req, ctx);
    if ('response' in g) return g.response;
    const body = await parseBody(req, PatchSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(await updateGoogleEvent(await googleCalendarDeps(), g.orgId, g.eventId, body.data.event, body.data.scope));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_UPDATE');
    }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
    const g = await guardEvent(req, ctx);
    if ('response' in g) return g.response;
    const scope = EventScopeSchema.safeParse(new URL(req.url).searchParams.get('scope') ?? 'this');
    if (!scope.success) return invalidRequest(scope.error);
    try {
        return NextResponse.json(await cancelGoogleEvent(await googleCalendarDeps(), g.orgId, g.eventId, scope.data));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_CANCEL');
    }
}
