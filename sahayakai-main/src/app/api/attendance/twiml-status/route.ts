import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import type { CallStatus } from '@/types/attendance';

// ── PUBLIC route — Twilio status callback ─────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const callSid = formData.get('CallSid') as string;
        const twilioStatus = formData.get('CallStatus') as string;

        if (!callSid) return new NextResponse('OK', { status: 200 });

        const statusMap: Record<string, CallStatus> = {
            completed:     'completed',
            failed:        'failed',
            'no-answer':   'no_answer',
            busy:          'busy',
            canceled:      'failed',
        };

        const callStatus: CallStatus = statusMap[twilioStatus] ?? 'failed';

        const db = await getDb();
        const snap = await db.collection('parent_outreach')
            .where('callSid', '==', callSid)
            .limit(1)
            .get();

        if (!snap.empty) {
            await snap.docs[0].ref.update({
                callStatus,
                updatedAt: new Date().toISOString(),
            });
        }

        return new NextResponse('OK', { status: 200 });
    } catch (error) {
        console.error('[twiml-status] Error:', error);
        return new NextResponse('OK', { status: 200 }); // always 200 to Twilio
    }
}
