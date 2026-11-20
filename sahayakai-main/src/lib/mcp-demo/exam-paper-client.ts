import 'server-only';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { toolErrorOf } from '@/lib/mcp/errors';
import { CreateExamPaperInput, ExamPaperResult } from '@/lib/mcp/exam-paper/schema';

export const MCP_DEMO_TOOL = 'create_exam_paper';
const CLIENT_INFO = { name: 'sahayak-exam-paper-demo-ui', version: '1.0.0' };
const CALL_TIMEOUT_MS = 180_000;

export interface McpDemoConfig { url: string; apiKey: string }
export interface McpServerIdentity { name: string; version: string; tool: string; protocol: string }
export interface McpDemoError { category: string; message: string; retryable: boolean }
export type McpDemoResult =
    | { ok: true; paper: ExamPaperResult; mcp: McpServerIdentity & { durationMs: number } }
    | { ok: false; error: McpDemoError };

export function getMcpDemoConfig(env: Record<string, string | undefined> = process.env): McpDemoConfig | null {
    const apiKey = env.MCP_EXAM_PAPER_API_KEY?.trim()
        || (env.NODE_ENV === 'development' ? env.MCP_LOCAL_DEV_API_KEY?.trim() : undefined);
    if (!apiKey) return null;
    const url = env.MCP_EXAM_PAPER_SERVER_URL?.trim()
        || `http://127.0.0.1:${env.PORT || 3000}/api/mcp/exam-paper`;
    return { url, apiKey };
}

async function connect(config: McpDemoConfig): Promise<Client> {
    const client = new Client(CLIENT_INFO);
    await client.connect(new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: { headers: { Authorization: `Bearer ${config.apiKey}` } },
    }), { timeout: 30_000 });
    return client;
}

function identity(client: Client): McpServerIdentity {
    const server = client.getServerVersion();
    return { name: server?.name ?? 'unknown', version: server?.version ?? 'unknown', tool: MCP_DEMO_TOOL, protocol: 'Streamable HTTP' };
}

export async function getMcpStatus(config: McpDemoConfig): Promise<{ connected: true; server: McpServerIdentity } | { connected: false }> {
    let client: Client | null = null;
    try {
        client = await connect(config);
        const { tools } = await client.listTools();
        if (!tools.some((tool) => tool.name === MCP_DEMO_TOOL)) return { connected: false };
        return { connected: true, server: identity(client) };
    } catch {
        return { connected: false };
    } finally {
        await client?.close().catch(() => undefined);
    }
}

export async function createExamPaperViaMcp(args: unknown, config: McpDemoConfig): Promise<McpDemoResult> {
    const parsed = CreateExamPaperInput.safeParse(args);
    if (!parsed.success) {
        return { ok: false, error: { category: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'Check the exam paper inputs.', retryable: false } };
    }

    let client: Client | null = null;
    try {
        client = await connect(config);
        const started = Date.now();
        const result = await client.callTool({ name: MCP_DEMO_TOOL, arguments: parsed.data }, undefined, { timeout: CALL_TIMEOUT_MS });
        const durationMs = Date.now() - started;
        if (result.isError) {
            const error = toolErrorOf(result);
            return { ok: false, error: {
                category: typeof error?.category === 'string' ? error.category : 'internal',
                message: typeof error?.message === 'string' ? error.message : 'The exam paper could not be generated. Please try again.',
                retryable: typeof error?.retryable === 'boolean' ? error.retryable : true,
            } };
        }
        const paper = ExamPaperResult.safeParse(result.structuredContent);
        if (!paper.success) {
            return { ok: false, error: { category: 'internal', message: 'The MCP server returned an unexpected result. Please try again.', retryable: true } };
        }
        return { ok: true, paper: paper.data, mcp: { ...identity(client), durationMs } };
    } catch (error) {
        const message = String((error as Error)?.message ?? '');
        return { ok: false, error: /request timed out/i.test(message)
            ? { category: 'timeout', message: 'Generation took too long. Please try again.', retryable: true }
            : { category: 'mcp_unavailable', message: 'The Sahayak Exam Paper MCP could not be reached. Please try again.', retryable: true } };
    } finally {
        await client?.close().catch(() => undefined);
    }
}
