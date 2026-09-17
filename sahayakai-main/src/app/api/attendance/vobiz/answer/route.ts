/**
 * Vobiz answer webhook — returns the call-control XML when a parent picks up.
 *
 * AUTH
 *
 * Vobiz does not sign its webhooks the way Twilio does, so there is no provider
 * signature to verify. Instead the URL itself is signed: `t` is a short-lived
 * token minted at dial time and bound to this one outreach record. An unsigned
 * or expired request gets a bare `<Response/>` — a valid document that ends the
 * call — rather than an error page, because Vobiz reads any non-XML body as a
 * failure and drops the leg in a way that is far harder to diagnose.
 *
 * The route is listed as a public API in `middleware.ts` (no user auth header
 * exists on a provider callback); the token above is what gates it.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { buildVobizAnswerXml, toWebSocketOrigin } from '@/lib/vobiz/answer-xml';
import { VOBIZ_DOMAINS, mintVobizToken, verifyVobizToken } from '@/lib/vobiz/tokens';

/** An XML document that simply ends the call. Used for every refusal. */
const EMPTY_RESPONSE = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

function xml(body: string, status = 200): NextResponse {
    return new NextResponse(body, {
        status,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
}

async function handle(req: NextRequest): Promise<NextResponse> {
    const url = new URL(req.url);
    const token = url.searchParams.get('t');

    // Vobiz POSTs the call parameters as form fields. They are read
    // best-effort: a GET, or a body we cannot parse, still yields valid XML.
    let form: FormData | null = null;
    if (req.method === 'POST') {
        form = await req.formData().catch(() => null);
    }
    const field = (name: string): string =>
        String(form?.get(name) ?? url.searchParams.get(name) ?? '');

    const outreachId = await verifyVobizToken(VOBIZ_DOMAINS.ANSWER, token);
    if (!outreachId) {
        // Deliberately terse: an unauthenticated caller learns nothing about
        // whether the record exists or the token merely expired.
        logger.warn('Vobiz answer webhook rejected — bad or expired token', 'ATTENDANCE');
        return xml(EMPTY_RESPONSE, 403);
    }

    const sidecarBase = process.env.NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL;
    const wsOrigin = sidecarBase ? toWebSocketOrigin(sidecarBase) : null;
    if (!wsOrigin) {
        logger.error(
            'Vobiz answer webhook cannot build a stream URL — NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL ' +
                'is unset or not http(s). The parent hears silence and the call ends.',
            undefined,
            'ATTENDANCE',
            { outreachId },
        );
        return xml(EMPTY_RESPONSE, 503);
    }

    // The provider's own id for this leg. Needed so the sidecar can hang up via
    // REST when the conversation finishes — closing the media socket does not
    // end a call held open by keepCallAlive.
    const callUuid = field('CallUUID') || field('call_uuid');

    const db = await getDb();
    const ref = db.collection('parent_outreach').doc(outreachId);
    const snap = await ref.get();
    if (!snap.exists) {
        logger.warn('Vobiz answer webhook for a missing outreach record', 'ATTENDANCE', { outreachId });
        return xml(EMPTY_RESPONSE, 404);
    }
    const data = snap.data()!;

    await ref
        .update({
            callStatus: 'initiated',
            vobizCallUuid: callUuid || null,
            answeredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
        .catch((e: unknown) => {
            // Bookkeeping must never cost the parent their call.
            logger.error('Vobiz answer: could not stamp outreach record', e, 'ATTENDANCE', { outreachId });
        });

    // A separate, purpose-scoped token: this one authorises the billable media
    // socket and nothing else. It is minted here rather than at dial time so its
    // lifetime starts when the parent actually answers.
    const { token: streamToken } = await mintVobizToken(VOBIZ_DOMAINS.STREAM, outreachId);

    const streamUrl =
        `${wsOrigin}/telephony/vobiz/stream` +
        `?t=${encodeURIComponent(streamToken)}` +
        `&cuid=${encodeURIComponent(callUuid)}` +
        `&lang=${encodeURIComponent(String(data.parentLanguage ?? 'English'))}`;

    return xml(buildVobizAnswerXml({ streamUrl }));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    return handle(req);
}

/** Vobiz may be configured for either verb; both must return the same document. */
export async function GET(req: NextRequest): Promise<NextResponse> {
    return handle(req);
}
