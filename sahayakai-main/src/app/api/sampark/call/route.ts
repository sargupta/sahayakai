/**
 * POST /api/sampark/call — place an outbound Sampark voice call via Exotel.
 *
 * Body: { to: string (E.164 Indian number), language?: string }
 * Auth: x-user-id header (required).
 * Config: EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN,
 *         EXOTEL_CALLER_ID, EXOTEL_APP_ID, EXOTEL_SUBDOMAIN.
 */

import { NextRequest, NextResponse } from 'next/server';
import { placeExotelCall, exotelConfigured } from '@/lib/exotel/client';
import { refuseIfParentOptedOut } from '@/lib/call-suppression';
import { getDb } from '@/lib/firebase-admin';
import type { Language } from '@/types';

interface SamparkCallBody {
    to?: unknown;
    language?: unknown;
}

function isValidIndianMobile(raw: unknown): raw is string {
    if (typeof raw !== 'string') return false;
    const digits = raw.replace(/[\s-]/g, '');
    return /^\+?91[6-9]\d{9}$/.test(digits) || /^[6-9]\d{9}$/.test(digits);
}

function normalizePhone(raw: string): string {
    const digits = raw.replace(/[\s-]/g, '');
    return digits.startsWith('+91') ? digits : `+91${digits}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHENTICATED' }, { status: 401 });
    }

    if (!exotelConfigured()) {
        return NextResponse.json(
            { error: 'Voice service not configured', code: 'VOICE_NOT_CONFIGURED' },
            { status: 503 },
        );
    }

    const body = (await req.json().catch(() => null)) as SamparkCallBody | null;
    if (!body) {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_REQUEST' }, { status: 400 });
    }
    if (!isValidIndianMobile(body.to)) {
        return NextResponse.json(
            { error: 'Enter a valid Indian mobile number (10 digits)', code: 'INVALID_PHONE' },
            { status: 422 },
        );
    }
    const to = normalizePhone(body.to as string);
    const language = typeof body.language === 'string' ? body.language : 'English';

    // Do-not-call check before dialling.
    let db;
    try {
        db = await getDb();
    } catch {
        return NextResponse.json({ error: 'Internal error', code: 'INTERNAL', retryable: true }, { status: 500 });
    }
    const suppressed = await refuseIfParentOptedOut(db, to).catch(() => null);
    if (suppressed) {
        return suppressed;
    }

    const host = req.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const statusCallbackUrl = `${protocol}://${host}/api/sampark/call-status?userId=${encodeURIComponent(userId)}`;

    const result = await placeExotelCall(to, {
        url: `${protocol}://${host}/api/sampark/twiml?language=${encodeURIComponent(language as Language)}`,
        statusCallback: statusCallbackUrl,
    });

    if (!result.ok) {
        return NextResponse.json(
            { error: result.message, code: result.code, retryable: result.status === 502 },
            { status: result.status ?? 502 },
        );
    }

    return NextResponse.json({ callSid: result.callSid, status: result.status, to, language }, { status: 202 });
}