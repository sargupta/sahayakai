import 'server-only';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CreateLessonPlanInput, LessonPlanResult } from '@/lib/mcp/lesson-planner/schema';

/**
 * Server-side MCP CLIENT used by the /mcp-demo/lesson-planner page.
 *
 * The demo page must show Sahayak's lesson planner being consumed THROUGH the
 * public MCP server, so this module does exactly what an external school's
 * agent does: official MCP SDK client → Streamable HTTP → POST
 * /api/mcp/lesson-planner → `create_lesson_plan`. It never imports the
 * lesson-plan service.
 *
 * The API key lives only here (server env). The browser talks to
 * /api/mcp-demo/lesson-planner, which requires a signed-in Sahayak user, and
 * never sees the key, the MCP URL or any MCP internals.
 */

export const MCP_DEMO_TOOL = 'create_lesson_plan';
export const MCP_DEMO_PROTOCOL = 'Streamable HTTP';
const CLIENT_INFO = { name: 'sahayak-mcp-demo-ui', version: '1.0.0' };
// Generation budget of the MCP server's route (maxDuration 120 s).
const CALL_TIMEOUT_MS = 120_000;

export interface McpDemoConfig {
    url: string;
    apiKey: string;
}

/**
 * Where the MCP server is and which key to present.
 *
 * - URL: `MCP_DEMO_SERVER_URL`, else this server over loopback. It is NEVER
 *   derived from the incoming request's Host header — a spoofed Host would
 *   otherwise make the server send its API key to an attacker's host.
 * - Key: `MCP_DEMO_API_KEY` (a normal scoped key issued with
 *   scripts/mcp/create-api-key.ts, scope `lesson-planner`), or — under
 *   `next dev` only — the local dev key from `npm run mcp:dev-key`.
 */
export function getMcpDemoConfig(env: Record<string, string | undefined> = process.env): McpDemoConfig | null {
    const apiKey = env.MCP_DEMO_API_KEY?.trim()
        || (env.NODE_ENV === 'development' ? env.MCP_LOCAL_DEV_API_KEY?.trim() : undefined);
    if (!apiKey) return null;
    const url = env.MCP_DEMO_SERVER_URL?.trim() || `http://127.0.0.1:${env.PORT || 3000}/api/mcp/lesson-planner`;
    return { url, apiKey };
}

export interface McpServerIdentity {
    name: string;
    version: string;
    tool: string;
    protocol: string;
}

export type McpDemoError = {
    category: string;
    message: string;
    retryable: boolean;
};

export type McpDemoResult =
    | { ok: true; plan: LessonPlanResult; mcp: McpServerIdentity & { durationMs: number } }
    | { ok: false; error: McpDemoError };

type FetchLike = typeof fetch;

async function connect(config: McpDemoConfig, fetchImpl?: FetchLike): Promise<Client> {
    const client = new Client(CLIENT_INFO);
    await client.connect(new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: { headers: { Authorization: `Bearer ${config.apiKey}` } },
        ...(fetchImpl ? { fetch: fetchImpl } : {}),
    }), { timeout: 30_000 });
    return client;
}

function identity(client: Client): McpServerIdentity {
    const server = client.getServerVersion();
    return { name: server?.name ?? 'unknown', version: server?.version ?? 'unknown', tool: MCP_DEMO_TOOL, protocol: MCP_DEMO_PROTOCOL };
}

const UNAVAILABLE: McpDemoError = {
    category: 'mcp_unavailable',
    message: 'The Sahayak MCP server could not be reached. Please try again.',
    retryable: true,
};

/** initialize + tools/list only: proves the MCP server is reachable and exposes the tool. Costs no generation. */
export async function getMcpStatus(config: McpDemoConfig, fetchImpl?: FetchLike): Promise<{ connected: true; server: McpServerIdentity } | { connected: false }> {
    let client: Client | null = null;
    try {
        client = await connect(config, fetchImpl);
        const { tools } = await client.listTools();
        if (!tools.some((t) => t.name === MCP_DEMO_TOOL)) return { connected: false };
        return { connected: true, server: identity(client) };
    } catch {
        return { connected: false };
    } finally {
        await client?.close().catch(() => undefined);
    }
}

/** Generate a lesson plan by calling the MCP tool. Arguments are checked against the public MCP schema first. */
export async function createLessonPlanViaMcp(args: unknown, config: McpDemoConfig, fetchImpl?: FetchLike): Promise<McpDemoResult> {
    const parsed = CreateLessonPlanInput.safeParse(args);
    if (!parsed.success) {
        return { ok: false, error: { category: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'Invalid input.', retryable: false } };
    }

    let client: Client | null = null;
    try {
        client = await connect(config, fetchImpl);
        const started = Date.now();
        const res = await client.callTool({ name: MCP_DEMO_TOOL, arguments: parsed.data }, undefined, { timeout: CALL_TIMEOUT_MS });
        const durationMs = Date.now() - started;

        if (res.isError) {
            const err = (res.structuredContent as { error?: Partial<McpDemoError> } | undefined)?.error;
            return {
                ok: false,
                error: {
                    category: typeof err?.category === 'string' ? err.category : 'internal',
                    message: typeof err?.message === 'string' ? err.message : 'The lesson plan could not be generated. Please try again.',
                    retryable: typeof err?.retryable === 'boolean' ? err.retryable : true,
                },
            };
        }
        const plan = LessonPlanResult.safeParse(res.structuredContent);
        if (!plan.success) {
            return { ok: false, error: { category: 'internal', message: 'The MCP server returned an unexpected result. Please try again.', retryable: true } };
        }
        return { ok: true, plan: plan.data, mcp: { ...identity(client), durationMs } };
    } catch (e) {
        // The SDK's own request timeout. (Do not match JSON-RPC -32001: Sahayak's MCP server also uses it for auth errors.)
        const timedOut = /request timed out/i.test(String((e as Error)?.message ?? ''));
        return {
            ok: false,
            error: timedOut
                ? { category: 'timeout', message: 'Generation took too long. Please try again.', retryable: true }
                : UNAVAILABLE,
        };
    } finally {
        await client?.close().catch(() => undefined);
    }
}
