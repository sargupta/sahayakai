import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { CSV_COLUMNS, CrmGuardianSchema, CrmSchoolSchema, CrmStudentSchema, pageSchema } from '../src/contract/crm-schema';
import { parseCsv, rowToGuardian, rowToStudent } from '../src/csv';
import { compareKeyed } from '../src/pagination';
import {
    AssessmentRecordSchema,
    AttendanceRecordSchema,
    CommunicationSchema,
    HpcEntrySchema,
    IncidentSchema,
    MeetingRequestSchema,
    RsvpSchema,
    SchoolEventSchema,
} from '../src/schemas';
import { API_KEY, api, crawl, getJson, startServer, type TestServer } from './helpers';

let srv: TestServer;
before(async () => {
    srv = await startServer();
});
after(async () => {
    await srv.close();
});

describe('auth', () => {
    test('401 with a JSON error without a key, with a wrong key, or a non-Bearer scheme', async () => {
        for (const authorization of [undefined, 'Bearer nope', `Basic ${API_KEY}`, 'Bearer ']) {
            const res = await fetch(`${srv.baseUrl}/v1/school`, { headers: authorization ? { authorization } : {} });
            assert.equal(res.status, 401, String(authorization));
            assert.equal(typeof ((await res.json()) as { error: unknown }).error, 'string');
        }
        const csv = await fetch(`${srv.baseUrl}/v1/export/students.csv`);
        assert.equal(csv.status, 401);
    });

    test('the demo page and /healthz need no key', async () => {
        const health = await fetch(`${srv.baseUrl}/healthz`);
        assert.equal(health.status, 200);
        assert.deepEqual(await health.json(), { ok: true, school: 'hillview-demo' });
        const page = await fetch(`${srv.baseUrl}/`);
        assert.equal(page.status, 200);
        assert.match(page.headers.get('content-type') ?? '', /text\/html/);
        const html = await page.text();
        assert.match(html, /Hillview Demo School, Siliguri/);
        assert.match(html, /name="viewport"/);
        assert.doesNotMatch(html, /<script|<link|src="http/i, 'no scripts or external assets');
    });

    test('unknown routes are JSON 404s; wrong methods are 405', async () => {
        const res = await api(srv.baseUrl, '/v1/nope');
        assert.equal(res.status, 404);
        assert.equal(typeof ((await res.json()) as { error: unknown }).error, 'string');
        assert.equal((await api(srv.baseUrl, '/v1/communications', { method: 'DELETE' })).status, 405);
    });
});

describe('school, students, guardians', () => {
    test('GET /v1/school validates', async () => {
        CrmSchoolSchema.parse(await getJson(srv.baseUrl, '/v1/school'));
    });

    test('every served student and guardian validates against the contract; tombstones included; no malformed', async () => {
        const state = srv.app.state;
        const students = await crawl(srv.baseUrl, '/v1/students', { limit: '200' });
        const guardians = await crawl(srv.baseUrl, '/v1/guardians', { limit: '200' });
        assert.equal(students.records.length, state.students.length);
        assert.equal(guardians.records.length, state.guardians.length);
        for (const s of students.records) assert.ok(CrmStudentSchema.safeParse(s).success, String(s.id));
        for (const g of guardians.records) assert.ok(CrmGuardianSchema.safeParse(g).success, String(g.id));
        assert.ok(students.records.some((s) => s.deleted === true));
        assert.ok(guardians.records.some((g) => g.deleted === true));
        const page = await getJson(srv.baseUrl, '/v1/students?limit=5');
        assert.ok(pageSchema(CrmStudentSchema).safeParse(page).success);
    });

    test('malformed records appear only with ?includeMalformed=true, and the flag rides in the cursor', async () => {
        const ids = (rows: Record<string, unknown>[]) => rows.map((r) => String(r.id));
        const plain = await crawl(srv.baseUrl, '/v1/students', { limit: '150' });
        assert.ok(!ids(plain.records).some((id) => id.startsWith('stu_99')));
        const withBad = await crawl(srv.baseUrl, '/v1/students', { limit: '150', includeMalformed: 'true' });
        assert.deepEqual(ids(withBad.records).filter((id) => id.startsWith('stu_99')).sort(), ['stu_9901', 'stu_9902']);
        const gBad = await crawl(srv.baseUrl, '/v1/guardians', { limit: '200', includeMalformed: 'true' });
        assert.ok(ids(gBad.records).includes('gdn_9901'));
        const invalid = withBad.records.filter((r) => !CrmStudentSchema.safeParse(r).success);
        assert.equal(invalid.length, 2);

        assert.equal((await api(srv.baseUrl, '/v1/students/stu_9901')).status, 404);
        assert.equal((await api(srv.baseUrl, '/v1/students/stu_9901?includeMalformed=true')).status, 200);
        assert.equal((await api(srv.baseUrl, '/v1/guardians/gdn_9901')).status, 404);
    });

    test('by-id endpoints', async () => {
        const s = srv.app.state.students[10];
        const g = srv.app.state.guardians[10];
        assert.ok(s && g);
        assert.deepEqual(await getJson(srv.baseUrl, `/v1/students/${s.id}`), s);
        assert.deepEqual(await getJson(srv.baseUrl, `/v1/guardians/${g.id}`), g);
        const missing = await api(srv.baseUrl, '/v1/students/stu_0000');
        assert.equal(missing.status, 404);
        assert.equal(typeof ((await missing.json()) as { error: unknown }).error, 'string');
    });
});

describe('pagination and updatedSince', () => {
    test('a small-page crawl returns every record once, ordered by updatedAt then id', async () => {
        const { records, pages } = await crawl(srv.baseUrl, '/v1/guardians', { limit: '37' });
        assert.ok(pages > 10);
        assert.equal(new Set(records.map((r) => r.id)).size, records.length);
        assert.equal(records.length, srv.app.state.guardians.length);
        for (let i = 1; i < records.length; i++) assert.ok(compareKeyed(records[i - 1] ?? {}, records[i] ?? {}) < 0, `order at ${i}`);
    });

    test('updatedSince is inclusive and exact', async () => {
        const state = srv.app.state;
        const sorted = [...state.students].sort(compareKeyed);
        const pivot = sorted[Math.floor(sorted.length * 0.8)];
        assert.ok(pivot);
        const expected = state.students.filter((s) => Date.parse(s.updatedAt) >= Date.parse(pivot.updatedAt)).map((s) => s.id).sort();
        const { records } = await crawl(srv.baseUrl, '/v1/students', { updatedSince: pivot.updatedAt, limit: '7' });
        assert.deepEqual(records.map((r) => String(r.id)).sort(), expected);
        assert.ok(records.some((r) => r.id === pivot.id), 'inclusive');
        // The same instant written with an IST offset selects the same records.
        const ist = new Date(Date.parse(pivot.updatedAt) + 330 * 60_000).toISOString().replace('Z', '+05:30');
        const again = await crawl(srv.baseUrl, '/v1/students', { updatedSince: ist, limit: '200' });
        assert.deepEqual(again.records.map((r) => String(r.id)).sort(), expected);
        // Tombstones updated in the last days are in a recent window.
        const recent = await crawl(srv.baseUrl, '/v1/students', { updatedSince: '2026-09-27T00:00:00+05:30' });
        for (const id of state.planted.tombstones.studentIds) assert.ok(recent.records.some((r) => r.id === id), id);
    });

    test('bad parameters are 400s', async () => {
        for (const q of ['limit=0', 'limit=201', 'limit=abc', 'cursor=%%%', 'cursor=bm9wZQ', 'updatedSince=yesterday', 'updatedSince=2026-09-01']) {
            const res = await api(srv.baseUrl, `/v1/students?${q}`);
            assert.equal(res.status, 400, q);
            assert.equal(typeof ((await res.json()) as { error: unknown }).error, 'string');
        }
    });
});

describe('CSV export', () => {
    test('students.csv and guardians.csv round-trip to the JSON the API serves', async () => {
        const state = srv.app.state;
        const res = await api(srv.baseUrl, '/v1/export/students.csv');
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-type') ?? '', /^text\/csv; charset=utf-8/);
        const [sh, ...sRows] = parseCsv(await res.text());
        assert.deepEqual(sh, [...CSV_COLUMNS.students]);
        const byId = new Map(state.students.map((s) => [s.id, s]));
        assert.equal(sRows.length, state.students.length);
        for (const row of sRows) {
            const back = rowToStudent(sh ?? [], row);
            assert.deepEqual(back, byId.get(String(back.id)));
        }
        const gRes = await api(srv.baseUrl, '/v1/export/guardians.csv');
        const [gh, ...gRows] = parseCsv(await gRes.text());
        assert.deepEqual(gh, [...CSV_COLUMNS.guardians]);
        const gById = new Map(state.guardians.map((g) => [g.id, g]));
        assert.equal(gRows.length, state.guardians.length);
        for (const row of gRows) {
            const back = rowToGuardian(gh ?? [], row);
            assert.deepEqual(back, gById.get(String(back.id)));
        }
    });

    test('malformed rows only with ?includeMalformed=true', async () => {
        const plain = await (await api(srv.baseUrl, '/v1/export/students.csv')).text();
        const withBad = await (await api(srv.baseUrl, '/v1/export/students.csv?includeMalformed=true')).text();
        assert.ok(!plain.includes('stu_9901'));
        assert.ok(withBad.includes('stu_9901') && withBad.includes('stu_9902'));
        const gBad = await (await api(srv.baseUrl, '/v1/export/guardians.csv?includeMalformed=true')).text();
        assert.ok(gBad.includes('gdn_9901,,Rakesh Gupta,father,12345,'));
    });
});

describe('slice 2-3 endpoints (v1 draft)', () => {
    test('HPC entries, attendance, assessments, events, meetings, incidents validate', async () => {
        const hpc = await getJson<{ data: unknown[] }>(srv.baseUrl, '/v1/hpc/entries?limit=200');
        for (const e of hpc.data) assert.ok(HpcEntrySchema.safeParse(e).success);
        const since = await crawl(srv.baseUrl, '/v1/hpc/entries', { since: '2026-09-20T00:00:00+05:30', limit: '200' });
        assert.ok(since.records.length > 0 && since.records.every((e) => Date.parse(String(e.updatedAt)) >= Date.parse('2026-09-20T00:00:00+05:30')));

        const att = await getJson<{ data: unknown[] }>(srv.baseUrl, `/v1/attendance?date=${srv.app.state.anchorDate}&limit=200`);
        assert.ok(att.data.length > 150);
        for (const r of att.data) assert.ok(AttendanceRecordSchema.safeParse(r).success);
        assert.equal((await api(srv.baseUrl, '/v1/attendance?date=2026-13-01')).status, 400);

        const asm = await getJson<{ data: unknown[] }>(srv.baseUrl, '/v1/assessments?limit=200');
        for (const r of asm.data) assert.ok(AssessmentRecordSchema.safeParse(r).success);

        const events = await crawl(srv.baseUrl, '/v1/events');
        for (const e of events.records) assert.ok(SchoolEventSchema.safeParse(e).success);
        assert.ok(events.records.some((e) => e.id === 'evt_ptm_7b_20261010'));
        SchoolEventSchema.parse(await getJson(srv.baseUrl, '/v1/events/evt_ptm_7b_20261010'));

        for (const m of (await crawl(srv.baseUrl, '/v1/meetings')).records) assert.ok(MeetingRequestSchema.safeParse(m).success);
        for (const i of (await crawl(srv.baseUrl, '/v1/incidents')).records) assert.ok(IncidentSchema.safeParse(i).success);
    });
});

describe('write-back', () => {
    const body = (overrides: Record<string, unknown> = {}) => ({
        externalId: 'call-abc-001',
        channel: 'voice_call',
        guardianId: 'gdn_0001',
        studentIds: [],
        purpose: 'ptm_invite',
        language: 'ne',
        outcome: 'answered',
        heardLevel: 'full',
        keysPressed: ['1'],
        occurredAt: '2026-10-05T05:00:00Z',
        ...overrides,
    });

    test('POST /v1/communications is idempotent by externalId', async () => {
        const before = srv.app.state.communications.length;
        const first = await api(srv.baseUrl, '/v1/communications', { method: 'POST', body: JSON.stringify(body()) });
        assert.equal(first.status, 201);
        const created = CommunicationSchema.parse(await first.json());
        const again = await api(srv.baseUrl, '/v1/communications', { method: 'POST', body: JSON.stringify(body({ outcome: 'no_answer' })) });
        assert.equal(again.status, 200);
        assert.deepEqual(await again.json(), created, 'the first write wins; a retry returns it unchanged');
        assert.equal(srv.app.state.communications.length, before + 1);
        const listed = await crawl(srv.baseUrl, '/v1/communications');
        assert.equal(listed.records.filter((c) => c.externalId === 'call-abc-001').length, 1);
    });

    test('POST /v1/communications validates its body', async () => {
        const bad = await api(srv.baseUrl, '/v1/communications', { method: 'POST', body: JSON.stringify({ externalId: 'x' }) });
        assert.equal(bad.status, 400);
        const notJson = await api(srv.baseUrl, '/v1/communications', { method: 'POST', body: '{nope' });
        assert.equal(notJson.status, 400);
        const unknown = await api(srv.baseUrl, '/v1/communications', { method: 'POST', body: JSON.stringify(body({ externalId: 'call-x', guardianId: 'gdn_4040' })) });
        assert.equal(unknown.status, 422);
        const extra = await api(srv.baseUrl, '/v1/communications', { method: 'POST', body: JSON.stringify(body({ externalId: 'call-y', transcript: 'no free text' })) });
        assert.equal(extra.status, 400);
    });

    test('POST /v1/events/{id}/rsvps upserts per guardian', async () => {
        const rsvp = (response: string) => ({ guardianId: 'gdn_0001', response, respondedAt: '2026-10-05T05:01:00Z' });
        const path = '/v1/events/evt_ptm_7b_20261010/rsvps';
        const first = await api(srv.baseUrl, path, { method: 'POST', body: JSON.stringify(rsvp('attending')) });
        assert.equal(first.status, 201);
        const created = RsvpSchema.parse(await first.json());
        const second = await api(srv.baseUrl, path, { method: 'POST', body: JSON.stringify(rsvp('not_attending')) });
        assert.equal(second.status, 200);
        const updated = RsvpSchema.parse(await second.json());
        assert.equal(updated.id, created.id);
        assert.equal(updated.response, 'not_attending');
        const listed = await crawl(srv.baseUrl, path);
        assert.equal(listed.records.length, 1);
        assert.equal((await api(srv.baseUrl, '/v1/events/evt_nope/rsvps', { method: 'POST', body: JSON.stringify(rsvp('attending')) })).status, 404);
        const closure = srv.app.state.planted.events.closure;
        assert.equal((await api(srv.baseUrl, `/v1/events/${closure}/rsvps`, { method: 'POST', body: JSON.stringify(rsvp('attending')) })).status, 409);
    });

    test('POST /v1/guardians/{id}/preferences sets doNotContact and bumps updatedAt', async () => {
        const g = srv.app.state.guardians.find((x) => !x.deleted && !x.doNotContact);
        assert.ok(g);
        const beforeAt = g.updatedAt;
        const res = await api(srv.baseUrl, `/v1/guardians/${g.id}/preferences`, { method: 'POST', body: JSON.stringify({ doNotContact: true }) });
        assert.equal(res.status, 200);
        const updated = CrmGuardianSchema.parse(await res.json());
        assert.equal(updated.doNotContact, true);
        assert.ok(Date.parse(updated.updatedAt) > Date.parse(beforeAt));
        const since = await crawl(srv.baseUrl, '/v1/guardians', { updatedSince: updated.updatedAt });
        assert.deepEqual(since.records.map((r) => r.id), [g.id]);
        assert.equal((await api(srv.baseUrl, `/v1/guardians/${g.id}/preferences`, { method: 'POST', body: JSON.stringify({ doNotContact: 'yes' }) })).status, 400);
        assert.equal((await api(srv.baseUrl, '/v1/guardians/gdn_4040/preferences', { method: 'POST', body: JSON.stringify({ doNotContact: true }) })).status, 404);
    });
});
