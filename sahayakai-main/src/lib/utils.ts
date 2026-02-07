import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Robust Logging Implementation
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, any>;
  error?: Error | unknown;
  timestamp: string;
  environment: string;
}

const formatError = (error: unknown): Record<string, any> | undefined => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    };
  }
  if (typeof error === 'object' && error !== null) {
    return error as Record<string, any>;
  }
  return error ? { message: String(error) } : undefined;
};

export const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    const entry: LogEntry = {
      level: 'info',
      message,
      meta,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
    // In production, Cloud Run captures stdout as structured logs
    console.log(JSON.stringify(entry));
  },

  warn: (message: string, meta?: Record<string, any>) => {
    const entry: LogEntry = {
      level: 'warn',
      message,
      meta,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
    console.warn(JSON.stringify(entry));
  },

  error: (message: string, error?: unknown, meta?: Record<string, any>) => {
    const entry: LogEntry = {
      level: 'error',
      message,
      error: formatError(error),
      meta,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
    console.error(JSON.stringify(entry));
  },

  debug: (message: string, meta?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[DEBUG]', message, meta);
    }
  }
};
