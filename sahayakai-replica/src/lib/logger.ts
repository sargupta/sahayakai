type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: Record<string, any>;
    error?: Error | unknown;
}

class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development';

    private formatEntry(level: LogLevel, message: string, data?: Record<string, any>, error?: unknown): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            error: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error
        };
    }

    private print(entry: LogEntry) {
        // In production, this would likely send to an observability service (OpenTelemetry, Datadog, etc.)
        // For now, we standardize console output.

        // Don't clutter test output unless it's an error
        if (process.env.NODE_ENV === 'test' && entry.level !== 'error') {
            return;
        }

        const { level, message, data, error, timestamp } = entry;

        switch (level) {
            case 'info':
                console.log(`[INFO] ${timestamp} - ${message}`, data || '');
                break;
            case 'warn':
                console.warn(`[WARN] ${timestamp} - ${message}`, data || '');
                break;
            case 'error':
                console.error(`[ERROR] ${timestamp} - ${message}`, error || '', data || '');
                break;
            case 'debug':
                if (this.isDevelopment) {
                    console.debug(`[DEBUG] ${timestamp} - ${message}`, data || '');
                }
                break;
        }
    }

    info(message: string, data?: Record<string, any>) {
        this.print(this.formatEntry('info', message, data));
    }

    warn(message: string, data?: Record<string, any>) {
        this.print(this.formatEntry('warn', message, data));
    }

    error(message: string, error?: unknown, data?: Record<string, any>) {
        this.print(this.formatEntry('error', message, data, error));
    }

    debug(message: string, data?: Record<string, any>) {
        this.print(this.formatEntry('debug', message, data));
    }
}

export const logger = new Logger();
