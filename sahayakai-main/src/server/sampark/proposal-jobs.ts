/**
 * The scheduled slice-2 job (every 15 minutes, like ingest): for each school
 * that has adopted at least one rule, run the adopted rules over fresh CRM
 * signals (creating proposals; unadopted rules stay inert), and page for any
 * same-day absence call that ended with key 2 or no answer.
 *
 * Idempotent and safe to overlap: proposals, intents and pages are create-only.
 * It never constructs a carrier and never places a call.
 */

import { logger } from '@/lib/logger';
import type { SamparkSchool } from '@/types/sampark';
import { processAbsencePages, runRules, type ProposalCtx } from '@/server/sampark/proposals';

export interface ProposalsJobReport {
    schools: number;
    created: number;
    pages: number;
    errors: string[];
}

/**
 * One school's share of the job: if it has adopted at least one rule, run the adopted rules over fresh CRM
 * signals and page for same-day absences. Shared with the import job (which runs it right after a fresh import).
 */
export async function proposalsForSchool(ctx: ProposalCtx, school: SamparkSchool): Promise<{ adopted: boolean; created: number; pages: number }> {
    const adopted = (await ctx.rules.listCurrentAdoptions(school.orgId)).some((a) => a.status === 'adopted');
    if (!adopted) return { adopted: false, created: 0, pages: 0 };
    const created = (await runRules(ctx, school.orgId)).created;
    const pages = (await processAbsencePages(ctx, school.orgId)).created;
    return { adopted: true, created, pages };
}

export async function proposalsJob(ctx: ProposalCtx): Promise<ProposalsJobReport> {
    const report: ProposalsJobReport = { schools: 0, created: 0, pages: 0, errors: [] };
    for (const school of await ctx.repo.listSchools()) {
        try {
            const done = await proposalsForSchool(ctx, school);
            if (!done.adopted) continue;
            report.schools++;
            report.created += done.created;
            report.pages += done.pages;
        } catch (err) {
            // One school's CRM being down never stops the others.
            const message = err instanceof Error ? err.message.slice(0, 200) : 'unknown error';
            report.errors.push(`${school.orgId}: ${message}`);
            logger.warn('Sampark proposals job failed for a school', 'SAMPARK_PROPOSALS_JOB', { orgId: school.orgId, error: message });
        }
    }
    return report;
}
