/**
 * /api/groups/[groupId]/membership
 *   POST   — join the group (idempotent; returns { joined }).
 *   DELETE — leave the group (idempotent).
 * Member identity is ALWAYS the authenticated uid. Join/leave are single
 * Firestore transactions (Wave 2b) — see src/server/groups.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { joinGroup, leaveGroup } from '@/server/groups';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: Promise<{ groupId: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { groupId } = await ctx.params;

    try {
        const result = await joinGroup(userId, groupId);
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err);
    }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { groupId } = await ctx.params;

    try {
        await leaveGroup(userId, groupId);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return errorResponse(err);
    }
}
