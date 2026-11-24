/**
 * GET /api/sampark/twiml — Exotel call flow TwiML for Sampark voice calls.
 *
 * Query: language (default English). Returns ExoML that reads the Sampark
 * greeting in the requested language using Exotel's TTS.
 */

import { NextResponse } from 'next/server';
import type { Language } from '@/types';

const LANGUAGE_VOICE: Record<Language, string> = {
    English: 'en-IN',
    Hindi: 'hi-IN',
    Bengali: 'bn-IN',
    Gujarati: 'gu-IN',
    Kannada: 'kn-IN',
    Malayalam: 'ml-IN',
    Marathi: 'mr-IN',
    Odia: 'or-IN',
    Punjabi: 'pa-IN',
    Tamil: 'ta-IN',
    Telugu: 'te-IN',
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
    const { searchParams } = new URL(req.url);
    const language = (searchParams.get('language') as Language) ?? 'English';
    const voice = LANGUAGE_VOICE[language] ?? 'en-IN';

    const exoml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="${voice}" language="${voice}">
        Namaste. This is a Sampark call from your child's school.
        Please stay on the line to hear the message.
    </Say>
    <Gather input="dtmt" timeout="5" numDigits="1">
        <Say voice="${voice}" language="${voice}">Press 1 to repeat this message.</Say>
    </Gather>
    <Hangup/>
</Response>`;

    return new NextResponse(exoml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' },
    });
}