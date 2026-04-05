import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { TWILIO_LANGUAGE_MAP, TWILIO_VOICE_MAP, CALL_MENU_PROMPTS } from '@/types/attendance';
import { validateTwilioSignature, validateTwilioSignaturePost } from '@/lib/twilio-validate';
import { generateAgentReply } from '@/ai/flows/parent-call-agent';
import type { TranscriptTurn } from '@/types/attendance';
import type { Language } from '@/types';

const MAX_TURNS = 6;
const SPEECH_TIMEOUT = 'auto'; // Twilio auto-detects end of speech

// ── Twilio speech language codes (for recognition, not TTS) ─────────────────
const SPEECH_LANGUAGE_MAP: Record<string, string> = {
    'en-IN': 'en-IN',
    'hi-IN': 'hi-IN',
    'kn-IN': 'kn-IN',
    'ta-IN': 'ta-IN',
    'te-IN': 'te-IN',
    'ml-IN': 'ml-IN',
    'bn-IN': 'bn-IN',
    'mr-IN': 'mr-IN',
    'gu-IN': 'gu-IN',
    'pa-IN': 'pa-Guru-IN', // Twilio uses this for Punjabi speech recognition
};

// ── GET: Initial call pickup — deliver greeting + teacher message + first <Gather> ──

export async function GET(req: NextRequest) {
    if (!validateTwilioSignature(req)) {
        console.warn('[twiml] Invalid Twilio signature — rejecting');
        return new NextResponse(hangupXml(), { status: 403, headers: XML_HEADERS });
    }

    const outreachId = new URL(req.url).searchParams.get('outreachId');
    if (!outreachId) return new NextResponse(hangupXml(), { headers: XML_HEADERS });

    try {
        const db = await getDb();
        const doc = await db.collection('parent_outreach').doc(outreachId).get();

        if (!doc.exists) return new NextResponse(hangupXml(), { headers: XML_HEADERS });

        const data = doc.data()!;
        const message: string = data.generatedMessage || '';
        const language = data.parentLanguage as Language;

        if (!message) return new NextResponse(hangupXml(), { headers: XML_HEADERS });

        const langCode = TWILIO_LANGUAGE_MAP[language] ?? 'en-IN';
        const voice = TWILIO_VOICE_MAP[language] ?? 'Google.en-IN-Neural2-A';
        const prompts = CALL_MENU_PROMPTS[langCode] ?? CALL_MENU_PROMPTS['en-IN'];
        const speechLang = SPEECH_LANGUAGE_MAP[langCode] ?? 'en-IN';

        // Initialize transcript with the agent's opening
        const openingText = `${prompts.greeting} ${message}`;
        const transcript: TranscriptTurn[] = [{
            role: 'agent',
            text: openingText,
            timestamp: new Date().toISOString(),
        }];

        // Save initial transcript to Firestore
        await doc.ref.update({
            transcript,
            turnCount: 1,
            updatedAt: new Date().toISOString(),
        });

        const gatherUrl = `/api/attendance/twiml?outreachId=${outreachId}`;
        const esc = escapeXml;

        // Greeting → teacher message → invite parent to speak
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say language="${langCode}" voice="${voice}">${esc(prompts.greeting)}</Say>
  <Pause length="1"/>
  <Say language="${langCode}" voice="${voice}">${esc(message)}</Say>
  <Pause length="1"/>
  <Say language="${langCode}" voice="${voice}">${esc(prompts.inviteResponse)}</Say>
  <Gather input="speech dtmf" action="${gatherUrl}" method="POST" language="${speechLang}" speechTimeout="${SPEECH_TIMEOUT}" timeout="10" numDigits="1">
    <Say language="${langCode}" voice="${voice}">${esc(prompts.waitingPrompt)}</Say>
  </Gather>
  <Say language="${langCode}" voice="${voice}">${esc(prompts.noResponseGoodbye)}</Say>
  <Hangup/>
</Response>`;

        return twimlResponse(twiml);
    } catch (error) {
        console.error('[twiml] GET Error:', error);
        return new NextResponse(hangupXml(), { headers: XML_HEADERS });
    }
}

// ── POST: Handle parent's speech/DTMF → generate AI reply → respond ─────────

export async function POST(req: NextRequest) {
    // Clone the request to read body twice (once for validation, once for parsing)
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((v, k) => { params[k] = v.toString(); });

    if (!validateTwilioSignaturePost(req, params)) {
        console.warn('[twiml] Invalid Twilio signature — rejecting POST');
        return new NextResponse(hangupXml(), { status: 403, headers: XML_HEADERS });
    }

    const outreachId = new URL(req.url).searchParams.get('outreachId');
    if (!outreachId) return new NextResponse(hangupXml(), { headers: XML_HEADERS });

    // Twilio sends SpeechResult for speech, Digits for DTMF
    const speechResult = formData.get('SpeechResult') as string | null;
    const digits = formData.get('Digits') as string | null;

    try {
        const db = await getDb();
        const doc = await db.collection('parent_outreach').doc(outreachId).get();

        if (!doc.exists) return new NextResponse(hangupXml(), { headers: XML_HEADERS });

        const data = doc.data()!;
        const language = data.parentLanguage as Language;
        const langCode = TWILIO_LANGUAGE_MAP[language] ?? 'en-IN';
        const voice = TWILIO_VOICE_MAP[language] ?? 'Google.en-IN-Neural2-A';
        const prompts = CALL_MENU_PROMPTS[langCode] ?? CALL_MENU_PROMPTS['en-IN'];
        const speechLang = SPEECH_LANGUAGE_MAP[langCode] ?? 'en-IN';

        const transcript: TranscriptTurn[] = data.transcript ?? [];
        const turnCount: number = data.turnCount ?? 1;

        // If parent pressed 2 or star → end call
        if (digits === '2' || digits === '*') {
            return twimlResponse(goodbyeXml(langCode, voice, prompts));
        }

        // If no speech detected (timeout) → gentle prompt or end
        const parentSpeech = speechResult?.trim();
        if (!parentSpeech) {
            if (turnCount >= 2) {
                // Already had at least one exchange, end gracefully
                return twimlResponse(goodbyeXml(langCode, voice, prompts));
            }
            // First timeout — try once more
            const esc = escapeXml;
            return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${langCode}" voice="${voice}">${esc(prompts.didntHear)}</Say>
  <Gather input="speech dtmf" action="/api/attendance/twiml?outreachId=${outreachId}" method="POST" language="${speechLang}" speechTimeout="${SPEECH_TIMEOUT}" timeout="10" numDigits="1">
    <Say language="${langCode}" voice="${voice}">${esc(prompts.waitingPrompt)}</Say>
  </Gather>
  <Say language="${langCode}" voice="${voice}">${esc(prompts.noResponseGoodbye)}</Say>
  <Hangup/>
</Response>`);
        }

        // Record parent's speech in transcript
        transcript.push({
            role: 'parent',
            text: parentSpeech,
            timestamp: new Date().toISOString(),
        });

        const newTurnCount = turnCount + 1;

        // Generate AI agent reply
        const agentResult = await generateAgentReply({
            studentName: data.studentName,
            className: data.className,
            subject: data.subject ?? '',
            reason: data.reason,
            teacherMessage: data.generatedMessage,
            teacherName: data.teacherName,
            schoolName: data.schoolName,
            parentLanguage: language,
            transcript: transcript.map(t => ({ role: t.role, text: t.text })),
            parentSpeech,
            turnNumber: newTurnCount,
        });

        const agentReply = agentResult.reply + (agentResult.followUpQuestion ? ` ${agentResult.followUpQuestion}` : '');

        // Record agent reply in transcript
        transcript.push({
            role: 'agent',
            text: agentReply,
            timestamp: new Date().toISOString(),
        });

        // Update Firestore with latest transcript
        await doc.ref.update({
            transcript,
            turnCount: newTurnCount,
            updatedAt: new Date().toISOString(),
        });

        const esc = escapeXml;

        // If agent says end call or max turns reached → closing
        if (agentResult.shouldEndCall || newTurnCount >= MAX_TURNS) {
            return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${langCode}" voice="${voice}">${esc(agentReply)}</Say>
  <Pause length="1"/>
  <Say language="${langCode}" voice="${voice}">${esc(prompts.thanks)}</Say>
  <Hangup/>
</Response>`);
        }

        // Continue conversation — say reply + gather next speech
        const gatherUrl = `/api/attendance/twiml?outreachId=${outreachId}`;
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${langCode}" voice="${voice}">${esc(agentReply)}</Say>
  <Pause length="1"/>
  <Gather input="speech dtmf" action="${gatherUrl}" method="POST" language="${speechLang}" speechTimeout="${SPEECH_TIMEOUT}" timeout="10" numDigits="1">
    <Say language="${langCode}" voice="${voice}">${esc(prompts.waitingPrompt)}</Say>
  </Gather>
  <Say language="${langCode}" voice="${voice}">${esc(prompts.noResponseGoodbye)}</Say>
  <Hangup/>
</Response>`);
    } catch (error) {
        console.error('[twiml] POST Error:', error);
        // On AI failure, gracefully end the call rather than hanging up abruptly
        try {
            const language = 'en-IN';
            return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${language}" voice="Google.en-IN-Neural2-A">We apologize, but we are experiencing a technical issue. The teacher's message has been delivered. Thank you for your time. Goodbye.</Say>
  <Hangup/>
</Response>`);
        } catch {
            return new NextResponse(hangupXml(), { headers: XML_HEADERS });
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const XML_HEADERS = { 'Content-Type': 'text/xml; charset=utf-8' };

function goodbyeXml(langCode: string, voice: string, prompts: { thanks: string }): string {
    const esc = escapeXml;
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${langCode}" voice="${voice}">${esc(prompts.thanks)}</Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function twimlResponse(xml: string): NextResponse {
    return new NextResponse(xml, { headers: XML_HEADERS });
}

function hangupXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>`;
}
