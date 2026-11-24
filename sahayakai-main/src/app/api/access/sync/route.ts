import { NextResponse } from 'next/server';
import { syncAccessClaim } from '@/lib/access/access-admin';
import { logger } from '@/lib/logger';

/**
 * POST /api/access/sync
 *
 * Re-derives the caller's access state from Firestore and repairs the custom
 * claim if it has drifted (new account, claim dropped by another writer,
 * approval granted since the token was minted). Callable by a signed-in
 * account that is not yet entitled: it is on the access-flow allowlist in
 * src/lib/access/access-state.ts.
 *
 * The caller can only ever sync ITSELF: the uid comes from the verified
 * token via the middleware-injected header, never from the request.
 *
 * When `claimChanged` is true the client must call `getIdToken(true)` so its
 * next request carries the new claim.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const uid = request.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const result = await syncAccessClaim(uid);
        return NextResponse.json({
            state: result.state,
            entitled: result.decision.entitled,
            expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null,
            claimChanged: result.claimChanged,
        });
    } catch (err) {
        logger.error('Access sync failed', err, 'ACCESS', { uid });
        return NextResponse.json({ error: 'Could not refresh access' }, { status: 500 });
    }
}
