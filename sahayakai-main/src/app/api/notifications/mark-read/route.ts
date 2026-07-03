/**
 * POST /api/notifications/mark-read — mark one notification read.
 * Migrated from markNotificationAsReadAction (tranche 5).
 * Wave 1 recipientId ownership check lives in the service.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { markNotificationAsRead } from '@/server/notifications';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

const BodySchema = z.object({
    notificationId: z.string().min(1),
});

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        await markNotificationAsRead(userId, parsed.data.notificationId);
        return NextResponse.json({ success: true });
    } catch (err) {
        return errorResponse(err, 'NOTIFICATIONS');
    }
}
