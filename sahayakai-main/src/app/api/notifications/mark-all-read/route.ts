/**
 * POST /api/notifications/mark-all-read — mark all of the caller's
 * notifications read.
 * Migrated from markAllAsReadAction (tranche 5).
 */
import { NextResponse } from 'next/server';
import { markAllAsRead } from '@/server/notifications';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    try {
        await markAllAsRead(userId);
        return NextResponse.json({ success: true });
    } catch (err) {
        return errorResponse(err, 'NOTIFICATIONS');
    }
}
