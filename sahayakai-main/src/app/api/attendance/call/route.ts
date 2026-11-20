import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { TWILIO_LANGUAGE_MAP } from '@/types/attendance';
import { isValidE164 } from '@/lib/twilio-validate';
import { checkCallingWindow, outsideCallingHoursBody } from '@/lib/calling-hours';
import { logger } from '@/lib/logger';
import { classifyTwilioFailure, releasesDedupWindow } from '@/lib/twilio-errors';
import { claimOutreachDial } from '@/lib/attendance/claim-dial';
import { getEffectiveMode } from '@/lib/voice-pipeline/health';
import { refuseIfParentOptedOut } from '@/lib/call-suppression';
import { isDestinationAllowed, placeVobizCall, readVobizConfig } from '@/lib/vobiz/client';
import { writeCallStatus, type CallStatusDb } from '@/lib/attendance/reconcile-call-status';
import { warmTelephony } from '@/lib/vobiz/warm';
import {
    VOBIZ_DOMAINS,
    VOBIZ_STATUS_TTL_SECONDS,
    mintVobizToken,
} from '@/lib/vobiz/tokens';
import type { Language } from '@/types';

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
async function forwardToExotel(userId: string, outreachId: string, callUrl: string): Promise<NextResponse> {
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
            return NextResponse.json(
                { error: data?.error ?? 'Failed to initiate call' },
                { status: res.status >= 400 && res.status < 600 ? res.status : 502 },
            );
        }
        // Voicebot returns its own call identifier; normalize to callSid for the modal.
        return NextResponse.json({ callSid: data?.callSid ?? data?.callId ?? data?.sid ?? 'exotel' });
    } catch (error) {
        console.error('[attendance/call] Exotel forward failed:', error);
        return NextResponse.json({ error: 'Failed to initiate call', code: 'CALL_NOT_PLACED' }, { status: 502 });
    }
}


/**
 * Ownership + destination for one outreach record.
 *
 * SECURITY: the number dialled is the one on the STUDENT'S RECORD now
 * (`classes/{classId}/students/{studentId}.parentPhone`), re-read at dial time
 * — never the request body, and never trusted merely because it was copied
 * onto the outreach doc. `POST /api/attendance/outreach-records` once stored a
 * client-supplied phone on the doc, which let a teacher make the company's
 * telephony account ring any number; fixing that one writer closed the
 * instance, and re-deriving the destination here closes the class: whatever a
 * present or future writer puts on the doc, a phone that does not match the
 * student record is refused before any provider is contacted.
 *
 * The class is re-checked too, so a teacher who has lost the class can no
 * longer call from an outreach they created while they owned it.
 *
 * Shared by every provider on purpose. These checks are the security boundary
 * of the whole feature, and when the Twilio path owned its own copy there was
 * nothing stopping a second provider from shipping with only some of them.
 */
type ResolvedTarget = { parentPhone: string; data: FirebaseFirestore.DocumentData };
type TargetResolution =
    | ({ ok: true } & ResolvedTarget)
    // `owned` once the record is confirmed to be this teacher's: only then may a
    // refusal mark it failed, so nobody can flip another teacher's record.
    | { ok: false; response: NextResponse; owned: false }
    | { ok: false; response: NextResponse; owned: true; category: string };

async function resolveOutreachTarget(
    db: FirebaseFirestore.Firestore,
    outreachId: string,
    userId: string,
): Promise<TargetResolution> {
    const snap = await db.collection('parent_outreach').doc(outreachId).get();
    if (!snap.exists) {
        return { ok: false, owned: false, response: NextResponse.json({ error: 'Outreach record not found', code: 'OUTREACH_NOT_FOUND' }, { status: 404 }) };
    }
    const data = snap.data()!;
    if (data.teacherUid !== userId) {
        return { ok: false, owned: false, response: NextResponse.json({ error: 'Unauthorized', code: 'FORBIDDEN' }, { status: 403 }) };
    }
    // Already dialled: the record belongs to the first request, whose call may be
    // ringing or in progress. Answer 409 BEFORE any other check, and as not-owned
    // so POST writes nothing: a refusal here (calling window just closed, parent
    // opted out, class or phone changed) would otherwise mark the live call
    // failed, and the first final state wins (gate: attendance-call-single-dial).
    // `callSid` covers records dialled before the claim existed.
    if (data.dialClaimedAt || data.callSid) {
        return { ok: false, owned: false, response: alreadyDialled({ userId, outreachId }) };
    }

    const classId = typeof data.classId === 'string' ? data.classId : '';
    const studentId = typeof data.studentId === 'string' ? data.studentId : '';
    if (!classId || !studentId) {
        return {
            ok: false,
            owned: true,
            category: 'outreach_incomplete',
            response: NextResponse.json({ error: 'Outreach record is missing its class or student', code: 'OUTREACH_INCOMPLETE' }, { status: 422 }),
        };
    }
    const classRef = db.collection('classes').doc(classId);
    const classDoc = await classRef.get();
    if (!classDoc.exists || classDoc.data()?.teacherUid !== userId) {
        return { ok: false, owned: true, category: 'class_not_owned', response: NextResponse.json({ error: 'Unauthorized', code: 'CLASS_NOT_OWNED' }, { status: 403 }) };
    }
    const studentDoc = await classRef.collection('students').doc(studentId).get();
    if (!studentDoc.exists) {
        return {
            ok: false,
            owned: true,
            category: 'student_not_found',
            response: NextResponse.json({ error: 'Student not found in this class', code: 'STUDENT_NOT_FOUND' }, { status: 404 }),
        };
    }

    const parentPhone: unknown = studentDoc.data()?.parentPhone;
    if (typeof parentPhone !== 'string' || !isValidE164(parentPhone)) {
        return {
            ok: false,
            owned: true,
            category: 'no_valid_parent_phone',
            response: NextResponse.json({ error: 'Student has no valid parent phone on record', code: 'NO_PARENT_PHONE' }, { status: 422 }),
        };
    }
    if (data.parentPhone !== parentPhone) {
        // Either the record was written with a number that is not the parent's,
        // or the teacher edited the student's phone since. Both are refused: the
        // first is the attack this function exists to stop, and the second only
        // costs the teacher a fresh outreach. The number itself is never logged.
        logger.warn('Parent call refused — outreach phone does not match the student record', 'ATTENDANCE', {
            userId,
            outreachId,
        });
        return {
            ok: false,
            owned: true,
            category: 'phone_mismatch',
            response: NextResponse.json(
                {
                    error: "The parent's phone on this outreach no longer matches the student record. Start a new outreach.",
                    code: 'PHONE_MISMATCH',
                },
                { status: 409 },
            ),
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
    config: NonNullable<ReturnType<typeof readVobizConfig>>,
): Promise<NextResponse> {
    // Start the sidecar's cold start now so it overlaps the ring (see warm.ts).
    // The target was resolved and checked in POST, before the provider switch.
    warmTelephony();

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
        // No call was placed, so the per-student dedup window is released for
        // the same reason the Twilio path releases it: the parent was never
        // disturbed, and holding the record "recent" only locks the teacher out.
        await writeCallStatus(db as unknown as CallStatusDb, outreachId, 'failed', {
            callFailureCategory: result.failure.category,
        }).catch((e: unknown) => {
            console.error('[attendance/call] could not mark outreach failed:', e);
        });
        const retryable = result.failure.category === 'network' || result.failure.category === 'provider_rejected';
        return NextResponse.json(
            {
                error: result.failure.category === 'invalid_destination'
                    ? 'Parent phone number is not callable'
                    : 'Failed to initiate call',
                code: result.failure.category.toUpperCase(),
                retryable,
            },
            { status: result.failure.category === 'invalid_destination' ? 422 : 502 },
        );
    }

    await writeCallStatus(db as unknown as CallStatusDb, outreachId, 'initiated', {
        callSid: result.handle.requestUuid,
        deliveryMethod: 'vobiz_call',
    });

    return NextResponse.json({ callSid: result.handle.requestUuid });
}

/**
 * The record was never dialled and ownership was already verified: mark it
 * failed so it does not read "Calling..." and does not hold the per-student
 * dedup window (only an explicit 'failed' releases it). Never fatal.
 */
async function markNotDialled(db: FirebaseFirestore.Firestore, outreachId: string, category: string): Promise<void> {
    await writeCallStatus(db as unknown as CallStatusDb, outreachId, 'failed', {
        callFailureCategory: category,
    }).catch((e: unknown) => {
        console.error('[attendance/call] could not mark outreach failed:', e);
    });
}

/** A call that will not be placed, and why, for the record. */
type Refusal = { category: string; response: NextResponse };

/**
 * Every reason this route refuses an owned record before contacting a
 * provider. Kept in one function so each refusal is released by the single
 * caller in POST (gate: attendance-call-refusals-gate.test.ts).
 */
function refuseBeforeDial(
    suppressed: NextResponse | null,
    ctx: { provider: string; parentLanguage: Language; userId: string; outreachId: string; destination: string },
): Refusal | null {
    // Quiet hours. Enforced HERE, ahead of the provider switch, so it binds every
    // caller equally — the modal's Try again, a scheduled retry, a cron sweep, or
    // a direct POST. Hiding a button is a courtesy; this is the guarantee.
    // A parent should never be phoned about their child's attendance at 2am.
    const window = checkCallingWindow();
    if (!window.allowed) {
        logger.warn(
            `Parent call refused outside calling hours (${window.istTime})`,
            'ATTENDANCE',
            { userId: ctx.userId, outreachId: ctx.outreachId, istHour: window.istHour },
        );
        return {
            category: 'outside_calling_hours',
            response: NextResponse.json(outsideCallingHoursBody(window), { status: 409 }),
        };
    }

    // The do-not-call list (looked up by the caller in POST, ahead of the
    // provider switch, so NO provider can be contacted for a parent who asked
    // not to be called; tests/call-suppression-gate enforces that order).
    if (suppressed) {
        return {
            category: suppressed.status === 409 ? 'parent_opted_out' : 'suppression_check_failed',
            response: suppressed,
        };
    }

    // The server's destination allow-list (CALL_ALLOWED_DESTINATIONS, set on staging and test
    // servers so they can never ring a real family). Checked for every provider, before any
    // provider is contacted.
    if (!isDestinationAllowed(ctx.destination)) {
        console.error('[attendance/call] DESTINATION_NOT_ALLOWED — refused by CALL_ALLOWED_DESTINATIONS; nothing dialled.');
        return {
            category: 'destination_not_allowed',
            response: NextResponse.json(
                { error: 'This destination is not allowed on this server.', code: 'DESTINATION_NOT_ALLOWED', retryable: false },
                { status: 403 },
            ),
        };
    }

    const unconfigured = (detail: string): Refusal => {
        console.error(`[attendance/call] PROVIDER_MISCONFIGURED — ${detail}. Operator action; retrying will not help.`);
        return {
            category: 'provider_unconfigured',
            response: NextResponse.json({ error: 'Voice service not configured', code: 'VOICE_NOT_CONFIGURED' }, { status: 503 }),
        };
    };
    if (ctx.provider === 'exotel') {
        return process.env.VOICE_EXOTEL_CALL_URL ? null : unconfigured('VOICE_PROVIDER=exotel but VOICE_EXOTEL_CALL_URL is not set');
    }
    if (ctx.provider === 'vobiz') {
        return readVobizConfig()
            ? null
            : unconfigured('VOICE_PROVIDER=vobiz but VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN / VOBIZ_FROM_NUMBER are not all set');
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        console.error('[attendance/call] PROVIDER_MISCONFIGURED — Twilio credentials or number are not set.');
        return {
            category: 'provider_unconfigured',
            response: NextResponse.json({ error: 'Twilio not configured', code: 'VOICE_NOT_CONFIGURED' }, { status: 503 }),
        };
    }
    // Check that the language is supported for Twilio calls
    if (!TWILIO_LANGUAGE_MAP[ctx.parentLanguage]) {
        return {
            category: 'language_unsupported',
            response: NextResponse.json(
                { error: `Auto-call not supported for ${ctx.parentLanguage}. Use WhatsApp copy instead.`, code: 'LANGUAGE_NOT_SUPPORTED' },
                { status: 422 },
            ),
        };
    }
    return null;
}

/** 409 for a repeated POST on an outreach record that has already been dialled. */
function alreadyDialled(ctx: { userId: string; outreachId: string }): NextResponse {
    logger.warn('Parent call refused: outreach already dialled', 'ATTENDANCE', { userId: ctx.userId, outreachId: ctx.outreachId });
    return NextResponse.json(
        { error: 'This call has already been placed. Start a new call to ring again.', code: 'ALREADY_DIALLED', retryable: false },
        { status: 409 },
    );
}

/** A refused call (to be released by POST) or the response of a call attempt. */
type CallOutcome =
    | { refused: true; category: string; response: NextResponse }
    | { refused: false; response: NextResponse };

/**
 * Everything after ownership is confirmed: the refusals, then the provider.
 * Returns ONLY a refusal from refuseBeforeDial or a provider's own response,
 * so POST can release every refusal in one place (and has a single return).
 */
async function placeOwnedCall(
    req: NextRequest,
    db: FirebaseFirestore.Firestore,
    target: ResolvedTarget,
    suppressed: NextResponse | null,
    ctx: { parentLanguage: Language; userId: string; outreachId: string },
): Promise<CallOutcome> {
    const provider = (process.env.VOICE_PROVIDER || 'twilio').toLowerCase();
    const override = provider === 'vobiz' ? process.env.VOBIZ_TEST_OVERRIDE_NUMBER : provider === 'twilio' ? process.env.TWILIO_TEST_OVERRIDE_NUMBER : undefined;
    const refusal = refuseBeforeDial(suppressed, { provider, ...ctx, destination: override || target.parentPhone });
    if (refusal) return { refused: true, ...refusal };

    // One dial per outreach record, claimed atomically before ANY provider is
    // contacted: a repeated POST (double click, retry loop, script) must not ring
    // the same parent again. "Try again" in the UI creates a new record.
    // NOT a refusal for POST to release: the first request owns this record and may be mid-call,
    // so markNotDialled must not mark it failed (gate: attendance-call-refusals-gate.test.ts).
    const claim = await claimOutreachDial(db as unknown as CallStatusDb, ctx.outreachId);
    if (!claim.ok) return { refused: false, response: alreadyDialled(ctx) };

    // Provider switch. Default 'twilio' preserves the existing batch TwiML path.
    // Set VOICE_PROVIDER=exotel to route attendance calls through the standalone
    // sahayakai-voice-call streaming voicebot (Sarvam STT/TTS + Gemini, 11 langs,
    // counselor-style interruption handling). The voicebot reads the same
    // parent_outreach doc (shared Firestore project) by id, so we only need to
    // forward the outreachId + the caller identity.
    if (provider === 'exotel') {
        // The voicebot dials the number on the outreach doc itself; ownership, the
        // destination and the opt-out were all checked above, before this switch.
        return { refused: false, response: await forwardToExotel(ctx.userId, ctx.outreachId, process.env.VOICE_EXOTEL_CALL_URL!) };
    }
    // Vobiz owns a real Indian origination number, so unlike the Twilio TRIAL
    // account it can actually reach a parent. It streams the leg into a live
    // conversation with VIDYA rather than reading a fixed script.
    if (provider === 'vobiz') {
        return { refused: false, response: await forwardToVobiz(req, db, ctx.outreachId, target, readVobizConfig()!) };
    }

    return { refused: false, response: await placeTwilioCall(req, db, ctx.outreachId, target) };
}

/** The Twilio batch TwiML path. Configuration and language were verified by refuseBeforeDial. */
async function placeTwilioCall(
    req: NextRequest,
    db: FirebaseFirestore.Firestore,
    outreachId: string,
    target: ResolvedTarget,
): Promise<NextResponse> {
    // All three were verified by refuseBeforeDial.
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env as Record<string, string>;

    try {

        // Ownership, destination, suppression, configuration and language were
        // all verified above, shared by every provider so they cannot drift.
        const parentPhone = target.parentPhone;

        // In test mode, override the destination number so all teachers can test
        // without calling real parents. Remove this env var to go live.
        const callTo = process.env.TWILIO_TEST_OVERRIDE_NUMBER || parentPhone;

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

            // Release the per-student dedup window when the attempt is
            // definitively dead. That window exists to stop a parent being
            // called repeatedly — but here no call was ever placed, so leaving
            // the record "recent" locks the teacher out for five minutes to
            // protect a parent who was never disturbed.
            if (releasesDedupWindow(failure)) {
                await writeCallStatus(db as unknown as CallStatusDb, outreachId, 'failed', {
                    callFailureCategory: failure.category,
                }).catch((e: unknown) => {
                    // Never let bookkeeping mask the error the teacher needs.
                    console.error('[attendance/call] could not mark outreach failed:', e);
                });
            }

            return NextResponse.json(
                { error: failure.error, code: failure.code, retryable: failure.retryable },
                { status: failure.status },
            );
        }

        const twilioData = await twilioRes.json();
        const callSid: string = twilioData.sid;

        // Update outreach record with callSid
        await writeCallStatus(db as unknown as CallStatusDb, outreachId, 'initiated', {
            callSid,
            deliveryMethod: 'twilio_call',
        });

        return NextResponse.json({ callSid });
    } catch (error: any) {
        console.error('[attendance/call] Error:', error);
        // Don't leak internal error messages (may contain stack, secrets, service paths)
        return NextResponse.json({ error: 'Internal error', code: 'INTERNAL' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHENTICATED' }, { status: 401 });

    // Parse the body once up front — both the Exotel and Twilio providers need it,
    // and req.json() can only be consumed a single time.
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_REQUEST' }, { status: 400 });
    const { outreachId, parentLanguage } = body as {
        outreachId: string;
        parentLanguage: Language;
    };
    if (!outreachId || !parentLanguage) {
        return NextResponse.json({ error: 'Missing required fields', code: 'INVALID_REQUEST' }, { status: 400 });
    }

    // Ownership and the server-stored destination first: until the record is
    // known to be this teacher's, a refusal must not touch it.
    //
    // A Firestore error here must still answer in JSON. Uncaught, Next.js sends
    // an empty 500 the modal cannot parse, and the teacher sees a JSON parse
    // error instead of a message (gate: attendance-call-json-errors-gate).
    let db: FirebaseFirestore.Firestore;
    let target: TargetResolution;
    try {
        db = await getDb();
        target = await resolveOutreachTarget(db, outreachId, userId);
    } catch (error) {
        console.error('[attendance/call] target resolution failed:', error);
        return NextResponse.json({ error: 'Internal error', code: 'INTERNAL', retryable: true }, { status: 500 });
    }
    if (!target.ok) {
        if (target.owned) await markNotDialled(db, outreachId, target.category);
        return target.response;
    }

    // REFUSAL-GATE: ownership confirmed. From here POST has exactly ONE return.
    // Every refusal comes back from placeOwnedCall as { refused: true } and is
    // released here: the modal created the record 'initiated' before calling
    // this route, and a record left 'initiated' reads as a call in progress and
    // holds the per-student dedup window although nobody was dialled
    // (gate: attendance-call-refusals-gate.test.ts).
    const suppressed = await refuseIfParentOptedOut(db, target.parentPhone);
    const outcome = await placeOwnedCall(req, db, target, suppressed, { parentLanguage, userId, outreachId });
    if (outcome.refused) await markNotDialled(db, outreachId, outcome.category);
    return outcome.response;
}
