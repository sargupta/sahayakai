/**
 * POST /api/messages/conversations/direct — get or create a 1:1 DM.
 * Migrated from getOrCreateDirectConversationAction (tranche 5).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrCreateDirectConversation } from '@/server/messages';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

const BodySchema = z.object({
    myUid: z.string().min(1),
    otherUid: z.string().min(1),
});

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const result = await getOrCreateDirectConversation(userId, parsed.data.myUid, parsed.data.otherUid);
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err, 'MESSAGES');
    }
}
