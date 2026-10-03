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
import { processAbsencePages, runRules, type ProposalCtx } from '@/server/sampark/proposals';

export interface ProposalsJobReport {
    schools: number;
    created: number;
    pages: number;
    errors: string[];
}

export async function proposalsJob(ctx: ProposalCtx): Promise<ProposalsJobReport> {
    const report: ProposalsJobReport = { schools: 0, created: 0, pages: 0, errors: [] };
    for (const school of await ctx.repo.listSchools()) {
        try {
            const adopted = (await ctx.rules.listCurrentAdoptions(school.orgId)).some((a) => a.status === 'adopted');
            if (!adopted) continue;
            report.schools++;
            report.created += (await runRules(ctx, school.orgId)).created;
            report.pages += (await processAbsencePages(ctx, school.orgId)).created;
        } catch (err) {
            // One school's CRM being down never stops the others.
            const message = err instanceof Error ? err.message.slice(0, 200) : 'unknown error';
            report.errors.push(`${school.orgId}: ${message}`);
            logger.warn('Sampark proposals job failed for a school', 'SAMPARK_PROPOSALS_JOB', { orgId: school.orgId, error: message });
        }
    }
    return report;
}
