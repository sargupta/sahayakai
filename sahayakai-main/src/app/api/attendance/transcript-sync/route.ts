/**
 * Internal API: Transcript Sync
 *
 * Called by the voice pipeline orchestrator (Pipecat) to persist
 * transcript updates to Firestore during a live call.
 * When callStatus='completed', triggers call summary generation.
 *
 * Auth: X-Internal-Key header (service-to-service, not user auth)
 *
 * POST /api/attendance/transcript-sync
 * Body: { outreachId, transcript, turnCount, callStatus? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { generateCallSummary } from '@/ai/flows/parent-call-agent';
import { timingSafeEqual } from 'crypto';
import type { TranscriptTurn } from '@/types/attendance';

function safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

interface TranscriptSyncBody {
    outreachId: string;
    transcript: TranscriptTurn[];
    turnCount: number;
    callStatus?: 'completed' | 'failed';
}

export async function POST(req: NextRequest) {
    const internalKey = process.env.VOICE_PIPELINE_INTERNAL_KEY;
    if (!internalKey) {
        return NextResponse.json({ error: 'Pipeline not configured' }, { status: 503 });
    }

    const providedKey = req.headers.get('x-internal-key') || '';
    if (!safeCompare(providedKey, internalKey)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body: TranscriptSyncBody = await req.json();
        const { outreachId, transcript, turnCount, callStatus } = body;

        if (!outreachId || !transcript) {
            return NextResponse.json({ error: 'Missing outreachId or transcript' }, { status: 400 });
        }

        const db = await getDb();
        const docRef = db.collection('parent_outreach').doc(outreachId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Outreach record not found' }, { status: 404 });
        }

        const update: Record<string, unknown> = {
            transcript,
            turnCount,
            updatedAt: new Date().toISOString(),
        };

        if (callStatus) {
            update.callStatus = callStatus;
        }

        await docRef.update(update);

        // Generate call summary when call completes (non-blocking)
        if (callStatus === 'completed' && transcript.length > 1) {
            const data = doc.data()!;
            generateCallSummary({
                studentName: data.studentName ?? '',
                className: data.className ?? '',
                subject: data.subject ?? '',
                reason: data.reason ?? '',
                teacherMessage: data.generatedMessage ?? '',
                teacherName: data.teacherName,
                schoolName: data.schoolName,
                parentLanguage: data.parentLanguage ?? 'Hindi',
                transcript: transcript.map(t => ({ role: t.role, text: t.text })),
            }).then(async (summary) => {
                await docRef.update({ callSummary: summary, updatedAt: new Date().toISOString() });
                console.log(`[transcript-sync] Summary generated for ${outreachId}`);
            }).catch((err) => {
                console.error(`[transcript-sync] Summary generation failed for ${outreachId}:`, err);
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[transcript-sync] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
