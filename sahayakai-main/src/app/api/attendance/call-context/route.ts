/**
 * Internal API: Call Context
 *
 * Called by the Pipecat voice server to fetch the full outreach record
 * needed to configure the call pipeline (student name, language, message, etc.)
 *
 * Auth: X-Internal-Key header (service-to-service, not user auth)
 *
 * GET /api/attendance/call-context?outreachId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(req: NextRequest) {
    const internalKey = process.env.VOICE_PIPELINE_INTERNAL_KEY;
    if (!internalKey) {
        return NextResponse.json({ error: 'Pipeline not configured' }, { status: 503 });
    }

    const providedKey = req.headers.get('x-internal-key') || '';
    if (!safeCompare(providedKey, internalKey)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const outreachId = new URL(req.url).searchParams.get('outreachId');
    if (!outreachId) {
        return NextResponse.json({ error: 'Missing outreachId' }, { status: 400 });
    }

    try {
        const db = await getDb();
        const doc = await db.collection('parent_outreach').doc(outreachId).get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Outreach record not found' }, { status: 404 });
        }

        const data = doc.data()!;

        return NextResponse.json({
            studentName: data.studentName ?? '',
            className: data.className ?? '',
            subject: data.subject ?? '',
            reason: data.reason ?? '',
            generatedMessage: data.generatedMessage ?? '',
            parentLanguage: data.parentLanguage ?? 'Hindi',
            teacherName: data.teacherName ?? '',
            schoolName: data.schoolName ?? '',
            teacherUid: data.teacherUid ?? '',
        });
    } catch (error) {
        console.error('[call-context] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
