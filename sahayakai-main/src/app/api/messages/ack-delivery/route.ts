/**
 * POST /api/messages/ack-delivery — stamp deliveredTo on visible messages.
 * Migrated from acknowledgeDeliveryAction (tranche 5).
 * F2-03 participant check lives in the service.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { acknowledgeDelivery } from '@/server/messages';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

const BodySchema = z.object({
    conversationId: z.string().min(1),
    messageIds: z.array(z.string().min(1)),
});

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await acknowledgeDelivery(userId, parsed.data.conversationId, parsed.data.messageIds);
        return NextResponse.json({ success: true });
    } catch (err) {
        return errorResponse(err, 'MESSAGES');
    }
}
