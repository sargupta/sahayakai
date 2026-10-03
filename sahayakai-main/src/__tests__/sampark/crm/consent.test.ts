/** @jest-environment node */
/**
 * The consent list (R2-4d): from the feed or a consent CSV, applied per guardian per purpose group, with the
 * row-level rejection report. END TO END: a consenting guardian proceeds through import -> audience, a
 * non-consenting one stays blocked by the policy gate.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { applyConsentRows, CrmConsentRowSchema, type ConsentTarget } from '@/lib/sampark/crm/consent';
import { consentCsvToRows, createCsvSource } from '@/lib/sampark/crm/csv-source';
import { CsvParseError } from '@/lib/sampark/crm/csv';
import { runImport } from '@/lib/sampark/crm/import';
import { CrmGuardianSchema, CrmStudentSchema, CSV_COLUMNS, type CrmGuardian, type CrmStudent } from '@/lib/sampark/crm/schema';
import type { CrmSource } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SamparkSchool } from '@/types/sampark';

import { campaign as engineCampaign } from '../engine/_fixtures';
import { ADMIN, CRM_SCHOOL, crmConsent, crmGuardian, crmStudent, ORG, setPhoneEnv, testClock } from '../server/_helpers';

beforeAll(setPhoneEnv);

const T1 = '2026-06-01T10:00:00+05:30';
const T2 = '2026-07-01T10:00:00+05:30';

function parsedGuardian(id: string, phone: string, consent: Partial<CrmGuardian['consent']> = {}): ConsentTarget {
    const g = CrmGuardianSchema.parse(crmGuardian(id, { phone, consent: { notices: null, progress: null, recordedConversation: null, hpcInput: null, ...consent } }));
    return { crm: g, e164: phone };
}
function parsedStudent(id: string, admissionNo: string, links: CrmStudent['guardians']): CrmStudent {
    return CrmStudentSchema.parse(crmStudent(id, { admissionNo, guardians: links }));
}
const link = (guardianId: string, isPrimary = true, isGuardianOfRecord = true) => ({ guardianId, isPrimary, isGuardianOfRecord });

describe('consent CSV', () => {
    const header = 'guardian,phone,studentAdmissionNo,purposeGroup,status,recordedAt,method,noticeVersion';

    it('maps rows with empty cells to nulls and numbers every row', () => {
        const rows = consentCsvToRows(`${header}\r\ng1,,,notices,granted,${T1},office,v1\r\n,+915000000002,,progress,denied,,,\r\n`);
        expect(rows).toEqual([
            { guardian: 'g1', phone: null, studentAdmissionNo: null, purposeGroup: 'notices', status: 'granted', recordedAt: T1, method: 'office', noticeVersion: 'v1', __csvRow: 1 },
            { guardian: null, phone: '+915000000002', studentAdmissionNo: null, purposeGroup: 'progress', status: 'denied', recordedAt: null, method: null, noticeVersion: null, __csvRow: 2 },
        ]);
    });

    it('accepts the header aliases guardianId and admissionNo', () => {
        const rows = consentCsvToRows('guardianId,admissionNo,purposeGroup,status\ng1,A1,notices,granted\n');
        expect(rows[0]).toMatchObject({ guardian: 'g1', studentAdmissionNo: 'A1' });
    });

    it('a wrong cell count quarantines that row only; a missing required or identifier column fails the file', () => {
        const rows = consentCsvToRows(`${header}\ng1,,,notices,granted\ng2,,,notices,granted,,,\n`);
        expect(rows[0]).toMatchObject({ __csvRow: 1, __csvError: 'expected 8 cells, found 5' });
        expect(rows[1]).toMatchObject({ guardian: 'g2' });
        expect(() => consentCsvToRows('guardian,phone\ng1,+91\n')).toThrow(CsvParseError);
        expect(() => consentCsvToRows('purposeGroup,status,recordedAt\nnotices,granted,\n')).toThrow(/guardian, phone or studentAdmissionNo/);
    });
});

describe('applyConsentRows', () => {
    function world() {
        const guardians = new Map<string, ConsentTarget>([
            ['g1', parsedGuardian('g1', '+915000000001')],
            ['g2', parsedGuardian('g2', '+915000000002')],
            ['g3', parsedGuardian('g3', '+915000000002')], // shares a phone with g2
        ]);
        const students = new Map<string, CrmStudent>([
            ['s1', parsedStudent('s1', 'A-100', [link('g1', true, true), link('g2', false, true)])],
            ['s2', parsedStudent('s2', 'A-200', [link('g3', true, false)])], // primary is not of record
            ['s3', parsedStudent('s3', 'A-300', [link('g1')])],
            ['s4', parsedStudent('s4', 'A-300', [link('g2')])], // duplicate admission number
        ]);
        return { guardians, students };
    }
    const row = (over: Record<string, unknown>, n = 1) => ({ purposeGroup: 'notices', status: 'granted', recordedAt: T1, method: 'office', noticeVersion: 'v1', __csvRow: n, ...over });

    it('resolves by guardian id, then phone, then admission number (primary guardian of record only)', () => {
        const { guardians, students } = world();
        const out = applyConsentRows(
            [row({ guardian: 'g1' }), row({ phone: '+915000000001', purposeGroup: 'progress' }), row({ studentAdmissionNo: 'A-100', purposeGroup: 'hpc_input' })],
            guardians,
            students,
        );
        expect(out).toEqual({ rejected: [], applied: 3 });
        expect(guardians.get('g1')!.crm.consent).toMatchObject({
            notices: { status: 'granted', recordedAt: T1, method: 'office', noticeVersion: 'v1' },
            progress: { status: 'granted' },
            hpcInput: { status: 'granted' },
            recordedConversation: null,
        });
        // the admission number named s1's PRIMARY guardian (g1), never the other guardian on file (g2)
        expect(guardians.get('g2')!.crm.consent.hpcInput).toBeNull();
    });

    it('accepts the camelCase group names and normalises a spaced local phone', () => {
        const { guardians, students } = world();
        applyConsentRows([row({ guardian: 'g1', purposeGroup: 'recordedConversation' }), row({ phone: '+91 5000000001', purposeGroup: 'hpcInput' })], guardians, students);
        expect(guardians.get('g1')!.crm.consent.recordedConversation?.status).toBe('granted');
        expect(guardians.get('g1')!.crm.consent.hpcInput?.status).toBe('granted');
    });

    it('rejects, with a reason and the row number, every row it cannot place — never guessing', () => {
        const { guardians, students } = world();
        const out = applyConsentRows(
            [
                row({ guardian: 'nobody' }, 1),
                row({ phone: '+915000000002' }, 2), // two guardians share it
                row({ phone: '+915999999999' }, 3),
                row({ studentAdmissionNo: 'A-300' }, 4), // two students
                row({ studentAdmissionNo: 'A-404' }, 5),
                row({ studentAdmissionNo: 'A-200' }, 6), // primary not of record
                row({ guardian: 'g1', status: 'maybe' }, 7),
                row({ guardian: 'g1', purposeGroup: 'marketing' }, 8),
                row({ guardian: 'g1', recordedAt: 'yesterday' }, 9),
                row({}, 10),
                { __csvRow: 11, __csvError: 'expected 8 cells, found 5' },
            ],
            guardians,
            students,
        );
        expect(out.applied).toBe(0);
        expect(out.rejected.map((r) => [r.row, r.entity, r.reason])).toEqual([
            [1, 'consent', 'no matching guardian in this import'],
            [2, 'consent', 'phone matches more than one guardian; give the guardian id'],
            [3, 'consent', 'no matching guardian in this import'],
            [4, 'consent', 'admission number matches more than one student'],
            [5, 'consent', 'no student with that admission number in this import'],
            [6, 'consent', 'student has no primary guardian of record in this import'],
            [7, 'consent', expect.stringMatching(/^status:/)],
            [8, 'consent', expect.stringMatching(/^purposeGroup:/)],
            [9, 'consent', expect.stringMatching(/^recordedAt:/)],
            [10, 'consent', expect.stringMatching(/names no guardian/)],
            [11, 'consent', 'expected 8 cells, found 5'],
        ]);
        for (const g of guardians.values()) expect(Object.values(g.crm.consent).every((c) => c === null)).toBe(true);
    });

    it('a newer record wins, an older one does not, and equal dates fail closed (denied beats granted)', () => {
        const { guardians, students } = world();
        applyConsentRows([row({ guardian: 'g1', status: 'denied', recordedAt: T2 }), row({ guardian: 'g1', status: 'granted', recordedAt: T1 })], guardians, students);
        expect(guardians.get('g1')!.crm.consent.notices?.status).toBe('denied');

        const tie = world();
        applyConsentRows([row({ guardian: 'g1', status: 'granted', recordedAt: T1 }), row({ guardian: 'g1', status: 'denied', recordedAt: T1 })], tie.guardians, tie.students);
        expect(tie.guardians.get('g1')!.crm.consent.notices?.status).toBe('denied');
        const tie2 = world();
        applyConsentRows([row({ guardian: 'g1', status: 'denied', recordedAt: T1 }), row({ guardian: 'g1', status: 'granted', recordedAt: T1 })], tie2.guardians, tie2.students);
        expect(tie2.guardians.get('g1')!.crm.consent.notices?.status).toBe('denied');
    });

    it('against the feed\'s own consent: newer list row replaces, older list row is ignored', () => {
        const guardians = new Map<string, ConsentTarget>([['g1', parsedGuardian('g1', '+915000000001', { notices: { status: 'granted', recordedAt: T2, method: 'app', noticeVersion: 'v2' } })]]);
        applyConsentRows([row({ guardian: 'g1', status: 'denied', recordedAt: T1 })], guardians, new Map());
        expect(guardians.get('g1')!.crm.consent.notices).toMatchObject({ status: 'granted', noticeVersion: 'v2' });
        applyConsentRows([row({ guardian: 'g1', status: 'denied', recordedAt: '2026-08-01T00:00:00+05:30' })], guardians, new Map());
        expect(guardians.get('g1')!.crm.consent.notices?.status).toBe('denied');
    });

    it('a row with no date is older than any dated record', () => {
        const guardians = new Map<string, ConsentTarget>([['g1', parsedGuardian('g1', '+915000000001', { notices: crmConsent('denied') as CrmGuardian['consent']['notices'] })]]);
        applyConsentRows([row({ guardian: 'g1', status: 'granted', recordedAt: null })], guardians, new Map());
        expect(guardians.get('g1')!.crm.consent.notices?.status).toBe('denied');
    });

    it('the row schema requires an identifier', () => {
        expect(CrmConsentRowSchema.safeParse({ purposeGroup: 'notices', status: 'granted' }).success).toBe(false);
        expect(CrmConsentRowSchema.safeParse({ guardian: 'g1', purposeGroup: 'notices', status: 'granted' }).success).toBe(true);
    });
});

// ── End to end: import → audience → gate ────────────────────────────────────

function school(): SamparkSchool {
    return {
        orgId: ORG,
        spokenName: { English: 'Hillview', Hindi: 'हिलव्यू', Bengali: 'হিলভিউ', Nepali: 'हिलभ्यू' },
        displayName: 'Hillview Demo School',
        mode: 'practice',
        isDemo: true,
        callingWindow: { startHour: 10, endHour: 20, offDays: [0] },
        holidays: [],
        venues: [],
        defaultLanguage: null,
        crm: { kind: 'rest', baseUrl: 'http://localhost:4700', apiKeySecretName: 'MOCK_CRM_API_KEY', lastImportAt: null, lastImportId: null },
        emergencyBypassConsent: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };
}

const noConsent = { notices: null, progress: null, recordedConversation: null, hpcInput: null };
function family(n: number, consent = noConsent) {
    return {
        student: crmStudent(`s${n}`, { admissionNo: `ADM-${n}`, guardians: [{ guardianId: `g${n}`, isPrimary: true, isGuardianOfRecord: true }] }),
        guardian: crmGuardian(`g${n}`, { phone: `+91500000000${n}`, consent }),
    };
}

async function importAndAudience(source: CrmSource) {
    const repo = createMemorySamparkRepo();
    const clock = testClock();
    await repo.upsertSchool(school());
    const run = await runImport({ repo, clock }, ORG, source, ADMIN);
    const camp = engineCampaign();
    await repo.createCampaign(camp);
    const res = await materialiseCampaignIntents({ repo, clock }, camp, school(), 'simulated');
    const intents = await repo.listIntentsByCampaign(ORG, camp.id);
    const byGuardian = Object.fromEntries(intents.map((i) => [i.guardianId, i.status === 'blocked' ? `blocked:${i.blockReason}` : i.status]));
    return { run, res, byGuardian, repo };
}

describe('END TO END: a guardian without consent stays blocked, a consenting one proceeds', () => {
    // g1 consents via the list, g2 denies via the list, g3 is never mentioned, g4 consents only for `progress`.
    const fam = [family(1), family(2), family(3), family(4)];
    const feedRows = [
        { guardian: 'g1', purposeGroup: 'notices', status: 'granted', recordedAt: T1, method: 'office', noticeVersion: 'v1' },
        { guardian: 'g2', purposeGroup: 'notices', status: 'denied', recordedAt: T1, method: 'office', noticeVersion: 'v1' },
        { phone: '+915000000004', purposeGroup: 'progress', status: 'granted', recordedAt: T1, method: 'app', noticeVersion: 'v1' },
        { guardian: 'ghost', purposeGroup: 'notices', status: 'granted', recordedAt: T1 },
    ];
    const expected = { g1: 'approved', g2: 'blocked:consent_denied', g3: 'blocked:no_consent', g4: 'blocked:no_consent' };

    it('consent list from the feed (an MCP tool or REST endpoint)', async () => {
        const source: CrmSource = {
            kind: 'mcp',
            fetchSchool: async () => CRM_SCHOOL,
            fetchStudents: async () => fam.map((f) => f.student),
            fetchGuardians: async () => fam.map((f) => f.guardian),
            fetchConsent: async () => feedRows,
        };
        const { run, byGuardian, repo } = await importAndAudience(source);
        expect(run).toMatchObject({ status: 'succeeded', source: 'mcp' });
        expect(run.rejected).toEqual([{ entity: 'consent', crmId: 'ghost', row: null, reason: 'no matching guardian in this import' }]);
        expect(byGuardian).toEqual(expected);
        // The registry holds what the list said, tagged as CRM-sourced.
        const prefs = await repo.getPreferences(ORG, ['g1', 'g2', 'g3', 'g4']);
        expect(prefs.get('g1')!.consent.notices).toMatchObject({ status: 'granted', source: 'crm', noticeVersion: 'v1' });
        expect(prefs.get('g2')!.consent.notices.status).toBe('denied');
        expect(prefs.get('g3')!.consent.notices.status).toBe('unknown');
        expect(prefs.get('g4')!.consent.progress.status).toBe('granted');
        expect(prefs.get('g4')!.consent.notices.status).toBe('unknown');
    });

    it('consent list from a consent CSV, with the same rejection report (row numbers)', async () => {
        const csvLine = (cols: readonly string[], v: Record<string, string>) => cols.map((c) => v[c] ?? '').join(',');
        const studentsCsv = [CSV_COLUMNS.students.join(','), ...fam.map((f) => csvLine(CSV_COLUMNS.students, {
            id: f.student.id as string, admissionNo: f.student.admissionNo as string, fullName: f.student.fullName as string,
            'spokenFirstName.en': 'Asha', grade: '7', section: 'B', rollNo: '1', gender: 'female', feeCategory: 'regular', boarding: 'false',
            status: 'active', guardians: `${(f.student.guardians as { guardianId: string }[])[0]!.guardianId}:true:true`, updatedAt: '2026-09-01T10:00:00+05:30',
        }))].join('\n');
        const guardiansCsv = [CSV_COLUMNS.guardians.join(','), ...fam.map((f) => csvLine(CSV_COLUMNS.guardians, {
            id: f.guardian.id as string, fullName: f.guardian.fullName as string, relation: 'mother', phone: f.guardian.phone as string, preferredLanguage: 'ne',
            doNotContact: 'false', synthetic: 'true', updatedAt: '2026-09-01T10:00:00+05:30',
        }))].join('\n');
        const consentCsv = [
            'guardian,phone,studentAdmissionNo,purposeGroup,status,recordedAt,method,noticeVersion',
            `g1,,,notices,granted,${T1},office,v1`,
            `,,ADM-2,notices,denied,${T1},office,v1`,
            `,+915000000004,,progress,granted,${T1},app,v1`,
            `ghost,,,notices,granted,${T1},,`,
            `g1,,,notices`,
        ].join('\n');
        const { run, byGuardian } = await importAndAudience(createCsvSource({ studentsCsv, guardiansCsv, consentCsv }));
        expect(run.status).toBe('succeeded');
        expect(run.rejected).toEqual([
            { entity: 'consent', crmId: 'ghost', row: 4, reason: 'no matching guardian in this import' },
            { entity: 'consent', crmId: null, row: 5, reason: 'expected 8 cells, found 4' },
        ]);
        expect(run.counts.rejected).toBe(2);
        expect(byGuardian).toEqual(expected);
    });

    it('with NO consent list the guardians\' own consent decides (unchanged behaviour)', async () => {
        const f1 = family(1, { notices: crmConsent('granted') as never, progress: null, recordedConversation: null, hpcInput: null });
        const source: CrmSource = { kind: 'rest', fetchSchool: async () => CRM_SCHOOL, fetchStudents: async () => [f1.student, family(2).student], fetchGuardians: async () => [f1.guardian, family(2).guardian] };
        const { byGuardian } = await importAndAudience(source);
        expect(byGuardian).toEqual({ g1: 'approved', g2: 'blocked:no_consent' });
    });

    it('a consent list that cannot be fetched fails the import loudly instead of importing with stale consent', async () => {
        const source: CrmSource = {
            kind: 'mcp',
            fetchSchool: async () => null,
            fetchStudents: async () => [],
            fetchGuardians: async () => [],
            fetchConsent: async () => {
                const e = new Error('consent tool failed');
                e.name = 'CrmFetchError';
                throw e;
            },
        };
        const { run } = await importAndAudience(source);
        expect(run).toMatchObject({ status: 'failed', error: 'consent tool failed' });
    });

    it('close() is called once per run, success or failure', async () => {
        const close = jest.fn(async () => undefined);
        await importAndAudience({ kind: 'mcp', fetchSchool: async () => null, fetchStudents: async () => [], fetchGuardians: async () => [], close });
        await importAndAudience({ kind: 'mcp', fetchSchool: async () => { throw new Error('x'); }, fetchStudents: async () => [], fetchGuardians: async () => [], close });
        expect(close).toHaveBeenCalledTimes(2);
    });
});
