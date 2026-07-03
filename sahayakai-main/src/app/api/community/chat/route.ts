/**
 * POST /api/community/chat — send a community chat message.
 * Body: { text, audioUrl? }. Author identity/name/photo derive from the
 * authenticated uid server-side; audioUrl restricted to Firebase Storage
 * (F10-03) — both enforced in src/server/community.ts. Rate-limited.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendChatMessage } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    text: z.string().max(2000),
    audioUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await sendChatMessage(userId, parsed.data.text, parsed.data.audioUrl);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return errorResponse(err);
    }
}
