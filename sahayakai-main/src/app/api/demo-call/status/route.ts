import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { validateTwilioSignaturePost } from '@/lib/twilio-validate';
import { DEMO_STATUSES } from '@/lib/demo-call/gates';

/**
 * Twilio StatusCallback sink for demo calls (public route, signature gated).
 * Maps provider call progress onto the lead document so the /try-call page
 * can poll GET /api/demo-call/[id]. Idempotent: last write wins, and a
 * terminal status is never downgraded by a late out-of-order callback.
 */

const TERMINAL = new Set(['completed', 'busy', 'failed', 'no-answer', 'canceled']);

export async function POST(req: NextRequest) {
    // Twilio sends application/x-www-form-urlencoded; the signature covers
    // the exact URL (incl. leadId query) + sorted form params.
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const params: Record<string, string> = {};
    form.forEach((value, key) => {
        if (typeof value === 'string') params[key] = value;
    });

    if (!validateTwilioSignaturePost(req, params)) {
        console.warn('[demo-call/status] Invalid Twilio signature — rejecting');
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leadId = new URL(req.url).searchParams.get('leadId');
    const callStatus = params['CallStatus'];
    if (!leadId || !callStatus) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (!(DEMO_STATUSES as readonly string[]).includes(callStatus)) {
        // Unknown provider status — acknowledge without writing.
        return NextResponse.json({ ok: true });
    }

    try {
        const db = await getDb();
        const ref = db.collection('demo_leads').doc(leadId);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return;
            const current = snap.data()?.status as string | undefined;
            // Never let a late 'ringing' overwrite a terminal state.
            if (current && TERMINAL.has(current) && !TERMINAL.has(callStatus)) return;
            tx.update(ref, {
                status: callStatus,
                callDurationSec: params['CallDuration'] ? Number(params['CallDuration']) : null,
                updatedAt: new Date().toISOString(),
            });
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[demo-call/status] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
