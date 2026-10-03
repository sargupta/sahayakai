import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { MCP_TOOLS } from '../src/mcp';
import { API_KEY, crawl, startServer, type TestServer } from './helpers';

let srv: TestServer;
before(async () => {
    srv = await startServer();
});
after(async () => {
    await srv.close();
});

let nextId = 1;
async function rpc(method: string, params?: unknown, headers: Record<string, string> = {}) {
    return fetch(`${srv.baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}`, ...headers },
        body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
    });
}
const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await rpc('tools/call', { name, arguments: args });
    assert.equal(res.status, 200);
    return (await res.json()) as {
        result?: { content: { text: string }[]; structuredContent: { data: Record<string, unknown>[]; nextCursor: string | null }; isError: boolean };
        error?: { code: number };
    };
};

describe('MCP face', () => {
    test('needs the same bearer key as /v1', async () => {
        const res = await fetch(`${srv.baseUrl}/mcp`, { method: 'POST', body: '{}' });
        assert.equal(res.status, 401);
    });

    test('initialize, initialized notification (202), tools/list', async () => {
        const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } });
        assert.equal(init.status, 200);
        assert.ok(init.headers.get('mcp-session-id'));
        const body = (await init.json()) as { result: { protocolVersion: string } };
        assert.equal(body.result.protocolVersion, '2025-03-26');
        const note = await fetch(`${srv.baseUrl}/mcp`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
        });
        assert.equal(note.status, 202);
        const list = (await (await rpc('tools/list')).json()) as { result: { tools: { name: string }[] } };
        assert.deepEqual(list.result.tools.map((t) => t.name), MCP_TOOLS.map((t) => t.name));
    });

    test('list_students returns the SAME pages as GET /v1/students, tombstones included', async () => {
        const rest = await crawl<Record<string, unknown>>(srv.baseUrl, '/v1/students', { limit: '50' });
        const viaMcp: Record<string, unknown>[] = [];
        let cursor: string | null = null;
        do {
            const out = await call('list_students', { limit: 50, ...(cursor ? { cursor } : {}) });
            const page = out.result!.structuredContent;
            assert.deepEqual(JSON.parse(out.result!.content[0]!.text), page, 'text block mirrors structuredContent');
            viaMcp.push(...page.data);
            cursor = page.nextCursor;
        } while (cursor);
        assert.deepEqual(viaMcp, rest.records);
        assert.ok(viaMcp.some((s) => s.deleted === true), 'tombstones are served');
    });

    test('includeMalformed serves the quarantine records; list_consent rows have the consent-list columns', async () => {
        const ids: unknown[] = [];
        let cursor: string | null = null;
        do {
            const out = await call('list_guardians', { includeMalformed: true, limit: 200, ...(cursor ? { cursor } : {}) });
            ids.push(...out.result!.structuredContent.data.map((g) => g.id));
            cursor = out.result!.structuredContent.nextCursor;
        } while (cursor);
        assert.ok(ids.includes('gdn_9901'));
        const consent = await call('list_consent', { limit: 5 });
        const row = consent.result!.structuredContent.data[0]!;
        assert.deepEqual(Object.keys(row).sort(), ['guardian', 'id', 'method', 'noticeVersion', 'phone', 'purposeGroup', 'recordedAt', 'status', 'studentAdmissionNo', 'updatedAt']);
    });

    test('a bad argument is an isError tool result; an unknown tool is a JSON-RPC error', async () => {
        const bad = await call('list_attendance', { date: 'tomorrow' });
        assert.equal(bad.result!.isError, true);
        const unknown = await call('delete_everything');
        assert.equal(unknown.error?.code, -32602);
    });

    test('GET is refused (no SSE stream) and the consent CSV export exists', async () => {
        const res = await fetch(`${srv.baseUrl}/mcp`, { headers: { authorization: `Bearer ${API_KEY}` } });
        assert.equal(res.status, 405);
        const csv = await fetch(`${srv.baseUrl}/v1/export/consent.csv`, { headers: { authorization: `Bearer ${API_KEY}` } });
        assert.equal(csv.status, 200);
        assert.match((await csv.text()).split('\r\n')[0] ?? '', /^guardian,phone,studentAdmissionNo,purposeGroup,status,recordedAt,method,noticeVersion$/);
    });
});
