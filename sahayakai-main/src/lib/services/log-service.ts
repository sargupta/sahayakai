export interface LogEntryDTO {
    timestamp: string;
    severity: string;
    message: string;
    service?: string;
    operation?: string;
    userId?: string;
    requestId?: string;
    metadata?: any;
    errorId?: string;
}

export class LogService {
    /**
     * Fetches recent logs from GCP.
     * If severity is 'ALL', it fetches everything from the project's default logs.
     */
    static async getRecentLogs(limit: number = 50, severity?: string): Promise<LogEntryDTO[]> {
        try {
            const { Logging } = await import('@google-cloud/logging');

            const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sahayakai-b4248';
            const logging = new Logging({ projectId });

            // Search across ALL logs for this project
            // Filter for structured logs that look like they came from our application
            let filter = `resource.type="cloud_run_revision" OR resource.type="global"`;

            if (severity && severity !== 'ALL') {
                filter += ` AND severity="${severity}"`;
            }

            const [entries] = await logging.getEntries({
                pageSize: limit,
                filter: filter,
                orderBy: 'timestamp desc',
            });

            console.log(`[LogService] Found ${entries.length} log entries for filter: ${filter}`);

            return entries.map(entry => {
                const metadata = entry.metadata;
                const payload = entry.data;

                // Try to parse structured data even if it was logged as a string
                let jsonPayload: any = payload;
                if (typeof payload === 'string' && payload.trim().startsWith('{')) {
                    try {
                        jsonPayload = JSON.parse(payload);
                    } catch (e) {
                        // Not JSON, keep as string
                    }
                }

                return {
                    timestamp: metadata.timestamp?.toString() || new Date().toISOString(),
                    severity: metadata.severity?.toString() || 'INFO',
                    message: jsonPayload?.message || (typeof payload === 'string' ? payload : 'No message'),
                    service: jsonPayload?.service || metadata.labels?.context || (metadata.resource?.labels as any)?.service_name,
                    operation: jsonPayload?.operation,
                    userId: jsonPayload?.userId,
                    requestId: jsonPayload?.requestId,
                    errorId: jsonPayload?.errorId,
                    metadata: jsonPayload?.metadata || (typeof jsonPayload === 'object' ? jsonPayload : {}),
                };
            });
        } catch (error) {
            console.error('Failed to fetch logs from GCP:', error);
            return [];
        }
    }
}
