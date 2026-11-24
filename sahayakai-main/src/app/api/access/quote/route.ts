import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { verifyTurnstile } from '@/lib/demo-call/gates';
import { createQuoteRequest, parseQuoteInput, reserveQuoteSlot } from '@/lib/access/quotes';
import { clientIp, errorResponse, readJsonObject, toErrorResponse } from '@/lib/access/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/access/quote — school quote request from the pricing estimator.
 *
 * PUBLIC endpoint (allowlisted in middleware). Safety model, in order:
 *   body shape + consistency -> 400 | Turnstile -> 403 |
 *   transactional daily cap / per-IP limit -> 429
 *
 * Validation runs before Turnstile so a malformed body costs no network
 * call; the caps run last so only well-formed, human-verified requests
 * consume a slot. The stored total is recomputed server-side.
 *
 * -> { ok: true, id }
 */
export async function POST(request: Request) {
    // Hashed IP keys must not be forgeable across deploys (same rule as the
    // demo-call endpoint, whose pepper this shares).
    // verifyTurnstile() passes when no secret is configured (local dev). In
    // production that would leave an anonymous write endpoint with no bot
    // check, so refuse outright instead.
    if (process.env.NODE_ENV === 'production' && !process.env.TURNSTILE_SECRET_KEY) {
        console.error('[access/quote] TURNSTILE_SECRET_KEY missing in production — refusing');
        return errorResponse(503, 'Quote requests are temporarily unavailable', 'NOT_CONFIGURED');
    }
    if (process.env.NODE_ENV === 'production' && !process.env.DEMO_CALL_PEPPER) {
        console.error('[access/quote] DEMO_CALL_PEPPER missing in production — refusing');
        return errorResponse(503, 'Quote requests are not available right now');
    }
    try {
        const body = await readJsonObject(request);
        const input = parseQuoteInput(body);

        const ip = clientIp(request);
        const turnstileOk = await verifyTurnstile(
            typeof body.turnstileToken === 'string' ? body.turnstileToken : undefined,
            ip,
        );
        if (!turnstileOk) return errorResponse(403, 'Verification failed, please retry', 'TURNSTILE_FAILED');

        const db = await getDb();
        const gate = await reserveQuoteSlot(db, ip);
        if (!gate.ok) {
            return NextResponse.json(
                {
                    error:
                        gate.reason === 'ip_limit'
                            ? 'Too many quote requests from this connection today. Please try tomorrow or write to contact@sargvision.com.'
                            : 'We have received a high number of quote requests today. Please try tomorrow or write to contact@sargvision.com.',
                    code: 'RATE_LIMITED',
                },
                { status: 429, headers: { 'Retry-After': '86400' } },
            );
        }

        const id = await createQuoteRequest(db, input, gate.ipHash);
        // Structured line so a log-based alert can notify sales. No PII.
        console.info(JSON.stringify({ severity: 'NOTICE', message: 'quote_request_received', id }));
        return NextResponse.json({ ok: true, id });
    } catch (err) {
        return toErrorResponse(err, '[access/quote]');
    }
}
