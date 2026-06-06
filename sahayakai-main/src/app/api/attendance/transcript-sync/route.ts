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
        const { outreachId, transcript, callStatus } = body;

        if (!outreachId || !transcript) {
            return NextResponse.json({ error: 'Missing outreachId or transcript' }, { status: 400 });
        }

        const db = await getDb();
        const docRef = db.collection('parent_outreach').doc(outreachId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Outreach record not found' }, { status: 404 });
        }

        // ── F9-007 fix: derive turnCount server-side ──────────────────────
        // Trusting the client-supplied turnCount lets the orchestrator desync
        // from reality (or a bad actor lie about it). The transcript array is
        // the source of truth — compute the count from it.
        const serverTurnCount = transcript.length;

        const update: Record<string, unknown> = {
            transcript,
            turnCount: serverTurnCount,
            updatedAt: new Date().toISOString(),
        };

        if (callStatus) {
            update.callStatus = callStatus;
        }

        await docRef.update(update);

        // ── F9-002 fix: atomic summary-generation lock ────────────────────
        // Both this route AND twiml-status call generateCallSummary on terminal
        // states. Without a lock, two concurrent terminal webhooks each read
        // `!callSummary` (true) before either has written, and BOTH invoke the
        // LLM. We use a transaction to claim the `_summaryGenerating` flag —
        // whichever request claims it first runs the LLM call; the other
        // request bails out cleanly.
        const data = doc.data()!;
        const mergedStatus = callStatus ?? data.callStatus;
        const isTerminal = mergedStatus === 'completed' || mergedStatus === 'failed';

        if (isTerminal && transcript.length > 1) {
            const claimed = await db.runTransaction(async (tx) => {
                const fresh = await tx.get(docRef);
                if (!fresh.exists) return false;
                const fd = fresh.data()!;
                if (fd.callSummary) return false;            // already generated
                if (fd._summaryGenerating) return false;     // another request is generating
                tx.update(docRef, {
                    _summaryGenerating: true,
                    _summaryGeneratingAt: new Date().toISOString(),
                });
                return true;
            });

            if (claimed) {
                // Parent-call schema requires 2-letter ISO (en/hi/bn/...).
                const { LANGUAGE_TO_ISO } = await import('@/types/index');
                const parentLanguageIso = (LANGUAGE_TO_ISO as Record<string, string>)[
                    data.parentLanguage ?? 'Hindi'
                ] ?? 'hi';
                generateCallSummary({
                    studentName: data.studentName ?? '',
                    className: data.className ?? '',
                    subject: data.subject ?? '',
                    reason: data.reason ?? '',
                    teacherMessage: data.generatedMessage ?? '',
                    teacherName: data.teacherName,
                    schoolName: data.schoolName,
                    parentLanguage: parentLanguageIso as 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'bn' | 'gu' | 'pa' | 'ml' | 'or',
                    callSid: data.callSid ?? doc.id,
                    transcript: transcript.map(t => ({ role: t.role, text: t.text })),
                }).then(async (summary) => {
                    await docRef.update({
                        callSummary: summary,
                        _summaryGenerating: false,
                        updatedAt: new Date().toISOString(),
                    });
                    console.log(`[transcript-sync] Summary generated for ${outreachId}`);
                }).catch(async (err) => {
                    console.error(`[transcript-sync] Summary generation failed for ${outreachId}:`, err);
                    // Release lock on failure so a future retry/twiml-status can claim it.
                    await docRef.update({ _summaryGenerating: false }).catch(() => {});
                });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[transcript-sync] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
