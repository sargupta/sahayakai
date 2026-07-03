/**
 * POST /api/groups/[groupId]/chat — send a group chat message (members only,
 * rate-limited; audioUrl restricted to Firebase Storage; author identity
 * derives from the authenticated uid — see src/server/groups.ts).
 * Returns { id }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendGroupChatMessage } from '@/server/groups';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: Promise<{ groupId: string }> }

const BodySchema = z.object({
    text: z.string().max(2000),
    audioUrl: z.string().max(2048).optional(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { groupId } = await ctx.params;
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const id = await sendGroupChatMessage(userId, groupId, parsed.data.text, parsed.data.audioUrl);
        return NextResponse.json({ id });
    } catch (err) {
        return errorResponse(err);
    }
}
