/**
 * @jest-environment node
 *
 * Class gate for "MCP error -32602: Structured content does not match the
 * tool's output schema".
 *
 * The official SDK client caches each tool's output schema at tools/list and
 * then validates `structuredContent` on EVERY tools/call result — including
 * `isError: true` results. A tool error that carries an `{ error }` object in
 * `structuredContent` therefore reaches a real client as a schema violation
 * instead of the error. This suite drives every public Sahayak MCP capability
 * the way a real client does (initialize → tools/list → failing tools/call)
 * and requires the error to arrive intact, with `structuredContent` absent.
 * A new capability must be added to CAPABILITIES below.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => { throw new Error('not used'); } }));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MCP_API_KEYS_COLLECTION, MCP_SCOPES, mintApiKey } from '@/lib/mcp/api-keys';
import { McpCapabilityError, toolErrorOf, toToolErrorResult } from '@/lib/mcp/errors';
import { handleMcpHttpRequest, type McpCapabilityDefinition } from '@/lib/mcp/http-handler';
import { lessonPlannerCapability } from '@/lib/mcp/lesson-planner/capability';
import { examPaperCapability } from '@/lib/mcp/exam-paper/capability';
import { quizCapability } from '@/lib/mcp/quiz/capability';

const PEPPER = 'error-results-pepper-0123456789-abcdefgh';
const store = new Map<string, unknown>();
const authDb = {
    collection: (c: string) => ({
        doc: (id: string) => ({ get: async () => ({ exists: store.has(`${c}/${id}`), data: () => store.get(`${c}/${id}`) }) }),
    }),
};
const rateLimited = () => { throw new McpCapabilityError('rate_limited', 'Rate limit reached for this API key.', 120); };

const CAPABILITIES: Array<{ cap: McpCapabilityDefinition; tool: string; args: Record<string, unknown>; category: string }> = [
    {
        cap: lessonPlannerCapability(async () => rateLimited()),
        tool: 'create_lesson_plan', args: { topic: 'Photosynthesis', grade: 7 }, category: 'rate_limited',
    },
    {
        cap: examPaperCapability({ dispatch: async () => rateLimited(), isEnabledFor: async () => false, canAnchorWholeSyllabus: async () => true }),
        tool: 'create_exam_paper', args: { grade: 8, subject: 'Science', chapters: ['Force and Pressure'] }, category: 'capability_disabled',
    },
    {
        cap: quizCapability({ dispatch: async () => rateLimited(), checkTopicSafety: () => ({ safe: true }) }),
        tool: 'create_quiz', args: { topic: 'Fractions', grade: 7 }, category: 'rate_limited',
    },
];

const { apiKey, keyId, record } = mintApiKey({ orgId: 'org-a', label: 'gate', scopes: [...MCP_SCOPES], createdBy: 'jest', pepper: PEPPER });

// jest.setup stubs the fetch API globals; the SDK transport needs real ones.
const realFetchApi = jest.requireActual('whatwg-fetch');
const stubbedFetchApi = { Headers: global.Headers, Request: global.Request, Response: global.Response };
beforeAll(() => {
    Object.assign(global, { Headers: realFetchApi.Headers, Request: realFetchApi.Request, Response: realFetchApi.Response });
    process.env.MCP_API_KEY_PEPPER = PEPPER;
    store.set(`${MCP_API_KEYS_COLLECTION}/${keyId}`, record);
    store.set('organizations/org-a', { name: 'School A' });
});
afterAll(() => Object.assign(global, stubbedFetchApi));

async function listedClient(cap: McpCapabilityDefinition) {
    const client = new Client({ name: 'real-client', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`https://sahayak.test/api/mcp/${cap.scope}`), {
        requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
        fetch: async (url, init) => handleMcpHttpRequest(new Request(url, init), cap, { getDb: async () => authDb, rateLimit: async () => undefined }),
    }));
    return client;
}

describe('tool error results reach a real MCP client intact', () => {
    it('never put an error object in structuredContent', () => {
        const result = toToolErrorResult(new McpCapabilityError('rate_limited', 'Slow down.', 90)) as Record<string, unknown>;
        expect(result.structuredContent).toBeUndefined();
        expect(toolErrorOf(result)).toEqual({ category: 'rate_limited', message: 'Slow down.', retryable: true, retry_after_seconds: 90 });
    });

    it.each(CAPABILITIES.map((c) => [c.tool, c] as const))('%s: tools/list then a failing call, twice on one client', async (_tool, { cap, tool, args, category }) => {
        const client = await listedClient(cap);
        const { tools } = await client.listTools();
        expect(tools.find((t) => t.name === tool)?.outputSchema).toBeDefined();
        for (let attempt = 0; attempt < 2; attempt++) {
            const res = await client.callTool({ name: tool, arguments: args });
            expect(res.isError).toBe(true);
            expect(res.structuredContent).toBeUndefined();
            expect(toolErrorOf(res)).toMatchObject({ category });
            expect(JSON.stringify(res.content)).not.toMatch(/output schema/i);
        }
        await client.close();
    });
});
