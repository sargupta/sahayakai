/**
 * Typed client wrapper for POST /api/telemetry (tranche 5 migration of
 * src/app/actions/telemetry.ts). Signature identical to the old server
 * action — never throws.
 */
import { apiFetch, ApiError } from '@/lib/api/client';

export async function syncTelemetryEvents(
    events: any[],
): Promise<{ success: boolean; count?: number }> {
    try {
        return await apiFetch(`/api/telemetry`, { method: 'POST', body: { events } });
    } catch (e) {
        // Action contract: unauthenticated syncs are a SILENT DROP that
        // reports success so the client's offline queue clears instead of
        // retrying forever.
        if (e instanceof ApiError && e.status === 401) {
            return { success: true, count: 0 };
        }
        return { success: false };
    }
}
