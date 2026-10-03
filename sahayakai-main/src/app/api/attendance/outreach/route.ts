import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { dbAdapter } from '@/lib/db/adapter';
import type { OutreachReason, CallStatus, PerformanceContext } from '@/types/attendance';
import type { Language, Subject } from '@/types';
import { refuseIfParentOptedOut } from '@/lib/call-suppression';
import { hasAdvancedPlan } from '@/lib/plan-utils';

// Per-(teacher,student) dedup window — protects against accidental floods
// (rapid double-clicks) AND against the F9-003 abuse path where a malicious
// or buggy caller fires 100 POSTs in 1s and turns the endpoint into a free
// Twilio call gateway. 5 minutes matches normal teacher cadence (no realistic
// reason to retry the same parent twice in <5min).
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

// A record still `pending` (created, no call placed yet) only counts for this
// long. It exists to catch a double-tap — two outreach POSTs a moment apart —
// not to lock a teacher out because a dial never happened.
const PENDING_GRACE_MS = 30 * 1000;

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Plan check
    const profile = await dbAdapter.getUser(userId);
    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!hasAdvancedPlan(profile.planType)) {
        return NextResponse.json({ error: 'PREMIUM_REQUIRED' }, { status: 403 });
    }

    try {
        const data = await req.json() as {
            classId: string;
            className: string;
            studentId: string;
            studentName: string;
            // parentPhone in the body is IGNORED — see F9-001 fix below.
            parentPhone?: string;
            parentLanguage: Language;
            reason: OutreachReason;
            teacherNote?: string;
            generatedMessage: string;
            // Phone-call rendition of generatedMessage (no salutation/sign-off,
            // assistant speaks on behalf of the teacher). Spoken by the twiml
            // route instead of the written letter.
            spokenScript?: string;
            deliveryMethod: 'twilio_call' | 'whatsapp_copy';
            performanceContext?: PerformanceContext;
            // Forwarded from the modal; used only by the Exotel streaming voicebot
            // to personalize the spoken greeting. teacherName/schoolName are NOT
            // trusted from the client — they are sourced from the teacher profile
            // server-side below.
            subject?: Subject;
        };

        if (!data.classId || !data.studentId) {
            return NextResponse.json({ error: 'Missing classId or studentId' }, { status: 400 });
        }

        const db = await getDb();

        // ── F9-001 fix: ownership verification ────────────────────────────
        // Without this, teacher B can write a parent_outreach doc targeting
        // teacher A's student. The /api/attendance/call route reads parentPhone
        // straight off the outreach doc, so B can call ANY number A has on file
        // (or, with caller-supplied phone, ANY number at all).
        const classDoc = await db.collection('classes').doc(data.classId).get();
        if (!classDoc.exists) {
            return NextResponse.json({ error: 'Class not found' }, { status: 404 });
        }
        if (classDoc.data()!.teacherUid !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const studentRef = db.collection('classes').doc(data.classId)
            .collection('students').doc(data.studentId);
        const studentDoc = await studentRef.get();
        if (!studentDoc.exists) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }
        const student = studentDoc.data()!;

        // ── F9-001 fix: use the stored parent phone, never the caller's ───
        // The caller can spoof parentPhone in the body to trigger a call to
        // an arbitrary number via Twilio. Always look up the phone from the
        // student record (which was set/edited under the teacher's own auth).
        const parentPhone: string | undefined = student.parentPhone;
        if (!parentPhone) {
            return NextResponse.json({ error: 'Student has no parent phone on record' }, { status: 422 });
        }

        // A parent who told us on a call not to phone them again is not called
        // again, however many new outreach docs the teacher creates. Refused
        // here (before a doc exists) AND in /api/attendance/call.
        if (data.deliveryMethod === 'twilio_call') {
            const suppressed = await refuseIfParentOptedOut(db, parentPhone);
            if (suppressed) return suppressed;
        }

        // ── F9-003 fix: per-(teacher, student) dedup window ───────────────
        //
        // The window protects the PARENT from being called repeatedly. So a
        // prior attempt only counts if it might actually have reached them.
        // An outreach whose call provably never went out (`callStatus:
        // 'failed'`, written by the call route when the provider refused) is
        // skipped: on 2026-08-18 a rotated Twilio token made every call fail,
        // and because those dead records still counted, teachers were locked
        // out for five minutes per student while no parent had been disturbed
        // at all.
        //
        // The window only counts outreaches that placed, or are placing, a call:
        //   - `failed`   never counted (the call route writes it on EVERY refusal:
        //                calling hours, opted out, bad phone, provider error...).
        //   - `pending`  created but no call placed yet. Counts only for
        //                PENDING_GRACE_MS, so a double-tap is still caught but an
        //                abandoned/refused attempt cannot hold the window for 5
        //                minutes. (It used to be created as 'initiated', which
        //                made every refusal look like a call in flight.)
        //   - anything else (`initiated`, `completed`, `manual`...) counts.
        const cutoffIso = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
        const recentSnap = await db.collection('parent_outreach')
            .where('teacherUid', '==', userId)
            .where('studentId', '==', data.studentId)
            .where('createdAt', '>=', cutoffIso)
            .limit(10)
            .get();
        const nowMs = Date.now();
        const recentDocs = recentSnap.docs.filter((d) => {
            const r = d.data() as { callStatus?: string; createdAt: string };
            if (r.callStatus === 'failed') return false;
            if (r.callStatus === 'pending') {
                return nowMs - new Date(r.createdAt).getTime() < PENDING_GRACE_MS;
            }
            return true;
        });
        if (recentDocs.length > 0) {
            // Most recent survivor decides the retry-after.
            const last = recentDocs
                .map((d) => d.data() as { createdAt: string; callStatus?: string })
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
            const lastMs = new Date(last.createdAt).getTime();
            const elapsed = Date.now() - lastMs;
            const windowMs = last.callStatus === 'pending' ? PENDING_GRACE_MS : DEDUP_WINDOW_MS;
            const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
            const resp = NextResponse.json(
                { error: 'Recent outreach already exists for this student', retryAfterSeconds },
                { status: 429 },
            );
            resp.headers.set('Retry-After', String(retryAfterSeconds));
            return resp;
        }

        const now = new Date().toISOString();
        const ref = db.collection('parent_outreach').doc();

        // Firestore rejects literal `undefined` in writes — build the doc
        // conditionally instead of setting optional fields to undefined.
        const record: Record<string, unknown> = {
            teacherUid: userId,
            classId: data.classId,
            className: data.className,
            studentId: data.studentId,
            studentName: data.studentName,
            parentPhone, // ← server-trusted, from students/{studentId}.parentPhone
            parentLanguage: data.parentLanguage,
            reason: data.reason,
            generatedMessage: data.generatedMessage,
            deliveryMethod: data.deliveryMethod,
            callStatus: (data.deliveryMethod === 'twilio_call' ? 'pending' : 'manual') as CallStatus,
            createdAt: now,
            updatedAt: now,
        };
        if (data.teacherNote) record.teacherNote = data.teacherNote;
        // Cap length defensively — this string is spoken verbatim by TTS.
        if (typeof data.spokenScript === 'string' && data.spokenScript.trim()) {
            record.spokenScript = data.spokenScript.trim().slice(0, 1500);
        }
        if (data.performanceContext) record.performanceContext = data.performanceContext;
        // Personalization for the Exotel streaming voicebot. subject comes from the
        // modal; teacherName/schoolName are server-trusted from the teacher profile.
        if (data.subject) record.subject = data.subject;
        if (profile.displayName) record.teacherName = profile.displayName;
        if (profile.schoolName) record.schoolName = profile.schoolName;

        await ref.set(record);
        return NextResponse.json({ outreachId: ref.id });
    } catch (error: any) {
        console.error('[attendance/outreach] Error:', error);
        return NextResponse.json({ error: error.message ?? 'Internal error' }, { status: 500 });
    }
}
