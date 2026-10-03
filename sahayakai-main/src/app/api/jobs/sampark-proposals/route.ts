/**
 * POST /api/jobs/sampark-proposals — Cloud Scheduler / local ticker job (every 15 minutes).
 *
 * Input:  none. `Authorization: Bearer <CRON_SECRET>`.
 * Output: { schools, created, pages, errors } — for every school with an adopted rule: the adopted rules run over
 *         fresh CRM signals (proposals created, create-only), and same-day-absence calls that ended with key 2 or no
 *         answer page the class teacher and principal.
 * Auth:   requireCronAuth (503 if CRON_SECRET unset, 401 on a wrong bearer).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first). Never places a call: only the dispatcher does.
 * Cost:   one CRM signals pull per adopted school per run.
 * Done:   unadopted rules stay inert; a school whose CRM is down is reported in `errors` and does not stop the others.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/cron-auth';
import { errorResponse, samparkDisabledResponse } from '@/server/sampark/http';
import { proposalsJob } from '@/server/sampark/proposal-jobs';
import { proposalContext } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const disabled = samparkDisabledResponse();
    if (disabled) return disabled;
    const denied = requireCronAuth(req);
    if (denied) return denied;
    try {
        return NextResponse.json(await proposalsJob(await proposalContext()));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_PROPOSALS_JOB');
    }
}
