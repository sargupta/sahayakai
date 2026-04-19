/**
 * Client-safe logger — same API as @/lib/logger but no Node.js dependencies.
 * Use this in "use client" components. The server logger (@/lib/logger) imports
 * @google-cloud/logging which uses node:util and breaks webpack client bundles.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class ClientLogger {
    private isDevelopment = process.env.NODE_ENV === 'development';

    info(message: string, context?: string, data?: Record<string, any>) {
        const prefix = `[INFO]${context ? `[${context}]` : ''}[CLIENT]`;
        console.log(`${prefix} ${new Date().toISOString()} - ${message}`, data || '');
    }

    warn(message: string, context?: string, data?: Record<string, any>) {
        const prefix = `[WARN]${context ? `[${context}]` : ''}[CLIENT]`;
        console.warn(`${prefix} ${new Date().toISOString()} - ${message}`, data || '');
    }

    error(message: string, error?: unknown, context?: string, data?: Record<string, any>) {
        const prefix = `[ERROR]${context ? `[${context}]` : ''}[CLIENT]`;
        console.error(`${prefix} ${new Date().toISOString()} - ${message}`, error || '', data || '');
    }

    debug(message: string, context?: string, data?: Record<string, any>) {
        if (this.isDevelopment) {
            console.debug(`[DEBUG]${context ? `[${context}]` : ''}[CLIENT] ${message}`, data || '');
        }
    }
}

export const logger = new ClientLogger();
