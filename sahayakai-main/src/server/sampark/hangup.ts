/**
 * Hang up Sampark calls that are still ringing on the real carrier (hardening H3 and H4,
 * docs/sampark/EDGE_CASES.md §3).
 *
 * Two staff actions need it: pausing the school (no call may start after the pause, and a
 * phone still ringing has not started yet) and cancelling a campaign (a parent should not
 * pick up a call about an event that was called off). Only calls in 'ringing' with a carrier
 * leg id are hung up. A call already speaking is left to finish, because cutting a parent off
 * mid-sentence is worse than letting the sentence end; the caller reports how many were still
 * speaking. A call still 'dialing' has no leg id yet: if it is answered, the answer webhook
 * refuses it (pause) or plays the withdrawn clip (cancel).
 *
 * Best effort and idempotent. The carrier's hangup callback then settles each call through
 * the ordinary path. Simulated calls never ring, so there is nothing to hang up in Practice mode.
 */

import { logger } from '@/lib/logger';
import { hangupVobizCall, readVobizConfig } from '@/lib/vobiz/client';
import type { SamparkCall } from '@/types/sampark';
import type { SamparkCtx } from '@/server/sampark/http';

export interface HangupReport {
    /** Ringing calls we asked the carrier to end. */
    attempted: number;
    /** Of those, the carrier confirmed. */
    hungUp: number;
    /** Calls already speaking (in progress), left to finish. */
    stillSpeaking: number;
}

export interface HangupOptions {
    /** Only this campaign's calls; all of the school's open calls when omitted. */
    campaignId?: string;
    /** Further filter, e.g. "not an emergency closure" for a routine-only pause. */
    include?: (call: SamparkCall) => boolean;
    /** Recorded in the audit log: 'school_paused' | 'campaign_cancelled'. */
    reason: string;
    actor: string;
}

/** The carrier call that ends one live leg. Injectable for tests. */
export type LegHangup = (callUuid: string) => Promise<boolean>;

function defaultLegHangup(): LegHangup | null {
    const config = readVobizConfig();
    return config ? (uuid) => hangupVobizCall(config, uuid) : null;
}

export async function hangupRingingCalls(ctx: SamparkCtx, orgId: string, opts: HangupOptions, legHangup: LegHangup | null = defaultLegHangup()): Promise<HangupReport> {
    const report: HangupReport = { attempted: 0, hungUp: 0, stillSpeaking: 0 };
    const calls = await ctx.repo.listCalls(orgId, { campaignId: opts.campaignId, limit: 1000 });
    const include = opts.include ?? (() => true);
    for (const call of calls) {
        if (call.carrier !== 'vobiz' || !include(call)) continue;
        if (call.state === 'in_progress') {
            report.stillSpeaking += 1;
            continue;
        }
        if (call.state !== 'ringing' || !call.vobizCallUuid || !legHangup) continue;
        report.attempted += 1;
        let ok = false;
        try {
            ok = await legHangup(call.vobizCallUuid);
        } catch (err) {
            logger.warn('Sampark hangup request failed', 'SAMPARK_HANGUP', { orgId, callId: call.id, error: err instanceof Error ? err.message : 'unknown' });
        }
        if (ok) report.hungUp += 1;
        await ctx.repo.appendAudit(orgId, {
            at: ctx.clock.now().toISOString(),
            actor: opts.actor,
            action: 'call.hangup_requested',
            target: `call/${call.id}`,
            detail: { reason: opts.reason, confirmed: ok },
        });
    }
    return report;
}
