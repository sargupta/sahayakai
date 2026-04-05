import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { TWILIO_LANGUAGE_MAP } from '@/types/attendance';
import { isValidE164 } from '@/lib/twilio-validate';
import type { Language } from '@/types';

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 });
    }

    try {
        const body = await req.json();
        const { outreachId, to, parentLanguage } = body as {
            outreachId: string;
            to: string;
            parentLanguage: Language;
        };

        if (!outreachId || !to || !parentLanguage) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!isValidE164(to)) {
            return NextResponse.json({ error: 'Invalid phone number format. Must be E.164 (e.g. +919876543210)' }, { status: 400 });
        }

        // In test mode, override the destination number so all teachers can test
        // without calling real parents. Remove this env var to go live.
        const callTo = process.env.TWILIO_TEST_OVERRIDE_NUMBER || to;

        // Verify ownership of the outreach record
        const db = await getDb();
        const outreachDoc = await db.collection('parent_outreach').doc(outreachId).get();
        if (!outreachDoc.exists) return NextResponse.json({ error: 'Outreach record not found' }, { status: 404 });
        if (outreachDoc.data()!.teacherUid !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        // Check that the language is supported for Twilio calls
        const langCode = TWILIO_LANGUAGE_MAP[parentLanguage];
        if (!langCode) {
            return NextResponse.json({
                error: `Auto-call not supported for ${parentLanguage}. Use WhatsApp copy instead.`
            }, { status: 422 });
        }

        // Build the TwiML callback URL dynamically (handles all environments)
        const host = req.headers.get('host');
        const protocol = host?.includes('localhost') ? 'http' : 'https';
        const twimlUrl = `${protocol}://${host}/api/attendance/twiml?outreachId=${outreachId}`;
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
                    StatusCallback:      statusCallbackUrl,
                    StatusCallbackEvent: 'initiated ringing answered completed',
                    StatusCallbackMethod:'POST',
                    Timeout:             '30',            // Ring for 30s before giving up
                    MachineDetection:    'DetectMessageEnd', // Detect voicemail; wait for beep before playing message
                }).toString(),
            }
        );

        if (!twilioRes.ok) {
            const err = await twilioRes.json();
            console.error('[attendance/call] Twilio error:', err);
            return NextResponse.json({ error: 'Failed to initiate call', detail: err.message }, { status: 502 });
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
        return NextResponse.json({ error: error.message ?? 'Internal error' }, { status: 500 });
    }
}
