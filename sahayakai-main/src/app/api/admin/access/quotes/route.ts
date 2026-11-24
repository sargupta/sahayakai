import { NextResponse } from 'next/server';
import { isQuoteStatus, listQuoteRequests, updateQuoteStatus } from '@/lib/access/quotes';
import {
    errorResponse,
    isSafeDocId,
    readJsonObject,
    requireSahayakAdmin,
    toErrorResponse,
} from '@/lib/access/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * /api/admin/access/quotes — school quote requests. SahayakAI administrators only.
 *
 * GET   ?status=new|contacted|qualified|closed (omit for all) -> { quotes: [...] }
 * PATCH { id, status } -> { ok: true }
 */
export async function GET(request: Request) {
    try {
        await requireSahayakAdmin(request);
        const raw = new URL(request.url).searchParams.get('status');
        if (raw !== null && raw !== '' && !isQuoteStatus(raw)) return errorResponse(400, 'Invalid status');
        return NextResponse.json({ quotes: await listQuoteRequests(raw && isQuoteStatus(raw) ? raw : null) });
    } catch (err) {
        return toErrorResponse(err, '[admin/access/quotes GET]');
    }
}

export async function PATCH(request: Request) {
    try {
        const actor = await requireSahayakAdmin(request);
        const body = await readJsonObject(request);
        if (!isSafeDocId(body.id)) return errorResponse(400, 'Invalid id');
        if (!isQuoteStatus(body.status)) return errorResponse(400, 'Invalid status');
        await updateQuoteStatus(body.id, body.status, actor);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return toErrorResponse(err, '[admin/access/quotes PATCH]');
    }
}
