/**
 * Typed client wrapper for GET /api/logs (tranche 5 migration of
 * src/app/actions/logs.ts). Signature and `{ logs, error? }` result contract
 * identical to the old server action — never throws.
 */
import { apiFetch } from '@/lib/api/client';
import type { LogEntryDTO } from '@/lib/services/log-service';

export async function getLogsAction(
    limit: number = 50,
    severity?: string,
): Promise<{ logs: LogEntryDTO[]; error?: string }> {
    try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (severity) params.set('severity', severity);
        return await apiFetch(`/api/logs?${params.toString()}`);
    } catch {
        return {
            logs: [],
            error: 'Failed to retrieve logs. Ensure you have the required GCP permissions.',
        };
    }
}
