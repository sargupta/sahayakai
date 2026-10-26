import 'server-only';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { toolErrorOf } from '@/lib/mcp/errors';
import { CreateQuizInput, QuizResult } from '@/lib/mcp/quiz/schema';

/**
 * Server-side MCP CLIENT for /mcp-demo/quiz — the same pattern as
 * ./lesson-planner-client.ts. Official MCP SDK → Streamable HTTP → POST
 * /api/mcp/quiz → `create_quiz`. Never imports the quiz service. The API key
 * lives only here (server env); the browser talks to /api/mcp-demo/quiz.
 */

export const MCP_DEMO_TOOL = 'create_quiz';
const CLIENT_INFO = { name: 'sahayak-quiz-demo-ui', version: '1.0.0' };
// Generation budget of the MCP server's route.
const CALL_TIMEOUT_MS = 120_000;

export interface McpDemoConfig { url: string; apiKey: string }
export interface McpServerIdentity { name: string; version: string; tool: string; protocol: string }
export interface McpDemoError { category: string; message: string; retryable: boolean }
export type McpDemoResult =
    | { ok: true; quiz: QuizResult; mcp: McpServerIdentity & { durationMs: number } }
    | { ok: false; error: McpDemoError };
type FetchLike = typeof fetch;

/**
 * Key: `MCP_QUIZ_API_KEY` (scope `quiz`), or under `next dev` the local dev
 * key. URL: `MCP_QUIZ_SERVER_URL`, else loopback — never the request's Host header.
 */
export function getMcpDemoConfig(env: Record<string, string | undefined> = process.env): McpDemoConfig | null {
    const apiKey = env.MCP_QUIZ_API_KEY?.trim()
        || (env.NODE_ENV === 'development' ? env.MCP_LOCAL_DEV_API_KEY?.trim() : undefined);
    if (!apiKey) return null;
    const url = env.MCP_QUIZ_SERVER_URL?.trim() || `http://127.0.0.1:${env.PORT || 3000}/api/mcp/quiz`;
    return { url, apiKey };
}

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
    return { name: server?.name ?? 'unknown', version: server?.version ?? 'unknown', tool: MCP_DEMO_TOOL, protocol: 'Streamable HTTP' };
}

/** initialize + tools/list only: proves the MCP server is reachable and exposes the tool. Costs no generation. */
export async function getMcpStatus(config: McpDemoConfig, fetchImpl?: FetchLike): Promise<{ connected: true; server: McpServerIdentity } | { connected: false }> {
    let client: Client | null = null;
    try {
        client = await connect(config, fetchImpl);
        const { tools } = await client.listTools();
        if (!tools.some((tool) => tool.name === MCP_DEMO_TOOL)) return { connected: false };
        return { connected: true, server: identity(client) };
    } catch {
        return { connected: false };
    } finally {
        await client?.close().catch(() => undefined);
    }
}

/** Generate a quiz by calling the MCP tool. Arguments are checked against the public MCP schema first. */
export async function createQuizViaMcp(args: unknown, config: McpDemoConfig, fetchImpl?: FetchLike): Promise<McpDemoResult> {
    const parsed = CreateQuizInput.safeParse(args);
    if (!parsed.success) {
        return { ok: false, error: { category: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'Check the quiz inputs.', retryable: false } };
    }

    let client: Client | null = null;
    try {
        client = await connect(config, fetchImpl);
        const started = Date.now();
        const result = await client.callTool({ name: MCP_DEMO_TOOL, arguments: parsed.data }, undefined, { timeout: CALL_TIMEOUT_MS });
        const durationMs = Date.now() - started;
        if (result.isError) {
            const error = toolErrorOf(result);
            return { ok: false, error: {
                category: typeof error?.category === 'string' ? error.category : 'internal',
                message: typeof error?.message === 'string' ? error.message : 'The quiz could not be generated. Please try again.',
                retryable: typeof error?.retryable === 'boolean' ? error.retryable : true,
            } };
        }
        const quiz = QuizResult.safeParse(result.structuredContent);
        if (!quiz.success) {
            return { ok: false, error: { category: 'internal', message: 'The MCP server returned an unexpected result. Please try again.', retryable: true } };
        }
        return { ok: true, quiz: quiz.data, mcp: { ...identity(client), durationMs } };
    } catch (error) {
        // The SDK's own request timeout. (Do not match JSON-RPC -32001: Sahayak's MCP server also uses it for auth errors.)
        const message = String((error as Error)?.message ?? '');
        return { ok: false, error: /request timed out/i.test(message)
            ? { category: 'timeout', message: 'Generation took too long. Please try again.', retryable: true }
            : { category: 'mcp_unavailable', message: 'The Sahayak Quiz MCP could not be reached. Please try again.', retryable: true } };
    } finally {
        await client?.close().catch(() => undefined);
    }
}
