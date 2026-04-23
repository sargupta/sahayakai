import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { dbAdapter } from '@/lib/db/adapter';
import type { ParentOutreach, OutreachReason, CallStatus, PerformanceContext } from '@/types/attendance';
import type { Language } from '@/types';
import { hasAdvancedPlan } from '@/lib/plan-utils';

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
            parentPhone: string;
            parentLanguage: Language;
            reason: OutreachReason;
            teacherNote?: string;
            generatedMessage: string;
            deliveryMethod: 'twilio_call' | 'whatsapp_copy';
            performanceContext?: PerformanceContext;
        };

        const db = await getDb();
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
            parentPhone: data.parentPhone,
            parentLanguage: data.parentLanguage,
            reason: data.reason,
            generatedMessage: data.generatedMessage,
            deliveryMethod: data.deliveryMethod,
            callStatus: (data.deliveryMethod === 'twilio_call' ? 'initiated' : 'manual') as CallStatus,
            createdAt: now,
            updatedAt: now,
        };
        if (data.teacherNote) record.teacherNote = data.teacherNote;
        if (data.performanceContext) record.performanceContext = data.performanceContext;

        await ref.set(record);
        return NextResponse.json({ outreachId: ref.id });
    } catch (error: any) {
        console.error('[attendance/outreach] Error:', error);
        return NextResponse.json({ error: error.message ?? 'Internal error' }, { status: 500 });
    }
}
