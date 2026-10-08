import 'server-only';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpScope } from './api-keys';
import { authenticateMcpRequest, type McpAuthDb, type McpPrincipal } from './auth';
import { classifyError, McpCapabilityError, toToolErrorResult } from './errors';
import { logMcpCall, logMcpRejection } from './observability';

/**
 * Shared HTTP entry point for every public Sahayak MCP server.
 *
 * One capability = one endpoint = one API-key scope, so a school can be
 * granted exactly the Sahayak capabilities it bought. Each server is a thin
 * adapter: it authenticates the caller, then calls the EXISTING Sahayak
 * service layer — no parallel AI implementation.
 *
 * Transport: MCP Streamable HTTP, stateless + JSON responses (a fresh
 * server per request, no session affinity), which suits Cloud Run's
 * horizontal scaling. Only POST is served; there is no server-initiated
 * SSE stream in stateless mode.
 */

/** Requests larger than this are refused before parsing. */
export const MAX_MCP_REQUEST_BYTES = 64 * 1024;

export interface McpHandlerDeps {
    getDb: () => Promise<McpAuthDb>;
    /** Per-key sliding-window limit; throws "Rate limit exceeded. Please wait N minutes." */
    rateLimit: (bucketId: string) => Promise<void>;
}

export interface ToolRunContext {
    principal: McpPrincipal;
    requestId: string;
}

export interface McpCapabilityDefinition {
    scope: McpScope;
    serverInfo: { name: string; version: string; title?: string };
    /** Shown to agents at initialize: what this server is for, in two or three sentences. */
    instructions: string;
    register: (server: McpServer, ctx: CapabilityRegistrationContext) => void;
}

export interface CapabilityRegistrationContext {
    /**
     * Wrap a tool implementation: per-key rate limit, error classification
     * (never leaks internals), and one structured log line per call.
     */
    run<T extends Record<string, unknown>>(
        tool: string,
        fn: (ctx: ToolRunContext) => Promise<T>,
        toText: (result: T) => string,
    ): Promise<{
        content: { type: 'text'; text: string }[];
        structuredContent?: Record<string, unknown>;
        isError?: boolean;
        _meta?: Record<string, unknown>;
    }>;
}

function jsonRpcError(status: number, message: string, extraHeaders: Record<string, string> = {}, code?: number): Response {
    return new Response(
        JSON.stringify({ jsonrpc: '2.0', error: { code: code ?? (status === 401 || status === 403 ? -32001 : -32000), message }, id: null }),
        { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders } },
    );
}

/**
 * Read and parse the JSON-RPC body ourselves (after authentication), so the
 * size limit is enforced on the bytes actually received — not just on a
 * client-declared Content-Length — and parse errors are uniform.
 */
async function readJsonBody(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
    let raw: string;
    try {
        raw = await request.text();
    } catch {
        return { ok: false, response: jsonRpcError(400, 'Could not read the request body.', {}, -32700) };
    }
    if (Buffer.byteLength(raw, 'utf8') > MAX_MCP_REQUEST_BYTES) {
        return { ok: false, response: jsonRpcError(413, `Request too large. Maximum is ${MAX_MCP_REQUEST_BYTES} bytes.`) };
    }
    try {
        return { ok: true, body: JSON.parse(raw) };
    } catch {
        return { ok: false, response: jsonRpcError(400, 'Parse error: the request body must be JSON-RPC 2.0 JSON.', {}, -32700) };
    }
}

const STATUS_FOR: Partial<Record<McpCapabilityError['category'], number>> = {
    authentication: 401,
    authorization: 403,
    not_configured: 503,
};

export async function handleMcpHttpRequest(
    request: Request,
    capability: McpCapabilityDefinition,
    deps: McpHandlerDeps,
): Promise<Response> {
    const requestId = randomUUID();

    if (request.method !== 'POST') {
        return jsonRpcError(405, 'Method not allowed. This MCP server uses Streamable HTTP POST (stateless).', { Allow: 'POST' });
    }
    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (declaredLength > MAX_MCP_REQUEST_BYTES) {
        return jsonRpcError(413, `Request too large. Maximum is ${MAX_MCP_REQUEST_BYTES} bytes.`);
    }

    let principal: McpPrincipal;
    try {
        principal = await authenticateMcpRequest(request.headers, capability.scope, deps);
    } catch (err) {
        const e = err instanceof McpCapabilityError ? err : classifyError(err);
        logMcpRejection(capability.scope, requestId, e.category);
        const status = STATUS_FOR[e.category] ?? 503;
        return jsonRpcError(status, e.message, status === 401 ? { 'WWW-Authenticate': 'Bearer realm="sahayak-mcp"' } : {});
    }

    const ctx: CapabilityRegistrationContext = {
        async run(tool, fn, toText) {
            const started = Date.now();
            try {
                await deps.rateLimit(`mcp_${principal.keyId}`);
                const result = await fn({ principal, requestId });
                logMcpCall({ requestId, capability: capability.scope, tool, keyId: principal.keyId, orgId: principal.orgId, durationMs: Date.now() - started, outcome: 'success' });
                return { content: [{ type: 'text', text: toText(result) }], structuredContent: result };
            } catch (err) {
                const e = classifyError(err);
                logMcpCall({ requestId, capability: capability.scope, tool, keyId: principal.keyId, orgId: principal.orgId, durationMs: Date.now() - started, outcome: 'error', errorCategory: e.category });
                return toToolErrorResult(e);
            }
        },
    };

    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const server = new McpServer(capability.serverInfo, { instructions: capability.instructions });
    capability.register(server, ctx);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
        await server.connect(transport);
        const response = await transport.handleRequest(request, { parsedBody: parsed.body });
        response.headers.set('Cache-Control', 'no-store');
        response.headers.set('X-Request-Id', requestId);
        return response;
    } catch {
        return jsonRpcError(500, 'Sahayak could not process this MCP request.');
    } finally {
        void server.close().catch(() => undefined);
    }
}
