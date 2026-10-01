/** @jest-environment node */
/**
 * RFC 4180 parsing and the CSV → wire-shape mapping the importer relies on.
 */

import { CsvParseError, parseCsv, parseCsvRecords } from '@/lib/sampark/crm/csv';
import { createCsvSource, CSV_ERROR_KEY, CSV_ROW_KEY, csvRowToGuardian, csvRowToStudent } from '@/lib/sampark/crm/csv-source';
import { CrmGuardianSchema, CrmStudentSchema, CSV_COLUMNS } from '@/lib/sampark/crm/schema';

describe('parseCsv (RFC 4180)', () => {
    it('parses plain rows with LF and CRLF, ignoring one trailing newline', () => {
        expect(parseCsv('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
        expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
        expect(parseCsv('a,b\r1,2')).toEqual([['a', 'b'], ['1', '2']]);
    });

    it('handles quoted fields with commas, escaped quotes and embedded newlines', () => {
        const rows = parseCsv('name,note\n"Rai, Sita","she said ""namaste""\nthen left"\n');
        expect(rows).toEqual([
            ['name', 'note'],
            ['Rai, Sita', 'she said "namaste"\nthen left'],
        ]);
    });

    it('strips a UTF-8 byte-order mark', () => {
        expect(parseCsv('﻿id,x\n1,2')).toEqual([['id', 'x'], ['1', '2']]);
    });

    it('keeps empty fields, including a trailing empty field and empty quoted fields', () => {
        expect(parseCsv('a,,c,\n"",x,"",')).toEqual([
            ['a', '', 'c', ''],
            ['', 'x', '', ''],
        ]);
    });

    it('keeps Unicode (Devanagari, Bengali) intact', () => {
        expect(parseCsv('hi,bn\nआशा,আশা')).toEqual([['hi', 'bn'], ['आशा', 'আশা']]);
    });

    it('rejects an unterminated quote, text after a closing quote, and a stray quote', () => {
        expect(() => parseCsv('a\n"open')).toThrow(CsvParseError);
        expect(() => parseCsv('"abc"x,1')).toThrow(/after closing quote/);
        expect(() => parseCsv('ab"c,1')).toThrow(/quote inside an unquoted field/);
    });

    it('returns no rows for empty input', () => {
        expect(parseCsv('')).toEqual([]);
    });
});

describe('parseCsvRecords', () => {
    it('requires the header columns', () => {
        expect(() => parseCsvRecords('id,name\n1,x', ['id', 'phone'])).toThrow(/missing column\(s\): phone/);
        expect(() => parseCsvRecords('', ['id'])).toThrow(/missing header row/);
    });

    it('flags rows with the wrong number of cells instead of throwing', () => {
        const { records } = parseCsvRecords('id,name\n1,x\n2\n3,y,z\n', ['id', 'name']);
        expect(records.map((r) => [r.row, r.error])).toEqual([
            [1, null],
            [2, 'expected 2 cells, found 1'],
            [3, 'expected 2 cells, found 3'],
        ]);
    });
});

function csvLine(values: string[]): string {
    return values.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',');
}

describe('CSV → wire shape', () => {
    const studentRow: Record<string, string> = {
        id: 's1',
        deleted: '',
        admissionNo: 'ADM-1',
        apaarId: '',
        fullName: 'Asha Rai',
        'spokenFirstName.en': 'Asha',
        'spokenFirstName.hi': 'आशा',
        'spokenFirstName.bn': '',
        'spokenFirstName.ne': 'आशा',
        grade: '7',
        section: 'B',
        rollNo: '12',
        gender: 'female',
        feeCategory: 'rte',
        boarding: 'false',
        transportRoute: 'R3',
        sensitiveFlags: 'counsellor_referral|severe_illness',
        status: 'active',
        guardians: 'g1:true:true|g2:false:false',
        updatedAt: '2026-09-01T10:00:00+05:30',
    };

    it('maps a student row to a record the wire schema accepts', () => {
        const json = csvRowToStudent(studentRow);
        const parsed = CrmStudentSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        expect(json).toMatchObject({
            apaarId: null,
            grade: 7,
            rollNo: 12,
            boarding: false,
            transportRoute: 'R3',
            sensitiveFlags: ['counsellor_referral', 'severe_illness'],
            spokenFirstName: { en: 'Asha', hi: 'आशा', ne: 'आशा' },
            guardians: [
                { guardianId: 'g1', isPrimary: true, isGuardianOfRecord: true },
                { guardianId: 'g2', isPrimary: false, isGuardianOfRecord: false },
            ],
        });
        expect(json).not.toHaveProperty('deleted');
        expect(json.spokenFirstName).not.toHaveProperty('bn');
    });

    it('passes malformed cells through raw so the schema rejects them', () => {
        const bad = csvRowToStudent({ ...studentRow, grade: 'seven', boarding: 'yes', guardians: 'g1' });
        expect(bad.grade).toBe('seven');
        expect(bad.boarding).toBe('yes');
        expect(CrmStudentSchema.safeParse(bad).success).toBe(false);
    });

    it('maps a guardian row, including the consent encoding', () => {
        const json = csvRowToGuardian({
            id: 'g1',
            deleted: 'false',
            fullName: 'Sita Rai',
            relation: 'mother',
            phone: '+915000000001',
            preferredLanguage: '',
            'consent.notices': 'granted;2026-06-01T10:00:00+05:30;admission_form;dpdp-v1',
            'consent.progress': 'unknown;;;',
            'consent.recordedConversation': '',
            'consent.hpcInput': '',
            doNotContact: 'true',
            synthetic: 'true',
            updatedAt: '2026-09-01T10:00:00+05:30',
        });
        expect(CrmGuardianSchema.safeParse(json).success).toBe(true);
        expect(json).toMatchObject({
            deleted: false,
            preferredLanguage: null,
            doNotContact: true,
            consent: {
                notices: { status: 'granted', recordedAt: '2026-06-01T10:00:00+05:30', method: 'admission_form', noticeVersion: 'dpdp-v1' },
                progress: { status: 'unknown', recordedAt: null, method: null, noticeVersion: null },
                recordedConversation: null,
                hpcInput: null,
            },
        });
    });

    it('createCsvSource tags rows with their row number and quarantines short rows', async () => {
        const header = CSV_COLUMNS.guardians.join(',');
        const good = csvLine(['g1', '', 'Sita Rai', 'mother', '+915000000001', 'ne', 'granted;;office;', '', '', '', 'false', 'true', '2026-09-01T10:00:00+05:30']);
        const short = 'g2,,Broken';
        const source = createCsvSource({ studentsCsv: CSV_COLUMNS.students.join(','), guardiansCsv: `${header}\n${good}\n${short}\n` });
        const rows = (await source.fetchGuardians(null)) as Record<string, unknown>[];
        expect(rows).toHaveLength(2);
        expect(rows[0][CSV_ROW_KEY]).toBe(1);
        expect(rows[0][CSV_ERROR_KEY]).toBeUndefined();
        expect(rows[1]).toMatchObject({ id: 'g2', [CSV_ROW_KEY]: 2 });
        expect(String(rows[1][CSV_ERROR_KEY])).toMatch(/expected 13 cells/);
        expect(await source.fetchStudents(null)).toEqual([]);
        expect(await source.fetchSchool()).toBeNull();
    });
});
