/**
 * POST /api/messages/send — send a message into a conversation.
 * Migrated from sendMessageAction (tranche 5).
 *
 * Sender identity comes ONLY from the middleware-verified x-user-id header.
 * The Zod schema stays deliberately loose on the Wave 3-validated fields
 * (audioUrl / audioDuration / resource) — the service performs those checks
 * with the exact error strings the forensic tests assert on.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendMessage } from '@/server/messages';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';
import type { SharedResource } from '@/types/messages';

const BodySchema = z.object({
    conversationId: z.string().min(1),
    text: z.string(),
    type: z.enum(['text', 'resource', 'audio']).optional(),
    resource: z.unknown().optional(),
    audioUrl: z.unknown().optional(),
    audioDuration: z.unknown().optional(),
    clientMessageId: z.string().min(1).max(128).optional(),
});

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const result = await sendMessage(userId, {
            conversationId: parsed.data.conversationId,
            text: parsed.data.text,
            type: parsed.data.type,
            resource: parsed.data.resource as SharedResource | undefined,
            audioUrl: parsed.data.audioUrl as string | undefined,
            audioDuration: parsed.data.audioDuration as number | undefined,
            clientMessageId: parsed.data.clientMessageId,
        });
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err, 'MESSAGES');
    }
}
