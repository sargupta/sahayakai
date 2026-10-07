import 'server-only';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InitiateParentCallInput, ListParentContactsInput, ParentCallResult, ParentContactsResult } from '@/lib/mcp/calling/schema';

/**
 * Server-side MCP CLIENT for /mcp-demo/calling — the same pattern as
 * ./lesson-planner-client.ts. Official MCP SDK → Streamable HTTP → POST
 * /api/mcp/calling → list_parent_contacts / initiate_parent_call. Never
 * imports the calling routes or services. The API key lives only here.
 */

export const CALLING_TOOL = 'initiate_parent_call';
export const CALLING_PROTOCOL = 'Streamable HTTP';
const CLIENT_INFO = { name: 'sahayak-mcp-calling-demo-ui', version: '1.0.0' };

export interface CallingDemoConfig { url: string; apiKey: string }

/**
 * Key: `MCP_CALLING_DEMO_API_KEY` (scope `calling`), or under `next dev` the
 * local dev key. URL: `MCP_CALLING_DEMO_SERVER_URL`, else loopback — never the
 * request's Host header.
 */
export function getCallingDemoConfig(env: Record<string, string | undefined> = process.env): CallingDemoConfig | null {
    const apiKey = env.MCP_CALLING_DEMO_API_KEY?.trim()
        || (env.NODE_ENV === 'development' ? env.MCP_LOCAL_DEV_API_KEY?.trim() : undefined);
    if (!apiKey) return null;
    const url = env.MCP_CALLING_DEMO_SERVER_URL?.trim() || `http://127.0.0.1:${env.PORT || 3000}/api/mcp/calling`;
    return { url, apiKey };
}

export interface DemoError { category: string; message: string; retryable: boolean; retry_after_seconds?: number }
export interface ServerIdentity { name: string; version: string; tool: string; protocol: string }
type FetchLike = typeof fetch;
const UNAVAILABLE: DemoError = { category: 'mcp_unavailable', message: 'The Sahayak MCP server could not be reached. Please try again.', retryable: true };

async function withClient<T>(config: CallingDemoConfig, fetchImpl: FetchLike | undefined, fn: (c: Client) => Promise<T>): Promise<T> {
    const client = new Client(CLIENT_INFO);
    try {
        await client.connect(new StreamableHTTPClientTransport(new URL(config.url), {
            requestInit: { headers: { Authorization: `Bearer ${config.apiKey}` } },
            ...(fetchImpl ? { fetch: fetchImpl } : {}),
        }), { timeout: 30_000 });
        return await fn(client);
    } finally {
        await client.close().catch(() => undefined);
    }
}

const identity = (c: Client): ServerIdentity => {
    const s = c.getServerVersion();
    return { name: s?.name ?? 'unknown', version: s?.version ?? 'unknown', tool: CALLING_TOOL, protocol: CALLING_PROTOCOL };
};

function toolError(res: unknown): DemoError {
    const e = ((res as { structuredContent?: unknown }).structuredContent as { error?: Partial<DemoError> } | undefined)?.error;
    return {
        category: typeof e?.category === 'string' ? e.category : 'internal',
        message: typeof e?.message === 'string' ? e.message : 'The request could not be completed. Please try again.',
        retryable: typeof e?.retryable === 'boolean' ? e.retryable : true,
        ...(typeof e?.retry_after_seconds === 'number' ? { retry_after_seconds: e.retry_after_seconds } : {}),
    };
}

export async function getCallingStatus(config: CallingDemoConfig, fetchImpl?: FetchLike): Promise<{ connected: true; server: ServerIdentity } | { connected: false }> {
    try {
        return await withClient(config, fetchImpl, async (c) => {
            const { tools } = await c.listTools();
            return tools.some((t) => t.name === CALLING_TOOL) ? { connected: true as const, server: identity(c) } : { connected: false as const };
        });
    } catch {
        return { connected: false };
    }
}

export type Outcome<T> = { ok: true; result: T; mcp: ServerIdentity & { durationMs: number } } | { ok: false; error: DemoError };

async function invoke<T>(tool: string, args: unknown, parse: (v: unknown) => { success: true; data: T } | { success: false }, config: CallingDemoConfig, fetchImpl?: FetchLike): Promise<Outcome<T>> {
    try {
        return await withClient(config, fetchImpl, async (c) => {
            const started = Date.now();
            const res = await c.callTool({ name: tool, arguments: args as Record<string, unknown> }, undefined, { timeout: 120_000 });
            if (res.isError) return { ok: false as const, error: toolError(res) };
            const parsed = parse(res.structuredContent);
            if (!parsed.success) return { ok: false as const, error: { category: 'internal', message: 'The MCP server returned an unexpected result.', retryable: true } };
            return { ok: true as const, result: parsed.data, mcp: { ...identity(c), tool, durationMs: Date.now() - started } };
        });
    } catch (e) {
        return /request timed out/i.test(String((e as Error)?.message ?? ''))
            ? { ok: false, error: { category: 'timeout', message: 'The request took too long. Please try again.', retryable: true } }
            : { ok: false, error: UNAVAILABLE };
    }
}

export async function listContactsViaMcp(args: unknown, config: CallingDemoConfig, fetchImpl?: FetchLike): Promise<Outcome<ParentContactsResult>> {
    const input = ListParentContactsInput.safeParse(args ?? {});
    if (!input.success) return { ok: false, error: { category: 'invalid_input', message: input.error.issues[0]?.message ?? 'Invalid input.', retryable: false } };
    return invoke('list_parent_contacts', input.data, (v) => ParentContactsResult.safeParse(v), config, fetchImpl);
}

export async function initiateCallViaMcp(args: unknown, config: CallingDemoConfig, fetchImpl?: FetchLike): Promise<Outcome<ParentCallResult>> {
    const input = InitiateParentCallInput.safeParse(args);
    if (!input.success) return { ok: false, error: { category: 'invalid_input', message: input.error.issues[0]?.message ?? 'Invalid input.', retryable: false } };
    return invoke(CALLING_TOOL, input.data, (v) => ParentCallResult.safeParse(v), config, fetchImpl);
}
