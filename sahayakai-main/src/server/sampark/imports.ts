/**
 * CRM imports (plan §3.3, §4①②): REST pull from the school's configured CRM,
 * or a CSV upload of the two exports. The run itself lives in
 * src/lib/sampark/crm/import.ts; this module picks the source and maps
 * configuration problems to client errors.
 */

import { z } from 'zod';

import { createCsvSource } from '@/lib/sampark/crm/csv-source';
import { runImport } from '@/lib/sampark/crm/import';
import { createRestSourceForSchool, CrmUrlError } from '@/lib/sampark/crm/rest-source';
import type { CrmSource } from '@/lib/sampark/ports';
import type { ImportRun } from '@/types/sampark';
import { badRequest } from '@/server/sampark/errors';
import type { SamparkCtx } from '@/server/sampark/http';
import { getSchoolOrThrow } from '@/server/sampark/school';

/** ~5 MB per CSV — a 5,000-student school exports well under 2 MB. */
const MAX_CSV_CHARS = 5_000_000;

export const StartImportSchema = z.discriminatedUnion('source', [
    z.object({ source: z.literal('rest') }).strict(),
    z
        .object({
            source: z.literal('csv'),
            studentsCsv: z.string().min(1).max(MAX_CSV_CHARS),
            guardiansCsv: z.string().min(1).max(MAX_CSV_CHARS),
        })
        .strict(),
]);
export type StartImportInput = z.infer<typeof StartImportSchema>;

export interface ImportServiceDeps {
    /** Test seam: build the REST source (defaults to the school's saved CRM config). */
    restSourceFor?: typeof createRestSourceForSchool;
}

export async function startImport(
    ctx: SamparkCtx,
    orgId: string,
    uid: string,
    input: StartImportInput,
    deps: ImportServiceDeps = {},
): Promise<ImportRun> {
    const school = await getSchoolOrThrow(ctx, orgId);
    let source: CrmSource;
    if (input.source === 'csv') {
        source = createCsvSource({ studentsCsv: input.studentsCsv, guardiansCsv: input.guardiansCsv });
    } else {
        if (!school.crm || school.crm.kind !== 'rest' || !school.crm.baseUrl) {
            throw badRequest('CRM_NOT_CONFIGURED', 'Set the CRM URL and key in school settings before importing');
        }
        try {
            source = await (deps.restSourceFor ?? createRestSourceForSchool)(school);
        } catch (err) {
            if (err instanceof CrmUrlError) throw badRequest('CRM_URL_REJECTED', err.message);
            throw badRequest('CRM_KEY_UNAVAILABLE', 'The CRM API key could not be read');
        }
    }
    return runImport({ repo: ctx.repo, clock: ctx.clock }, orgId, source, uid);
}

export async function getLatestImport(ctx: SamparkCtx, orgId: string): Promise<ImportRun | null> {
    await getSchoolOrThrow(ctx, orgId);
    return ctx.repo.getLatestImportRun(orgId);
}
