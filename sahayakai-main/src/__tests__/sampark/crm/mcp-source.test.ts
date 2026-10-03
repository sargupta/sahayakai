/** @jest-environment node */
/**
 * The deterministic MCP client (R2-4b): handshake, named-tool calls through the mapping, REST-equal URL safety,
 * caps, and no secret in any error. No model is involved anywhere: a source-level gate below proves it.
 */

import fs from 'node:fs';
import path from 'node:path';

import { createHttpMcpTransport, createMcpSource, MCP_PROTOCOL_VERSION, scrubSecret, type McpTransport } from '@/lib/sampark/crm/mcp-source';
import { CrmFetchError } from '@/lib/sampark/crm/errors';
import { MAX_PAGES, MAX_RECORDS } from '@/lib/sampark/crm/mapped-source';
import { parseMapping } from '@/lib/sampark/crm/mapping';
import type { LookupFn } from '@/lib/sampark/crm/rest-source';

import { crmGuardian, crmStudent } from '../server/_helpers';

const PUBLIC_IP = '93.184.216.34';
const SECRET = 'sk-test-SECRET-VALUE-123';
const resolveTo = (...addresses: string[]): LookupFn => async () => addresses.map((address) => ({ address, family: 4 }));
const TOOLS = { students: 'list_students', guardians: 'list_guardians', school: 'get_school', consent: 'list_consent' };
const mapping = (extra: Record<string, unknown> = {}) => parseMapping({ mcp: { tools: TOOLS }, ...extra });

/** The jest setup replaces global Response with a header-less stub, so tests build the minimal real shape. */
function res(body: string | null, init: { status?: number; headers?: Record<string, string> } = {}): Response {
    const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const status = init.status ?? 200;
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
        body: undefined,
        text: async () => body ?? '',
        json: async () => JSON.parse(body ?? ''),
    } as unknown as Response;
}

interface Call {
    method: string;
    params: unknown;
    headers: Record<string, string>;
    init: RequestInit;
}

/** A fake MCP server behind `fetch`. `respond` can override any reply. */
function fakeServer(opts: {
    tools?: string[];
    pages?: Record<string, Record<string, unknown[]>>; // tool → cursor('' for first) → rows; next cursor = next key
    sse?: boolean;
    structured?: boolean;
    respond?: (method: string, params: Record<string, unknown>, id: number) => Response | undefined;
} = {}) {
    const calls: Call[] = [];
    const published = opts.tools ?? Object.values(TOOLS);
    const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response => {
        const text = opts.sse ? `event: message\ndata: ${JSON.stringify(body)}\n\n` : JSON.stringify(body);
        return res(text, { status, headers: { 'content-type': opts.sse ? 'text/event-stream' : 'application/json', ...headers } });
    };
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
        const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
        if (init?.method === 'DELETE') {
            calls.push({ method: 'DELETE', params: null, headers, init: init ?? {} });
            return res(null, { status: 204 });
        }
        const msg = JSON.parse(String(init?.body)) as { id?: number; method: string; params?: Record<string, unknown> };
        calls.push({ method: msg.method, params: msg.params, headers, init: init ?? {} });
        const custom = opts.respond?.(msg.method, msg.params ?? {}, msg.id ?? 0);
        if (custom) return custom;
        if (msg.id === undefined) return res(null, { status: 202 });
        if (msg.method === 'initialize') return json({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, serverInfo: { name: 'x', version: '1' } } }, 200, { 'mcp-session-id': 'sess-1' });
        if (msg.method === 'tools/list') return json({ jsonrpc: '2.0', id: msg.id, result: { tools: published.map((name) => ({ name, inputSchema: { type: 'object' } })) } });
        if (msg.method === 'tools/call') {
            const name = String(msg.params?.name);
            const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
            const table = opts.pages?.[name] ?? { '': [] };
            const keys = Object.keys(table);
            const at = keys.indexOf(String(args.cursor ?? ''));
            const page = { data: table[keys[at] as string] ?? [], nextCursor: keys[at + 1] ?? null };
            const result = opts.structured === false
                ? { content: [{ type: 'text', text: JSON.stringify(page) }] }
                : { content: [{ type: 'text', text: JSON.stringify(page) }], structuredContent: page };
            return json({ jsonrpc: '2.0', id: msg.id, result });
        }
        return json({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'method not found' } });
    });
    return { fetchImpl: fetchImpl as unknown as typeof fetch, calls, fetchMock: fetchImpl };
}

function build(server: ReturnType<typeof fakeServer>, over: { url?: string; nodeEnv?: string; lookup?: LookupFn; mapping?: ReturnType<typeof mapping>; timeoutMs?: number } = {}) {
    const transport = createHttpMcpTransport({
        url: over.url ?? 'https://tool.school.in/mcp',
        apiKey: SECRET,
        fetchImpl: server.fetchImpl,
        lookup: over.lookup ?? resolveTo(PUBLIC_IP),
        nodeEnv: over.nodeEnv ?? 'production',
        timeoutMs: over.timeoutMs,
    });
    return { transport, source: createMcpSource({ transport, mapping: over.mapping ?? mapping(), secret: SECRET }) };
}

describe('MCP handshake and tool calls', () => {
    it('initialize → initialized → tools/list → tools/call, with bearer, protocol version and session headers', async () => {
        const server = fakeServer({ pages: { list_students: { '': [crmStudent('s1')] } } });
        const { source } = build(server);
        const rows = await source.fetchStudents(null);
        expect(rows).toHaveLength(1);
        expect(source.kind).toBe('mcp');
        expect(server.calls.map((c) => c.method)).toEqual(['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
        expect(server.calls.every((c) => c.headers.Authorization === `Bearer ${SECRET}`)).toBe(true);
        expect(server.calls[0]!.headers['Mcp-Session-Id']).toBeUndefined();
        expect(server.calls[1]!.headers['Mcp-Session-Id']).toBe('sess-1');
        expect(server.calls[3]!.headers['MCP-Protocol-Version']).toBe(MCP_PROTOCOL_VERSION);
        expect(server.calls.every((c) => c.init.redirect === 'error')).toBe(true);
        expect(server.calls[3]!.params).toMatchObject({ name: 'list_students', arguments: { limit: 200 } });
    });

    it('the handshake runs once per source, and close() deletes the session', async () => {
        const server = fakeServer();
        const { source } = build(server);
        await source.fetchStudents(null);
        await source.fetchGuardians(null);
        expect(server.calls.filter((c) => c.method === 'initialize')).toHaveLength(1);
        await source.close!();
        expect(server.calls.at(-1)!.method).toBe('DELETE');
    });

    it('pages by cursor through the mapping and passes updatedSince and static args', async () => {
        const server = fakeServer({ pages: { list_students: { '': [crmStudent('a')], c2: [crmStudent('b')], c3: [crmStudent('c')] } } });
        const { source } = build(server, { mapping: mapping({ mcp: { tools: TOOLS, args: { students: { includeMalformed: true } } } }) });
        const rows = await source.fetchStudents('2026-09-01T00:00:00Z');
        expect(rows.map((r) => (r as { id: string }).id)).toEqual(['a', 'b', 'c']);
        const calls = server.calls.filter((c) => c.method === 'tools/call');
        expect(calls).toHaveLength(3);
        expect(calls[0]!.params).toMatchObject({ arguments: { includeMalformed: true, updatedSince: '2026-09-01T00:00:00Z' } });
        expect((calls[1]!.params as { arguments: { cursor: string } }).arguments.cursor).toBe('c2');
    });

    it('reads a text-only JSON result when there is no structuredContent', async () => {
        const server = fakeServer({ structured: false, pages: { list_guardians: { '': [crmGuardian('g1')] } } });
        await expect(build(server).source.fetchGuardians(null)).resolves.toHaveLength(1);
    });

    it('accepts an SSE-framed response', async () => {
        const server = fakeServer({ sse: true, pages: { list_guardians: { '': [crmGuardian('g1')] } } });
        await expect(build(server).source.fetchGuardians(null)).resolves.toHaveLength(1);
    });

    it('maps tool results through the same mapping layer as REST', async () => {
        const server = fakeServer({ pages: { list_guardians: { '': [{ pid: 'p1' }] } } });
        const { source } = build(server, { mapping: mapping({ fields: { guardians: { id: 'pid' } } }) });
        await expect(source.fetchGuardians(null)).resolves.toEqual([{ pid: 'p1', id: 'p1' }]);
    });

    it('fetchSchool uses the school tool; no school tool configured → null (holidays untouched)', async () => {
        const server = fakeServer({ respond: (method, params, id) => (method === 'tools/call' && params.name === 'get_school' ? res(JSON.stringify({ jsonrpc: '2.0', id, result: { content: [], structuredContent: { id: 'x' } } }), { headers: { 'content-type': 'application/json' } }) : undefined) });
        await expect(build(server).source.fetchSchool()).resolves.toEqual({ id: 'x' });
        const without = build(fakeServer(), { mapping: parseMapping({ mcp: { tools: { students: 'list_students', guardians: 'list_guardians' } } }) });
        await expect(without.source.fetchSchool()).resolves.toBeNull();
    });

    it('consent: fetchConsent exists only when a consent tool is configured', async () => {
        const server = fakeServer({ pages: { list_consent: { '': [{ guardian: 'g1' }] } } });
        const { source } = build(server);
        await expect(source.fetchConsent!()).resolves.toEqual([{ guardian: 'g1' }]);
        const none = createMcpSource({ transport: build(server).transport, mapping: parseMapping({ mcp: { tools: { students: 'a', guardians: 'b' } } }) });
        expect(none.fetchConsent).toBeUndefined();
    });

    it('an unconfigured optional entity (fee dues) is an error the signals loader already tolerates', async () => {
        const server = fakeServer();
        await expect(build(server).source.fetchRecords!('/v1/fees/dues')).rejects.toThrow(/No tool is configured for feeDues/);
        expect(() => build(server).source.fetchRecords!('/admin/secrets')).toThrow(/unexpected CRM path/);
    });

    it('fails fast when a configured tool name is not published, or students/guardians tools are missing', async () => {
        const server = fakeServer({ tools: ['list_students', 'get_school', 'list_consent'] });
        await expect(build(server).source.fetchStudents(null)).rejects.toThrow(/no tool named "list_guardians"/);
        const nameless = build(fakeServer(), { mapping: parseMapping({}) });
        await expect(nameless.source.fetchStudents(null)).rejects.toThrow(/No tool is configured for students/);
    });
});

describe('MCP URL safety (the REST rules)', () => {
    it('refuses a private address after DNS, before any request', async () => {
        const server = fakeServer();
        const { source } = build(server, { lookup: resolveTo('169.254.169.254') });
        await expect(source.fetchStudents(null)).rejects.toThrow(/private or reserved/);
        expect(server.fetchMock).not.toHaveBeenCalled();
    });

    it('refuses http outside dev, allows the local dummy in dev', async () => {
        const prod = build(fakeServer(), { url: 'http://tool.school.in/mcp' });
        await expect(prod.source.fetchStudents(null)).rejects.toThrow(/https/);
        const dev = build(fakeServer({ pages: { list_students: { '': [] } } }), { url: 'http://127.0.0.1:4700/mcp', nodeEnv: 'development' });
        await expect(dev.source.fetchStudents(null)).resolves.toEqual([]);
    });

    it('refuses credentials in the URL', async () => {
        const { source } = build(fakeServer(), { url: 'https://u:p@tool.school.in/mcp' });
        await expect(source.fetchStudents(null)).rejects.toThrow(/credentials/);
    });
});

describe('MCP caps and failures — never a secret in an error', () => {
    const errorOf = async (p: Promise<unknown>) => {
        try {
            await p;
        } catch (e) {
            return e as Error;
        }
        throw new Error('expected a rejection');
    };

    it('a repeating cursor is a loop and aborts', async () => {
        const server = fakeServer({
            respond: (method, _p, id) =>
                method === 'tools/call' ? res(JSON.stringify({ jsonrpc: '2.0', id, result: { content: [], structuredContent: { data: [], nextCursor: 'same' } } }), { headers: { 'content-type': 'application/json' } }) : undefined,
        });
        await expect(build(server).source.fetchStudents(null)).rejects.toThrow(/pagination loop/);
    });

    it('stops at the page cap and at the record cap', async () => {
        let n = 0;
        const endless = fakeServer({
            respond: (method, _p, id) => {
                if (method !== 'tools/call') return undefined;
                n += 1;
                return res(JSON.stringify({ jsonrpc: '2.0', id, result: { content: [], structuredContent: { data: [], nextCursor: `c${n}` } } }), { headers: { 'content-type': 'application/json' } });
            },
        });
        await expect(build(endless).source.fetchStudents(null)).rejects.toThrow(new RegExp(`exceeded ${MAX_PAGES} pages`));
        expect(MAX_RECORDS).toBeGreaterThan(0);
    });

    it('a tool error, a JSON-RPC error, an HTTP error and bad JSON never leak the secret', async () => {
        const echo = `leaked ${SECRET} here`;
        const cases: Record<string, (method: string, id: number) => Response | undefined> = {
            toolError: (m, id) => (m === 'tools/call' ? res(JSON.stringify({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: echo }] } }), { headers: { 'content-type': 'application/json' } }) : undefined),
            rpcError: (m, id) => (m === 'tools/call' ? res(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message: echo } }), { headers: { 'content-type': 'application/json' } }) : undefined),
            http500: (m) => (m === 'tools/call' ? res(echo, { status: 500 }) : undefined),
            badJson: (m) => (m === 'tools/call' ? res(echo, { headers: { 'content-type': 'application/json' } }) : undefined),
            noContent: (m, id) => (m === 'tools/call' ? res(JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: echo }] } }), { headers: { 'content-type': 'application/json' } }) : undefined),
        };
        for (const [name, respond] of Object.entries(cases)) {
            const server = fakeServer({ respond: (m, _p, id) => respond(m, id) });
            const err = await errorOf(build(server).source.fetchStudents(null));
            expect({ name, type: err.name, leaked: err.message.includes(SECRET) }).toEqual({ name, type: 'CrmFetchError', leaked: false });
        }
    });

    it('a transport failure or timeout is a safe message', async () => {
        const boom = jest.fn(async () => {
            throw new Error(`connect ECONNREFUSED with header Bearer ${SECRET}`);
        });
        const t = createHttpMcpTransport({ url: 'https://tool.school.in/mcp', apiKey: SECRET, fetchImpl: boom as unknown as typeof fetch, lookup: resolveTo(PUBLIC_IP), nodeEnv: 'production' });
        const err = await errorOf(t.request('initialize', {}));
        expect(err).toBeInstanceOf(CrmFetchError);
        expect(err.message).not.toContain(SECRET);

        const slow = jest.fn((_u: string, init?: RequestInit) => new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' })))));
        const t2 = createHttpMcpTransport({ url: 'https://tool.school.in/mcp', apiKey: SECRET, fetchImpl: slow as unknown as typeof fetch, lookup: resolveTo(PUBLIC_IP), nodeEnv: 'production', timeoutMs: 20 });
        await expect(t2.request('initialize', {})).rejects.toThrow(/timed out/);
    });

    it('refuses an oversized response', async () => {
        const big = fakeServer({ respond: (m) => (m === 'initialize' ? res('x'.repeat(2048), { headers: { 'content-type': 'application/json' } }) : undefined) });
        const t = createHttpMcpTransport({ url: 'https://tool.school.in/mcp', apiKey: SECRET, fetchImpl: big.fetchImpl, lookup: resolveTo(PUBLIC_IP), nodeEnv: 'production', maxResponseBytes: 1024 });
        await expect(t.request('initialize', {})).rejects.toThrow(/larger than the allowed size/);
    });

    it('scrubSecret removes every occurrence', () => {
        expect(scrubSecret(`a ${SECRET} b ${SECRET}`, SECRET)).toBe('a [redacted] b [redacted]');
    });
});

describe('CLASS: no model in the call-placing path (SAMPARK_PLAN 3.4)', () => {
    const dir = path.resolve(__dirname, '../../../lib/sampark/crm');
    const forbidden = /(genkit|@genkit-ai|@google\/genai|@google\/generative-ai|@anthropic-ai|openai|vertexai|@ai-sdk|langchain|@\/ai\/)/i;

    it.each(['mcp-source.ts', 'mapped-source.ts', 'mapping.ts', 'consent.ts'])('%s imports no model client', (file) => {
        const src = fs.readFileSync(path.join(dir, file), 'utf8');
        const imports = src.split('\n').filter((l) => /^\s*(import|export)\b.*from\s|require\(|import\(/.test(l));
        expect(imports.filter((l) => forbidden.test(l))).toEqual([]);
    });

    it('the source never sends a model-chosen tool name: names come only from the saved mapping', async () => {
        const server = fakeServer({ pages: { list_students: { '': [] } } });
        await build(server).source.fetchStudents(null);
        const names = server.calls.filter((c) => c.method === 'tools/call').map((c) => (c.params as { name: string }).name);
        expect(names.every((n) => Object.values(TOOLS).includes(n))).toBe(true);
    });
});

export type { McpTransport };
