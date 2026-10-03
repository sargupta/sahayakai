/**
 * CRM imports (plan §3.3, §4①②): a pull from the school's configured CRM
 * (REST or MCP, chosen by school.crm.kind in crm-source.ts), or a CSV upload of
 * the two exports plus an optional consent list. The run itself lives in
 * src/lib/sampark/crm/import.ts; this module picks the source and maps
 * configuration problems to client errors.
 */

import { z } from 'zod';

import { runImport } from '@/lib/sampark/crm/import';
import { CrmUrlError } from '@/lib/sampark/crm/rest-source';
import type { ImportRun } from '@/types/sampark';
import { CrmNotConnectedError, crmSourceForSchool, type CrmSourceDeps } from '@/server/sampark/crm-source';
import { badRequest } from '@/server/sampark/errors';
import type { SamparkCtx } from '@/server/sampark/http';
import { getSchoolOrThrow } from '@/server/sampark/school';

/** ~5 MB per CSV — a 5,000-student school exports well under 2 MB. */
const MAX_CSV_CHARS = 5_000_000;

export const StartImportSchema = z.discriminatedUnion('source', [
    // 'rest' and 'mcp' both mean "pull from the saved connection"; the saved kind must match what was asked for.
    z.object({ source: z.literal('rest') }).strict(),
    z.object({ source: z.literal('mcp') }).strict(),
    z
        .object({
            source: z.literal('csv'),
            studentsCsv: z.string().min(1).max(MAX_CSV_CHARS),
            guardiansCsv: z.string().min(1).max(MAX_CSV_CHARS),
            /** Optional consent list: guardian/phone/studentAdmissionNo, purposeGroup, status, recordedAt, method, noticeVersion. */
            consentCsv: z.string().min(1).max(MAX_CSV_CHARS).optional(),
        })
        .strict(),
]);
export type StartImportInput = z.infer<typeof StartImportSchema>;

export type ImportServiceDeps = CrmSourceDeps;

export async function startImport(
    ctx: SamparkCtx,
    orgId: string,
    uid: string,
    input: StartImportInput,
    deps: ImportServiceDeps = {},
): Promise<ImportRun> {
    const school = await getSchoolOrThrow(ctx, orgId);
    let source;
    if (input.source === 'csv') {
        source = await crmSourceForSchool(school, { studentsCsv: input.studentsCsv, guardiansCsv: input.guardiansCsv, consentCsv: input.consentCsv ?? null });
    } else {
        if (school.crm?.kind !== input.source) {
            throw badRequest('CRM_NOT_CONFIGURED', 'Set the CRM URL and key in school settings before importing');
        }
        try {
            source = await crmSourceForSchool(school, null, deps);
        } catch (err) {
            if (err instanceof CrmNotConnectedError) throw badRequest('CRM_NOT_CONFIGURED', err.message);
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
