import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Meta WhatsApp Cloud API webhook.
 *
 * GET:  verification handshake (`hub.challenge`)
 * POST: incoming-message events → forwarded to /api/assistant for the
 *       multilingual reply, then sent back via Cloud API.
 *
 * Set in Meta App dashboard:
 *   Callback URL: https://<host>/api/wa/webhook
 *   Verify token: matches META_WA_VERIFY_TOKEN env
 *
 * Subscribe the WABA to `messages` so this endpoint receives inbound DMs.
 */

const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN ?? '';
const APP_SECRET = process.env.META_APP_SECRET ?? '';

export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;
    const mode = params.get('hub.mode');
    const token = params.get('hub.verify_token');
    const challenge = params.get('hub.challenge');
    if (mode === 'subscribe' && token && token === VERIFY_TOKEN && challenge) {
        return new NextResponse(challenge, { status: 200 });
    }
    return NextResponse.json({ error: 'verification_failed' }, { status: 403 });
}

function verifySignature(rawBody: string, signature: string | null): boolean {
    if (!APP_SECRET || !signature) return false;
    const expected =
        'sha256=' +
        crypto.createHmac('sha256', APP_SECRET).update(rawBody, 'utf8').digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    const rawBody = await req.text();
    if (!verifySignature(rawBody, req.headers.get('x-hub-signature-256'))) {
        return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
    }
    let payload: unknown;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    // Process async — Meta retries if it doesn't get a 200 fast.
    void handleEvent(payload).catch(err => console.error('[wa/webhook] handler error', err));
    return NextResponse.json({ ok: true });
}

/**
 * Walks the Meta payload, extracts messages, forwards each to the
 * assistant brain, and posts the reply back through Cloud API.
 *
 * NOTE: stubbed end-to-end shape. Wire to `/api/assistant` once the
 * brand WhatsApp number + WABA + Cloud API access token are provisioned
 * (Week 0 of the social-automation plan).
 */
async function handleEvent(payload: unknown) {
    const entries = (payload as { entry?: Array<{ changes?: Array<{ value?: any }> }> }).entry ?? [];
    for (const entry of entries) {
        for (const change of entry.changes ?? []) {
            const msgs = change.value?.messages ?? [];
            for (const m of msgs) {
                console.log('[wa/webhook] message', { from: m.from, type: m.type, id: m.id });
                // TODO Week 1: dispatch to /api/assistant and reply via Cloud API.
            }
        }
    }
}
