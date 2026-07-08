import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { baileysClient } from '@/lib/social/worker-client';

/**
 * Initiate a Baileys pairing for the calling teacher.
 * Returns the 8-digit pairing code they enter under WhatsApp →
 * Linked Devices → Link with phone number instead.
 */

const Body = z.object({ phoneNumber: z.string().min(8) });

export async function POST(req: NextRequest) {
    const teacherUid = req.headers.get('x-user-id');
    if (!teacherUid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    try {
        const { pairingCode } = await baileysClient.pair(teacherUid, parsed.data.phoneNumber);
        return NextResponse.json({ pairingCode });
    } catch (err) {
        const detail = err instanceof Error ? err.message : 'unknown';
        return NextResponse.json({ error: 'pair_failed', detail }, { status: 502 });
    }
}

export async function GET(req: NextRequest) {
    const teacherUid = req.headers.get('x-user-id');
    if (!teacherUid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    try {
        const status = await baileysClient.status(teacherUid);
        return NextResponse.json(status);
    } catch (err) {
        const detail = err instanceof Error ? err.message : 'unknown';
        return NextResponse.json({ error: 'status_failed', detail }, { status: 502 });
    }
}
