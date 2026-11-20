/**
 * RFC 4180 CSV parsing for school-CRM exports (plan §3.3).
 *
 * Handles: quoted fields, escaped quotes (""), commas and line breaks inside
 * quotes, CRLF / LF / lone-CR record separators, a UTF-8 byte-order mark, and a
 * trailing newline. Deliberately strict about one thing: text after a closing
 * quote (`"abc"x`) is an error, because silently gluing it on is how a CRM's
 * broken export becomes a wrong phone number.
 *
 * Pure and dependency-free so it can run anywhere (route, job, script, test).
 */

export class CsvParseError extends Error {
    constructor(message: string, readonly line: number) {
        super(`${message} (line ${line})`);
        this.name = 'CsvParseError';
    }
}

/** Parse CSV text into rows of raw string cells. Empty trailing line is ignored. */
export function parseCsv(text: string): string[][] {
    const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let afterQuote = false; // just closed a quoted field; only , or EOL may follow
    let line = 1;
    let fieldStarted = false;

    const endField = () => {
        row.push(field);
        field = '';
        afterQuote = false;
        fieldStarted = false;
    };
    const endRow = () => {
        endField();
        rows.push(row);
        row = [];
    };

    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inQuotes) {
            if (c === '"') {
                if (src[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                    afterQuote = true;
                }
            } else {
                if (c === '\n') line++;
                field += c;
            }
            continue;
        }
        if (c === ',') {
            endField();
            continue;
        }
        if (c === '\r' || c === '\n') {
            if (c === '\r' && src[i + 1] === '\n') i++;
            endRow();
            line++;
            continue;
        }
        if (afterQuote) throw new CsvParseError('unexpected character after closing quote', line);
        if (c === '"') {
            if (fieldStarted || field.length > 0) throw new CsvParseError('quote inside an unquoted field', line);
            inQuotes = true;
            fieldStarted = true;
            continue;
        }
        field += c;
        fieldStarted = true;
    }
    if (inQuotes) throw new CsvParseError('unterminated quoted field', line);
    // Flush the last record unless the input ended with a newline (or was empty).
    if (fieldStarted || field.length > 0 || row.length > 0) endRow();
    return rows;
}

export interface CsvRecord {
    /** 1-based data row number (the header is row 0), for quarantine reasons. */
    row: number;
    values: Record<string, string>;
}

/**
 * Parse CSV with a required header row into keyed records. Throws if a
 * required column is missing. Rows with the wrong number of cells are
 * returned with `error` set rather than thrown, so the importer can
 * quarantine exactly that row and keep going.
 */
export function parseCsvRecords(
    text: string,
    requiredColumns: readonly string[],
): { records: (CsvRecord & { error: string | null })[] } {
    const rows = parseCsv(text).filter((r) => !(r.length === 1 && r[0] === ''));
    if (rows.length === 0) throw new CsvParseError('missing header row', 1);
    const header = rows[0].map((h) => h.trim());
    const missing = requiredColumns.filter((c) => !header.includes(c));
    if (missing.length > 0) throw new CsvParseError(`missing column(s): ${missing.join(', ')}`, 1);

    const records = rows.slice(1).map((cells, idx) => {
        const values: Record<string, string> = {};
        header.forEach((h, i) => {
            values[h] = cells[i] ?? '';
        });
        const error = cells.length !== header.length
            ? `expected ${header.length} cells, found ${cells.length}`
            : null;
        return { row: idx + 1, values, error };
    });
    return { records };
}
