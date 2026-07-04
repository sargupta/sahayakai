/**
 * POST /api/messages/conversations/group — create a group conversation.
 * Migrated from createGroupConversationAction (tranche 5).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createGroupConversation } from '@/server/messages';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

const BodySchema = z.object({
    creatorUid: z.string().min(1),
    participantUids: z.array(z.string().min(1)),
    name: z.string(),
});

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const result = await createGroupConversation(
            userId,
            parsed.data.creatorUid,
            parsed.data.participantUids,
            parsed.data.name,
        );
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err, 'MESSAGES');
    }
}
