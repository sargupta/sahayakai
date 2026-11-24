import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { buildWatermarkText } from '@/lib/access/watermark';

export const dynamic = 'force-dynamic';

/**
 * GET /api/access/watermark -> { watermark: string | null }
 *
 * The footer line the client stamps on every exported PDF page
 * (src/lib/export-pdf.ts). Computed server-side from values the client cannot
 * forge: the gate verdict and organisation come from the middleware-injected
 * `x-user-access` / `x-user-org` / `x-user-email` headers (verified ID-token
 * claims), the school name from the caller's own profile document.
 *
 * Always 200 for a signed-in caller; `null` means "no watermark". On an
 * internal error the answer is also `null` so a Firestore hiccup can never
 * block a teacher's download.
 */
export async function GET(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = request.headers.get('x-user-access');
    const email = request.headers.get('x-user-email');
    const tokenOrgId = request.headers.get('x-user-org');

    // Fast path: these verdicts never carry a watermark and need no I/O.
    if (access !== 'pilot' && access !== 'active') {
        return NextResponse.json({ watermark: null }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    try {
        const db = await getDb();
        const userSnap = await db.collection('users').doc(userId).get();
        const profile = (userSnap.exists ? userSnap.data() : undefined) as
            | { schoolName?: unknown; organizationId?: unknown; email?: unknown }
            | undefined;

        const orgId =
            tokenOrgId ||
            (typeof profile?.organizationId === 'string' ? profile.organizationId : '');

        let orgName: string | null = null;
        if (orgId) {
            const orgSnap = await db.collection('organizations').doc(orgId).get();
            const name = orgSnap.exists ? (orgSnap.data() as { name?: unknown }).name : undefined;
            orgName = typeof name === 'string' ? name : null;
        }

        const watermark = buildWatermarkText({
            access,
            orgName,
            schoolName: typeof profile?.schoolName === 'string' ? profile.schoolName : null,
            email: email || (typeof profile?.email === 'string' ? profile.email : null),
        });
        return NextResponse.json({ watermark }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (err) {
        logger.error('Failed to resolve export watermark', err, 'ACCESS', { userId });
        return NextResponse.json({ watermark: null }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
}
