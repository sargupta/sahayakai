/**
 * POST /api/profile/certifications — add a certification to the caller's own
 * profile (tranche 5 migration of
 * src/app/actions/profile.ts::addCertificationAction). Self-only by
 * construction: uid comes from the middleware-verified session.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addCertificationAction } from '@/server/profile';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

const CertificationSchema = z.object({
    certName: z.string().min(1).max(300),
    issuingBody: z.string().max(300).optional(),
    issueDate: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = CertificationSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        // Keep the historic message for the empty-certName case.
        return NextResponse.json({ error: 'Missing required field: certName' }, { status: 400 });
    }

    try {
        await addCertificationAction(parsed.data);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Missing required field')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return errorResponse(error, 'PROFILE');
    }
}
