import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    const uid = req.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { token } = await req.json();
    if (!token || typeof token !== 'string') {
        return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const db = await getDb();

    // Use a hash of the token as the doc ID for dedup
    const tokenHash = Buffer.from(token).toString('base64url').slice(0, 20);

    await db.collection('users').doc(uid).collection('fcm_tokens').doc(tokenHash).set({
        token,
        platform: 'web',
        updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ ok: true });
}
