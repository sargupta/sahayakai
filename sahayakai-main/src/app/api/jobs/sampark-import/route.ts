/**
 * POST /api/jobs/sampark-import — Cloud Scheduler / local ticker job (intended cadence: every 15 minutes).
 *
 * Input:  none. `Authorization: Bearer <CRON_SECRET>`.
 * Output: { skipped, schools, imported, notDue, deferred, noCrm, failed, proposalsCreated, pages, errors } — for every
 *         Sampark school with a connected CRM (rest or mcp): import the CRM, and when that succeeds run the adopted rules
 *         over the fresh data (proposals created, create-only) and page for same-day absences.
 * Auth:   requireCronAuth (503 if CRON_SECRET unset, 401 on a wrong bearer).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first). Never places a call: only the dispatcher does.
 * Cost:   one CRM import per due school per run (a school imported < 10 minutes ago is skipped), at most 25 schools and
 *         4 minutes per run, single-flight lease so overlapping deliveries do nothing. Every CRM request has a timeout and
 *         page/record caps.
 * Done:   idempotent on re-run; a school whose CRM is down is reported in `errors` and does not stop the others, and is
 *         retried on the next run. No scheduler is created by this route; see docs/FEATURE_FLAGS.md for the cadence.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/cron-auth';
import { errorResponse, samparkDisabledResponse } from '@/server/sampark/http';
import { importJob } from '@/server/sampark/import-jobs';
import { proposalContext } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const disabled = samparkDisabledResponse();
    if (disabled) return disabled;
    const denied = requireCronAuth(req);
    if (denied) return denied;
    try {
        return NextResponse.json(await importJob(await proposalContext()));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_IMPORT_JOB');
    }
}
