import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { TWILIO_LANGUAGE_MAP } from '@/types/attendance';
import { isValidE164 } from '@/lib/twilio-validate';
import { checkCallingWindow } from '@/lib/calling-hours';
import { logger } from '@/lib/logger';
import { classifyTwilioFailure } from '@/lib/twilio-errors';
import { getEffectiveMode } from '@/lib/voice-pipeline/health';
import { refuseIfParentOptedOut } from '@/lib/call-suppression';
import { placeVobizCall, readVobizConfig } from '@/lib/vobiz/client';
import {
    VOBIZ_DOMAINS,
    VOBIZ_STATUS_TTL_SECONDS,
    mintVobizToken,
} from '@/lib/vobiz/tokens';
import type { Language } from '@/types';

/**
 * Per-request facts the wrapper needs to keep the outreach record truthful.
 *
 * `callPlaced` flips true the instant a provider ACCEPTS the call. From then on
 * the record must never be rewritten as failed, even if later bookkeeping
 * throws — a call that is ringing a parent is not a failed call.
 */
interface DialContext {
    callPlaced: boolean;
}

/**
 * Why a refusal happened, keyed by the response object so the single choke point
 * in POST can record it without re-reading a body.
 */
const refusalCategories = new WeakMap<object, string>();

function refuse(body: Record<string, unknown>, status: number, category: string): NextResponse {
    const res = NextResponse.json(body, { status });
    refusalCategories.set(res, category);
    return res;
}

/**
 * Make the outreach record say what happened: this dial never took place.
 *
 * WHY: the outreach route creates the record before any call exists, and its
 * 5-minute per-student dedup counts every record that is not `failed`. Every
 * refusal that left the record untouched (calling hours, opt-out, bad phone,
 * provider down...) therefore locked the teacher out of retrying for five
 * minutes — and the modal kept showing a call in flight — for a call that was
 * never made. POST funnels EVERY non-2xx through this, so a new early return
 * cannot forget it (tests: attendance-call-refusal-state.test.ts).
 *
 * Never touches a record that already has a callSid or a call in progress, and
 * never throws: bookkeeping must not mask the refusal the teacher needs to see.
 */
async function releaseOutreach(
    db: FirebaseFirestore.Firestore,
    outreachId: string,
    before: FirebaseFirestore.DocumentData,
    category: string,
): Promise<void> {
    const status = before.callStatus as string | undefined;
    const untouchable =
        !!before.callSid ||
        (status !== undefined && status !== 'pending' && status !== 'initiated' && status !== 'failed');
    if (untouchable) return;
    try {
        await db.collection('parent_outreach').doc(outreachId).update({
            callStatus: 'failed',
            callFailureCategory: category,
            updatedAt: new Date().toISOString(),
        });
    } catch (e) {
        console.error('[attendance/call] could not mark outreach failed:', e);
    }
}

/**
 * Route the attendance call through the standalone sahayakai-voice-call service
 * (Exotel WebSocket streaming voicebot). That service performs its own ownership
 * verification and server-side phone lookup against the SAME parent_outreach doc
 * (shared Firestore project), so we forward only the outreachId + caller identity.
 *
 * Config:
 *   VOICE_EXOTEL_CALL_URL — full URL of the voicebot's start-call endpoint,
 *     e.g. https://sahayakai-voice-call-xxxx.a.run.app/api/exotel/call
 */
async function forwardToExotel(
    userId: string,
    outreachId: string,
    ctx: DialContext,
): Promise<NextResponse> {
    const callUrl = process.env.VOICE_EXOTEL_CALL_URL;
    if (!callUrl) {
        console.error('[attendance/call] VOICE_PROVIDER=exotel but VOICE_EXOTEL_CALL_URL is not set');
        return refuse({ error: 'Voice service not configured' }, 503, 'provider_unconfigured');
    }
    try {
        const res = await fetch(callUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // The voicebot authorizes the call by matching outreach.teacherUid
                // against this header (same identity model as the main app middleware).
                'x-user-id': userId,
            },
            body: JSON.stringify({ outreachId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error('[attendance/call] Exotel voicebot error:', res.status, data?.error);
            // Surface the upstream status so the modal can show a useful message
            // (e.g. 422 no-phone, 403 ownership) without leaking internals.
            return refuse(
                { error: data?.error ?? 'Failed to initiate call' },
                res.status >= 400 && res.status < 600 ? res.status : 502,
                'provider_rejected',
            );
        }
        ctx.callPlaced = true;
        // Voicebot returns its own call identifier; normalize to callSid for the modal.
        return NextResponse.json({ callSid: data?.callSid ?? data?.callId ?? data?.sid ?? 'exotel' });
    } catch (error) {
        console.error('[attendance/call] Exotel forward failed:', error);
        return refuse({ error: 'Failed to initiate call' }, 502, 'network');
    }
}


/**
 * Ownership + destination for one outreach record.
 *
 * SECURITY: the parent's phone number is read from the server-stored document,
 * never from the request body. A teacher who could supply the destination could
 * dial any number on the company's telephony account.
 *
 * Shared by both providers on purpose. These four checks are the security
 * boundary of the whole feature, and when the Twilio path owned its own copy
 * there was nothing stopping a second provider from shipping with three of them.
 */
type ResolvedTarget = { parentPhone: string; data: FirebaseFirestore.DocumentData };
type TargetResolution =
    | ({ ok: true } & ResolvedTarget)
    // `owned` is set once ownership is proven, so the caller may correct the
    // record's state; it is deliberately absent for 404/403.
    | { ok: false; response: NextResponse; owned?: FirebaseFirestore.DocumentData };

async function resolveOutreachTarget(
    db: FirebaseFirestore.Firestore,
    outreachId: string,
    userId: string,
): Promise<TargetResolution> {
    const snap = await db.collection('parent_outreach').doc(outreachId).get();
    if (!snap.exists) {
        return { ok: false, response: NextResponse.json({ error: 'Outreach record not found' }, { status: 404 }) };
    }
    const data = snap.data()!;
    if (data.teacherUid !== userId) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) };
    }
    const parentPhone: string | undefined = data.parentPhone;
    if (!parentPhone || !isValidE164(parentPhone)) {
        return {
            ok: false,
            response: refuse({ error: 'Outreach record has no valid parent phone' }, 422, 'invalid_destination'),
            owned: data,
        };
    }
    return { ok: true, parentPhone, data };
}

/**
 * Place the call through Vobiz, which streams the parent into a live
 * conversation with VIDYA rather than reading a script at them.
 *
 * Unlike the Twilio path there is no per-language TTS voice to select here: the
 * conversation is spoken by the Live model in the sidecar, so language travels
 * as context on the stream URL instead of as a voice id.
 */
async function forwardToVobiz(
    req: NextRequest,
    db: FirebaseFirestore.Firestore,
    outreachId: string,
    target: ResolvedTarget,
    ctx: DialContext,
): Promise<NextResponse> {
    const config = readVobizConfig();
    if (!config) {
        console.error(
            '[attendance/call] PROVIDER_MISCONFIGURED — VOICE_PROVIDER=vobiz but ' +
            'VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN / VOBIZ_FROM_NUMBER are not all set. ' +
            'Operator action; retrying will not help.',
        );
        return refuse({ error: 'Voice service not configured' }, 503, 'provider_unconfigured');
    }

    // Same escape hatch the Twilio path has: lets a teacher exercise the flow
    // without dialling a real parent. Unset it to go live.
    const callTo = process.env.VOBIZ_TEST_OVERRIDE_NUMBER || target.parentPhone;

    const host = req.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const base = `${protocol}://${host}`;

    // Two purpose-scoped tokens. The status token lives far longer because its
    // webhook fires when the call ENDS, not when it starts.
    const [answer, status] = await Promise.all([
        mintVobizToken(VOBIZ_DOMAINS.ANSWER, outreachId),
        mintVobizToken(VOBIZ_DOMAINS.STATUS, outreachId, VOBIZ_STATUS_TTL_SECONDS),
    ]);

    const result = await placeVobizCall(config, {
        to: callTo,
        answerUrl: `${base}/api/attendance/vobiz/answer?t=${encodeURIComponent(answer.token)}`,
        hangupUrl: `${base}/api/attendance/vobiz/status?kind=hangup&t=${encodeURIComponent(status.token)}`,
        ringUrl: `${base}/api/attendance/vobiz/status?kind=ring&t=${encodeURIComponent(status.token)}`,
    });

    if (!result.ok) {
        console.error(
            `[attendance/call] Vobiz failure category=${result.failure.category} ` +
            `httpStatus=${result.failure.status ?? 'none'}`,
        );
        if (result.failure.category === 'provider_unconfigured') {
            console.error(
                '[attendance/call] PROVIDER_MISCONFIGURED — Vobiz rejected our credentials. ' +
                'No calls can be placed until they are corrected. Operator action.',
            );
        }
        // No call was placed. POST marks the record failed (releasing the
        // per-student dedup window) for every non-2xx, this one included.
        const retryable = result.failure.category === 'network' || result.failure.category === 'provider_rejected';
        return refuse(
            {
                error: result.failure.category === 'invalid_destination'
                    ? 'Parent phone number is not callable'
                    : 'Failed to initiate call',
                code: result.failure.category.toUpperCase(),
                retryable,
            },
            result.failure.category === 'invalid_destination' ? 422 : 502,
            result.failure.category,
        );
    }
    ctx.callPlaced = true;

    await db.collection('parent_outreach').doc(outreachId).update({
        callSid: result.handle.requestUuid,
        callStatus: 'initiated',
        deliveryMethod: 'vobiz_call',
        updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ callSid: result.handle.requestUuid });
}

/**
 * Everything after ownership is proven. Returns a response; POST decides what
 * that means for the outreach record.
 */
async function dispatchCall(
    req: NextRequest,
    db: FirebaseFirestore.Firestore,
    userId: string,
    outreachId: string,
    parentLanguage: Language | undefined,
    target: ResolvedTarget,
    ctx: DialContext,
): Promise<NextResponse> {
    if (!parentLanguage) {
        return refuse({ error: 'Missing required fields' }, 400, 'invalid_request');
    }

    // Quiet hours. Enforced HERE, ahead of the provider switch, so it binds every
    // caller equally — the modal's Try again, a scheduled retry, a cron sweep, or
    // a direct POST. Hiding a button is a courtesy; this is the guarantee.
    // A parent should never be phoned about their child's attendance at 2am.
    const window = checkCallingWindow();
    if (!window.allowed) {
        logger.warn(
            `Parent call refused outside calling hours (${window.istTime})`,
            'ATTENDANCE',
            { userId, outreachId, istHour: window.istHour },
        );
        return refuse(
            {
                error: window.reason,
                code: 'OUTSIDE_CALLING_HOURS',
                nextAllowedAt: window.nextAllowedAt?.toISOString() ?? null,
            },
            409,
            'outside_calling_hours',
        );
    }

    // The do-not-call list. Runs ahead of the provider switch so NO provider can
    // be contacted for a parent who asked not to be called
    // (attendance-call-suppression-gate.test.ts enforces this order).
    const suppressed = await refuseIfParentOptedOut(db, target.parentPhone);
    if (suppressed) {
        refusalCategories.set(suppressed, 'opted_out');
        return suppressed;
    }

    // Provider switch. Default 'twilio' preserves the existing batch TwiML path.
    // Set VOICE_PROVIDER=exotel to route attendance calls through the standalone
    // sahayakai-voice-call streaming voicebot (Sarvam STT/TTS + Gemini, 11 langs,
    // counselor-style interruption handling). The voicebot reads the same
    // parent_outreach doc (shared Firestore project) by id, so we only need to
    // forward the outreachId + the caller identity.
    const provider = (process.env.VOICE_PROVIDER || 'twilio').toLowerCase();
    if (provider === 'exotel') {
        return forwardToExotel(userId, outreachId, ctx);
    }
    // Vobiz owns a real Indian origination number, so unlike the Twilio TRIAL
    // account it can actually reach a parent. It streams the leg into a live
    // conversation with VIDYA rather than reading a fixed script.
    if (provider === 'vobiz') {
        return forwardToVobiz(req, db, outreachId, target, ctx);
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        return refuse({ error: 'Twilio not configured' }, 503, 'provider_unconfigured');
    }

    try {
        // Ownership, destination and suppression were verified by POST, shared by
        // every provider so they cannot drift apart on the security checks.
        const parentPhone = target.parentPhone;

        // In test mode, override the destination number so all teachers can test
        // without calling real parents. Remove this env var to go live.
        const callTo = process.env.TWILIO_TEST_OVERRIDE_NUMBER || parentPhone;

        // Check that the language is supported for Twilio calls
        const langCode = TWILIO_LANGUAGE_MAP[parentLanguage];
        if (!langCode) {
            return refuse({
                error: `Auto-call not supported for ${parentLanguage}. Use WhatsApp copy instead.`
            }, 422, 'unsupported_language');
        }

        // Determine pipeline mode (streaming if orchestrator is healthy, else batch)
        const pipelineMode = await getEffectiveMode();

        // Build the TwiML callback URL dynamically (handles all environments)
        const host = req.headers.get('host');
        const protocol = host?.includes('localhost') ? 'http' : 'https';
        const twimlUrl = `${protocol}://${host}/api/attendance/twiml?outreachId=${outreachId}&mode=${pipelineMode}`;
        const statusCallbackUrl = `${protocol}://${host}/api/attendance/twiml-status`;

        // Initiate Twilio call via REST API
        // Use Singapore edge for lower latency to India (asia-south1 deployment)
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
                    To:                  callTo,
                    From:                TWILIO_PHONE_NUMBER,
                    Url:                 twimlUrl,
                    // The initial TwiML URL MUST be fetched with GET — our route's
                    // GET handler delivers the greeting + teacher message + first
                    // <Gather>. Without this, Twilio defaults to POST, hits our
                    // POST branch which expects a SpeechResult, sees nothing, and
                    // plays the "didn't catch that" prompt (e.g. Marathi
                    // "क्षमा करा, मला ऐकू आले नाही") as the first thing the parent
                    // hears — instead of the actual greeting.
                    //
                    // History: this regression was first reported + fixed in May
                    // 2026 on a stale claude/* branch (db2312735) that never
                    // merged to main. The 2026-06-06 forensic-wave rewrite of the
                    // calls.create body using `URLSearchParams({...})` literal
                    // form dropped the param again. User-reported symptom both
                    // times: "started saying 'i don't understand'... not started
                    // with greeting".
                    Method:              'GET',
                    StatusCallback:      statusCallbackUrl,
                    StatusCallbackEvent: 'initiated ringing answered completed',
                    StatusCallbackMethod:'POST',
                    Timeout:             '30',            // Ring for 30s before giving up
                    MachineDetection:    'DetectMessageEnd', // Detect voicemail; wait for beep before playing message
                }).toString(),
            }
        );

        if (!twilioRes.ok) {
            const err = await twilioRes.json().catch(() => ({}));
            const failure = classifyTwilioFailure(err?.code, twilioRes.status);

            // Log the category explicitly so a misconfigured account is
            // greppable and alertable instead of hiding inside a generic 502.
            // The Twilio body is logged but NEVER returned — it can carry
            // account identifiers.
            console.error(
                `[attendance/call] Twilio failure category=${failure.category} ` +
                `httpStatus=${twilioRes.status}`,
                err,
            );
            if (failure.category === 'provider_unconfigured') {
                console.error(
                    '[attendance/call] PROVIDER_MISCONFIGURED — no calls can be placed ' +
                    'until the Twilio credentials or number are corrected. Operator ' +
                    'action; retrying will not help.',
                );
            }

            // Twilio refused, so no call exists. POST marks the record failed
            // for EVERY refusal, retryable ones included: before, a transient
            // 429/5xx left it "initiated" and the teacher's retry bounced off
            // the dedup window — protecting a parent who was never called.
            return refuse(
                { error: failure.error, code: failure.code, retryable: failure.retryable },
                failure.status,
                failure.category,
            );
        }

        const twilioData = await twilioRes.json();
        const callSid: string = twilioData.sid;
        ctx.callPlaced = true;

        // Update outreach record with callSid
        await db.collection('parent_outreach').doc(outreachId).update({
            callSid,
            callStatus: 'initiated',
            deliveryMethod: 'twilio_call',
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ callSid });
    } catch (error: any) {
        console.error('[attendance/call] Error:', error);
        // Don't leak internal error messages (may contain stack, secrets, service paths)
        return refuse({ error: 'Internal error' }, 500, 'internal_error');
    }
}

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Parse the body once up front — both the Exotel and Twilio providers need it,
    // and req.json() can only be consumed a single time.
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const { outreachId, parentLanguage } = body as {
        outreachId?: string;
        parentLanguage?: Language;
    };
    if (!outreachId) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ownership + server-stored destination first, for every provider. A 404/403
    // here touches nothing: the record is missing or someone else's.
    let db: FirebaseFirestore.Firestore;
    let target: TargetResolution;
    try {
        db = await getDb();
        target = await resolveOutreachTarget(db, outreachId, userId);
    } catch (error) {
        console.error('[attendance/call] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
    if (!target.ok) {
        if (target.owned) {
            await releaseOutreach(db, outreachId, target.owned, refusalCategories.get(target.response) ?? 'refused');
        }
        return target.response;
    }

    // THE CHOKE POINT. Ownership is proven, so any non-2xx from here on means a
    // call was not placed — and the record must say so (see releaseOutreach).
    const ctx: DialContext = { callPlaced: false };
    let res: NextResponse;
    try {
        res = await dispatchCall(req, db, userId, outreachId, parentLanguage, target, ctx);
    } catch (error) {
        console.error('[attendance/call] Error:', error);
        res = refuse({ error: 'Internal error' }, 500, 'internal_error');
    }
    if (res.status >= 400 && !ctx.callPlaced) {
        await releaseOutreach(db, outreachId, target.data, refusalCategories.get(res) ?? 'refused');
    }
    return res;
}
