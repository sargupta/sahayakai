import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { reconcileCallStatus } from '@/lib/attendance/reconcile-call-status';

// ── GET /api/attendance/call-summary?outreachId=xxx ──────────────────────────
// Returns the call transcript and AI-generated summary for a completed call.

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const outreachId = new URL(req.url).searchParams.get('outreachId');
    if (!outreachId) return NextResponse.json({ error: 'Missing outreachId' }, { status: 400 });

    try {
        const db = await getDb();
        const doc = await db.collection('parent_outreach').doc(outreachId).get();

        if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (doc.data()!.teacherUid !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const data = doc.data()!;
        return NextResponse.json({
            // Reconciled, never raw (CLAUDE.md law 1): a stale "initiated" or an
            // engine failure reads as failed rather than "Calling…" forever.
            callStatus:          reconcileCallStatus(data),
            callDurationSeconds: data.callDurationSeconds ?? null,
            answeredBy:          data.answeredBy ?? null,
            turnCount:           data.turnCount ?? 0,
            transcript:          data.transcript ?? [],
            callSummary:         data.callSummary ?? null,
        });
    } catch (error: any) {
        console.error('[call-summary] Error:', error);
        return NextResponse.json({ error: error.message ?? 'Internal error' }, { status: 500 });
    }
}
