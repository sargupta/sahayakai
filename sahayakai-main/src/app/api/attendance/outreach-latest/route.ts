/**
 * Internal API: Latest outreach lookup
 *
 * QA #5 (2026-06-02) modal-resume fix: previously, when the teacher closed
 * the Contact-Parent modal mid-call (or the 5-min poller gave up), the
 * `outreachId` was lost from React state and any callSummary that landed
 * later was never surfaced. The user reopened the modal, walked through
 * "reason → note → review" again, and never saw the AI summary at all.
 *
 * This endpoint returns the most recent parent_outreach record for the
 * (teacher, student) pair within the last 24 hours. The modal calls it on
 * open; if a recent call has a summary, we jump straight to the summary
 * step. If a call is still in flight, we resume polling against the same
 * outreachId.
 *
 * GET /api/attendance/outreach-latest?studentId=xxx
 * Returns: { outreachId, callStatus, callDurationSeconds, answeredBy,
 *            turnCount, transcript, callSummary } | { outreachId: null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

// 24h lookback — older outreaches are considered "past" and shouldn't auto-resume.
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const studentId = new URL(req.url).searchParams.get('studentId');
    if (!studentId) return NextResponse.json({ error: 'Missing studentId' }, { status: 400 });

    try {
        const db = await getDb();
        const snap = await db.collection('parent_outreach')
            .where('teacherUid', '==', userId)
            .where('studentId', '==', studentId)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (snap.empty) return NextResponse.json({ outreachId: null });

        const doc = snap.docs[0];
        const data = doc.data();

        // Only resume if the record is recent. An outreach from last week
        // shouldn't pre-fill today's modal.
        const createdAt = data.createdAt ? Date.parse(data.createdAt) : 0;
        if (!createdAt || Date.now() - createdAt > LOOKBACK_MS) {
            return NextResponse.json({ outreachId: null });
        }

        return NextResponse.json({
            outreachId:          doc.id,
            callStatus:          data.callStatus ?? null,
            callDurationSeconds: data.callDurationSeconds ?? null,
            answeredBy:          data.answeredBy ?? null,
            turnCount:           data.turnCount ?? 0,
            transcript:          data.transcript ?? [],
            callSummary:         data.callSummary ?? null,
        });
    } catch (error: any) {
        console.error('[outreach-latest] Error:', error);
        return NextResponse.json({ error: error.message ?? 'Internal error' }, { status: 500 });
    }
}
