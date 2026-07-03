/**
 * POST /api/telemetry — persist a batch of client telemetry events
 * (tranche 5 migration of src/app/actions/telemetry.ts::syncTelemetryEvents).
 *
 * Auth: middleware-verified x-user-id required (401 when absent — the client
 * wrapper converts that to the action's historic `{ success: true, count: 0 }`
 * silent-drop so offline queues stay happy). The uid is server-stamped on
 * every event; batch capped at 500 inside the service.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { syncTelemetryEvents } from '@/server/telemetry';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

const TelemetrySchema = z.object({
    events: z.array(z.record(z.any())).max(500),
});

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = TelemetrySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid telemetry payload' }, { status: 400 });
    }

    try {
        const result = await syncTelemetryEvents(parsed.data.events);
        return NextResponse.json(result);
    } catch (error) {
        return errorResponse(error, 'TELEMETRY');
    }
}
