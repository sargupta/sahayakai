/**
 * The Riya call reducer: provider events → call record. Pure.
 *
 * Forward-only and idempotent, because webhooks are retried, duplicated and
 * delivered out of order:
 *   - an event id already applied is a no-op;
 *   - a post-call transcription (a conversation happened) beats an initiation
 *     failure whichever arrives first;
 *   - 'unknown' (we could not tell whether the phone rang) may be resolved by a later
 *     authentic event, never the reverse;
 *   - nothing here ever schedules another dial. A person decides about retries.
 */

import { transcriptRequestsStop, type RiyaWebhookEvent } from './webhook';
import { isTerminalConversationState, type ConversationCall, type ConversationCallState } from './types';

export const MAX_APPLIED_EVENTS = 20;

export interface ApplyOptions {
    now: Date;
    /** SAMPARK_RIYA_STORE_TRANSCRIPTS === 'true' */
    storeTranscript: boolean;
    /** Days a stored transcript is kept (SAMPARK_RIYA_TRANSCRIPT_DAYS, default 30). */
    transcriptDays: number;
}

function withEvent(call: ConversationCall, eventId: string, at: string): Pick<ConversationCall, 'appliedEvents' | 'lastEventAt' | 'updatedAt'> {
    return { appliedEvents: [...call.appliedEvents, eventId].slice(-MAX_APPLIED_EVENTS), lastEventAt: at, updatedAt: at };
}

function stopRequested(call: ConversationCall, event: Extract<RiyaWebhookEvent, { kind: 'post_call' }>): boolean {
    const field = event.dataCollection.stop_requested?.toLowerCase();
    if (field === 'yes' || field === 'true') return true;
    return call.stopRequested || transcriptRequestsStop(event.transcript);
}

export function applyRiyaEvent(call: ConversationCall, event: RiyaWebhookEvent, opts: ApplyOptions): ConversationCall | null {
    if (event.kind === 'ignored') return null;
    if (call.appliedEvents.includes(event.eventId)) return null;
    const at = opts.now.toISOString();

    if (event.kind === 'initiation_failure') {
        // A conversation already recorded wins; keep the record of having seen the event.
        if (call.state === 'completed') return { ...call, ...withEvent(call, event.eventId, at) };
        const state: ConversationCallState = event.failureReason === 'busy' ? 'busy' : event.failureReason === 'no-answer' ? 'no_answer' : 'failed';
        return {
            ...call,
            ...withEvent(call, event.eventId, at),
            state,
            providerConversationId: call.providerConversationId ?? event.conversationId,
            providerStatus: 'initiation_failure',
            failureReason: `initiation_failure:${event.failureReason}`,
            endedAt: call.endedAt ?? at,
        };
    }

    // post_call
    const done = event.status === 'done';
    const transcript = opts.storeTranscript ? event.transcript : null;
    const expires = opts.storeTranscript ? new Date(opts.now.getTime() + opts.transcriptDays * 86_400_000).toISOString() : null;
    return {
        ...call,
        ...withEvent(call, event.eventId, at),
        state: done ? 'completed' : 'unknown',
        providerConversationId: call.providerConversationId ?? event.conversationId,
        providerStatus: event.status,
        durationSeconds: event.durationSeconds,
        terminationReason: event.terminationReason,
        callSuccessful: event.callSuccessful,
        dataCollection: { ...call.dataCollection, ...event.dataCollection },
        stopRequested: stopRequested(call, event),
        transcript,
        transcriptExpiresAt: expires,
        failureReason: done ? null : `post_call_status:${event.status.slice(0, 40)}`,
        endedAt: call.endedAt ?? at,
    };
}

/**
 * A reconciliation snapshot (GET conversation) applied to a call. Only a FINAL provider
 * status moves the call; 'initiated' / 'in-progress' / 'processing' leave it as is.
 */
export function applyRiyaSnapshot(
    call: ConversationCall,
    snap: { status: string; durationSeconds: number | null; terminationReason: string | null; callSuccessful: string | null },
    now: Date,
): ConversationCall | null {
    if (call.state === 'completed') return null;
    const at = now.toISOString();
    if (snap.status === 'done') {
        return {
            ...call,
            state: 'completed',
            providerStatus: 'done',
            durationSeconds: snap.durationSeconds,
            terminationReason: snap.terminationReason?.slice(0, 300) ?? null,
            callSuccessful: snap.callSuccessful === 'success' || snap.callSuccessful === 'failure' || snap.callSuccessful === 'unknown' ? snap.callSuccessful : null,
            failureReason: null,
            endedAt: call.endedAt ?? at,
            updatedAt: at,
        };
    }
    if (snap.status === 'failed') {
        if (isTerminalConversationState(call.state) && call.state !== 'unknown') return null;
        return { ...call, state: 'failed', providerStatus: 'failed', failureReason: 'provider_status:failed', endedAt: call.endedAt ?? at, updatedAt: at };
    }
    if (call.providerStatus === snap.status) return null;
    return { ...call, providerStatus: snap.status.slice(0, 40), updatedAt: at };
}
