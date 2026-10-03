/**
 * CSV CrmSource — maps a school's two CSV exports back into the JSON wire
 * shape of crm/schema.ts, so the importer validates CSV and REST records with
 * the SAME Zod schemas and quarantines failures the same way (plan §3.3).
 *
 * Encodings (CSV_COLUMNS in crm/schema.ts):
 *   booleans      'true' / 'false'   (anything else is passed through raw so Zod rejects it)
 *   numbers       decimal digits     (anything else passed through raw)
 *   nullable      empty cell → null
 *   optional      empty cell → key absent
 *   lists         '|'-joined         (empty cell → [])
 *   guardians     "guardianId:isPrimary:isGuardianOfRecord" joined by '|'
 *   consent       "status;recordedAt;method;noticeVersion" (empty cell → null; empty part → null)
 *
 * Every mapped record carries its 1-based data-row number under CSV_ROW_KEY so
 * the importer can say "row 17: phone must be E.164". Zod object schemas strip
 * unknown keys, so the marker never reaches the snapshot. A row with the wrong
 * number of cells is returned with CSV_ERROR_KEY set and is quarantined as-is.
 */

import { CsvParseError, parseCsvRecords } from '@/lib/sampark/crm/csv';
import { CSV_COLUMNS } from '@/lib/sampark/crm/schema';
import type { CrmSource } from '@/lib/sampark/ports';

export const CSV_ROW_KEY = '__csvRow';
export const CSV_ERROR_KEY = '__csvError';

/** The consent list CSV (R2-4d): see crm/consent.ts for the meaning of each column. */
export const CONSENT_CSV_REQUIRED_COLUMNS = ['purposeGroup', 'status'] as const;
export const CONSENT_CSV_COLUMNS = ['guardian', 'phone', 'studentAdmissionNo', 'purposeGroup', 'status', 'recordedAt', 'method', 'noticeVersion'] as const;

type Json = Record<string, unknown>;

function bool(raw: string): unknown {
    const v = raw.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
    return raw;
}

function num(raw: string): unknown {
    const v = raw.trim();
    if (v === '') return null;
    return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : raw;
}

function nullable(raw: string): string | null {
    return raw === '' ? null : raw;
}

function list(raw: string): string[] {
    return raw === '' ? [] : raw.split('|').map((s) => s.trim());
}

function optionalBool(raw: string): unknown {
    return raw.trim() === '' ? undefined : bool(raw);
}

function guardianLinks(raw: string): unknown[] {
    return list(raw).map((part) => {
        // Split from the right: the last two segments are booleans, the rest is the id.
        const segs = part.split(':');
        if (segs.length < 3) return part; // raw string → Zod "expected object"
        const isGuardianOfRecord = segs.pop() as string;
        const isPrimary = segs.pop() as string;
        return { guardianId: segs.join(':'), isPrimary: bool(isPrimary), isGuardianOfRecord: bool(isGuardianOfRecord) };
    });
}

function consent(raw: string): unknown {
    if (raw.trim() === '') return null;
    const parts = raw.split(';');
    if (parts.length !== 4) return raw; // raw string → Zod "expected object"
    const [status, recordedAt, method, noticeVersion] = parts.map((p) => p.trim());
    return {
        status,
        recordedAt: recordedAt === '' ? null : recordedAt,
        method: method === '' ? null : method,
        noticeVersion: noticeVersion === '' ? null : noticeVersion,
    };
}

function withoutUndefined(obj: Json): Json {
    for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
    return obj;
}

export function csvRowToStudent(v: Record<string, string>): Json {
    const spoken: Json = {};
    for (const code of ['en', 'hi', 'bn', 'ne'] as const) {
        const name = v[`spokenFirstName.${code}`] ?? '';
        if (name !== '') spoken[code] = name;
    }
    return withoutUndefined({
        id: v.id,
        deleted: optionalBool(v.deleted ?? ''),
        admissionNo: v.admissionNo,
        apaarId: nullable(v.apaarId ?? ''),
        fullName: v.fullName,
        spokenFirstName: spoken,
        grade: num(v.grade ?? ''),
        section: v.section,
        rollNo: num(v.rollNo ?? ''),
        gender: v.gender,
        feeCategory: v.feeCategory,
        boarding: bool(v.boarding ?? ''),
        transportRoute: nullable(v.transportRoute ?? ''),
        sensitiveFlags: list(v.sensitiveFlags ?? ''),
        status: v.status,
        guardians: guardianLinks(v.guardians ?? ''),
        updatedAt: v.updatedAt,
    });
}

export function csvRowToGuardian(v: Record<string, string>): Json {
    return withoutUndefined({
        id: v.id,
        deleted: optionalBool(v.deleted ?? ''),
        fullName: v.fullName,
        relation: v.relation,
        phone: v.phone,
        preferredLanguage: nullable(v.preferredLanguage ?? ''),
        consent: {
            notices: consent(v['consent.notices'] ?? ''),
            progress: consent(v['consent.progress'] ?? ''),
            recordedConversation: consent(v['consent.recordedConversation'] ?? ''),
            hpcInput: consent(v['consent.hpcInput'] ?? ''),
        },
        doNotContact: bool(v.doNotContact ?? ''),
        synthetic: bool(v.synthetic ?? ''),
        updatedAt: v.updatedAt,
    });
}

function mapRecords(text: string, columns: readonly string[], toJson: (v: Record<string, string>) => Json): Json[] {
    const { records } = parseCsvRecords(text, columns);
    return records.map((r) => {
        if (r.error) return { id: r.values.id || null, [CSV_ROW_KEY]: r.row, [CSV_ERROR_KEY]: r.error };
        return { ...toJson(r.values), [CSV_ROW_KEY]: r.row };
    });
}

/**
 * Map a consent CSV (header row required) into raw consent rows. Rows with the wrong number of cells carry
 * CSV_ERROR_KEY and are quarantined by the importer like any other bad row. The header must contain purposeGroup,
 * status and at least one of guardian / phone / studentAdmissionNo (aliases guardianId, admissionNo).
 */
export function consentCsvToRows(text: string): Json[] {
    const { records } = parseCsvRecords(text, CONSENT_CSV_REQUIRED_COLUMNS);
    const sample = records[0]?.values ?? {};
    const hasIdentifier = ['guardian', 'guardianId', 'phone', 'studentAdmissionNo', 'admissionNo'].some((c) => c in sample);
    if (records.length > 0 && !hasIdentifier) throw new CsvParseError('missing column(s): guardian, phone or studentAdmissionNo', 1);
    return records.map((r) => {
        if (r.error) return { [CSV_ROW_KEY]: r.row, [CSV_ERROR_KEY]: r.error };
        const v = r.values;
        const cell = (...names: string[]): string | null => {
            for (const n of names) if ((v[n] ?? '').trim() !== '') return (v[n] as string).trim();
            return null;
        };
        return {
            guardian: cell('guardian', 'guardianId'),
            phone: cell('phone'),
            studentAdmissionNo: cell('studentAdmissionNo', 'admissionNo'),
            purposeGroup: v.purposeGroup?.trim() ?? '',
            status: v.status?.trim() ?? '',
            recordedAt: cell('recordedAt'),
            method: cell('method'),
            noticeVersion: cell('noticeVersion'),
            [CSV_ROW_KEY]: r.row,
        };
    });
}

/**
 * A CSV import is a full snapshot: `updatedSince` is ignored. There is no
 * school record in a CSV export, so fetchSchool() returns null and the
 * importer leaves the school's holidays as they are. A consent CSV is optional;
 * without one the guardians' own `consent.*` columns decide.
 */
export function createCsvSource(input: { studentsCsv: string; guardiansCsv: string; consentCsv?: string | null }): CrmSource {
    const source: CrmSource = {
        kind: 'csv',
        fetchSchool: async () => null,
        fetchStudents: async () => mapRecords(input.studentsCsv, CSV_COLUMNS.students, csvRowToStudent),
        fetchGuardians: async () => mapRecords(input.guardiansCsv, CSV_COLUMNS.guardians, csvRowToGuardian),
    };
    const consentCsv = input.consentCsv;
    if (consentCsv && consentCsv.trim() !== '') source.fetchConsent = async () => consentCsvToRows(consentCsv);
    return source;
}
