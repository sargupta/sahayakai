/**
 * /api/attendance/twilio-config
 *
 * GET — whether Twilio env vars are configured (was getTwilioConfigStatusAction).
 * Auth-gated; reveals only a boolean, never the values.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getTwilioConfigStatus, attendanceErrorStatus } from '@/server/attendance';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        return NextResponse.json(await getTwilioConfigStatus(userId));
    } catch (err) {
        const { message, status } = attendanceErrorStatus(err);
        return NextResponse.json({ error: message }, { status });
    }
}
