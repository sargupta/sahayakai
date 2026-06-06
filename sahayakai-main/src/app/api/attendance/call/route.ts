import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { TWILIO_LANGUAGE_MAP } from '@/types/attendance';
import { isValidE164 } from '@/lib/twilio-validate';
import { getEffectiveMode } from '@/lib/voice-pipeline/health';
import type { Language } from '@/types';

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 });
    }

    try {
        const body = await req.json().catch(() => null);
        if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        const { outreachId, parentLanguage } = body as {
            outreachId: string;
            parentLanguage: Language;
        };

        if (!outreachId || !parentLanguage) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify ownership of the outreach record AND get the server-stored parent phone.
        // SECURITY: Never trust a phone number from the request body — a teacher could
        // otherwise call any arbitrary number using our Twilio account.
        const db = await getDb();
        const outreachDoc = await db.collection('parent_outreach').doc(outreachId).get();
        if (!outreachDoc.exists) return NextResponse.json({ error: 'Outreach record not found' }, { status: 404 });
        const outreach = outreachDoc.data()!;
        if (outreach.teacherUid !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const parentPhone: string | undefined = outreach.parentPhone;
        if (!parentPhone || !isValidE164(parentPhone)) {
            return NextResponse.json({ error: 'Outreach record has no valid parent phone' }, { status: 422 });
        }

        // In test mode, override the destination number so all teachers can test
        // without calling real parents. Remove this env var to go live.
        const callTo = process.env.TWILIO_TEST_OVERRIDE_NUMBER || parentPhone;

        // Check that the language is supported for Twilio calls
        const langCode = TWILIO_LANGUAGE_MAP[parentLanguage];
        if (!langCode) {
            return NextResponse.json({
                error: `Auto-call not supported for ${parentLanguage}. Use WhatsApp copy instead.`
            }, { status: 422 });
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
            console.error('[attendance/call] Twilio error:', err);
            // Don't leak internal Twilio error details (can contain account SIDs, tokens)
            return NextResponse.json({ error: 'Failed to initiate call' }, { status: 502 });
        }

        const twilioData = await twilioRes.json();
        const callSid: string = twilioData.sid;

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
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
