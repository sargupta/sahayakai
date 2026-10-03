/**
 * MCP CrmSource — a DETERMINISTIC client of the school tool's MCP server (R2-4b,
 * SAMPARK_PLAN §3.4).
 *
 * Our code calls NAMED tools (the names come from the school's saved mapping:
 * `mapping.mcp.tools`) and maps the results through the same mapping layer REST
 * uses. NO LLM is anywhere in this path: a pipeline that places calls to parents
 * must not depend on a model choosing tools or reading free text. This module
 * must never import a model client; a test (mcp-source.test.ts) greps for that.
 *
 * Transport. This is the MCP "streamable HTTP" transport spoken directly:
 * JSON-RPC 2.0 over POST, `initialize` → `notifications/initialized` →
 * `tools/list` → `tools/call`, with the optional `Mcp-Session-Id`, and either a
 * plain JSON or a single-event SSE response body. It is hand-written behind the
 * small `McpTransport` interface instead of using `@modelcontextprotocol/sdk`
 * because that package is only a TRANSITIVE dependency here (not declared in
 * package.json) and its HTTP transport follows redirects and cannot be told to
 * run our SSRF check. The interface lets the official SDK client be dropped in
 * later if the school's server needs a feature this does not speak (OAuth,
 * stateful SSE streams).
 *
 * Safety rules are the REST rules: https only outside dev, every resolved
 * address must be public (assertCrmUrlSafe), redirects refused, bearer secret
 * from getSecret (never stored), per-request timeout, response size cap, page
 * and record caps (mapped-source.ts). Error messages are built from fixed text
 * plus at most 120 characters of the server's message with the secret scrubbed;
 * they never carry a response body, header or the key.
 */

import { getSecret } from '@/lib/secrets';
import { CrmFetchError, CrmUrlError } from '@/lib/sampark/crm/errors';
import { createMappedSource, type MappedSourceIO, type PageParams } from '@/lib/sampark/crm/mapped-source';
import { type CrmEntity, type CrmMapping, parseMapping } from '@/lib/sampark/crm/mapping';
import { assertCrmUrlSafe, CRM_REQUEST_TIMEOUT_MS, type LookupFn } from '@/lib/sampark/crm/rest-source';
import type { CrmSource } from '@/lib/sampark/ports';
import type { SamparkSchool } from '@/types/sampark';

export const MCP_PROTOCOL_VERSION = '2025-03-26';
export const MCP_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_TOOL_LIST_PAGES = 20;

export interface McpTransport {
    /** One JSON-RPC request; resolves to the `result`. Throws CrmFetchError (safe message) on any failure. */
    request(method: string, params?: unknown): Promise<unknown>;
    /** A JSON-RPC notification (no response expected). */
    notify(method: string, params?: unknown): Promise<void>;
    /** Best-effort session teardown. Never throws. */
    close(): Promise<void>;
}

type NodeEnv = string | undefined;

export interface HttpMcpTransportOptions {
    url: string;
    apiKey: string;
    fetchImpl?: typeof fetch;
    lookup?: LookupFn;
    nodeEnv?: NodeEnv;
    timeoutMs?: number;
    maxResponseBytes?: number;
}

/** Replace the secret (and anything that looks like a bearer header carrying it) in text that may be shown. */
export function scrubSecret(text: string, secret: string): string {
    if (secret.length < 4) return text;
    return text.split(secret).join('[redacted]');
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
    if (!res.body) {
        // No stream (a non-undici Response, e.g. a test polyfill): read it whole, then enforce the same cap.
        const text = typeof res.text === 'function' ? await res.text() : '';
        if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new CrmFetchError('MCP response is larger than the allowed size');
        return text;
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
            await reader.cancel().catch(() => undefined);
            throw new CrmFetchError('MCP response is larger than the allowed size');
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
}

/** The JSON-RPC message with this id out of an SSE body (`data:` lines of each event). */
function messageFromSse(text: string, id: number): unknown {
    for (const event of text.split(/\r?\n\r?\n/)) {
        const data = event
            .split(/\r?\n/)
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).replace(/^ /, ''))
            .join('\n');
        if (!data) continue;
        try {
            const msg = JSON.parse(data) as { id?: unknown };
            if (msg && typeof msg === 'object' && msg.id === id) return msg;
        } catch {
            // not JSON: skip the event
        }
    }
    return undefined;
}

export function createHttpMcpTransport(opts: HttpMcpTransportOptions): McpTransport {
    const doFetch = opts.fetchImpl ?? fetch;
    const timeoutMs = opts.timeoutMs ?? CRM_REQUEST_TIMEOUT_MS;
    const maxBytes = opts.maxResponseBytes ?? MCP_MAX_RESPONSE_BYTES;
    let checked: Promise<URL> | null = null;
    let sessionId: string | null = null;
    let negotiated = false;
    let nextId = 1;
    const scrub = (s: string) => scrubSecret(s, opts.apiKey);

    const base = () => {
        if (!checked) checked = assertCrmUrlSafe(opts.url, { nodeEnv: opts.nodeEnv ?? process.env.NODE_ENV, lookup: opts.lookup });
        return checked;
    };

    async function send(method: 'POST' | 'DELETE', body: unknown | null): Promise<Response> {
        const url = await base();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const headers: Record<string, string> = {
                Authorization: `Bearer ${opts.apiKey}`,
                Accept: 'application/json, text/event-stream',
            };
            if (body !== null) headers['Content-Type'] = 'application/json';
            if (sessionId) headers['Mcp-Session-Id'] = sessionId;
            if (negotiated) headers['MCP-Protocol-Version'] = MCP_PROTOCOL_VERSION;
            return await doFetch(url.toString(), {
                method,
                headers,
                body: body === null ? undefined : JSON.stringify(body),
                redirect: 'error',
                signal: controller.signal,
                cache: 'no-store',
            });
        } catch (err) {
            const aborted = (err as { name?: string })?.name === 'AbortError';
            throw new CrmFetchError(aborted ? `MCP request timed out after ${timeoutMs / 1000}s` : 'MCP request failed');
        } finally {
            clearTimeout(timer);
        }
    }

    return {
        async request(method, params) {
            const id = nextId++;
            const res = await send('POST', { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });
            if (!res.ok) throw new CrmFetchError(`MCP server responded ${res.status} to ${method}`);
            if (method === 'initialize') sessionId = res.headers.get('mcp-session-id') ?? sessionId;
            const type = (res.headers.get('content-type') ?? '').toLowerCase();
            const text = await readCapped(res, maxBytes);
            let message: unknown;
            if (type.includes('text/event-stream')) {
                message = messageFromSse(text, id);
            } else {
                try {
                    message = JSON.parse(text);
                } catch {
                    throw new CrmFetchError(`MCP server returned invalid JSON to ${method}`);
                }
            }
            if (!message || typeof message !== 'object' || (message as { id?: unknown }).id !== id) {
                throw new CrmFetchError(`MCP server sent no response to ${method}`);
            }
            const m = message as { result?: unknown; error?: { code?: unknown; message?: unknown } };
            if (m.error !== undefined) {
                const code = typeof m.error?.code === 'number' ? m.error.code : 0;
                const text = typeof m.error?.message === 'string' ? scrub(m.error.message).slice(0, 120) : '';
                throw new CrmFetchError(`MCP ${method} failed (code ${code}): ${text}`);
            }
            if (method === 'initialize') negotiated = true;
            return m.result;
        },
        async notify(method, params) {
            const res = await send('POST', { jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) });
            await res.body?.cancel().catch(() => undefined);
            if (!res.ok) throw new CrmFetchError(`MCP server responded ${res.status} to ${method}`);
        },
        async close() {
            if (!sessionId) return;
            try {
                const res = await send('DELETE', null);
                await res.body?.cancel().catch(() => undefined);
            } catch {
                // best effort
            }
            sessionId = null;
        },
    };
}

// ── Source ──────────────────────────────────────────────────────────────────

export interface McpSourceOptions {
    transport: McpTransport;
    mapping: CrmMapping;
    /** For scrubbing tool error text; the transport scrubs protocol errors itself. */
    secret?: string;
}

/** The JSON body a tools/call result carries: structuredContent, else the first text block parsed as JSON. */
function toolBody(name: string, result: unknown, secret: string): unknown {
    const r = (result && typeof result === 'object' ? result : {}) as {
        isError?: unknown;
        structuredContent?: unknown;
        content?: unknown;
    };
    const blocks = Array.isArray(r.content) ? (r.content as { type?: unknown; text?: unknown }[]) : [];
    const text = blocks.find((b) => b && b.type === 'text' && typeof b.text === 'string')?.text as string | undefined;
    if (r.isError === true) {
        throw new CrmFetchError(`MCP tool ${name} reported an error: ${scrubSecret(text ?? '', secret).slice(0, 120)}`);
    }
    if (r.structuredContent !== undefined && r.structuredContent !== null && typeof r.structuredContent === 'object') return r.structuredContent;
    if (text === undefined) throw new CrmFetchError(`MCP tool ${name} returned no JSON content`);
    try {
        return JSON.parse(text);
    } catch {
        throw new CrmFetchError(`MCP tool ${name} returned content that is not JSON`);
    }
}

export function createMcpSource(opts: McpSourceOptions): CrmSource {
    const mapping = parseMapping(opts.mapping);
    const secret = opts.secret ?? '';
    const tools = mapping.mcp.tools;
    let ready: Promise<void> | null = null;

    /** initialize → initialized → tools/list, and verify every configured tool exists. Once per source. */
    function ensureReady(): Promise<void> {
        if (!ready) {
            ready = (async () => {
                if (!tools.students || !tools.guardians) {
                    throw new CrmFetchError('MCP tool names for students and guardians are not configured');
                }
                const init = await opts.transport.request('initialize', {
                    protocolVersion: MCP_PROTOCOL_VERSION,
                    capabilities: {},
                    clientInfo: { name: 'sahayakai-sampark', version: '1.0.0' },
                });
                if (!init || typeof init !== 'object' || typeof (init as { protocolVersion?: unknown }).protocolVersion !== 'string') {
                    throw new CrmFetchError('MCP server sent an invalid initialize result');
                }
                await opts.transport.notify('notifications/initialized');
                const published = new Set<string>();
                let cursor: string | undefined;
                for (let page = 0; page < MAX_TOOL_LIST_PAGES; page++) {
                    const list = (await opts.transport.request('tools/list', cursor ? { cursor } : undefined)) as {
                        tools?: { name?: unknown }[];
                        nextCursor?: unknown;
                    };
                    for (const t of Array.isArray(list?.tools) ? list.tools : []) if (typeof t?.name === 'string') published.add(t.name);
                    if (typeof list?.nextCursor !== 'string' || list.nextCursor === '') break;
                    cursor = list.nextCursor;
                }
                for (const [entity, name] of Object.entries(tools)) {
                    if (name && !published.has(name)) throw new CrmFetchError(`The MCP server has no tool named "${name}" (for ${entity})`);
                }
            })();
            // A failed handshake must be retried by a new source, not cached as a rejected promise forever.
            ready.catch(() => undefined);
        }
        return ready;
    }

    const io: MappedSourceIO = {
        kind: 'mcp',
        hasEntity: (entity: CrmEntity) => tools[entity] !== undefined,
        fetchBody: async (entity, params: PageParams | null) => {
            await ensureReady();
            const name = tools[entity] as string;
            const args = { ...(mapping.mcp.args[entity] ?? {}), ...(params ?? {}) };
            const result = await opts.transport.request('tools/call', { name, arguments: args });
            return toolBody(name, result, secret);
        },
    };
    const source = createMappedSource(io, mapping);
    source.close = () => opts.transport.close();
    return source;
}

/** Build the MCP source for a school from its saved CRM config. */
export async function createMcpSourceForSchool(
    school: SamparkSchool,
    overrides: Partial<Omit<HttpMcpTransportOptions, 'url' | 'apiKey'>> & { transport?: McpTransport } = {},
): Promise<CrmSource> {
    const crm = school.crm;
    if (!crm || crm.kind !== 'mcp' || !crm.baseUrl) throw new CrmUrlError('No MCP server is configured for this school');
    if (!crm.apiKeySecretName) throw new CrmUrlError('No CRM API key secret is configured for this school');
    const mapping = parseMapping(crm.mapping ?? null);
    const apiKey = await getSecret(crm.apiKeySecretName);
    const { transport, ...transportOverrides } = overrides;
    return createMcpSource({
        transport: transport ?? createHttpMcpTransport({ url: crm.baseUrl, apiKey, ...transportOverrides }),
        mapping,
        secret: apiKey,
    });
}
