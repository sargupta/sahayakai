import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { isDemoLanguage } from '@/lib/demo-call/scripts';
import {
    encryptPhone,
    isValidIndianMobile,
    reserveDemoCallSlot,
    verifyTurnstile,
} from '@/lib/demo-call/gates';

/**
 * PUBLIC endpoint (allowlisted in middleware) — "Hear the Call" lead magnet.
 * A visitor asks us to call THEIR OWN number once with a fixed demo script.
 *
 * Spec: docs/PARENT_CALL_DEMO_SPEC.md. Safety model, in order:
 *   flag off -> 503 | shape/consent -> 400 | +91 mobile + language -> 422
 *   Turnstile -> 403 | transactional gates (daily cap / IP / cooldown) -> 429
 *
 * No request field ever reaches TTS (scripts are server-side constants) and
 * no request field ever chooses the FROM number. The only caller-controlled
 * call parameter is the destination — which is the point of the demo — and
 * it is bounded by the gates above plus the self-identifying preamble in
 * every script.
 */

interface DemoCallBody {
    phone?: unknown;
    language?: unknown;
    consent?: unknown;
    turnstileToken?: unknown;
    utm?: unknown;
}

function clientIp(req: NextRequest): string {
    const fwd = req.headers.get('x-forwarded-for');
    return (fwd ? fwd.split(',')[0] : '').trim() || 'unknown';
}

/** Keep only expected small string fields; never store arbitrary client JSON. */
function sanitizeUtm(utm: unknown): Record<string, string> {
    if (!utm || typeof utm !== 'object') return {};
    const out: Record<string, string> = {};
    for (const key of ['source', 'medium', 'campaign'] as const) {
        const v = (utm as Record<string, unknown>)[key];
        if (typeof v === 'string' && v.length > 0) out[key] = v.slice(0, 64);
    }
    return out;
}

export async function POST(req: NextRequest) {
    // 1. Kill switch / feature flag (default OFF — see docs/FEATURE_FLAGS.md).
    if (process.env.DEMO_CALL_ENABLED !== 'true') {
        return NextResponse.json({ error: 'Demo calls are not available right now' }, { status: 503 });
    }
    // Refuse to run a public calling endpoint in prod without a real pepper —
    // hashed cooldown keys would be forgeable/collidable across deploys.
    if (process.env.NODE_ENV === 'production' && !process.env.DEMO_CALL_PEPPER) {
        console.error('[demo-call] DEMO_CALL_PEPPER missing in production — refusing');
        return NextResponse.json({ error: 'Demo calls are not available right now' }, { status: 503 });
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        return NextResponse.json({ error: 'Voice service not configured' }, { status: 503 });
    }

    // 2. Body shape + explicit consent.
    const body = (await req.json().catch(() => null)) as DemoCallBody | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    if (body.consent !== true) {
        return NextResponse.json({ error: 'Consent is required' }, { status: 400 });
    }

    // 3. Destination + language validation (cheap, before any network work).
    const phone = typeof body.phone === 'string' ? body.phone.replace(/[\s-]/g, '') : '';
    const normalizedPhone = /^[6-9]\d{9}$/.test(phone) ? `+91${phone}` : phone;
    if (!isValidIndianMobile(normalizedPhone)) {
        return NextResponse.json(
            { error: 'Enter an Indian mobile number (10 digits, starting 6 to 9)' },
            { status: 422 },
        );
    }
    if (!isDemoLanguage(body.language)) {
        return NextResponse.json({ error: 'Unsupported language' }, { status: 422 });
    }
    const language = body.language;

    // 4. Bot gate (skipped only when Turnstile is not provisioned).
    const ip = clientIp(req);
    const turnstileOk = await verifyTurnstile(
        typeof body.turnstileToken === 'string' ? body.turnstileToken : undefined,
        ip,
    );
    if (!turnstileOk) {
        return NextResponse.json({ error: 'Verification failed, please retry' }, { status: 403 });
    }

    try {
        // 5. Atomic abuse/cost gates (reserves the slot on success).
        const db = await getDb();
        const gate = await reserveDemoCallSlot(db, normalizedPhone, ip);
        if (!gate.ok) {
            const messages: Record<string, string> = {
                daily_cap: 'Today\'s free demo calls are finished. Please try tomorrow.',
                ip_limit: 'Demo limit reached from this connection. Please try tomorrow.',
                phone_repeat: 'This number already received its demo call. Sign up for 10 free parent calls instead.',
            };
            return NextResponse.json(
                { error: messages[gate.reason ?? 'daily_cap'] },
                { status: 429, headers: { 'Retry-After': '86400' } },
            );
        }

        // 6. Lead document — created BEFORE the provider call so even a
        // Twilio failure leaves an auditable row (status: failed).
        const { phoneEnc, phoneLast4 } = encryptPhone(normalizedPhone);
        const nowIso = new Date().toISOString();
        const leadRef = db.collection('demo_leads').doc();
        await leadRef.set({
            phoneEnc,
            phoneLast4,
            phoneHash: gate.phoneHash,
            ipHash: gate.ipHash,
            language,
            status: 'queued',
            callSid: null,
            utm: sanitizeUtm(body.utm),
            consent: true,
            followupState: 'none',
            createdAt: nowIso,
            updatedAt: nowIso,
        });

        // 7. Place the call. Same hard-won parameters as attendance/call
        // (Singapore edge, Method: GET on the TwiML fetch, machine detection).
        const callTo = process.env.TWILIO_TEST_OVERRIDE_NUMBER || normalizedPhone;
        const host = req.headers.get('host');
        const protocol = host?.includes('localhost') ? 'http' : 'https';
        const twimlUrl = `${protocol}://${host}/api/demo-call/twiml?leadId=${leadRef.id}&lang=${encodeURIComponent(language)}`;
        const statusCallbackUrl = `${protocol}://${host}/api/demo-call/status?leadId=${leadRef.id}`;

        const twilioAuth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
        const twilioRes = await fetch(
            `https://api.singapore.us1.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${twilioAuth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    To: callTo,
                    From: TWILIO_PHONE_NUMBER,
                    Url: twimlUrl,
                    // MUST stay GET — see the regression history comment in
                    // src/app/api/attendance/call/route.ts (May 2026, 2026-06-06):
                    // without it Twilio POSTs, and the listener's first words
                    // are an error prompt instead of the greeting.
                    Method: 'GET',
                    StatusCallback: statusCallbackUrl,
                    StatusCallbackEvent: 'initiated ringing answered completed',
                    StatusCallbackMethod: 'POST',
                    Timeout: '30',
                    MachineDetection: 'DetectMessageEnd',
                }).toString(),
            },
        );

        if (!twilioRes.ok) {
            const err = await twilioRes.json().catch(() => ({}));
            console.error('[demo-call] Twilio error:', twilioRes.status, (err as { code?: number }).code);
            await leadRef.update({ status: 'failed', updatedAt: new Date().toISOString() });
            // Never leak Twilio error bodies (can contain account identifiers).
            return NextResponse.json({ error: 'Could not place the call, please try again later' }, { status: 502 });
        }

        const twilioData = (await twilioRes.json()) as { sid?: string };
        await leadRef.update({
            callSid: twilioData.sid ?? null,
            status: 'initiated',
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ id: leadRef.id }, { status: 202 });
    } catch (error) {
        console.error('[demo-call] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
