import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

/**
 * Polling endpoint for the /try-call page (public route).
 * Returns call progress ONLY — no phone, no hashes, no PII. The id is an
 * unguessable Firestore auto-id handed to the same client that created it.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (!id || !/^[A-Za-z0-9]{10,40}$/.test(id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    try {
        const db = await getDb();
        const snap = await db.collection('demo_leads').doc(id).get();
        if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ status: snap.data()?.status ?? 'queued' });
    } catch (error) {
        console.error('[demo-call/id] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
