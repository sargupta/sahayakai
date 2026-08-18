import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioSignature } from '@/lib/twilio-validate';
import { DEMO_CALL_SCRIPTS, isDemoLanguage } from '@/lib/demo-call/scripts';
import { TWILIO_LANGUAGE_MAP, TWILIO_VOICE_MAP } from '@/types/attendance';

/**
 * TwiML for the "Hear the Call" demo (public route, Twilio-signature gated).
 *
 * One-way playback only: greeting-preamble + praise-call script + closing
 * pitch, rendered by the SAME Google <Say> voices the real parent calls use
 * (TWILIO_VOICE_MAP). No <Gather>, no user input, no Firestore read — the
 * script text is a server-side constant keyed by the validated lang param.
 */

const XML_HEADERS = { 'Content-Type': 'text/xml' } as const;

function escapeXml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function hangupXml(): string {
    return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';
}

export async function GET(req: NextRequest) {
    // Only Twilio may fetch call instructions — same gate as attendance/twiml.
    if (!validateTwilioSignature(req)) {
        console.warn('[demo-call/twiml] Invalid Twilio signature — rejecting');
        return new NextResponse(hangupXml(), { status: 403, headers: XML_HEADERS });
    }

    const lang = new URL(req.url).searchParams.get('lang');
    // Allowlist lookup — the param never touches file paths or Firestore.
    if (!isDemoLanguage(lang)) {
        return new NextResponse(hangupXml(), { headers: XML_HEADERS });
    }

    const langCode = TWILIO_LANGUAGE_MAP[lang] ?? 'en-IN';
    const voice = TWILIO_VOICE_MAP[lang] ?? 'Google.en-IN-Neural2-A';
    const script = DEMO_CALL_SCRIPTS[lang];

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say language="${langCode}" voice="${voice}">${escapeXml(script)}</Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;

    return new NextResponse(twiml, { headers: XML_HEADERS });
}
