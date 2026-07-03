/**
 * /api/moderation/block — block / unblock a user (moderation v1).
 *   POST   { blockedUid } — block
 *   DELETE { blockedUid } — unblock
 *
 * Caller identity comes ONLY from the middleware-verified x-user-id header
 * (docs/API_MIGRATION_PATTERN.md). The block list lives at
 * users/{caller}/blocks/{blockedUid}; the blocked user is never notified.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { blockUser, unblockUser } from '@/server/moderation';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    blockedUid: z.string().min(1).max(128),
});

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await blockUser(userId, parsed.data.blockedUid);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return errorResponse(err, 'MODERATION');
    }
}

export async function DELETE(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await unblockUser(userId, parsed.data.blockedUid);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return errorResponse(err, 'MODERATION');
    }
}
