/** @jest-environment node */
/**
 * CrmSource conformance against the real mock school CRM (R2-4 class gate): REST, MCP and CSV must each pass the
 * shared kit AND produce identical canonical import results. The mock is started as a child process
 * (mock-school-crm/ is its own ESM package; CI installs its dependencies before this suite runs).
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { createCsvSource } from '@/lib/sampark/crm/csv-source';
import { createHttpMcpTransport, createMcpSource } from '@/lib/sampark/crm/mcp-source';
import { parseMapping } from '@/lib/sampark/crm/mapping';
import { createRestSource } from '@/lib/sampark/crm/rest-source';

import { setPhoneEnv } from '../server/_helpers';
import { canonicalImport, defineCrmSourceConformance, hostileLeakReport, type CanonicalImport, type ConformanceAdapter, type ConformanceContext } from './conformance-kit';
import type { ImportRun } from '@/types/sampark';

jest.setTimeout(90_000);

const MOCK_DIR = path.resolve(__dirname, '../../../../../mock-school-crm');
const KEY = 'conformance-key-123';

let child: ChildProcess | null = null;
let baseUrl = '';
let stateDir = '';

async function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address() as net.AddressInfo;
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

async function waitHealthy(url: string, ms: number): Promise<void> {
    const until = Date.now() + ms;
    for (;;) {
        try {
            const res = await fetch(`${url}/healthz`);
            if (res.ok) return;
        } catch {
            // not up yet
        }
        if (Date.now() > until) throw new Error('the mock school CRM did not start in time');
        await new Promise((r) => setTimeout(r, 250));
    }
}

beforeAll(async () => {
    setPhoneEnv();
    if (!fs.existsSync(path.join(MOCK_DIR, 'node_modules', 'tsx'))) {
        throw new Error(
            'mock-school-crm dependencies are not installed. Run `npm ci` inside mock-school-crm/ (the CI test workflow does this before jest) — this suite is a class gate and must not be skipped.',
        );
    }
    const port = await freePort();
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-crm-conformance-'));
    child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
        cwd: MOCK_DIR,
        env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOCK_CRM_API_KEY: KEY, MOCK_CRM_STATE_PATH: path.join(stateDir, 'state.json') },
        stdio: 'ignore',
    });
    baseUrl = `http://127.0.0.1:${port}`;
    await waitHealthy(baseUrl, 60_000);
});

afterAll(async () => {
    child?.kill('SIGTERM');
    if (stateDir) fs.rmSync(stateDir, { recursive: true, force: true });
});

const MCP_TOOLS = { school: 'get_school', students: 'list_students', guardians: 'list_guardians' };

/** Counts every request a fetch implementation makes. */
function countingFetch(): { fetchImpl: typeof fetch; count: () => number } {
    let n = 0;
    return {
        fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) => {
            n += 1;
            return fetch(input, init);
        }) as typeof fetch,
        count: () => n,
    };
}

const rest: ConformanceAdapter = {
    name: 'REST',
    paged: true,
    async make({ pageSize, consentList }) {
        const counter = countingFetch();
        const mapping = parseMapping({ pagination: { pageSize }, ...(consentList ? { rest: { endpoints: { consent: '/v1/consent' } } } : {}) });
        return {
            source: createRestSource({ baseUrl: `${baseUrl}/?includeMalformed=true`, apiKey: KEY, mapping, fetchImpl: counter.fetchImpl, nodeEnv: 'test' }),
            requestCount: counter.count,
        };
    },
    makeHostile: ({ url, secret }) => createRestSource({ baseUrl: url, apiKey: secret, nodeEnv: 'test' }),
};

const mcp: ConformanceAdapter = {
    name: 'MCP',
    paged: true,
    async make({ pageSize, consentList }) {
        const counter = countingFetch();
        const mapping = parseMapping({
            mcp: {
                tools: { ...MCP_TOOLS, ...(consentList ? { consent: 'list_consent' } : {}) },
                args: { students: { includeMalformed: true }, guardians: { includeMalformed: true } },
            },
            pagination: { pageSize },
        });
        const transport = createHttpMcpTransport({ url: `${baseUrl}/mcp`, apiKey: KEY, fetchImpl: counter.fetchImpl, nodeEnv: 'test' });
        return { source: createMcpSource({ transport, mapping, secret: KEY }), requestCount: counter.count };
    },
    makeHostile: ({ url, secret }) => {
        const mapping = parseMapping({ mcp: { tools: { ...MCP_TOOLS, consent: 'list_consent' } } });
        const transport = createHttpMcpTransport({ url: `${url}/mcp`, apiKey: secret, nodeEnv: 'test' });
        return createMcpSource({ transport, mapping, secret });
    },
};

async function download(pathAndQuery: string): Promise<string> {
    const res = await fetch(`${baseUrl}${pathAndQuery}`, { headers: { Authorization: `Bearer ${KEY}` } });
    if (!res.ok) throw new Error(`${pathAndQuery} -> ${res.status}`);
    return res.text();
}

const csv: ConformanceAdapter = {
    name: 'CSV',
    paged: false,
    async make({ consentList }) {
        const [studentsCsv, guardiansCsv, consentCsv] = await Promise.all([
            download('/v1/export/students.csv?includeMalformed=true'),
            download('/v1/export/guardians.csv?includeMalformed=true'),
            consentList ? download('/v1/export/consent.csv') : Promise.resolve(null),
        ]);
        return { source: createCsvSource({ studentsCsv, guardiansCsv, consentCsv }) };
    },
};

// REST defines the reference; MCP and CSV must reproduce it exactly.
const ctx: ConformanceContext = { reference: { value: null as (CanonicalImport & { run: ImportRun }) | null } };
for (const adapter of [rest, mcp, csv]) defineCrmSourceConformance(adapter, ctx);

// ── The kit has teeth: deliberately broken adapters must be caught ──────────

describe('conformance kit — proves it fails a broken source', () => {
    it('a source that leaks the secret into its errors is reported', async () => {
        const secret = 'sk-teeth-LEAKY-SECRET-1';
        const leaky = (url: string) => {
            const inner = createRestSource({ baseUrl: url, apiKey: secret, nodeEnv: 'test' });
            const wrap = <T,>(fn: () => Promise<T>) => async () => {
                try {
                    return await fn();
                } catch (err) {
                    throw new Error(`${(err as Error).message} (sent Authorization: Bearer ${secret})`);
                }
            };
            return { ...inner, fetchSchool: wrap(() => inner.fetchSchool()), fetchStudents: () => wrap(() => inner.fetchStudents(null))(), fetchGuardians: () => wrap(() => inner.fetchGuardians(null))() };
        };
        const report = await hostileLeakReport(leaky, 'http500', secret);
        expect(report.leaks).toContain('a thrown error');
        expect(report.leaks).toContain('the log'); // the importer hides non-Crm error text from the run, but the log still has it
    });

    it('a source that drops tombstones or swallows malformed rows produces a different canonical result', async () => {
        const good = await canonicalImport((await rest.make({ pageSize: 200, consentList: false })).source);
        const base = (await rest.make({ pageSize: 200, consentList: false })).source;
        const noTombstones = { ...base, fetchStudents: async () => ((await base.fetchStudents(null)) as { deleted?: boolean }[]).filter((r) => r.deleted !== true) };
        const dropped = await canonicalImport(noTombstones);
        expect(dropped.counts.tombstoned).toBeLessThan(good.counts.tombstoned);

        const noMalformed = {
            ...base,
            fetchGuardians: async () => ((await base.fetchGuardians(null)) as { id: string }[]).filter((r) => r.id !== 'gdn_9901'),
        };
        const swallowed = await canonicalImport(noMalformed);
        expect(swallowed.rejected.length).toBeLessThan(good.rejected.length);
    });

    it('a source that serves consent wrongly changes the preferences registry', async () => {
        const good = await canonicalImport((await rest.make({ pageSize: 200, consentList: false })).source);
        const base = (await rest.make({ pageSize: 200, consentList: false })).source;
        const grantsEveryone = {
            ...base,
            fetchGuardians: async () =>
                ((await base.fetchGuardians(null)) as { consent?: Record<string, unknown> }[]).map((g) =>
                    g.consent ? { ...g, consent: { ...g.consent, notices: { status: 'granted', recordedAt: null, method: null, noticeVersion: null } } } : g,
                ),
        };
        const wrong = await canonicalImport(grantsEveryone);
        expect(wrong.preferences).not.toEqual(good.preferences);
    });
});
