/**
 * POST /api/connections/request — send a connection request.
 * Migrated from sendConnectionRequestAction (tranche 5).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendConnectionRequest } from '@/server/connections';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

const BodySchema = z.object({
    toUid: z.string().min(1),
});

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const result = await sendConnectionRequest(userId, parsed.data.toUid);
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err, 'CONNECTIONS');
    }
}
