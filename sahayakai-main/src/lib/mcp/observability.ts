import { StructuredLogger } from '@/lib/logger/structured-logger';
import type { McpErrorCategory } from './errors';

/**
 * One structured log line per MCP tool call. Deliberately excludes the API
 * key, the request arguments (teacher-typed topics) and the generated
 * content: only identifiers, timing and outcome are recorded.
 */
export interface McpCallLog {
    requestId: string;
    capability: string;
    tool: string;
    keyId: string;
    orgId: string;
    durationMs: number;
    outcome: 'success' | 'error';
    errorCategory?: McpErrorCategory;
}

export function logMcpCall(entry: McpCallLog): void {
    const context = {
        service: 'mcp',
        operation: entry.tool,
        requestId: entry.requestId,
        duration: entry.durationMs,
        metadata: {
            capability: entry.capability,
            keyId: entry.keyId,
            orgId: entry.orgId,
            outcome: entry.outcome,
            ...(entry.errorCategory ? { errorCategory: entry.errorCategory } : {}),
        },
    };
    if (entry.outcome === 'success') StructuredLogger.info('MCP tool call', context);
    else StructuredLogger.warn('MCP tool call failed', context);
}

/** Request-level rejections (bad key, missing scope) — no principal yet. */
export function logMcpRejection(capability: string, requestId: string, category: McpErrorCategory): void {
    StructuredLogger.warn('MCP request rejected', {
        service: 'mcp',
        operation: 'authenticate',
        requestId,
        metadata: { capability, errorCategory: category },
    });
}
