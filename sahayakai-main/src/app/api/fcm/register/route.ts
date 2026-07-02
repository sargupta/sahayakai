import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

// A single FCM registration token identifies one browser/device install. Cap
// its length defensively (real FCM tokens are ~150-300 chars).
const MAX_TOKEN_LEN = 4096;

export async function POST(req: NextRequest) {
    const uid = req.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { token } = await req.json();
    if (!token || typeof token !== 'string' || token.length > MAX_TOKEN_LEN) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const db = await getDb();

    // Use a hash of the token as the doc ID for dedup
    const tokenHash = Buffer.from(token).toString('base64url').slice(0, 20);

    // SECURITY (H28): a browser/device FCM token belongs to whoever is signed in
    // NOW. On a shared device (staffroom PC, family phone) the same token was
    // left registered under a previous user, so sendPushToUser(previousUser)
    // pushed their private message previews to the person now using the device.
    // Purge this token from every OTHER user before (re)claiming it for `uid`,
    // so a token is only ever associated with the most recent signer-in. This
    // is server-authoritative and does not rely on a logout-time client call
    // (which may not fire, e.g. the auth token is already gone).
    try {
        const stale = await db.collectionGroup('fcm_tokens')
            .where('token', '==', token)
            .get();
        const deletions = stale.docs
            .filter(d => d.ref.parent.parent?.id !== uid)
            .map(d => d.ref.delete());
        if (deletions.length) await Promise.all(deletions);
    } catch (err) {
        // Non-fatal: if the collectionGroup index is missing or the query
        // fails, still register the token for the current user below. Log for
        // visibility (a missing single-field index on `token` would surface here).
        console.error('[fcm/register] stale-token purge failed', err);
    }

    await db.collection('users').doc(uid).collection('fcm_tokens').doc(tokenHash).set({
        token,
        platform: 'web',
        updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ ok: true });
}
