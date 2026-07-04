/**
 * POST /api/account/sync — sync the verified auth identity into Firestore on
 * sign-in (tranche 5 migration of src/app/actions/auth.ts::syncUserAction).
 *
 * SECURITY (F1-06 / F11-5): the service trusts ONLY the middleware-verified
 * x-user-id / x-user-email / x-user-name headers (field-OMISSION semantics
 * when a claim is absent). The client payload is compat-only (photoURL).
 *
 * Lives under /api/account/** — NOT /api/auth/** — because middleware's
 * public-route list contains the `/api/auth/` prefix (pre-login
 * profile-check); this endpoint must stay behind token verification.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { syncUserAction } from '@/server/auth';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

const SyncUserSchema = z.object({
    uid: z.string().min(1),
    email: z.string().max(320).nullable(),
    displayName: z.string().max(300).nullable(),
    photoURL: z.string().max(2048).nullable(),
});

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = SyncUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Invalid user data' }, { status: 400 });
    }

    try {
        const result = await syncUserAction(parsed.data);
        // Same result contract as the action ({ success, error? }); keep 200
        // so the client wrapper returns the object unchanged.
        return NextResponse.json(result);
    } catch (error) {
        return errorResponse(error, 'AUTH');
    }
}
