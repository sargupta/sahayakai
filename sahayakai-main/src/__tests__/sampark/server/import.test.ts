/** @jest-environment node */
/**
 * The CRM importer (plan §3.3, §4①②): every record validated independently,
 * failures quarantined with reasons, guardians of RECORD only, preferences
 * bootstrapped without overwriting office decisions, and no plaintext phone
 * number written anywhere.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { createCsvSource } from '@/lib/sampark/crm/csv-source';
import { runImport } from '@/lib/sampark/crm/import';
import { CSV_COLUMNS } from '@/lib/sampark/crm/schema';
import { decryptPhone, hashPhone } from '@/lib/sampark/phone';
import type { CrmSource, SamparkRepo } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SamparkSchool } from '@/types/sampark';

import { ADMIN, CRM_SCHOOL, crmConsent, crmGuardian, crmStudent, ORG, recordingRepo, setPhoneEnv, testClock } from './_helpers';

beforeAll(setPhoneEnv);

function school(): SamparkSchool {
    return {
        orgId: ORG,
        spokenName: { English: 'Hillview', Hindi: 'हिलव्यू', Bengali: 'হিলভিউ', Nepali: 'हिलभ्यू' },
        displayName: 'Hillview Demo School',
        mode: 'practice',
        isDemo: true,
        callingWindow: { startHour: 10, endHour: 19, offDays: [0] },
        holidays: ['2026-01-26'],
        venues: [],
        defaultLanguage: null,
        crm: { kind: 'rest', baseUrl: 'http://localhost:4700', apiKeySecretName: 'MOCK_CRM_API_KEY', lastImportAt: null, lastImportId: null },
        emergencyBypassConsent: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };
}

function source(students: unknown[], guardians: unknown[], schoolRecord: unknown = CRM_SCHOOL): CrmSource {
    return {
        kind: 'rest',
        fetchSchool: async () => schoolRecord,
        fetchStudents: async () => students,
        fetchGuardians: async () => guardians,
    };
}

async function setup(): Promise<SamparkRepo & { writes: { method: string; args: unknown[] }[] }> {
    const repo = recordingRepo(createMemorySamparkRepo());
    await repo.upsertSchool(school());
    return repo;
}

describe('runImport', () => {
    it('imports valid records, maps them to the snapshot, and refreshes holidays', async () => {
        const repo = await setup();
        const g1 = crmGuardian('g1', { preferredLanguage: 'bn', relation: 'father' });
        const run = await runImport(
            { repo, clock: testClock() },
            ORG,
            source([crmStudent('s1', { guardians: [{ guardianId: 'g1', isPrimary: true, isGuardianOfRecord: true }] })], [g1]),
            ADMIN,
        );
        expect(run).toMatchObject({ status: 'succeeded', source: 'rest', startedBy: ADMIN, error: null });
        expect(run.counts).toEqual({ students: 1, guardians: 1, rejected: 0, tombstoned: 0 });

        const [student] = await repo.listStudents(ORG);
        expect(student).toMatchObject({
            id: 's1',
            grade: 7,
            section: 'B',
            displayName: 'Student s1',
            guardianIds: ['g1'],
            active: true,
            spokenFirstName: { English: 'Asha', Hindi: 'आशा', Bengali: 'আশা', Nepali: 'आशा' },
        });
        const guardian = await repo.getGuardian(ORG, 'g1');
        expect(guardian).toMatchObject({ relation: 'father', crmLanguage: 'Bengali', phoneClass: 'synthetic', studentIds: ['s1'], active: true });
        expect(guardian!.phoneLast4).toBe(String(g1.phone).slice(-4));
        expect(guardian!.phoneHash).toBe(hashPhone(String(g1.phone)));
        expect(decryptPhone(guardian!.phoneEnc)).toBe(g1.phone);

        // H10: the CRM's holidays are merged with the school's own (here the pre-split list), never replacing them.
        const updated = await repo.getSchool(ORG);
        expect(updated!.holidays).toEqual(['2026-01-26', '2026-10-19', '2026-10-20']);
        expect(updated!.manualHolidays).toEqual(['2026-01-26']);
        expect(updated!.crmHolidays).toEqual(['2026-10-19', '2026-10-20']);
        expect(updated!.crm).toMatchObject({ lastImportId: run.id });
        await expect(repo.getLatestImportRun(ORG)).resolves.toMatchObject({ id: run.id, status: 'succeeded' });
    });

    it('quarantines malformed records with the first Zod issue and imports the rest', async () => {
        const repo = await setup();
        const run = await runImport(
            { repo, clock: testClock() },
            ORG,
            source(
                [
                    crmStudent('s1'),
                    crmStudent('s2', { grade: 14 }),
                    crmStudent('s3', { section: 'b' }),
                    crmStudent('s4', { guardians: [] }),
                    { fullName: 'no id at all' },
                ],
                [
                    crmGuardian('g-s1'),
                    crmGuardian('g-bad-phone', { phone: '98765' }),
                    crmGuardian('g-bad-lang', { preferredLanguage: 'fr' }),
                    crmGuardian('g-not-mobile', { phone: '+912212345678', synthetic: false }),
                ],
            ),
            ADMIN,
        );
        expect(run.status).toBe('succeeded');
        expect(run.counts).toMatchObject({ students: 1, guardians: 1, rejected: 7 });
        const reasons = Object.fromEntries(run.rejected.map((r) => [`${r.entity}:${r.crmId}`, r.reason]));
        expect(reasons['student:s2']).toMatch(/^grade: /);
        expect(reasons['student:s3']).toBe('section: section must be a single capital letter');
        expect(reasons['student:s4']).toBe('guardians: a student needs at least one guardian');
        expect(reasons['student:null']).toMatch(/^id: /);
        expect(reasons['guardian:g-bad-phone']).toBe('phone: phone must be E.164');
        expect(reasons['guardian:g-bad-lang']).toMatch(/^preferredLanguage: /);
        expect(reasons['guardian:g-not-mobile']).toBe('invalid phone');
        expect(run.rejected.every((r) => r.row === null)).toBe(true);
        expect((await repo.listStudents(ORG)).map((s) => s.id)).toEqual(['s1']);
    });

    it('never writes a plaintext number anywhere (guardians, runs, rejects, audit, preferences)', async () => {
        const repo = await setup();
        const guardians = [crmGuardian('g-s1'), crmGuardian('g-invalid', { phone: '+912212345678', synthetic: false })];
        await runImport({ repo, clock: testClock() }, ORG, source([crmStudent('s1')], guardians), ADMIN);
        const written = JSON.stringify(repo.writes);
        expect(written).not.toContain('+915');
        for (const g of guardians) {
            expect(written).not.toContain(String(g.phone));
            expect(written).not.toContain(String(g.phone).slice(3)); // without the +91 prefix
        }
    });

    it('bundles on guardians of RECORD: a step-parent on file is not linked', async () => {
        const repo = await setup();
        await runImport(
            { repo, clock: testClock() },
            ORG,
            source(
                [
                    crmStudent('s1', { guardians: [{ guardianId: 'mum', isPrimary: true, isGuardianOfRecord: true }] }),
                    crmStudent('s2', {
                        grade: 3,
                        guardians: [
                            { guardianId: 'mum', isPrimary: true, isGuardianOfRecord: true },
                            { guardianId: 'step', isPrimary: false, isGuardianOfRecord: false },
                        ],
                    }),
                    crmStudent('s3', { guardians: [{ guardianId: 'step', isPrimary: true, isGuardianOfRecord: true }] }),
                ],
                [crmGuardian('mum'), crmGuardian('step', { relation: 'guardian' })],
            ),
            ADMIN,
        );
        const byId = new Map((await repo.listStudents(ORG)).map((s) => [s.id, s]));
        expect(byId.get('s2')!.guardianIds).toEqual(['mum']);
        expect((await repo.getGuardian(ORG, 'mum'))!.studentIds.sort()).toEqual(['s1', 's2']);
        expect((await repo.getGuardian(ORG, 'step'))!.studentIds).toEqual(['s3']);
    });

    it('drops links to guardians that were rejected, and keeps the student', async () => {
        const repo = await setup();
        await runImport(
            { repo, clock: testClock() },
            ORG,
            source([crmStudent('s1', { guardians: [{ guardianId: 'gone', isPrimary: true, isGuardianOfRecord: true }] })], [crmGuardian('gone', { phone: 'x' })]),
            ADMIN,
        );
        const [s1] = await repo.listStudents(ORG);
        expect(s1.guardianIds).toEqual([]);
    });

    it('marks tombstoned records inactive', async () => {
        const repo = await setup();
        await runImport({ repo, clock: testClock() }, ORG, source([crmStudent('s1'), crmStudent('s2', { guardians: [{ guardianId: 'g-s1', isPrimary: true, isGuardianOfRecord: true }] })], [crmGuardian('g-s1'), crmGuardian('g-s2')]), ADMIN);
        const run = await runImport(
            { repo, clock: testClock() },
            ORG,
            source([crmStudent('s1'), { id: 's2', deleted: true, updatedAt: '2026-09-02T10:00:00+05:30' }], [crmGuardian('g-s1'), { id: 'g-s2', deleted: true }]),
            ADMIN,
        );
        expect(run.counts.tombstoned).toBe(2);
        const students = new Map((await repo.listStudents(ORG)).map((s) => [s.id, s]));
        expect(students.get('s1')!.active).toBe(true);
        expect(students.get('s2')!.active).toBe(false);
        expect((await repo.getGuardian(ORG, 'g-s2'))!.active).toBe(false);
    });

    it('honours a CRM "synthetic" flag even for a mobile-looking number, and CRM do-not-contact', async () => {
        const repo = await setup();
        await runImport(
            { repo, clock: testClock() },
            ORG,
            source([crmStudent('s1')], [crmGuardian('g-s1', { phone: '+919812345678', synthetic: true, doNotContact: true })]),
            ADMIN,
        );
        expect(await repo.getGuardian(ORG, 'g-s1')).toMatchObject({ phoneClass: 'synthetic', crmDoNotContact: true });
    });

    it('bootstraps preferences from CRM consent and never overwrites an office decision', async () => {
        const repo = await setup();
        const clock = testClock();
        const g = crmGuardian('g-s1', {
            consent: { notices: crmConsent('granted'), progress: crmConsent('denied'), recordedConversation: null, hpcInput: null },
        });
        await runImport({ repo, clock }, ORG, source([crmStudent('s1')], [g]), ADMIN);
        let prefs = (await repo.getPreferences(ORG, ['g-s1'])).get('g-s1')!;
        expect(prefs.language).toBeNull();
        expect(prefs.consent.notices).toMatchObject({ status: 'granted', source: 'crm', noticeVersion: 'dpdp-v1' });
        expect(prefs.consent.progress).toMatchObject({ status: 'denied', source: 'crm' });
        expect(prefs.consent.recorded_conversation).toMatchObject({ status: 'unknown', source: 'crm' });

        // The office records a denial and a language; the CRM later says granted.
        await repo.upsertPreferences([
            {
                ...prefs,
                language: 'Hindi',
                consent: { ...prefs.consent, notices: { status: 'denied', noticeVersion: null, language: 'Hindi', recordedAt: '2026-09-10T00:00:00.000Z', source: 'office' } },
                updatedBy: ADMIN,
            },
        ]);
        const g2 = crmGuardian('g-s1', {
            phone: g.phone,
            consent: { notices: crmConsent('granted'), progress: crmConsent('granted'), recordedConversation: null, hpcInput: null },
        });
        await runImport({ repo, clock }, ORG, source([crmStudent('s1')], [g2]), ADMIN);
        prefs = (await repo.getPreferences(ORG, ['g-s1'])).get('g-s1')!;
        expect(prefs.language).toBe('Hindi');
        expect(prefs.consent.notices).toMatchObject({ status: 'denied', source: 'office' });
        // A group the CRM still owns follows the CRM.
        expect(prefs.consent.progress).toMatchObject({ status: 'granted', source: 'crm' });
    });

    it('records a failed run with a safe error when the source throws', async () => {
        const repo = await setup();
        const failing: CrmSource = {
            kind: 'rest',
            fetchSchool: async () => {
                throw Object.assign(new Error('CRM responded 401 for /v1/school'), { name: 'CrmFetchError' });
            },
            fetchStudents: async () => [],
            fetchGuardians: async () => [],
        };
        const run = await runImport({ repo, clock: testClock() }, ORG, failing, ADMIN);
        expect(run).toMatchObject({ status: 'failed', error: 'CRM responded 401 for /v1/school' });
        const internal: CrmSource = { ...failing, fetchSchool: async () => { throw new Error('socket hang up at 10.0.0.3'); } };
        const run2 = await runImport({ repo, clock: testClock() }, ORG, internal, ADMIN);
        expect(run2.error).toBe('Import failed');
    });

    it('refuses a school that has not enabled Sampark', async () => {
        const repo = createMemorySamparkRepo();
        await expect(runImport({ repo, clock: testClock() }, 'nobody', source([], []), ADMIN)).rejects.toThrow(/not enabled/);
    });

    it('imports the same records from CSV, with row numbers on quarantined rows', async () => {
        const repo = await setup();
        const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
        const studentsCsv = [
            CSV_COLUMNS.students.join(','),
            ['s1', '', 'ADM-1', '', 'Asha Rai', 'Asha', 'आशा', 'আশা', 'आशा', '7', 'B', '1', 'female', 'regular', 'false', '', '', 'active', 'g1:true:true', '2026-09-01T10:00:00+05:30'].map(esc).join(','),
            ['s2', '', 'ADM-2', '', 'Bad Grade', '', '', '', '', 'seven', 'B', '2', 'male', 'regular', 'false', '', '', 'active', 'g1:true:true', '2026-09-01T10:00:00+05:30'].map(esc).join(','),
        ].join('\r\n');
        const guardiansCsv = [
            CSV_COLUMNS.guardians.join(','),
            ['g1', '', 'Sita Rai', 'mother', '+915000000077', 'ne', 'granted;2026-06-01T10:00:00+05:30;admission_form;dpdp-v1', '', '', '', 'false', 'true', '2026-09-01T10:00:00+05:30'].map(esc).join(','),
            'g2,,Truncated',
        ].join('\r\n');
        const run = await runImport({ repo, clock: testClock() }, ORG, createCsvSource({ studentsCsv, guardiansCsv }), ADMIN);
        expect(run).toMatchObject({ status: 'succeeded', source: 'csv', counts: { students: 1, guardians: 1, rejected: 2 } });
        expect(run.rejected).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ entity: 'student', crmId: 's2', row: 2, reason: expect.stringMatching(/^grade: /) }),
                expect.objectContaining({ entity: 'guardian', crmId: 'g2', row: 2, reason: 'expected 13 cells, found 3' }),
            ]),
        );
        // CSV has no school record: holidays are left as they were.
        expect((await repo.getSchool(ORG))!.holidays).toEqual(['2026-01-26']);
        expect(JSON.stringify(repo.writes)).not.toContain('+915000000077');
    });
    it('records the primary guardians of record for each child (H6), ignoring a primary link that is not of record', async () => {
        const repo = await setup();
        await runImport(
            { repo, clock: testClock() },
            ORG,
            source(
                [
                    crmStudent('s1', {
                        guardians: [
                            { guardianId: 'mum', isPrimary: true, isGuardianOfRecord: true },
                            { guardianId: 'dad', isPrimary: false, isGuardianOfRecord: true },
                            { guardianId: 'step', isPrimary: true, isGuardianOfRecord: false },
                        ],
                    }),
                    crmStudent('s2', { guardians: [{ guardianId: 'dad', isPrimary: false, isGuardianOfRecord: true }] }),
                ],
                [crmGuardian('mum'), crmGuardian('dad', { relation: 'father' }), crmGuardian('step', { relation: 'guardian' })],
            ),
            ADMIN,
        );
        const byId = new Map((await repo.listStudents(ORG)).map((s) => [s.id, s]));
        expect(byId.get('s1')).toMatchObject({ guardianIds: ['mum', 'dad'], primaryGuardianIds: ['mum'] });
        expect(byId.get('s2')).toMatchObject({ guardianIds: ['dad'], primaryGuardianIds: [] });
    });
});

// ── H6: a child who left is inactive after a full CSV import ────────────────

describe('runImport — absence from a full export (H6)', () => {
    const esc = (v: string) => (/[",\n|]/.test(v) && !v.includes(':') ? `"${v.replace(/"/g, '""')}"` : v);
    const studentRow = (id: string, guardianId: string) =>
        [id, '', `ADM-${id}`, '', `Student ${id}`, 'Asha', '', '', '', '7', 'B', '1', 'female', 'regular', 'false', '', '', 'active', `${guardianId}:true:true`, '2026-09-01T10:00:00+05:30'].map(esc).join(',');
    const guardianRow = (id: string, phone: string) =>
        [id, '', `Guardian ${id}`, 'mother', phone, 'ne', 'granted;2026-06-01T10:00:00+05:30;admission_form;dpdp-v1', '', '', '', 'false', 'true', '2026-09-01T10:00:00+05:30'].map(esc).join(',');
    const csv = (students: string[], guardians: string[]) =>
        createCsvSource({
            studentsCsv: [CSV_COLUMNS.students.join(','), ...students].join('\r\n'),
            guardiansCsv: [CSV_COLUMNS.guardians.join(','), ...guardians].join('\r\n'),
        });
    const PHONES = { g1: '+915000000101', g2: '+915000000102', g3: '+915000000103' };

    /** Three families imported from a full CSV export. */
    async function seeded() {
        const repo = await setup();
        const run = await runImport(
            { repo, clock: testClock() },
            ORG,
            csv([studentRow('s1', 'g1'), studentRow('s2', 'g2'), studentRow('s3', 'g3')], [guardianRow('g1', PHONES.g1), guardianRow('g2', PHONES.g2), guardianRow('g3', PHONES.g3)]),
            ADMIN,
        );
        expect(run.status).toBe('succeeded');
        return repo;
    }

    const activeIds = async (repo: SamparkRepo) => ({
        students: (await repo.listStudents(ORG)).filter((s) => s.active).map((s) => s.id),
        guardians: (await repo.listGuardians(ORG)).filter((g) => g.active).map((g) => g.id),
    });

    it('a student or guardian missing from the next CSV export is marked inactive, and counted as tombstoned', async () => {
        const repo = await seeded();
        // s2 left the school; their guardian g2 is no longer in the guardians export either.
        const run = await runImport({ repo, clock: testClock() }, ORG, csv([studentRow('s1', 'g1'), studentRow('s3', 'g3')], [guardianRow('g1', PHONES.g1), guardianRow('g3', PHONES.g3)]), ADMIN);
        expect(run).toMatchObject({ status: 'succeeded', counts: { students: 2, guardians: 2, tombstoned: 2 } });
        expect(await activeIds(repo)).toEqual({ students: ['s1', 's3'], guardians: ['g1', 'g3'] });
        // Through the tombstone path: the record is kept, only made inactive.
        expect((await repo.listStudents(ORG)).find((s) => s.id === 's2')).toMatchObject({ active: false, guardianIds: ['g2'] });
        const audit = repo.writes.filter((w) => w.method === 'appendAudit').map((w) => w.args[1] as { action: string; detail: Record<string, unknown> });
        expect(audit[audit.length - 1].detail).toMatchObject({ absentMarkedInactive: { students: 1, guardians: 1 }, absenceSkipped: [] });
    });

    it('a guardian absent from the export loses the link from a child who is still there', async () => {
        const repo = await seeded();
        // s2 now lists g1 (the family's other record); g2 is gone from the export.
        await runImport({ repo, clock: testClock() }, ORG, csv([studentRow('s1', 'g1'), studentRow('s2', 'g1'), studentRow('s3', 'g3')], [guardianRow('g1', PHONES.g1), guardianRow('g3', PHONES.g3)]), ADMIN);
        expect(await activeIds(repo)).toEqual({ students: ['s1', 's2', 's3'], guardians: ['g1', 'g3'] });
        expect((await repo.listStudents(ORG)).find((s) => s.id === 's2')!.guardianIds).toEqual(['g1']);
    });

    it('a child who comes back in a later export is active again', async () => {
        const repo = await seeded();
        await runImport({ repo, clock: testClock() }, ORG, csv([studentRow('s1', 'g1'), studentRow('s3', 'g3')], [guardianRow('g1', PHONES.g1), guardianRow('g2', PHONES.g2), guardianRow('g3', PHONES.g3)]), ADMIN);
        expect((await activeIds(repo)).students).toEqual(['s1', 's3']);
        await runImport({ repo, clock: testClock() }, ORG, csv([studentRow('s1', 'g1'), studentRow('s2', 'g2'), studentRow('s3', 'g3')], [guardianRow('g1', PHONES.g1), guardianRow('g2', PHONES.g2), guardianRow('g3', PHONES.g3)]), ADMIN);
        expect((await activeIds(repo)).students).toEqual(['s1', 's2', 's3']);
    });

    it('a quarantined row that still carries its id counts as present: a malformed record is not a child who left', async () => {
        const repo = await seeded();
        const badGrade = studentRow('s2', 'g2').replace(',7,B,', ',seven,B,');
        const run = await runImport({ repo, clock: testClock() }, ORG, csv([studentRow('s1', 'g1'), badGrade, studentRow('s3', 'g3')], [guardianRow('g1', PHONES.g1), guardianRow('g2', PHONES.g2), guardianRow('g3', PHONES.g3)]), ADMIN);
        expect(run.counts).toMatchObject({ rejected: 1, tombstoned: 0 });
        expect((await activeIds(repo)).students).toEqual(['s1', 's2', 's3']);
    });

    it('a file that cannot be trusted as the whole list marks nobody inactive: a row without a usable id, or no valid row at all', async () => {
        const repo = await seeded();
        // A row of the wrong shape (its first cell may not be an id) in the students file.
        let run = await runImport({ repo, clock: testClock() }, ORG, csv([studentRow('s1', 'g1'), 'truncated,,row'], [guardianRow('g1', PHONES.g1), guardianRow('g2', PHONES.g2), guardianRow('g3', PHONES.g3)]), ADMIN);
        expect(run.counts.tombstoned).toBe(0);
        // An empty guardians file (header only) next to a good students file.
        run = await runImport({ repo, clock: testClock() }, ORG, csv([studentRow('s1', 'g1'), studentRow('s2', 'g2'), studentRow('s3', 'g3')], []), ADMIN);
        expect(run.counts.tombstoned).toBe(0);
        expect(await activeIds(repo)).toEqual({ students: ['s1', 's2', 's3'], guardians: ['g1', 'g2', 'g3'] });
        const audit = repo.writes.filter((w) => w.method === 'appendAudit').map((w) => w.args[1] as { detail: Record<string, unknown> });
        expect(audit[audit.length - 1].detail).toMatchObject({ absenceSkipped: ['guardians'] });
    });

    it('a REST pull never tombstones by absence: a record it does not list stays as it was', async () => {
        const repo = await setup();
        await runImport({ repo, clock: testClock() }, ORG, source([crmStudent('s1'), crmStudent('s2')], [crmGuardian('g-s1'), crmGuardian('g-s2')]), ADMIN);
        const run = await runImport({ repo, clock: testClock() }, ORG, source([crmStudent('s1')], [crmGuardian('g-s1')]), ADMIN);
        expect(run.counts.tombstoned).toBe(0);
        expect(await activeIds(repo)).toEqual({ students: ['s1', 's2'], guardians: ['g-s1', 'g-s2'] });
    });

    it('a REST pull asks for everything (updatedSince null), so an incremental page can never be read as the whole school', async () => {
        const repo = await setup();
        const asked: (string | null)[] = [];
        const spy: CrmSource = {
            kind: 'rest',
            fetchSchool: async () => null,
            fetchStudents: async (since) => {
                asked.push(since);
                return [crmStudent('s1')];
            },
            fetchGuardians: async (since) => {
                asked.push(since);
                return [crmGuardian('g-s1')];
            },
        };
        await runImport({ repo, clock: testClock() }, ORG, spy, ADMIN);
        expect(asked).toEqual([null, null]);
    });
});
