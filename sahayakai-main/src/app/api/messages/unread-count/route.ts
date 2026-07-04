/**
 * GET /api/messages/unread-count?userId=<uid> — total unread across the
 * caller's conversations (sidebar badge).
 * Migrated from getTotalUnreadCountAction (tranche 5).
 */
import { NextResponse } from 'next/server';
import { getTotalUnreadCount } from '@/server/messages';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

export async function GET(req: Request) {
    const callerId = req.headers.get('x-user-id');
    if (!callerId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    try {
        const total = await getTotalUnreadCount(callerId, userId);
        return NextResponse.json({ total });
    } catch (err) {
        return errorResponse(err, 'MESSAGES');
    }
}
