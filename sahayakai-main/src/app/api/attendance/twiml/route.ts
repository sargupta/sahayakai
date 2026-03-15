import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { TWILIO_LANGUAGE_MAP } from '@/types/attendance';
import type { Language } from '@/types';

// ── PUBLIC route — Twilio calls this, no x-user-id header ────────────────────

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const outreachId = searchParams.get('outreachId');

    if (!outreachId) {
        return new NextResponse(hangupXml(), {
            headers: { 'Content-Type': 'text/xml' },
        });
    }

    try {
        const db = await getDb();
        const doc = await db.collection('parent_outreach').doc(outreachId).get();

        if (!doc.exists || doc.data()!.callStatus !== 'initiated') {
            return new NextResponse(hangupXml(), {
                headers: { 'Content-Type': 'text/xml' },
            });
        }

        const data = doc.data()!;
        const message: string = data.generatedMessage;
        const language = data.parentLanguage as Language;
        const langCode = TWILIO_LANGUAGE_MAP[language] ?? 'en-IN';

        // Escape XML special characters in the message
        const safeMessage = message
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say language="${langCode}" voice="Polly.Aditi">${safeMessage}</Say>
  <Pause length="1"/>
</Response>`;

        // Mark as completed (will be overridden by status callback if call actually completes)
        await doc.ref.update({ updatedAt: new Date().toISOString() });

        return new NextResponse(twiml, {
            headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        });
    } catch (error) {
        console.error('[twiml] Error:', error);
        return new NextResponse(hangupXml(), {
            headers: { 'Content-Type': 'text/xml' },
        });
    }
}

// POST is also required — Twilio may POST to TwiML URLs
export const POST = GET;

function hangupXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>`;
}
