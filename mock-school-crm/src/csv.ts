/**
 * CSV export in the contract's canonical shape (contract CSV_COLUMNS): header
 * row, UTF-8, comma-separated, CRLF line ends, RFC 4180 quoting. Nested fields
 * are flattened with dots; lists use '|'.
 *
 *   guardians      "guardianId:isPrimary:isGuardianOfRecord|…"
 *   consent.*      "status;recordedAt;method;noticeVersion", each part empty = null;
 *                  the whole cell empty = the consent itself is null
 *   sensitiveFlags "flag|flag", empty = []
 *   deleted        "true" for tombstones, empty when absent
 *   nullable text  empty = null; spokenFirstName.<lang> empty = not reviewed (key absent)
 *
 * The parse side (`rowToStudent` / `rowToGuardian`) is what an importer does:
 * it maps a row back to the JSON shape WITHOUT validating, so a malformed row
 * comes back as the same malformed record and fails the schema on its own.
 */

import { CSV_COLUMNS, type CrmGuardian, type CrmStudent } from './contract/crm-schema';

// ── RFC 4180 ─────────────────────────────────────────────────────────────────

function quote(field: string): string {
    return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

export function encodeCsv(rows: readonly (readonly string[])[]): string {
    return rows.map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';
}

/** Parses RFC 4180 text (CRLF or LF line ends). Returns rows of raw strings. */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let i = 0;
    let quoted = false;
    let atFieldStart = true;
    while (i < text.length) {
        const ch = text[i] as string;
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                quoted = false;
                i += 1;
                continue;
            }
            field += ch;
            i += 1;
            continue;
        }
        if (ch === '"' && atFieldStart) {
            quoted = true;
            atFieldStart = false;
            i += 1;
            continue;
        }
        if (ch === ',') {
            row.push(field);
            field = '';
            atFieldStart = true;
            i += 1;
            continue;
        }
        if (ch === '\r' || ch === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            atFieldStart = true;
            i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
            continue;
        }
        field += ch;
        atFieldStart = false;
        i += 1;
    }
    if (quoted) throw new Error('unterminated quoted field');
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

// ── Flattening ───────────────────────────────────────────────────────────────

type Loose = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const bool = (v: unknown): string => (v === true ? 'true' : v === false ? 'false' : str(v));

function consentCell(v: unknown): string {
    if (v === null || v === undefined) return '';
    const c = v as Loose;
    return [str(c.status), str(c.recordedAt), str(c.method), str(c.noticeVersion)].join(';');
}

/** Flattens a student record (valid or not) into CSV cells in CSV_COLUMNS order. */
export function studentToRow(record: CrmStudent | Loose): string[] {
    const r = record as Loose;
    const spoken = (r.spokenFirstName ?? {}) as Loose;
    const links = Array.isArray(r.guardians) ? (r.guardians as Loose[]) : [];
    const cells: Record<(typeof CSV_COLUMNS.students)[number], string> = {
        id: str(r.id),
        deleted: r.deleted === undefined ? '' : bool(r.deleted),
        admissionNo: str(r.admissionNo),
        apaarId: str(r.apaarId),
        fullName: str(r.fullName),
        'spokenFirstName.en': str(spoken.en),
        'spokenFirstName.hi': str(spoken.hi),
        'spokenFirstName.bn': str(spoken.bn),
        'spokenFirstName.ne': str(spoken.ne),
        grade: str(r.grade),
        section: str(r.section),
        rollNo: str(r.rollNo),
        gender: str(r.gender),
        feeCategory: str(r.feeCategory),
        boarding: bool(r.boarding),
        transportRoute: str(r.transportRoute),
        sensitiveFlags: Array.isArray(r.sensitiveFlags) ? (r.sensitiveFlags as unknown[]).map(str).join('|') : '',
        status: str(r.status),
        guardians: links.map((l) => `${str(l.guardianId)}:${bool(l.isPrimary)}:${bool(l.isGuardianOfRecord)}`).join('|'),
        updatedAt: str(r.updatedAt),
    };
    return CSV_COLUMNS.students.map((c) => cells[c]);
}

export function guardianToRow(record: CrmGuardian | Loose): string[] {
    const r = record as Loose;
    const consent = (r.consent ?? {}) as Loose;
    const cells: Record<(typeof CSV_COLUMNS.guardians)[number], string> = {
        id: str(r.id),
        deleted: r.deleted === undefined ? '' : bool(r.deleted),
        fullName: str(r.fullName),
        relation: str(r.relation),
        phone: str(r.phone),
        preferredLanguage: str(r.preferredLanguage),
        'consent.notices': consentCell(consent.notices),
        'consent.progress': consentCell(consent.progress),
        'consent.recordedConversation': consentCell(consent.recordedConversation),
        'consent.hpcInput': consentCell(consent.hpcInput),
        doNotContact: bool(r.doNotContact),
        synthetic: bool(r.synthetic),
        updatedAt: str(r.updatedAt),
    };
    return CSV_COLUMNS.guardians.map((c) => cells[c]);
}

export function studentsCsv(records: readonly (CrmStudent | Loose)[]): string {
    return encodeCsv([[...CSV_COLUMNS.students], ...records.map(studentToRow)]);
}

export function guardiansCsv(records: readonly (CrmGuardian | Loose)[]): string {
    return encodeCsv([[...CSV_COLUMNS.guardians], ...records.map(guardianToRow)]);
}

// ── Un-flattening (importer side; used by the round-trip tests) ─────────────

const nullable = (v: string): string | null => (v === '' ? null : v);
const parseBool = (v: string): boolean | string => (v === 'true' ? true : v === 'false' ? false : v);
const parseNum = (v: string): number | string => (/^-?\d+$/.test(v) ? Number(v) : v);

function parseConsent(cell: string): Loose | null {
    if (cell === '') return null;
    const [status = '', recordedAt = '', method = '', noticeVersion = ''] = cell.split(';');
    return { status, recordedAt: nullable(recordedAt), method: nullable(method), noticeVersion: nullable(noticeVersion) };
}

function byHeader<T extends string>(header: readonly string[], columns: readonly T[], row: readonly string[]): Record<T, string> {
    const out = {} as Record<T, string>;
    for (const c of columns) {
        const idx = header.indexOf(c);
        if (idx < 0) throw new Error(`missing column ${c}`);
        out[c] = row[idx] ?? '';
    }
    return out;
}

export function rowToStudent(header: readonly string[], row: readonly string[]): Loose {
    const c = byHeader(header, CSV_COLUMNS.students, row);
    const spoken: Loose = {};
    for (const lang of ['en', 'hi', 'bn', 'ne'] as const) {
        const v = c[`spokenFirstName.${lang}`];
        if (v !== '') spoken[lang] = v;
    }
    return {
        id: c.id,
        ...(c.deleted === '' ? {} : { deleted: parseBool(c.deleted) }),
        admissionNo: c.admissionNo,
        apaarId: nullable(c.apaarId),
        fullName: c.fullName,
        spokenFirstName: spoken,
        grade: parseNum(c.grade),
        section: c.section,
        rollNo: parseNum(c.rollNo),
        gender: c.gender,
        feeCategory: c.feeCategory,
        boarding: parseBool(c.boarding),
        transportRoute: nullable(c.transportRoute),
        sensitiveFlags: c.sensitiveFlags === '' ? [] : c.sensitiveFlags.split('|'),
        status: c.status,
        guardians:
            c.guardians === ''
                ? []
                : c.guardians.split('|').map((part) => {
                      const [guardianId = '', isPrimary = '', isGuardianOfRecord = ''] = part.split(':');
                      return { guardianId, isPrimary: parseBool(isPrimary), isGuardianOfRecord: parseBool(isGuardianOfRecord) };
                  }),
        updatedAt: c.updatedAt,
    };
}

export function rowToGuardian(header: readonly string[], row: readonly string[]): Loose {
    const c = byHeader(header, CSV_COLUMNS.guardians, row);
    return {
        id: c.id,
        ...(c.deleted === '' ? {} : { deleted: parseBool(c.deleted) }),
        fullName: c.fullName,
        relation: c.relation,
        phone: c.phone,
        preferredLanguage: nullable(c.preferredLanguage),
        consent: {
            notices: parseConsent(c['consent.notices']),
            progress: parseConsent(c['consent.progress']),
            recordedConversation: parseConsent(c['consent.recordedConversation']),
            hpcInput: parseConsent(c['consent.hpcInput']),
        },
        doNotContact: parseBool(c.doNotContact),
        synthetic: parseBool(c.synthetic),
        updatedAt: c.updatedAt,
    };
}
