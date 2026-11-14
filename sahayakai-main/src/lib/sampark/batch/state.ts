/**
 * Pure rules for a class-wide batch campaign: how a Riya call's state maps onto its recipient,
 * progress counts, which recipients may be retried, and when the campaign has finished.
 * No I/O here, so every rule is unit-tested directly.
 */

import type { ConversationCall, ConversationCallState } from '@/lib/sampark/conversation/types';

import {
    BATCH_ACTIVE_STATUSES,
    BATCH_MAX_ATTEMPTS,
    BATCH_RETRYABLE_STATUSES,
    type BatchCampaign,
    type BatchProgress,
    type BatchRecipient,
    type BatchRecipientStatus,
} from './types';

export function recipientStatusForCall(state: ConversationCallState): BatchRecipientStatus {
    switch (state) {
        case 'initiating':
        case 'initiated':
            return 'in_progress';
        case 'completed':
        case 'no_answer':
        case 'busy':
        case 'failed':
        case 'unknown':
            return state;
        default:
            return 'unknown';
    }
}

/** The callback / stop requests a call carries (collected answer, phrase match or synopsis). */
export function callRequests(call: Pick<ConversationCall, 'dataCollection' | 'stopRequested' | 'synopsis'>): { callbackRequested: boolean; stopRequested: boolean } {
    const cb = call.dataCollection?.callback_requested_time;
    return {
        callbackRequested: Boolean((cb && cb.trim() && cb.trim().toLowerCase() !== 'not_applicable') || call.synopsis?.callbackRequest),
        stopRequested: Boolean(call.stopRequested),
    };
}

/**
 * Mirrors one call onto its recipient. Only the recipient's CURRENT call may move it (an older
 * attempt's late webhook never overwrites a newer attempt), and a cancelled recipient stays cancelled.
 * Returns null when nothing changes.
 */
export function applyCallToRecipient(r: BatchRecipient, call: Pick<ConversationCall, 'id' | 'state' | 'dataCollection' | 'stopRequested' | 'synopsis' | 'failureReason'>, nowIso: string): BatchRecipient | null {
    if (r.currentCallId !== call.id) return null;
    if (r.status === 'cancelled' || r.status === 'skipped') return null;
    const status = recipientStatusForCall(call.state);
    const req = callRequests(call);
    const callIds = r.callIds.includes(call.id) ? r.callIds : [...r.callIds, call.id];
    const lastError = status === 'failed' && call.failureReason ? { code: 'CALL_FAILED', message: call.failureReason.slice(0, 200) } : r.lastError;
    if (status === r.status && req.callbackRequested === r.callbackRequested && req.stopRequested === r.stopRequested && callIds === r.callIds && lastError === r.lastError) return null;
    return { ...r, status, callIds, claimUntil: null, callbackRequested: req.callbackRequested, stopRequested: req.stopRequested, lastError, updatedAt: nowIso };
}

export function progressOf(c: Pick<BatchCampaign, 'recipients'>): BatchProgress {
    const p: BatchProgress = {
        total: c.recipients.length, completed: 0, inProgress: 0, pending: 0, retrying: 0,
        noAnswer: 0, busy: 0, failed: 0, failedOrNoAnswer: 0, unknown: 0, skipped: 0, cancelled: 0,
        callbackRequested: 0, stopRequested: 0,
    };
    for (const r of c.recipients) {
        if (r.status === 'completed') p.completed += 1;
        else if (BATCH_ACTIVE_STATUSES.includes(r.status)) p.inProgress += 1;
        else if (r.status === 'pending') {
            p.pending += 1;
            if (r.attempts > 0) p.retrying += 1;
        } else if (BATCH_RETRYABLE_STATUSES.includes(r.status)) {
            p.failedOrNoAnswer += 1;
            if (r.status === 'no_answer') p.noAnswer += 1;
            else if (r.status === 'busy') p.busy += 1;
            else p.failed += 1;
        } else if (r.status === 'unknown') p.unknown += 1;
        else if (r.status === 'skipped') p.skipped += 1;
        else if (r.status === 'cancelled') p.cancelled += 1;
        if (r.callbackRequested) p.callbackRequested += 1;
        if (r.stopRequested) p.stopRequested += 1;
    }
    return p;
}

/**
 * A recipient may be retried (explicit action only) when the last call did not reach a conversation
 * and nothing says the family should not be called: not after a stop request, not when they asked
 * for a callback (that is a proposed callback a person schedules), not an unknown outcome (a person
 * reviews it first), and only up to BATCH_MAX_ATTEMPTS calls.
 */
export function isRetryable(r: BatchRecipient): boolean {
    return BATCH_RETRYABLE_STATUSES.includes(r.status) && !r.stopRequested && !r.callbackRequested && r.attempts < BATCH_MAX_ATTEMPTS;
}

export function hasActiveRecipients(c: Pick<BatchCampaign, 'recipients'>): boolean {
    return c.recipients.some((r) => BATCH_ACTIVE_STATUSES.includes(r.status));
}

/** A running campaign is completed once no recipient is pending or in flight. */
export function isFinished(c: Pick<BatchCampaign, 'recipients'>): boolean {
    return !c.recipients.some((r) => r.status === 'pending' || BATCH_ACTIVE_STATUSES.includes(r.status));
}

/** Whether the queue still has to look at this campaign (running/paused, or calls still in flight). */
export function isOpen(c: Pick<BatchCampaign, 'status' | 'recipients'>): boolean {
    return c.status === 'running' || c.status === 'paused' || hasActiveRecipients(c);
}
