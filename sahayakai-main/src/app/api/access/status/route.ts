import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/access/access-admin';
import { ACCESS_CLAIM, ACCESS_EXP_CLAIM, evaluateAccess, resolveEffectiveGateMode } from '@/lib/access/access-state';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

/**
 * GET /api/access/status
 *
 * Read-only view of the caller's access state for the /access page and the
 * post-sign-in router. Unlike /api/access/sync this never writes.
 * `entitled` reflects the source of truth, which can be ahead of the token
 * the caller is holding; call /api/access/sync to bring the token in line.
 */
export const dynamic = 'force-dynamic';

function toIso(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().toISOString();
    }
    return null;
}

export async function GET(request: Request) {
    const uid = request.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const resolved = await resolveAccess(uid);
        const decision = evaluateAccess({
            [ACCESS_CLAIM]: resolved.state,
            [ACCESS_EXP_CLAIM]: resolved.expiresAt ? Math.floor(resolved.expiresAt.getTime() / 1000) : undefined,
        });

        const db = await getDb();
        const requestSnap = await db.collection('access_requests').doc(uid).get();
        const requestData = requestSnap.exists ? (requestSnap.data() as Record<string, unknown>) : null;

        return NextResponse.json({
            mode: resolveEffectiveGateMode().mode,
            state: resolved.state,
            // `expired` is reported distinctly so the page can say so.
            verdict: decision.verdict,
            entitled: decision.entitled,
            expiresAt: resolved.expiresAt ? resolved.expiresAt.toISOString() : null,
            request: requestData
                ? {
                      status: typeof requestData.status === 'string' ? requestData.status : 'pending',
                      createdAt: toIso(requestData.createdAt),
                  }
                : null,
        });
    } catch (err) {
        logger.error('Access status failed', err, 'ACCESS', { uid });
        return NextResponse.json({ error: 'Could not load access status' }, { status: 500 });
    }
}
