/**
 * Adapter selection by `school.crm.kind` (R2-4e) — the ONE place a CrmSource is
 * chosen for a school.
 *
 *   rest → createRestSourceForSchool   (pulls the school's tool over HTTPS)
 *   mcp  → createMcpSourceForSchool    (deterministic named-tool calls over MCP)
 *   csv  → never a standing connection: a CSV import is an UPLOAD, so the caller
 *          supplies the files (startImport). A scheduled job skips csv schools.
 *
 * Configuration problems come back as CrmUrlError (client-fixable, message safe
 * to show); anything else is reported generically so a secret-store error text
 * never reaches a response.
 */

import { createCsvSource } from '@/lib/sampark/crm/csv-source';
import { createMcpSourceForSchool } from '@/lib/sampark/crm/mcp-source';
import { createRestSourceForSchool, CrmUrlError } from '@/lib/sampark/crm/rest-source';
import type { CrmSource } from '@/lib/sampark/ports';
import type { SamparkSchool } from '@/types/sampark';

export interface CrmSourceDeps {
    /** Test seams: build the connected source (defaults to the real adapters). */
    restSourceFor?: typeof createRestSourceForSchool;
    mcpSourceFor?: typeof createMcpSourceForSchool;
}

export interface CsvUpload {
    studentsCsv: string;
    guardiansCsv: string;
    consentCsv?: string | null;
}

/** True when the school has a standing CRM connection a job can pull from (rest or mcp). */
export function hasConnectedCrm(school: SamparkSchool): boolean {
    const crm = school.crm;
    return Boolean(crm && (crm.kind === 'rest' || crm.kind === 'mcp') && crm.baseUrl && crm.apiKeySecretName);
}

export class CrmNotConnectedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CrmNotConnectedError';
    }
}

/** The source for a school: a connected adapter by kind, or the CSV upload when one is given. */
export async function crmSourceForSchool(school: SamparkSchool, upload: CsvUpload | null, deps: CrmSourceDeps = {}): Promise<CrmSource> {
    if (upload) return createCsvSource(upload);
    const crm = school.crm;
    if (!crm || !hasConnectedCrm(school)) throw new CrmNotConnectedError('Set the CRM URL and key in school settings before importing');
    if (crm.kind === 'mcp') return (deps.mcpSourceFor ?? createMcpSourceForSchool)(school);
    return (deps.restSourceFor ?? createRestSourceForSchool)(school);
}

export { CrmUrlError };
