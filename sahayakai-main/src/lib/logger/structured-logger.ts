import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
    service?: string;
    operation?: string;
    userId?: string;
    requestId?: string;
    input?: any;
    state?: any;
    duration?: number;
    metadata?: Record<string, any>;
}

export class StructuredLogger {
    static error(message: string, context: LogContext, error?: Error): string {
        const errorId = uuidv4();

        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            errorId,
            errorType: error?.constructor?.name || 'Error',
            errorCode: (error as any)?.errorCode || 'UNKNOWN-ERROR-001',
            message,

            // Context
            service: context.service || 'unknown',
            operation: context.operation || 'unknown',
            userId: context.userId,
            requestId: context.requestId,

            // Technical details
            stack: error?.stack,
            cause: error?.cause,

            // Operational context
            input: this.sanitizeInput(context.input),
            state: context.state,
            duration: context.duration,

            // Additional metadata
            metadata: context.metadata
        };

        // Log to console (Cloud Run captures this)
        console.error(JSON.stringify(logEntry, null, 2));

        // Send to Sentry if available
        try {
            const Sentry = require('@sentry/nextjs');
            if (Sentry) {
                Sentry.captureException(error || new Error(message), {
                    contexts: { custom: context },
                    tags: {
                        errorId,
                        errorCode: logEntry.errorCode,
                        service: logEntry.service
                    }
                });
            }
        } catch (e) {
            // Sentry not available, skip
        }

        return errorId;
    }

    static warn(message: string, context: LogContext) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'WARN',
            message,
            ...context
        };

        console.warn(JSON.stringify(logEntry, null, 2));
    }

    static info(message: string, context: LogContext) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message,
            ...context
        };

        console.log(JSON.stringify(logEntry, null, 2));
    }

    private static sanitizeInput(input: any): any {
        if (!input) return input;

        // Handle arrays
        if (Array.isArray(input)) {
            return input.map(item => this.sanitizeInput(item));
        }

        // Handle objects
        if (typeof input === 'object') {
            const sanitized: any = {};
            const sensitiveFields = ['password', 'apiKey', 'token', 'secret', 'authorization'];

            for (const [key, value] of Object.entries(input)) {
                if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    sanitized[key] = '[REDACTED]';
                } else if (typeof value === 'object') {
                    sanitized[key] = this.sanitizeInput(value);
                } else {
                    sanitized[key] = value;
                }
            }

            return sanitized;
        }

        return input;
    }
}
