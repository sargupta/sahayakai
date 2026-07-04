/**
 * POST /api/messages/mark-read — mark a conversation read for the caller.
 * Migrated from markConversationReadAction (tranche 5).
 * F2-02 participant check lives in the service.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { markConversationRead } from '@/server/messages';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

const BodySchema = z.object({
    conversationId: z.string().min(1),
    userId: z.string().min(1),
});

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await markConversationRead(userId, parsed.data.conversationId, parsed.data.userId);
        return NextResponse.json({ success: true });
    } catch (err) {
        return errorResponse(err, 'MESSAGES');
    }
}
