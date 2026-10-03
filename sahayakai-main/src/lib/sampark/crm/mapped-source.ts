/**
 * The part of a CrmSource that REST and MCP share: paging through an entity's
 * list under the saved mapping (parameter names, cursor or page-number style,
 * where the list and the next cursor sit), hard caps, and mapping each record
 * onto the canonical shape. The adapters supply only `fetchBody` — one HTTP GET
 * or one MCP tool call.
 *
 * Caps (a hostile or broken tool must not make an import run forever):
 *   MAX_PAGES pages and MAX_RECORDS records per entity per import; a cursor
 *   that repeats is a loop and aborts the import.
 */

import { CrmFetchError } from '@/lib/sampark/crm/errors';
import {
    type CrmEntity,
    type CrmMapping,
    entityForCanonicalPath,
    getPath,
    mapRecord,
} from '@/lib/sampark/crm/mapping';
import type { CrmSource } from '@/lib/sampark/ports';

export const MAX_PAGES = 1_000;
export const MAX_RECORDS = 250_000;

export type PageParams = Record<string, string | number>;

export interface MappedSourceIO {
    kind: 'rest' | 'mcp';
    /** True when the mapping/config names an endpoint or tool for this entity. */
    hasEntity(entity: CrmEntity): boolean;
    /**
     * Fetch one response body for an entity. `params` is null for a single-record entity (school), else the
     * paging parameters already named per the mapping. Throws CrmFetchError with a SAFE message.
     */
    fetchBody(entity: CrmEntity, params: PageParams | null): Promise<unknown>;
    /** REST only: an unmapped, raw `/v1/...` path (kept for slice-2 callers that name a path directly). */
    fetchRawPath?(path: string): Promise<unknown[]>;
}

function extractPage(entity: CrmEntity, body: unknown, mapping: CrmMapping): { records: unknown[]; next: string | null } {
    const { dataPath, nextCursorPath, style } = mapping.pagination;
    const list = dataPath === '$' ? body : getPath(body, dataPath);
    if (!Array.isArray(list)) throw new CrmFetchError(`CRM page for ${entity} has no list at "${dataPath}"`);
    if (style === 'page' || nextCursorPath === null) return { records: list, next: null };
    const raw = nextCursorPath === '$' ? body : getPath(body, nextCursorPath);
    if (raw === null || raw === undefined || raw === '') return { records: list, next: null };
    if (typeof raw !== 'string' && typeof raw !== 'number') throw new CrmFetchError(`CRM next cursor for ${entity} is not a string`);
    return { records: list, next: String(raw) };
}

export function createMappedSource(io: MappedSourceIO, mapping: CrmMapping): CrmSource {
    const p = mapping.pagination;

    async function paginate(entity: CrmEntity, updatedSince: string | null): Promise<unknown[]> {
        if (!io.hasEntity(entity)) throw new CrmFetchError(`No ${io.kind === 'mcp' ? 'tool' : 'endpoint'} is configured for ${entity}`);
        const out: unknown[] = [];
        const seen = new Set<string>();
        let cursor: string | null = null;
        for (let page = 0; page < MAX_PAGES; page++) {
            const params: PageParams = { [p.limitParam]: p.pageSize };
            if (p.style === 'page') params[p.cursorParam] = page + p.pageStart;
            else if (cursor !== null) params[p.cursorParam] = cursor;
            if (updatedSince !== null && p.updatedSinceParam !== null) params[p.updatedSinceParam] = updatedSince;
            const { records, next } = extractPage(entity, await io.fetchBody(entity, params), mapping);
            for (const r of records) out.push(mapRecord(entity, r, mapping));
            if (out.length > MAX_RECORDS) throw new CrmFetchError(`CRM returned more than ${MAX_RECORDS} ${entity} records`);
            if (p.style === 'page') {
                // A short or empty page ends the crawl.
                if (records.length < p.pageSize) return out;
                continue;
            }
            if (!next) return out;
            if (seen.has(next)) throw new CrmFetchError(`CRM pagination loop on ${entity}`);
            seen.add(next);
            cursor = next;
        }
        throw new CrmFetchError(`CRM pagination exceeded ${MAX_PAGES} pages on ${entity}`);
    }

    const source: CrmSource = {
        kind: io.kind,
        fetchSchool: async () => {
            if (!io.hasEntity('school')) return null; // a tool without a school record: holidays are left as they are
            return mapRecord('school', await io.fetchBody('school', null), mapping);
        },
        fetchStudents: (updatedSince) => paginate('students', updatedSince),
        fetchGuardians: (updatedSince) => paginate('guardians', updatedSince),
        // Not `async`: an unexpected path is refused synchronously, before any request is built.
        fetchRecords: (path) => {
            const entity = entityForCanonicalPath(path);
            if (entity && entity !== 'school') return paginate(entity, null);
            if (io.fetchRawPath) return io.fetchRawPath(path);
            throw new CrmFetchError(`Refusing to fetch an unexpected CRM path: ${path}`);
        },
    };
    if (io.hasEntity('consent')) source.fetchConsent = () => paginate('consent', null);
    return source;
}
