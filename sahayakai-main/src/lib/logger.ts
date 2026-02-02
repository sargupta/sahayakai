type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: string; // e.g., 'STORAGE', 'AUTH', 'AI'
    data?: Record<string, any>;
    error?: Error | unknown;
}

class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development';
    private isServer = typeof window === 'undefined';
    private gcpLoggingMetadata = {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        logName: 'sahayakai-application-logs'
    };

    private formatEntry(level: LogLevel, message: string, data?: Record<string, any>, error?: unknown, context?: string): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            data,
            error: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error
        };
    }

    private async sendToGCP(entry: LogEntry) {
        if (!this.isServer || this.isDevelopment) return;

        try {
            // Use a variable to prevent Webpack from statically analyzing the import
            // and trying to bundle Node.js dependencies for the client.
            const pkgName = '@google-cloud/logging';
            const { Logging } = await import(pkgName);
            const logging = new Logging({ projectId: this.gcpLoggingMetadata.projectId });
            const log = logging.log(this.gcpLoggingMetadata.logName);

            const metadata = {
                resource: { type: 'global' },
                severity: this.mapSeverity(entry.level),
                labels: {
                    context: entry.context || 'GENERAL',
                    environment: process.env.NODE_ENV || 'production'
                }
            };

            const logEntry = log.entry(metadata, entry);
            await log.write(logEntry);
        } catch (e) {
            // Silently fail to avoid crashing the app due to logging failures
            // but we could fallback to console.error in some cases
        }
    }

    private mapSeverity(level: LogLevel): string {
        switch (level) {
            case 'info': return 'INFO';
            case 'warn': return 'WARNING';
            case 'error': return 'ERROR';
            case 'debug': return 'DEBUG';
            default: return 'INFO';
        }
    }

    private async print(entry: LogEntry) {
        // Don't clutter test output unless it's an error
        if (process.env.NODE_ENV === 'test' && entry.level !== 'error') {
            return;
        }

        const { level, message, data, error, timestamp, context } = entry;
        const prefix = `[${level.toUpperCase()}]${context ? `[${context}]` : ''}${this.isServer ? '[SERVER]' : '[CLIENT]'}`;
        const output = `${prefix} ${timestamp} - ${message}`;

        switch (level) {
            case 'info':
                console.log(output, data || '');
                break;
            case 'warn':
                console.warn(output, data || '');
                break;
            case 'error':
                console.error(output, error || '', data || '');
                // --- Sentry Integration ---
                if (!this.isDevelopment) {
                    try {
                        const Sentry = await import('@sentry/nextjs');
                        if (error instanceof Error) {
                            Sentry.captureException(error, { extra: { context, ...data } });
                        } else {
                            Sentry.captureMessage(message, { level: 'error', extra: { context, ...data, errorData: error } });
                        }
                    } catch (e) {
                        // SDK not installed or configured yet
                    }
                }
                break;
            case 'debug':
                if (this.isDevelopment) {
                    console.debug(output, data || '');
                }
                break;
        }

        // --- GCP Logging ---
        if (this.isServer && !this.isDevelopment) {
            await this.sendToGCP(entry);
        }
    }

    info(message: string, context?: string, data?: Record<string, any>) {
        this.print(this.formatEntry('info', message, data, undefined, context));
    }

    warn(message: string, context?: string, data?: Record<string, any>) {
        this.print(this.formatEntry('warn', message, data, undefined, context));
    }

    error(message: string, error?: unknown, context?: string, data?: Record<string, any>) {
        this.print(this.formatEntry('error', message, data, error, context));
    }

    startTimer(message: string, context?: string, data?: Record<string, any>) {
        const start = performance.now();
        this.info(`Timer started: ${message}`, context, data);

        return {
            stop: (endData?: Record<string, any>) => {
                const duration = performance.now() - start;
                this.info(`Timer stopped: ${message} - ${duration.toFixed(2)}ms`, context, { ...data, ...endData, durationMs: duration });
                return duration;
            }
        };
    }
}

export const logger = new Logger();
