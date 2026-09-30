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

        const updated = await repo.getSchool(ORG);
        expect(updated!.holidays).toEqual(['2026-10-19', '2026-10-20']);
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
});
