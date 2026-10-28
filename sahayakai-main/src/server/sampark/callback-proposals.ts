/**
 * A parent's "call me back" on a Riya call → a PROPOSED callback.
 *
 * Called once from the conversation service when a call settles. It never
 * schedules or starts anything: a proposal has no approved announcement and no
 * queue position, so the worker cannot see it. A school admin confirms it in the
 * callback calendar (choosing a time when the request was ambiguous), and only
 * then does it become 'scheduled'. Idempotent: the id is derived from the call id,
 * so a re-delivered webhook proposes nothing new.
 */

import crypto from 'node:crypto';

import type { CallbackRepo } from '@/lib/sampark/callbacks/repo';
import { DEFAULT_CALLBACK_TIME_ZONE, parseCallbackTime } from '@/lib/sampark/callbacks/time';
import type { SamparkCallback } from '@/lib/sampark/callbacks/types';
import type { ConversationCall } from '@/lib/sampark/conversation/types';
import type { Clock, SamparkRepo } from '@/lib/sampark/ports';

export const MAX_REQUESTED_TEXT = 120;

export function proposalIdFor(orgId: string, callId: string): string {
    return crypto.createHash('sha256').update(`${orgId}|proposal|${callId}`).digest('hex').slice(0, 32);
}

export async function proposeCallbackFromCall(
    deps: { callbacks: CallbackRepo; repo: SamparkRepo; clock: Clock },
    call: ConversationCall,
): Promise<SamparkCallback | null> {
    const raw = call.dataCollection.callback_requested_time;
    const requested = typeof raw === 'string' ? raw.trim().slice(0, MAX_REQUESTED_TEXT) : '';
    if (!requested || ['no', 'none', 'null', 'n/a'].includes(requested.toLowerCase())) return null;
    if (!call.facts && !call.campaignId) {
        // A call recorded before callbacks existed: nothing to call back about.
        await deps.repo.appendAudit(call.orgId, {
            at: deps.clock.now().toISOString(), actor: 'riya', action: 'callback.not_proposed', target: `riya_call/${call.id}`, detail: { reason: 'no_source_facts' },
        });
        return null;
    }

    const now = deps.clock.now();
    const timeZone = DEFAULT_CALLBACK_TIME_ZONE;
    const parsed = parseCallbackTime(requested, now, timeZone);
    const nowIso = now.toISOString();
    const proposal: SamparkCallback = {
        id: proposalIdFor(call.orgId, call.id),
        orgId: call.orgId,
        guardianId: call.guardianId,
        studentId: call.studentId,
        riyaPurpose: call.riyaPurpose,
        facts: call.facts ?? null,
        campaignId: call.campaignId ?? null,
        announcement: null,
        scheduledAt: parsed.status === 'exact' ? parsed.at.toISOString() : null,
        timeZone,
        candidates: parsed.status === 'ambiguous' ? parsed.candidates.map((c) => c.toISOString()) : [],
        status: 'proposed',
        version: 0,
        queueAt: null,
        attempts: 0,
        lease: null,
        riyaCallId: null,
        lastError: null,
        source: 'conversation',
        sourceCallId: call.id,
        requestedText: requested,
        note: null,
        createdBy: 'riya',
        approvedBy: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        cancelledBy: null,
        completedAt: null,
    };
    if (!(await deps.callbacks.createIfAbsent(proposal))) return null;
    await deps.repo.appendAudit(call.orgId, {
        at: nowIso, actor: 'riya', action: 'callback.proposed', target: `callback/${proposal.id}`,
        detail: { sourceCallId: call.id, parse: parsed.status },
    });
    return proposal;
}
