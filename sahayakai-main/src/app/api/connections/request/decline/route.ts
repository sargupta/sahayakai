/**
 * POST /api/connections/request/decline — decline (recipient) or withdraw
 * (sender) a pending connection request.
 * Migrated from declineConnectionRequestAction (tranche 5).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { declineConnectionRequest } from '@/server/connections';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

const BodySchema = z.object({
    requestId: z.string().min(1),
});

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await declineConnectionRequest(userId, parsed.data.requestId);
        return NextResponse.json({ success: true });
    } catch (err) {
        return errorResponse(err, 'CONNECTIONS');
    }
}
