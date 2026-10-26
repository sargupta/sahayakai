/**
 * Keyset pagination shared by every list endpoint.
 *
 * Order: `updatedAt` ascending (compared as instants, so any ISO offset works),
 * then `id` ascending. The cursor is opaque base64url JSON holding the last
 * row's (updatedAt, id) plus the `includeMalformed` flag, so a caller that
 * only forwards `cursor` on later pages still gets a consistent crawl. A
 * record updated mid-crawl moves to the end and is seen again: at-least-once,
 * which is what an `updatedSince` importer wants.
 *
 * `updatedSince` (alias `since`) is inclusive: updatedAt >= updatedSince.
 */

export const MAX_LIMIT = 200;
export const DEFAULT_LIMIT = 100;

export class BadRequest extends Error {}

interface CursorPayload {
    u: number;
    i: string;
    m?: boolean;
}

export interface PageQuery {
    since: number | null;
    after: CursorPayload | null;
    limit: number;
    includeMalformed: boolean;
}

function parseInstant(raw: string, name: string): number {
    // Same shape the contract uses: ISO-8601 date-time with Z or an offset.
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(raw)) {
        throw new BadRequest(`${name} must be an ISO-8601 date-time with an offset, e.g. 2026-09-01T00:00:00Z`);
    }
    const t = Date.parse(raw);
    if (Number.isNaN(t)) throw new BadRequest(`${name} is not a valid date-time`);
    return t;
}

export function encodeCursor(payload: CursorPayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): CursorPayload {
    try {
        const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
        if (
            parsed &&
            typeof parsed === 'object' &&
            typeof (parsed as CursorPayload).u === 'number' &&
            typeof (parsed as CursorPayload).i === 'string'
        ) {
            return parsed as CursorPayload;
        }
    } catch {
        // fall through
    }
    throw new BadRequest('cursor is not valid');
}

export function parsePageQuery(params: URLSearchParams): PageQuery {
    const sinceRaw = params.get('updatedSince') ?? params.get('since');
    const since = sinceRaw ? parseInstant(sinceRaw, params.has('updatedSince') ? 'updatedSince' : 'since') : null;
    const cursorRaw = params.get('cursor');
    const after = cursorRaw ? decodeCursor(cursorRaw) : null;
    const limitRaw = params.get('limit');
    let limit = DEFAULT_LIMIT;
    if (limitRaw !== null) {
        if (!/^\d+$/.test(limitRaw) || Number(limitRaw) < 1 || Number(limitRaw) > MAX_LIMIT) {
            throw new BadRequest(`limit must be an integer from 1 to ${MAX_LIMIT}`);
        }
        limit = Number(limitRaw);
    }
    const includeMalformed = params.get('includeMalformed') === 'true' || after?.m === true;
    return { since, after, limit, includeMalformed };
}

interface Keyed {
    id?: unknown;
    updatedAt?: unknown;
}

const key = (r: Keyed): [number, string] => {
    const t = typeof r.updatedAt === 'string' ? Date.parse(r.updatedAt) : Number.NaN;
    return [Number.isNaN(t) ? 0 : t, String(r.id ?? '')];
};

export function compareKeyed(a: Keyed, b: Keyed): number {
    const [ta, ia] = key(a);
    const [tb, ib] = key(b);
    if (ta !== tb) return ta - tb;
    return ia < ib ? -1 : ia > ib ? 1 : 0;
}

export function paginate<T extends Keyed>(records: readonly T[], q: PageQuery): { data: T[]; nextCursor: string | null } {
    const sorted = records.filter((r) => q.since === null || key(r)[0] >= q.since).sort(compareKeyed);
    const start = q.after
        ? sorted.findIndex((r) => {
              const [t, id] = key(r);
              const after = q.after as CursorPayload;
              return t > after.u || (t === after.u && id > after.i);
          })
        : 0;
    const from = start < 0 ? sorted.length : start;
    const data = sorted.slice(from, from + q.limit);
    const last = data[data.length - 1];
    const more = from + q.limit < sorted.length;
    const nextCursor =
        more && last ? encodeCursor({ u: key(last)[0], i: key(last)[1], ...(q.includeMalformed ? { m: true } : {}) }) : null;
    return { data, nextCursor };
}
