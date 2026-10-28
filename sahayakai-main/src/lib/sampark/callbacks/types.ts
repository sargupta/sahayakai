/**
 * Callbacks: a Riya call to one family, scheduled for a later instant.
 *
 * A callback stores WHO (guardian + student of record) and WHAT (the Riya
 * purpose and its facts, or the campaign whose facts to use) — the same inputs
 * a person gives the Riya tab — plus WHEN (a UTC instant and the IANA zone it
 * was chosen in). At the due instant the worker (src/server/sampark/callbacks.ts,
 * driven by the existing /api/jobs/sampark-dispatch scheduler tick) re-runs every
 * Riya check and starts the call through startRiyaCall with a key derived from
 * (callback id, version), so a retried or crashed run can never dial twice.
 *
 * Layout (Admin SDK only; firestore.rules default-deny covers every sampark_* path):
 *   sampark_schools/{orgId}/sampark_callbacks/{callbackId}   SamparkCallback
 */

import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import type { RiyaPurpose } from '@/lib/sampark/conversation/riya-purposes';

export const CALLBACK_STATUSES = [
    /** From a parent's request on a call; waits for a person. NEVER executes by itself. */
    'proposed',
    /** Approved; the worker starts it at scheduledAt. */
    'scheduled',
    /** A worker holds the lease and is starting the call. */
    'running',
    /** The Riya call was started (its own outcome is on the call record). */
    'completed',
    /** Terminal: a check refused the call, or retries ran out. A person may reschedule. */
    'failed',
    /** Terminal: the worker reached it too late to call without surprising the family. */
    'missed',
    'cancelled',
] as const;
export type CallbackStatus = (typeof CALLBACK_STATUSES)[number];

/** Statuses a person may still act on (reschedule / cancel). */
export const OPEN_CALLBACK_STATUSES: readonly CallbackStatus[] = ['proposed', 'scheduled', 'failed', 'missed'];

export interface CallbackError {
    /** Stable machine code (a Riya refusal code or a callback code). */
    code: string;
    /** Safe to show; never contains a phone number. */
    message: string;
    at: string;
}

export interface CallbackLease {
    holder: string;
    until: string;
}

export interface SamparkCallback {
    /** Server-generated: hash(orgId | request key). Also the record id. */
    id: string;
    orgId: string;

    // WHO and WHAT — record ids only; the phone is resolved on the server at run time.
    guardianId: string;
    studentId: string;
    riyaPurpose: RiyaPurpose;
    facts: RiyaFacts | null;
    campaignId: string | null;
    /** What Riya will say, as a person approved it. Null until a proposal is confirmed. */
    announcement: string | null;

    // WHEN
    /** UTC instant, ISO 8601 with Z. Null only for a proposal whose time was ambiguous. */
    scheduledAt: string | null;
    /** IANA zone the time was chosen in (display and parsing; the calling window is the school's). */
    timeZone: string;
    /** Suggested instants for an ambiguous proposal ("tomorrow morning"); a person picks one. */
    candidates: string[];

    status: CallbackStatus;
    /** Bumped by every reschedule; part of the run's idempotency key. */
    version: number;
    /**
     * Worker queue position: due time while 'scheduled' (scheduledAt, or a retry time),
     * lease expiry while 'running', null otherwise. The worker's only query is
     * `queueAt <= now`, so terminal and proposed records are never read by it.
     */
    queueAt: string | null;
    attempts: number;
    lease: CallbackLease | null;

    // Outcome
    riyaCallId: string | null;
    lastError: CallbackError | null;

    // Origin
    source: 'staff' | 'conversation';
    /** The Riya call this callback follows up, if any. */
    sourceCallId: string | null;
    /** The parent's words, bounded (conversation proposals only). */
    requestedText: string | null;
    note: string | null;

    /** 'riya' for a conversation proposal. */
    createdBy: string;
    /** The person whose approval the call runs under. Null for an unconfirmed proposal. */
    approvedBy: string | null;
    createdAt: string;
    updatedAt: string;
    cancelledBy: string | null;
    completedAt: string | null;
}

/** The console's view: display names joined, never a phone number beyond its last four digits. */
export interface CallbackView extends Omit<SamparkCallback, 'lease'> {
    guardianDisplayName: string | null;
    studentDisplayName: string | null;
    guardianPhoneLast4: string | null;
    /** The Riya call's state once started ('completed', 'no_answer', …). */
    callState: string | null;
}
