/**
 * GET /api/notifications — the caller's notifications (newest first).
 * Migrated from getNotificationsAction (tranche 5).
 */
import { NextResponse } from 'next/server';
import { getNotifications } from '@/server/notifications';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

export async function GET(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    try {
        const notifications = await getNotifications(userId);
        return NextResponse.json(notifications);
    } catch (err) {
        return errorResponse(err, 'NOTIFICATIONS');
    }
}
