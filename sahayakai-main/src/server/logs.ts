/**
 * Admin log-reader service — migrated verbatim from src/app/actions/logs.ts
 * (tranche 5, docs/API_MIGRATION_PATTERN.md). Served by GET /api/logs.
 */

import { LogService, LogEntryDTO } from '@/lib/services/log-service';
import { StructuredLogger } from '@/lib/logger/structured-logger';

/**
 * Fetch recent application logs for admins.
 */
export async function getLogsAction(limit: number = 50, severity?: string): Promise<{ logs: LogEntryDTO[], error?: string }> {
    try {
        // 1. Admin Verification
        const { headers } = await import('next/headers');
        const headersList = await headers();
        const userId = headersList.get('x-user-id');

        if (!userId) throw new Error("Unauthorized");

        // This will throw if the user is not an admin
        const { validateAdmin } = await import('@/lib/auth-utils');
        await validateAdmin(userId);

        const logs = await LogService.getRecentLogs(limit, severity);
        return { logs };
    } catch (error) {
        StructuredLogger.error('Failed to fetch logs via API route', {
            service: 'log-action',
            operation: 'getLogsAction'
        }, error as Error);

        return {
            logs: [],
            error: 'Failed to retrieve logs. Ensure you have the required GCP permissions.'
        };
    }
}
