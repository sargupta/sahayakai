/**
 * An MCP server face over the SAME data the REST API serves (JSON-RPC 2.0 over
 * HTTP, the "streamable HTTP" transport with plain `application/json`
 * responses, no SSE stream). Hand-rolled on purpose: the dummy CRM stays
 * dependency-light and the app's deterministic MCP client is tested against the
 * wire protocol itself, not against an SDK's idea of it.
 *
 *   POST /mcp   Authorization: Bearer <api key>   (the same key as /v1)
 *
 * Methods: initialize, notifications/initialized (202), ping, tools/list,
 * tools/call. Every list tool takes `{ updatedSince?, cursor?, limit?,
 * includeMalformed? }` and returns the SAME `{ data, nextCursor }` page the REST
 * endpoint returns, as structuredContent AND as one JSON text block (clients
 * read either).
 *
 * Tool names (snake_case, what a real tool team would plausibly publish):
 *   get_school  list_students  list_guardians  list_consent
 *   list_attendance  list_hpc_entries  list_assessments  list_meetings  list_incidents
 * The dummy CRM holds no fee dues, so it publishes no fee tool; a client that
 * configures one is told so by tools/list.
 */

import type { CrmGuardian } from './contract/crm-schema';
import { isValidDate } from './calendar';
import { BadRequest, paginate, parsePageQuery } from './pagination';
import type { CrmState } from './state';

export const MCP_PROTOCOL_VERSION = '2025-03-26';

type Json = Record<string, unknown>;

export interface JsonRpcRequest {
    jsonrpc?: unknown;
    id?: unknown;
    method?: unknown;
    params?: unknown;
}

const PAGING_PROPS = {
    updatedSince: { type: 'string', description: 'ISO-8601 date-time with offset; inclusive' },
    cursor: { type: 'string', description: 'opaque cursor from the previous page' },
    limit: { type: 'integer', minimum: 1, maximum: 200 },
    includeMalformed: { type: 'boolean', description: 'also serve the deliberately malformed records (demo of quarantine)' },
};

const listTool = (name: string, description: string, extra: Json = {}) => ({
    name,
    description,
    inputSchema: { type: 'object', properties: { ...PAGING_PROPS, ...extra }, additionalProperties: false },
});

export const MCP_TOOLS = [
    { name: 'get_school', description: 'The school record: name, board, academic year, rubric scale, holidays.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    listTool('list_students', 'Students, with their guardians of record. Deleted students arrive as tombstones.'),
    listTool('list_guardians', 'Guardians with phone, language and per-purpose consent. Deleted guardians arrive as tombstones.'),
    listTool('list_consent', 'One row per guardian per purpose group that has a consent record.'),
    listTool('list_attendance', 'Daily attendance marks.', { date: { type: 'string' }, studentId: { type: 'string' } }),
    listTool('list_hpc_entries', 'Holistic progress card entries.', { studentId: { type: 'string' } }),
    listTool('list_assessments', 'Assessment scores.', { studentId: { type: 'string' } }),
    listTool('list_meetings', 'Meeting requests.'),
    listTool('list_incidents', 'Incidents (reason codes only, never note text).'),
];

/** Flatten the guardians' nested consent into one row per guardian per purpose group. */
export function consentRows(guardians: readonly CrmGuardian[]): Json[] {
    const groups = [
        ['notices', 'notices'],
        ['progress', 'progress'],
        ['recorded_conversation', 'recordedConversation'],
        ['hpc_input', 'hpcInput'],
    ] as const;
    const rows: Json[] = [];
    for (const g of guardians) {
        if (g.deleted) continue;
        for (const [group, key] of groups) {
            const c = g.consent[key];
            if (!c) continue;
            rows.push({
                // id + updatedAt make the rows pageable with the same keyset pagination as the lists.
                id: `${g.id}:${group}`,
                updatedAt: g.updatedAt,
                guardian: g.id,
                phone: g.phone,
                studentAdmissionNo: null,
                purposeGroup: group,
                status: c.status,
                recordedAt: c.recordedAt,
                method: c.method,
                noticeVersion: c.noticeVersion,
            });
        }
    }
    return rows;
}

function asArgs(v: unknown): Json {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {};
}

function toParams(args: Json): URLSearchParams {
    const p = new URLSearchParams();
    for (const k of ['updatedSince', 'cursor', 'limit', 'includeMalformed', 'date', 'studentId'] as const) {
        const v = args[k];
        if (v !== undefined && v !== null) p.set(k, String(v));
    }
    return p;
}

function callTool(state: CrmState, name: string, args: Json): unknown {
    const params = toParams(args);
    const q = () => parsePageQuery(params);
    const byStudent = <T extends { studentId: string }>(rows: readonly T[]) => {
        const sid = params.get('studentId');
        return sid ? rows.filter((r) => r.studentId === sid) : rows;
    };
    switch (name) {
        case 'get_school':
            return state.school;
        case 'list_students': {
            const query = q();
            return paginate(query.includeMalformed ? [...state.students, ...state.malformed.students] : state.students, query);
        }
        case 'list_guardians': {
            const query = q();
            return paginate(query.includeMalformed ? [...state.guardians, ...state.malformed.guardians] : state.guardians, query);
        }
        case 'list_consent':
            return paginate(consentRows(state.guardians), q());
        case 'list_attendance': {
            const date = params.get('date');
            if (date !== null && !isValidDate(date)) throw new BadRequest('date must be YYYY-MM-DD');
            const rows = byStudent(state.attendance).filter((r) => date === null || r.date === date);
            return paginate(rows, q());
        }
        case 'list_hpc_entries':
            return paginate(byStudent(state.hpcEntries), q());
        case 'list_assessments':
            return paginate(byStudent(state.assessments), q());
        case 'list_meetings':
            return paginate(state.meetings, q());
        case 'list_incidents':
            return paginate(state.incidents, q());
        default:
            return undefined;
    }
}

const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result });

/**
 * Handle ONE JSON-RPC message. Returns null for a notification (the transport
 * answers 202). Protocol problems become JSON-RPC errors, tool problems become
 * `isError` results, as the MCP spec says.
 */
export function handleMcpMessage(state: CrmState, msg: JsonRpcRequest): unknown | null {
    if (msg === null || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
        return rpcError(null, -32600, 'invalid request');
    }
    const isNotification = msg.id === undefined;
    const id = msg.id;
    switch (msg.method) {
        case 'initialize':
            return rpcResult(id, {
                protocolVersion: MCP_PROTOCOL_VERSION,
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: 'mock-school-crm', version: '1.0.0' },
                instructions: 'Read-only view of the dummy school CRM. Same data as the REST API under /v1.',
            });
        case 'ping':
            return isNotification ? null : rpcResult(id, {});
        case 'tools/list':
            return rpcResult(id, { tools: MCP_TOOLS });
        case 'tools/call': {
            const params = asArgs(msg.params);
            const name = typeof params.name === 'string' ? params.name : '';
            if (!MCP_TOOLS.some((t) => t.name === name)) return rpcError(id, -32602, `unknown tool: ${name.slice(0, 60)}`);
            try {
                const out = callTool(state, name, asArgs(params.arguments));
                return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out, isError: false });
            } catch (err) {
                if (err instanceof BadRequest) return rpcResult(id, { content: [{ type: 'text', text: err.message }], isError: true });
                throw err;
            }
        }
        default:
            if (isNotification) return null; // notifications/initialized, notifications/cancelled, …
            return rpcError(id, -32601, `method not found: ${msg.method.slice(0, 60)}`);
    }
}
