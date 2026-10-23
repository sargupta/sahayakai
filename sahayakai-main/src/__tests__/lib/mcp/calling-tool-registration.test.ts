/**
 * @jest-environment node
 *
 * GATES for the Parent Calling MCP (Sampark + MCP integration brief, 2026-10-23).
 *
 * 1. initiate_parent_call stays switched off (decision 1) until it routes
 *    through Sampark's request-to-talk purposes, gate, approval and records.
 *    The class of bug: any code path that registers a dialling tool on the
 *    calling server. Checked three ways — the production capability's tools,
 *    the tools/list a real MCP client sees from the real route module, and a
 *    scan of src/ for anything outside capability.ts that registers the tool.
 *
 * 2. list_parent_contacts never returns a full parent phone number. The class
 *    of bug: a field holding a phone (or any long digit run from one) added to
 *    the tool's output schema or projection. Checked on the schema itself and
 *    on a real MCP round trip with phones planted in every student field.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/logger/structured-logger', () => ({ StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mintApiKey, MCP_API_KEYS_COLLECTION } from '@/lib/mcp/api-keys';
import { handleMcpHttpRequest } from '@/lib/mcp/http-handler';
import { callingCapability, ENABLED_CALLING_TOOLS } from '@/lib/mcp/calling/capability';
import { ParentContactsResult } from '@/lib/mcp/calling/schema';

const SRC = path.join(__dirname, '..', '..', '..');
const CAPABILITY_FILE = path.join(SRC, 'lib', 'mcp', 'calling', 'capability.ts');

const realFetchApi = jest.requireActual('whatwg-fetch');
const stubbed = { Headers: global.Headers, Request: global.Request, Response: global.Response, fetch: global.fetch };
beforeAll(() => Object.assign(global, { Headers: realFetchApi.Headers, Request: realFetchApi.Request, Response: realFetchApi.Response }));
afterAll(() => Object.assign(global, stubbed));

// ── minimal in-memory Firestore ─────────────────────────────────────────────
const docs = new Map<string, Record<string, any>>();
const snap = (p: string) => ({ id: p.split('/').pop()!, exists: docs.has(p), data: () => docs.get(p) });
const children = (p: string) => [...docs.keys()].filter((k) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes('/'));
const coll = (p: string): any => ({
    doc: (id: string) => ({ get: async () => snap(`${p}/${id}`), collection: (c: string) => coll(`${p}/${id}/${c}`) }),
    get: async () => ({ docs: children(p).map(snap) }),
    orderBy: () => coll(p),
    where: (field: string, _op: string, v: string[]) => ({ get: async () => ({ docs: children(p).filter((k) => v.includes(docs.get(k)![field])).map(snap) }) }),
});
const fakeDb = { collection: (c: string) => coll(c) };

const PEPPER = 'calling-gate-pepper-0123456789-abcdefgh';
const DEPS = {
    getDb: async () => fakeDb as any,
    routes: { parentMessage: jest.fn(), outreach: jest.fn(), call: jest.fn() },
    callbackBaseUrl: 'https://app.sahayak.example',
    checkCallingWindow: () => ({ allowed: true, istHour: 11, istTime: '11:00', reason: '', nextAllowedAt: null }),
};

async function connect(capability = callingCapability(DEPS)) {
    const { apiKey, keyId, record } = mintApiKey({ orgId: 'org-a', label: 'gate', scopes: ['calling'], createdBy: 'jest', pepper: PEPPER });
    docs.set(`${MCP_API_KEYS_COLLECTION}/${keyId}`, record as any);
    const client = new Client({ name: 'gate', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL('https://sahayak.test/api/mcp/calling'), {
        requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
        fetch: async (url, init) => handleMcpHttpRequest(new Request(url, init), capability, { getDb: async () => fakeDb as any, rateLimit: async () => undefined }),
    }));
    return client;
}

beforeEach(() => {
    docs.clear();
    process.env.MCP_API_KEY_PEPPER = PEPPER;
    docs.set('organizations/org-a', { name: 'School A' });
    docs.set('organizations/org-a/members/teacher-a', { role: 'teacher' });
    docs.set('classes/class-6a', { teacherUid: 'teacher-a', name: 'Class 6A', subject: 'Science', gradeLevel: 'Class 6' });
});

function walkSource(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name !== '__tests__' && e.name !== 'node_modules') walkSource(full, out);
        } else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !/\.test\.|\.spec\./.test(e.name)) {
            out.push(full);
        }
    }
    return out;
}

describe('gate: initiate_parent_call is not registered (decision 1)', () => {
    it('the production calling capability registers only the enabled read-only tools', () => {
        const registered: string[] = [];
        callingCapability(DEPS).register({ registerTool: (name: string) => { registered.push(name); } } as any, {} as any);
        expect(registered).toEqual([...ENABLED_CALLING_TOOLS]);
        expect(registered).not.toContain('initiate_parent_call');
    });

    it('a real MCP client sees list_parent_contacts and no initiate_parent_call in tools/list', async () => {
        const client = await connect();
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name)).toEqual(['list_parent_contacts']);
        expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
        await client.close();
    });

    it('calling initiate_parent_call is refused as an unknown tool and reaches none of the Contact-flow routes', async () => {
        const client = await connect();
        const res: any = await client.callTool({ name: 'initiate_parent_call', arguments: { class_id: 'class-6a', student_id: 'stu-1', reason: 'positive_feedback' } })
            .catch((e: Error) => ({ isError: true, thrown: e.message }));
        expect(res.isError).toBe(true);
        expect(DEPS.routes.parentMessage).not.toHaveBeenCalled();
        expect(DEPS.routes.outreach).not.toHaveBeenCalled();
        expect(DEPS.routes.call).not.toHaveBeenCalled();
        await client.close();
    });

    it('the /api/mcp/calling route serves the production callingCapability, not a custom tool set', () => {
        const route = fs.readFileSync(path.join(SRC, 'app', 'api', 'mcp', 'calling', 'route.ts'), 'utf8');
        expect(route).toMatch(/callingCapability\(/);
        expect(route).not.toMatch(/registerInitiateParentCall|registerTool\(/);
    });

    it('nothing in src/ outside capability.ts registers initiate_parent_call or calls registerInitiateParentCall', () => {
        const offenders = walkSource(SRC)
            .filter((f) => path.resolve(f) !== path.resolve(CAPABILITY_FILE))
            .filter((f) => {
                const text = fs.readFileSync(f, 'utf8');
                return /registerInitiateParentCall/.test(text) || /registerTool\(\s*['"`]initiate_parent_call['"`]/.test(text);
            })
            .map((f) => path.relative(SRC, f));
        expect(offenders).toEqual([]);
    });

    it('capability.ts itself never calls registerInitiateParentCall', () => {
        const text = fs.readFileSync(CAPABILITY_FILE, 'utf8');
        // the one allowed mention is the function definition
        expect(text.match(/registerInitiateParentCall\s*\(/g)).toHaveLength(1);
        expect(text).toMatch(/export function registerInitiateParentCall\s*\(/);
    });
});

describe('gate: list_parent_contacts never returns a full phone number', () => {
    /** Every key of an object schema, recursively (arrays and nullables unwrapped). */
    function schemaKeys(schema: z.ZodTypeAny, prefix = ''): string[] {
        let s: any = schema;
        while (s instanceof z.ZodOptional || s instanceof z.ZodNullable || s instanceof z.ZodDefault || s instanceof z.ZodEffects) {
            s = s instanceof z.ZodEffects ? s.innerType() : s.unwrap?.() ?? s._def.innerType;
        }
        if (s instanceof z.ZodArray) return schemaKeys(s.element, `${prefix}[]`);
        if (s instanceof z.ZodObject) {
            return Object.entries(s.shape as Record<string, z.ZodTypeAny>).flatMap(([k, v]) => [`${prefix}.${k}`, ...schemaKeys(v, `${prefix}.${k}`)]);
        }
        return [];
    }

    it('the output schema has no phone-like field except the 4-digit suffix and the reachable flag', () => {
        const phoneLike = schemaKeys(ParentContactsResult).filter((k) => /phone|mobile|msisdn|tel\b|contact_?number|whatsapp/i.test(k.split('.').pop()!));
        expect(phoneLike.map((k) => k.split('.').pop())).toEqual(['parent_phone_last4']);
    });

    const PLANTED = ['+919876543210', '09812345678', '+91 98123 40000', '+14155550123'];
    const digitsOf = (p: string) => p.replace(/\D/g, '');

    it('with phones planted in every student field, no response byte carries 5+ consecutive digits of any of them', async () => {
        docs.set('classes/class-6a/students/stu-1', {
            name: 'Ravi Kumar', rollNumber: 1, parentLanguage: 'Hindi',
            parentPhone: PLANTED[0], alternatePhone: PLANTED[1], phone: PLANTED[2], fatherMobile: PLANTED[3],
            guardian: { phone: PLANTED[1] }, contacts: [PLANTED[2]], notes: `call ${PLANTED[3]}`,
        });
        docs.set('classes/class-6a/students/stu-2', { name: 'Asha', rollNumber: 2, parentPhone: '', parentLanguage: 'English' });

        const client = await connect();
        const res: any = await client.callTool({ name: 'list_parent_contacts', arguments: {} });
        await client.close();

        expect(res.isError).toBeFalsy();
        const out = ParentContactsResult.strict().parse(res.structuredContent);
        const [ravi, asha] = out.classes[0].students;
        expect(Object.keys(ravi).sort()).toEqual(['name', 'parent_language', 'parent_phone_last4', 'parent_reachable', 'roll_number', 'student_id']);
        expect(ravi.parent_phone_last4).toBe('3210');
        expect(asha).toMatchObject({ parent_reachable: false, parent_phone_last4: '' });
        for (const s of out.classes.flatMap((c) => c.students)) expect(s.parent_phone_last4).toMatch(/^\d{0,4}$/);

        // structuredContent AND the text content a model reads
        const wire = JSON.stringify(res).replace(/\D+/g, ' ');
        for (const planted of PLANTED) {
            const d = digitsOf(planted);
            for (let i = 0; i + 5 <= d.length; i++) expect(wire).not.toContain(d.slice(i, i + 5));
        }
    });
});
