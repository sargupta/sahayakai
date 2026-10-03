/**
 * The scheduled import job (R2-5): "arriving data triggers Sampark" without any
 * per-school scheduler. One run, for every Sampark school with a CONNECTED CRM
 * (rest or mcp; a csv school has nothing to pull):
 *
 *   1. import the CRM (full snapshot, validated row by row)        -> runImport
 *   2. if the import succeeded: run the adopted rules over the     -> proposalsForSchool
 *      fresh data and page for same-day absences (create-only)
 *
 * Intended cadence: every 15 minutes (docs/FEATURE_FLAGS.md). No scheduler is
 * created by this code; whoever owns the schedule points it at the route.
 *
 * Bounded
 *   - single-flight: a lease ('sampark-import') makes an overlapping run a no-op;
 *   - at most MAX_SCHOOLS_PER_RUN schools and TIME_BUDGET_MS per run, least
 *     recently imported first, so a slow school cannot starve the others;
 *   - a school imported less than MIN_INTERVAL_MS ago is "not due": a retried or
 *     doubled scheduler delivery costs the CRM nothing;
 *   - every CRM request has its own timeout, page and record caps (crm/*-source.ts).
 *
 * Idempotent: importing the same snapshot again writes the same records;
 * proposals, intents and pages are create-only. Isolated: one school's CRM being
 * down is reported in `errors` and never stops the others. A FAILED import is
 * retried on the next run (lastImportAt only advances on success) and does not
 * generate proposals from stale data.
 *
 * It never constructs a carrier and never places a call: only the dispatcher does.
 */

import crypto from 'node:crypto';
import os from 'node:os';

import { runImport } from '@/lib/sampark/crm/import';
import type { CrmSource } from '@/lib/sampark/ports';
import { logger } from '@/lib/logger';
import type { SamparkSchool } from '@/types/sampark';
import { crmSourceForSchool, hasConnectedCrm } from '@/server/sampark/crm-source';
import { proposalsForSchool } from '@/server/sampark/proposal-jobs';
import type { ProposalCtx } from '@/server/sampark/proposals';

export const IMPORT_LOCK = 'sampark-import';
export const IMPORT_JOB_OPTIONS = {
    maxSchoolsPerRun: 25,
    timeBudgetMs: 4 * 60 * 1000,
    minIntervalMs: 10 * 60 * 1000,
    lockTtlMs: 10 * 60 * 1000,
};

export interface ImportJobReport {
    /** True when another run held the lease: nothing was done. */
    skipped: boolean;
    /** Schools with a connected CRM that were considered. */
    schools: number;
    imported: number;
    /** Imported recently enough (< minIntervalMs): left alone. */
    notDue: number;
    /** Left for the next run: over the school or time budget. */
    deferred: number;
    /** Schools without a rest/mcp connection (csv or none). */
    noCrm: number;
    failed: number;
    proposalsCreated: number;
    pages: number;
    errors: string[];
}

export interface ImportJobDeps {
    /** Test seam: the source for a school (defaults to the adapter chosen by school.crm.kind). */
    crmSourceFor?: (school: SamparkSchool) => Promise<CrmSource>;
    options?: Partial<typeof IMPORT_JOB_OPTIONS>;
}

/** Only messages from our own CRM errors are shown; anything else (a secret store, a driver) stays generic. */
function safeMessage(err: unknown): string {
    if (err instanceof Error && /^(Crm|Csv|Import)/.test(err.name)) return err.message.slice(0, 200);
    return 'unexpected error';
}

export async function importJob(ctx: ProposalCtx, deps: ImportJobDeps = {}): Promise<ImportJobReport> {
    const opts = { ...IMPORT_JOB_OPTIONS, ...deps.options };
    const report: ImportJobReport = { skipped: false, schools: 0, imported: 0, notDue: 0, deferred: 0, noCrm: 0, failed: 0, proposalsCreated: 0, pages: 0, errors: [] };
    const holder = `import:${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
    if (!(await ctx.repo.acquireLock(IMPORT_LOCK, holder, ctx.clock.now(), opts.lockTtlMs))) return { ...report, skipped: true };

    const startedAt = ctx.clock.now().getTime();
    try {
        const all = await ctx.repo.listSchools();
        const connected = all.filter(hasConnectedCrm);
        report.noCrm = all.length - connected.length;
        const lastImport = (s: SamparkSchool) => (s.crm?.lastImportAt ? Date.parse(s.crm.lastImportAt) : Number.NEGATIVE_INFINITY);
        // Least recently imported first (never imported = oldest).
        connected.sort((a, b) => {
            const [la, lb] = [lastImport(a), lastImport(b)];
            return la < lb ? -1 : la > lb ? 1 : a.orgId.localeCompare(b.orgId);
        });

        let attempted = 0;
        for (const school of connected) {
            report.schools++;
            if (ctx.clock.now().getTime() - lastImport(school) < opts.minIntervalMs) {
                report.notDue++;
                continue;
            }
            if (attempted >= opts.maxSchoolsPerRun || ctx.clock.now().getTime() - startedAt >= opts.timeBudgetMs) {
                report.deferred++;
                continue;
            }
            attempted++;
            try {
                const source = await (deps.crmSourceFor ?? ((s) => crmSourceForSchool(s, null)))(school);
                const run = await runImport({ repo: ctx.repo, clock: ctx.clock }, school.orgId, source, 'import-job');
                if (run.status !== 'succeeded') {
                    report.failed++;
                    report.errors.push(`${school.orgId}: import failed: ${run.error ?? 'unknown error'}`.slice(0, 260));
                    continue;
                }
                report.imported++;
                // Fresh data: the adopted rules run over it right away. A failure here is reported, not fatal.
                const fresh = (await ctx.repo.getSchool(school.orgId)) ?? school;
                try {
                    const done = await proposalsForSchool(ctx, fresh);
                    report.proposalsCreated += done.created;
                    report.pages += done.pages;
                } catch (err) {
                    report.errors.push(`${school.orgId}: proposals failed: ${safeMessage(err)}`);
                    logger.warn('Sampark import job: proposals failed for a school', 'SAMPARK_IMPORT_JOB', { orgId: school.orgId, error: safeMessage(err) });
                }
            } catch (err) {
                report.failed++;
                report.errors.push(`${school.orgId}: ${safeMessage(err)}`);
                logger.warn('Sampark import job failed for a school', 'SAMPARK_IMPORT_JOB', { orgId: school.orgId, error: safeMessage(err) });
            }
        }
    } finally {
        await ctx.repo.releaseLock(IMPORT_LOCK, holder);
    }
    return report;
}
