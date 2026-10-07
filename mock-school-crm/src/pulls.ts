/**
 * The calling system's last pulls, for the demo page ("SahayakAI pulled these
 * records at 14:12"). Kept in memory only, never in the state file: it
 * describes this server process, not the school's data, so a restart forgets it.
 *
 * Only authenticated GETs of the student and guardian lists and the CSV exports
 * count. A paged crawl is one pull: a page without a cursor starts it and each
 * cursor page adds its records, so a 37-per-page crawl of 645 guardians reads
 * "645 guardians". A CSV export is one pull of every row it served.
 */

export type PullKind = 'students' | 'guardians';

export interface PullRecord {
    /** When the latest request of this pull was served (ISO UTC). */
    at: string;
    /** Records served across the pull's pages (tombstones, and malformed rows if asked for, included). */
    records: number;
    requests: number;
    via: 'api' | 'csv';
    /** The pull asked only for changes (`updatedSince` / `since`). */
    incremental: boolean;
    /** False while a paged crawl still has a next cursor to follow. */
    complete: boolean;
}

export interface PullSnapshot {
    students: PullRecord | null;
    guardians: PullRecord | null;
}

export interface PullTracker {
    /** One served list page. `continued` = the request carried a cursor. */
    page(kind: PullKind, page: { records: number; continued: boolean; incremental: boolean; complete: boolean }): void;
    csv(kind: PullKind, rows: number): void;
    snapshot(): PullSnapshot;
}

export function createPullTracker(now: () => Date): PullTracker {
    const last: Record<PullKind, PullRecord | null> = { students: null, guardians: null };
    return {
        page(kind, p) {
            const at = now().toISOString();
            const prev = last[kind];
            if (p.continued && prev && prev.via === 'api' && !prev.complete) {
                last[kind] = { ...prev, at, records: prev.records + p.records, requests: prev.requests + 1, complete: p.complete };
            } else {
                last[kind] = { at, records: p.records, requests: 1, via: 'api', incremental: p.incremental, complete: p.complete };
            }
        },
        csv(kind, rows) {
            last[kind] = { at: now().toISOString(), records: rows, requests: 1, via: 'csv', incremental: false, complete: true };
        },
        snapshot() {
            return {
                students: last.students ? { ...last.students } : null,
                guardians: last.guardians ? { ...last.guardians } : null,
            };
        },
    };
}
