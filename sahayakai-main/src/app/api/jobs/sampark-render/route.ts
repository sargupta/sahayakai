/**
 * POST /api/jobs/sampark-render — Cloud Scheduler / local ticker job.
 *
 * Input:  none. `Authorization: Bearer <CRON_SECRET>`.
 * Output: RenderJobReport { skipped, campaigns, clipsRendered, scheduled,
 *         renderFailed, errors }. For every 'rendering' campaign: render up
 *         to 24 clips per campaign per tick (skipping clips that exist),
 *         transcribe-back verify 'message' clips; when finished with no
 *         failures → materialise intents → 'scheduled'; any failure →
 *         'render_failed' (nothing dispatched).
 * Auth:   requireCronAuth (503 if CRON_SECRET unset, 401 on a wrong bearer).
 *         /api/jobs/ is a public middleware prefix, so this check is the gate.
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   TTS (Gemini-TTS / Chirp 3 HD) + Chirp 2 STT per NEW clip only;
 *         single-flight lease 'sampark-render'.
 * Done:   an approved campaign reaches 'scheduled' with intents, blocked ones with reasons.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/cron-auth';
import { getSpeechDeps } from '@/lib/sampark/repo/factory';
import { errorResponse, samparkContext, samparkDisabledResponse } from '@/server/sampark/http';
import { renderJob } from '@/server/sampark/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    const disabled = samparkDisabledResponse();
    if (disabled) return disabled;
    const denied = requireCronAuth(req);
    if (denied) return denied;
    try {
        const ctx = await samparkContext();
        const speech = await getSpeechDeps();
        return NextResponse.json(await renderJob({ ...ctx, speech }));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_RENDER_JOB');
    }
}
