/**
 * THE CRM-SOURCE CONFORMANCE KIT (R2-4 class gate).
 *
 * One shared test function that ANY `CrmSource` must pass. A new connector (a
 * second MCP tool, another vendor's REST dialect, an SFTP drop) is not done until
 * a conformance.test.ts row feeds it through `defineCrmSourceConformance`; the
 * rows today are REST, MCP and CSV, all served from the same mock school CRM, and
 * the kit demands IDENTICAL canonical import results from all three.
 *
 * What every source must do
 *   1 pagination      the same records at any page size; a network source really crawls
 *                     several pages at a small page size; no duplicates
 *   2 tombstones      `deleted: true` records come through and import as retired, never as live students/guardians
 *   3 quarantine      the planted malformed records are rejected with a reason, each independently
 *                     (one bad row never blocks the rest), and never reach the snapshot
 *   4 consent         every consent state (granted, denied, unknown-status, unrecorded) maps to the same registry entries;
 *                     the consent LIST path (feed tool, REST endpoint or consent CSV) gives the same registry as the
 *                     guardians' own consent columns
 *   5 canonical       the full normalised snapshot (students, guardians, preferences, rejected rows, counts) deep-equals
 *                     the reference result
 *   6 no leakage      network sources only: when the tool fails, lies, or echoes the secret back, the secret appears in
 *                     NO thrown error, import-run error text or log line
 *
 * The kit is deliberately free of connector specifics: adapters only say how to MAKE a source.
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { logger } from '@/lib/logger';
import { runImport } from '@/lib/sampark/crm/import';
import { decryptPhone } from '@/lib/sampark/phone';
import type { CrmSource } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { ImportRun, SamparkSchool } from '@/types/sampark';

import fixturePlanted from '../../fixtures/sampark/planted.json';

export const ORG = 'hillview-demo';
const planted = (fixturePlanted as { planted: PlantedIds }).planted;
interface PlantedIds {
    malformed: { studentIds: string[]; guardianIds: string[]; reasons: Record<string, string> };
    tombstones: { studentIds: string[]; guardianIds: string[] };
    consentExamples: { deniedGuardianId: string; unknownNullGuardianId: string; unknownStatusGuardianId: string };
}

export interface MadeSource {
    source: CrmSource;
    /** Network requests made so far (HTTP requests or JSON-RPC calls). Absent for file sources. */
    requestCount?: () => number;
}

export interface ConformanceAdapter {
    /** Label for test names. */
    name: string;
    /** True for sources that talk over a network and page (REST, MCP). */
    paged: boolean;
    /**
     * A source over the mock CRM with the malformed records INCLUDED.
     * `consentList: true` → the source must ALSO offer its consent list (`fetchConsent`).
     */
    make(opts: { pageSize: number; consentList: boolean }): Promise<MadeSource>;
    /** Network sources: a source pointed at `url`, a server that fails and echoes `secret`. */
    makeHostile?(opts: { url: string; secret: string }): CrmSource;
}

// ── Canonical form of an import result ──────────────────────────────────────

export interface CanonicalImport {
    status: ImportRun['status'];
    counts: ImportRun['counts'];
    rejected: { entity: string; crmId: string | null; reason: string }[];
    students: unknown[];
    guardians: unknown[];
    preferences: unknown[];
    tombstonedStudentIds: string[];
    tombstonedGuardianIds: string[];
}

function school(): SamparkSchool {
    return {
        orgId: ORG,
        spokenName: { English: 'Hillview', Hindi: 'हिलव्यू', Bengali: 'হিলভিউ', Nepali: 'हिलभ्यू' },
        displayName: 'Hillview Demo School',
        mode: 'practice',
        isDemo: true,
        callingWindow: { startHour: 10, endHour: 19, offDays: [0] },
        holidays: [],
        venues: [],
        defaultLanguage: null,
        crm: null,
        emergencyBypassConsent: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };
}

const byId = <T extends { id?: string; guardianId?: string }>(a: T, b: T) => String(a.id ?? a.guardianId).localeCompare(String(b.id ?? b.guardianId));

/** Import the source into a fresh in-memory repo and return the normalised result. */
export async function canonicalImport(source: CrmSource): Promise<CanonicalImport & { run: ImportRun }> {
    const repo = createMemorySamparkRepo();
    await repo.upsertSchool(school());
    const clock = { now: () => new Date('2026-10-05T05:30:00Z') };
    const run = await runImport({ repo, clock }, ORG, source, 'conformance');
    const students = (await repo.listStudents(ORG)).sort(byId);
    const guardians = (await repo.listGuardians(ORG)).sort(byId);
    const prefs = await repo.getPreferences(ORG, guardians.map((g) => g.id));
    return {
        run,
        status: run.status,
        counts: run.counts,
        rejected: run.rejected.map((r) => ({ entity: r.entity, crmId: r.crmId, reason: r.reason })).sort((a, b) => `${a.entity}${a.crmId}`.localeCompare(`${b.entity}${b.crmId}`)),
        // guardianIds / studentIds are SETS: their order follows the order the source listed the records in.
        students: students.map((s) => ({ ...s, guardianIds: [...s.guardianIds].sort(), importedAt: undefined })),
        // phoneEnc is AES-GCM with a random IV: compare the DECRYPTED number instead.
        guardians: guardians.map((g) => ({ ...g, studentIds: [...g.studentIds].sort(), phoneEnc: undefined, phone: decryptPhone(g.phoneEnc), importedAt: undefined })),
        preferences: [...prefs.values()].sort(byId).map((p) => ({ ...p, updatedAt: undefined })),
        tombstonedStudentIds: students.filter((s) => !s.active).map((s) => s.id),
        tombstonedGuardianIds: guardians.filter((g) => !g.active).map((g) => g.id),
    };
}

// ── The hostile server (secret-leak test) ───────────────────────────────────

export type HostileMode = 'http500' | 'bad_json' | 'rpc_error' | 'tool_error' | 'tool_garbage';

/**
 * A local server that behaves badly AND echoes the request's Authorization header (so the secret) in every
 * failure it produces. REST gets HTTP errors / invalid JSON; MCP gets a valid handshake and then tool failures.
 */
export async function startHostileServer(mode: HostileMode): Promise<{ url: string; close(): Promise<void> }> {
    const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
            const auth = String(req.headers.authorization ?? '');
            const echo = `echoing ${auth} / ${auth.replace(/^Bearer\s+/i, '')}`;
            const send = (status: number, body: string, type = 'application/json') => {
                res.writeHead(status, { 'content-type': type });
                res.end(body);
            };
            let rpc: { id?: number; method?: string } | null = null;
            try {
                rpc = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { id?: number; method?: string };
            } catch {
                rpc = null;
            }
            if (rpc?.method) {
                // MCP: a healthy handshake, then the configured failure on tools/call.
                if (rpc.id === undefined) return send(202, '');
                if (rpc.method === 'initialize') return send(200, JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { protocolVersion: '2025-03-26', capabilities: {} } }));
                if (rpc.method === 'tools/list') {
                    const tools = ['get_school', 'list_students', 'list_guardians', 'list_consent'].map((name) => ({ name }));
                    return send(200, JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { tools } }));
                }
                if (mode === 'http500') return send(500, echo);
                if (mode === 'bad_json') return send(200, echo);
                if (mode === 'rpc_error') return send(200, JSON.stringify({ jsonrpc: '2.0', id: rpc.id, error: { code: -32000, message: echo } }));
                if (mode === 'tool_garbage') return send(200, JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { content: [{ type: 'text', text: echo }] } }));
                return send(200, JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { isError: true, content: [{ type: 'text', text: echo }] } }));
            }
            // REST (and anything else): the failure straight away.
            if (mode === 'bad_json' || mode === 'tool_garbage') return send(200, echo);
            return send(500, echo);
        });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${port}`,
        close: () =>
            new Promise<void>((resolve) => {
                server.closeAllConnections?.();
                server.close(() => resolve());
            }),
    };
}

/** Every string the logger was given, flattened, so a secret hiding in an Error or a data object is found. */
function loggedText(): string {
    const parts: string[] = [];
    const walk = (v: unknown) => {
        if (v instanceof Error) parts.push(v.name, v.message, v.stack ?? '');
        else if (typeof v === 'string') parts.push(v);
        else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x);
    };
    for (const level of ['info', 'warn', 'error', 'debug'] as const) {
        const fn = (logger as unknown as Record<string, jest.Mock | undefined>)[level];
        for (const call of fn?.mock?.calls ?? []) walk(call);
    }
    return parts.join('\n');
}

/**
 * Run a source against the hostile server and report every place the secret showed up (empty = clean).
 * Exported so the kit itself can be proven to catch a leaky adapter.
 */
export async function hostileLeakReport(
    makeSource: (hostileUrl: string) => CrmSource,
    mode: HostileMode,
    secret: string,
): Promise<{ thrown: string[]; leaks: string[]; failedRun: CanonicalImport & { run: ImportRun } }> {
    for (const level of ['info', 'warn', 'error', 'debug'] as const) (logger[level] as unknown as jest.Mock).mockClear?.();
    const hostile = await startHostileServer(mode);
    try {
        const source = makeSource(hostile.url);
        const thrown: string[] = [];
        for (const call of [() => source.fetchSchool(), () => source.fetchStudents(null), () => source.fetchGuardians(null)]) {
            try {
                await call();
            } catch (err) {
                const e = err as Error;
                thrown.push(`${e.name}: ${e.message}\n${e.stack ?? ''}`);
            }
        }
        const failedRun = await canonicalImport(makeSource(hostile.url));
        const places: Record<string, string> = {
            'a thrown error': thrown.join('\n'),
            'the import run error': String(failedRun.run.error),
            'the stored import run': JSON.stringify(failedRun.run),
            'the log': loggedText(),
        };
        return { thrown, leaks: Object.entries(places).filter(([, text]) => text.includes(secret)).map(([where]) => where), failedRun };
    } finally {
        await hostile.close();
    }
}

// ── The kit ─────────────────────────────────────────────────────────────────

export interface ConformanceContext {
    /** The reference result every adapter must reproduce. Filled by the first adapter's "canonical" test. */
    reference: { value: (CanonicalImport & { run: ImportRun }) | null };
}

export function defineCrmSourceConformance(adapter: ConformanceAdapter, ctx: ConformanceContext): void {
    describe(`CrmSource conformance — ${adapter.name}`, () => {
        let main: (CanonicalImport & { run: ImportRun }) | null = null;
        const secret = `sk-conformance-${adapter.name}-SECRET-9f3a7c`;

        beforeAll(async () => {
            main = await canonicalImport((await adapter.make({ pageSize: 200, consentList: false })).source);
        });

        // 1 ── pagination
        it('1 pagination: identical records at page size 7 and 200, no duplicates', async () => {
            const small = await adapter.make({ pageSize: 7, consentList: false });
            const big = await adapter.make({ pageSize: 200, consentList: false });
            const a = (await small.source.fetchStudents(null)) as { id: string }[];
            const b = (await big.source.fetchStudents(null)) as { id: string }[];
            expect(a.length).toBeGreaterThan(100);
            expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
            expect(new Set(a.map((r) => r.id)).size).toBe(a.length);
            const ga = (await small.source.fetchGuardians(null)) as { id: string }[];
            expect(ga.length).toBeGreaterThan(100);
            expect(new Set(ga.map((r) => r.id)).size).toBe(ga.length);
            if (adapter.paged) {
                expect(small.requestCount!()).toBeGreaterThan(big.requestCount!() * 5); // really crawled many pages
            }
        });

        // 2 ── tombstones
        it('2 tombstones: deleted records arrive as tombstones and never become live records', async () => {
            const { source } = await adapter.make({ pageSize: 200, consentList: false });
            const raw = (await source.fetchStudents(null)) as { id: string; deleted?: unknown }[];
            const rawGuardians = (await source.fetchGuardians(null)) as { id: string; deleted?: unknown }[];
            for (const id of planted.tombstones.studentIds) expect(raw.find((r) => r.id === id)?.deleted).toBe(true);
            for (const id of planted.tombstones.guardianIds) expect(rawGuardians.find((r) => r.id === id)?.deleted).toBe(true);
            const live = new Set((main!.students as { id: string; active: boolean }[]).filter((s) => s.active).map((s) => s.id));
            for (const id of planted.tombstones.studentIds) expect(live.has(id)).toBe(false);
            const liveG = new Set((main!.guardians as { id: string; active: boolean }[]).filter((g) => g.active).map((g) => g.id));
            for (const id of planted.tombstones.guardianIds) expect(liveG.has(id)).toBe(false);
            expect(main!.counts.tombstoned).toBe(planted.tombstones.studentIds.length + planted.tombstones.guardianIds.length);
        });

        // 3 ── malformed rows
        it('3 quarantine: every planted malformed record is rejected with a reason; the rest still import', () => {
            const rejectedIds = main!.rejected.map((r) => r.crmId).sort();
            expect(rejectedIds).toEqual([...planted.malformed.studentIds, ...planted.malformed.guardianIds].sort());
            for (const r of main!.rejected) expect(r.reason.trim().length).toBeGreaterThan(3);
            expect(main!.counts.rejected).toBe(main!.rejected.length);
            const students = main!.students as { id: string }[];
            const guardians = main!.guardians as { id: string }[];
            for (const id of planted.malformed.studentIds) expect(students.some((s) => s.id === id)).toBe(false);
            for (const id of planted.malformed.guardianIds) expect(guardians.some((g) => g.id === id)).toBe(false);
            expect(main!.status).toBe('succeeded');
            expect(students.length).toBeGreaterThan(200); // one bad row never blocks the rest
        });

        // 4 ── consent mapping
        it('4 consent: each consent state maps to the same registry entry; the consent list agrees with the feed', async () => {
            const prefs = new Map((main!.preferences as { guardianId: string; consent: Record<string, { status: string; source: string }> }[]).map((p) => [p.guardianId, p]));
            const ex = planted.consentExamples;
            expect(prefs.get(ex.deniedGuardianId)!.consent.notices.status).toBe('denied');
            expect(prefs.get(ex.unknownNullGuardianId)!.consent.notices).toMatchObject({ status: 'unknown', source: 'crm' });
            expect(prefs.get(ex.unknownStatusGuardianId)!.consent.notices.status).toBe('unknown');
            const granted = [...prefs.values()].filter((p) => p.consent.notices.status === 'granted').length;
            expect(granted).toBeGreaterThan(50);

            const withList = await adapter.make({ pageSize: 200, consentList: true });
            expect(withList.source.fetchConsent).toBeDefined();
            const viaList = await canonicalImport(withList.source);
            expect(viaList.run.rejected.filter((r) => r.entity === 'consent')).toEqual([]);
            // The list was derived from the same data, so the registry must be identical (granted/denied/unknown).
            expect(viaList.preferences).toEqual(main!.preferences);
        });

        // 5 ── canonical equality
        it('5 canonical: the whole normalised import equals the reference result', () => {
            if (!ctx.reference.value) {
                ctx.reference.value = main; // the first adapter defines the reference; the rest must match it
                return;
            }
            const ref = ctx.reference.value;
            expect(main!.counts).toEqual(ref.counts);
            expect(main!.rejected).toEqual(ref.rejected);
            expect(main!.students).toEqual(ref.students);
            expect(main!.guardians).toEqual(ref.guardians);
            expect(main!.preferences).toEqual(ref.preferences);
        });

        // 6 ── no leakage
        if (adapter.makeHostile) {
            it.each(['http500', 'bad_json', 'rpc_error', 'tool_error', 'tool_garbage'] as HostileMode[])(
                '6 no secret in errors or logs when the tool misbehaves (%s)',
                async (mode) => {
                    const report = await hostileLeakReport((url) => adapter.makeHostile!({ url, secret }), mode, secret);
                    expect(report.failedRun.run.status).toBe('failed');
                    expect(report.failedRun.run.error).toBeTruthy();
                    expect(report.thrown.length).toBeGreaterThan(0);
                    expect(report.leaks).toEqual([]);
                },
            );
        }
    });
}
