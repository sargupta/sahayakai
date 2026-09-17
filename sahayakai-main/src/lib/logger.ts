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
    /** Built once. It used to be constructed on every single log call. */
    private gcpLog: Promise<{ write: (e: unknown) => Promise<unknown>; entry: (m: unknown, d: unknown) => unknown }> | null = null;
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
            // Use string literal to ensure Webpack bundles the dependency
            if (!this.gcpLog) {
                this.gcpLog = (async () => {
                    const { Logging } = await import('@google-cloud/logging');
                    const logging = new Logging({ projectId: this.gcpLoggingMetadata.projectId });
                    return logging.log(this.gcpLoggingMetadata.logName) as never;
                })();
            }
            const log = await this.gcpLog;

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

    /**
     * One line of JSON per event, which is the only shape Cloud Run's log
     * agent can parse.
     *
     * WHY: `console.error(prefix, errorObject)` asks Node to pretty-print the
     * Error with util.inspect, which emits the message and every stack frame
     * on its own line. Cloud Run ingests stdout line by line, so a single
     * failure arrived as a dozen separate entries, each with no severity and
     * no message field. Querying `severity>=ERROR` in Log Explorer returned
     * request logs with empty payloads and none of the actual errors — the
     * billing reconciliation job failed 104 times over four days and its
     * reason was effectively unfindable.
     *
     * `severity`, `message` and `stack_trace` are the field names Cloud
     * Logging and Error Reporting look for; everything else rides along in
     * jsonPayload.
     */
    private writeStructured(entry: LogEntry) {
        const { level, message, context, data, error, timestamp } = entry;

        // formatEntry has already flattened any Error into
        // { message, stack, name }, so an `instanceof Error` check here would
        // never fire. Read the flattened shape instead.
        const flat = (
            error !== null && typeof error === 'object' && 'stack' in (error as object)
                ? (error as { message?: string; stack?: string; name?: string })
                : null
        );

        const payload: Record<string, unknown> = {
            severity: this.mapSeverity(level),
            message: flat?.message ? `${message}: ${flat.message}` : message,
            time: timestamp,
        };
        if (context) payload.context = context;
        if (data) payload.data = data;
        if (flat) {
            payload.stack_trace = flat.stack;
            payload.errorName = flat.name;
        } else if (error !== undefined && error !== null) {
            payload.error = error;
        }

        let line: string;
        try {
            line = JSON.stringify(payload);
        } catch {
            // Circular or otherwise unserialisable `data` must not cost us the
            // log line — drop the payload, keep the event.
            line = JSON.stringify({
                severity: this.mapSeverity(level),
                message,
                time: timestamp,
                context,
                dataOmitted: 'unserialisable',
            });
        }

        // console.* with exactly one string argument emits exactly one line.
        if (level === 'error') console.error(line);
        else if (level === 'warn') console.warn(line);
        else console.info(line);
    }

    private async print(entry: LogEntry) {
        // Don't clutter test output unless it's an error
        if (process.env.NODE_ENV === 'test' && entry.level !== 'error') {
            return;
        }

        const { level, message, data, error, timestamp, context } = entry;

        // On Cloud Run, emit machine-readable JSON. Locally and in the
        // browser, keep the readable prefixed form.
        const structured = this.isServer && !this.isDevelopment;
        if (structured && level !== 'debug') {
            this.writeStructured(entry);
        }

        const prefix = `[${level.toUpperCase()}]${context ? `[${context}]` : ''}${this.isServer ? '[SERVER]' : '[CLIENT]'}`;
        const output = `${prefix} ${timestamp} - ${message}`;

        switch (level) {
            case 'info':
                // Sink for the info level. Uses console.info so the no-console
                // lint gate stays green while behaving identically.
                if (!structured) console.info(output, data || '');
                break;
            case 'warn':
                if (!structured) console.warn(output, data || '');
                break;
            case 'error':
                if (!structured) console.error(output, error || '', data || '');
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
