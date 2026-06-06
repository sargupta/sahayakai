import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { validateTwilioSignaturePost } from '@/lib/twilio-validate';
import { generateCallSummary } from '@/ai/flows/parent-call-agent';
import type { CallStatus } from '@/types/attendance';

// ── PUBLIC route — Twilio status callback ─────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        // Build params map for signature validation
        const params: Record<string, string> = {};
        formData.forEach((value, key) => { params[key] = value.toString(); });

        if (!validateTwilioSignaturePost(req, params)) {
            console.warn('[twiml-status] Invalid Twilio signature — rejecting');
            return new NextResponse('Forbidden', { status: 403 });
        }

        const callSid = formData.get('CallSid') as string;
        const twilioStatus = formData.get('CallStatus') as string;
        const answeredBy = formData.get('AnsweredBy') as string | null;
        const callDuration = formData.get('CallDuration') as string | null;

        if (!callSid) return new NextResponse('OK', { status: 200 });

        // Only update Firestore on terminal states
        const statusMap: Record<string, CallStatus> = {
            completed:   'completed',
            failed:      'failed',
            'no-answer': 'no_answer',
            busy:        'busy',
            canceled:    'failed',
        };

        const callStatus = statusMap[twilioStatus];
        if (!callStatus) return new NextResponse('OK', { status: 200 });

        const db = await getDb();
        const snap = await db.collection('parent_outreach')
            .where('callSid', '==', callSid)
            .limit(1)
            .get();

        if (snap.empty) return new NextResponse('OK', { status: 200 });

        const docRef = snap.docs[0].ref;
        const data = snap.docs[0].data();

        const update: Record<string, unknown> = {
            callStatus,
            updatedAt: new Date().toISOString(),
        };
        if (answeredBy) update.answeredBy = answeredBy;
        if (callDuration) update.callDurationSeconds = parseInt(callDuration, 10);

        await docRef.update(update);

        // F8-03 fix (P0): idempotency guard. Twilio retries the completed-status
        // callback on transient failures (and load balancers occasionally
        // double-deliver). Without this guard we re-ran the LLM summary on
        // every retry, multiplying cost and churning the saved summary doc.
        //
        // We use a Firestore transaction to atomically check `callSummary`
        // absence AND claim a `_summaryGenerating` flag — only one webhook
        // call can hold the claim at a time. Subsequent retries see the
        // flag (or the persisted summary) and short-circuit. Mirrors the
        // pattern in transcript-sync/route.ts:87.
        if (callStatus === 'completed' && data.transcript?.length > 1) {
            const claimed = await db.runTransaction(async (tx) => {
                const snap = await tx.get(docRef);
                const d = snap.data() ?? {};
                if (d.callSummary) return false;          // already generated
                if (d._summaryGenerating) return false;   // another worker holds the claim
                tx.update(docRef, {
                    _summaryGenerating: true,
                    _summaryGeneratingAt: new Date().toISOString(),
                });
                return true;
            });

            if (claimed) {
                // Fire-and-forget: don't block the 200 response to Twilio
                generateAndSaveSummary(docRef, data, callDuration).catch((err) => {
                    console.error('[twiml-status] Summary generation failed:', err);
                    // Release the claim so a future retry can attempt it.
                    docRef.update({ _summaryGenerating: false }).catch(() => {});
                });
            } else {
                console.log('[twiml-status] Summary already generated or in-flight — skipping (idempotent)');
            }
        }

        return new NextResponse('OK', { status: 200 });
    } catch (error) {
        console.error('[twiml-status] Error:', error);
        return new NextResponse('OK', { status: 200 }); // always 200 to Twilio
    }
}

// ── Summary generation (runs after returning 200 to Twilio) ─────────────────

async function generateAndSaveSummary(
    docRef: FirebaseFirestore.DocumentReference,
    data: FirebaseFirestore.DocumentData,
    callDuration: string | null,
) {
    console.log('[twiml-status] Generating call summary for outreach:', docRef.id);

    // Parent-call schema requires 2-letter ISO (en/hi/bn/...). Profiles
    // store the full Language name (`Hindi`), so map via LANGUAGE_TO_ISO.
    const { LANGUAGE_TO_ISO } = await import('@/types/index');
    const parentLanguageIso = (LANGUAGE_TO_ISO as Record<string, string>)[
        data.parentLanguage ?? 'English'
    ] ?? 'en';

    const summary = await generateCallSummary({
        studentName:        data.studentName,
        className:          data.className,
        subject:            data.subject ?? '',
        reason:             data.reason,
        teacherMessage:     data.generatedMessage,
        teacherName:        data.teacherName,
        schoolName:         data.schoolName,
        parentLanguage:     parentLanguageIso as 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'bn' | 'gu' | 'pa' | 'ml' | 'or',
        callSid:            data.callSid ?? docRef.id,
        transcript:         (data.transcript ?? []).map((t: { role: string; text: string }) => ({
            role: t.role,
            text: t.text,
        })),
        callDurationSeconds: callDuration ? parseInt(callDuration, 10) : undefined,
    });

    await docRef.update({
        callSummary: {
            ...summary,
            generatedAt: new Date().toISOString(),
        },
        _summaryGenerating: false, // F8-03: release idempotency claim
        updatedAt: new Date().toISOString(),
    });

    console.log('[twiml-status] Call summary saved. Quality:', summary.callQuality, 'Sentiment:', summary.parentSentiment);
}
