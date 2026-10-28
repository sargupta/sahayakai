/**
 * POST /api/jobs/sampark-dispatch — Cloud Scheduler / local ticker job (every minute).
 *
 * Input:  none. `Authorization: Bearer <CRON_SECRET>`.
 * Output: DispatchReport { schools, dialed, deferred, blocked, skipped, swept, errors }.
 *         One dispatcher tick: single-flight lease, sweep calls lost in
 *         'dialing' to 'unknown' (never re-dialled), then per school gate →
 *         claim (transaction) → place → record. Campaigns move scheduled →
 *         dispatching → completed when every intent is terminal.
 * Auth:   requireCronAuth (503 if CRON_SECRET unset, 401 on a wrong bearer).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first). Carrier: practice
 *         → simulated; anything else is refused (SAMPARK_LIVE_DIAL_ENABLED is
 *         false and slice 1 has no real carrier).
 * Cost:   ≤25 dials per school per tick, ≤20 in flight per school; simulated
 *         calls cost nothing.
 * Done:   calls happen only inside the school's window; outcomes, keys and
 *         opt-outs are recorded.
 * Then:   due callbacks (src/server/sampark/callbacks.ts runCallbackTick) under their
 *         own single-flight lock, when Riya is on: claim → re-check → startRiyaCall.
 *         Reported as `callbacks`. A callback failure never fails the dispatch tick.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/cron-auth';
import { errorResponse, samparkContext, samparkDisabledResponse } from '@/server/sampark/http';
import { dispatchJob } from '@/server/sampark/jobs';
import { callbackDeps, runCallbackTick, type CallbackTickReport } from '@/server/sampark/callbacks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const disabled = samparkDisabledResponse();
    if (disabled) return disabled;
    const denied = requireCronAuth(req);
    if (denied) return denied;
    try {
        const ctx = await samparkContext();
        const dispatch = await dispatchJob(ctx);
        let callbacks: CallbackTickReport | { error: string };
        try {
            callbacks = await runCallbackTick(await callbackDeps(ctx));
        } catch (err) {
            console.error('[SAMPARK_CALLBACKS] tick failed', err);
            callbacks = { error: 'callback tick failed' };
        }
        return NextResponse.json({ ...dispatch, callbacks });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_DISPATCH_JOB');
    }
}
