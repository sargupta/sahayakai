/**
 * The callback state machine. Pure: every function takes a record and returns the
 * next record, or a refusal code. Repos apply these inside a transaction, so two
 * workers, or a worker and a person, can never both win:
 *
 *   proposed  ──confirm──▶ scheduled ──claim──▶ running ──▶ completed
 *       │                  │  ▲   │               │  └────▶ failed     (terminal refusal / retries out)
 *       │                  │  │   └──(too late)──────────▶ missed
 *       │                  │  └──── retry (transient) ◀──┘
 *       └──cancel──▶ cancelled ◀──cancel── scheduled / failed / missed
 *   scheduled / failed / missed ──reschedule──▶ scheduled (version + 1)
 *
 * A 'running' record cannot be cancelled or rescheduled: the call may already be
 * ringing. A 'running' record whose lease expired (the worker died) is claimable
 * again with the SAME version, so the retry reuses the same idempotency key and
 * startRiyaCall returns the call the dead worker started instead of dialling.
 */

import type { CallbackStatus, SamparkCallback } from './types';

/** How long a worker may hold a claim before another may take over. */
export const CALLBACK_LEASE_MS = 5 * 60_000;
/** Runs reached later than this after scheduledAt are 'missed', not called. */
export const CALLBACK_MISSED_GRACE_MS = 60 * 60_000;
/** Total starts tried before a transient failure becomes terminal. */
export const CALLBACK_MAX_ATTEMPTS = 4;
/** Delay before retrying a transient failure (multiplied by the attempt number). */
export const CALLBACK_RETRY_DELAY_MS = 2 * 60_000;
/** A callback may be scheduled at least this far ahead … */
export const CALLBACK_MIN_LEAD_MS = 60_000;
/** … and at most this far. */
export const CALLBACK_MAX_AHEAD_MS = 30 * 24 * 60 * 60_000;

export type TransitionRefusal =
    | 'CALLBACK_IN_PROGRESS'
    | 'CALLBACK_NOT_OPEN'
    | 'CALLBACK_CHANGED'
    | 'CALLBACK_NOT_PROPOSED';

export type Transition = { ok: true; next: SamparkCallback } | { ok: false; code: TransitionRefusal };

const iso = (d: Date) => d.toISOString();

function refuse(code: TransitionRefusal): Transition {
    return { ok: false, code };
}

function checkVersion(cb: SamparkCallback, expectedVersion: number | undefined): TransitionRefusal | null {
    return expectedVersion !== undefined && expectedVersion !== cb.version ? 'CALLBACK_CHANGED' : null;
}

/** A person moves an open callback to a new instant with a (re)approved announcement. */
export function reschedule(
    cb: SamparkCallback,
    input: { scheduledAt: Date; timeZone: string; announcement: string; uid: string; now: Date; expectedVersion?: number },
): Transition {
    if (cb.status === 'running') return refuse('CALLBACK_IN_PROGRESS');
    if (cb.status !== 'scheduled' && cb.status !== 'failed' && cb.status !== 'missed' && cb.status !== 'proposed') return refuse('CALLBACK_NOT_OPEN');
    const stale = checkVersion(cb, input.expectedVersion);
    if (stale) return refuse(stale);
    const at = iso(input.scheduledAt);
    return {
        ok: true,
        next: {
            ...cb,
            status: 'scheduled',
            scheduledAt: at,
            timeZone: input.timeZone,
            candidates: [],
            announcement: input.announcement,
            version: cb.version + 1,
            queueAt: at,
            attempts: 0,
            lease: null,
            lastError: null,
            riyaCallId: null,
            approvedBy: input.uid,
            updatedAt: iso(input.now),
            completedAt: null,
        },
    };
}

/** A person cancels. Never while a worker is starting the call. */
export function cancel(cb: SamparkCallback, input: { uid: string; now: Date; expectedVersion?: number }): Transition {
    if (cb.status === 'running') return refuse('CALLBACK_IN_PROGRESS');
    if (!(['proposed', 'scheduled', 'failed', 'missed'] as CallbackStatus[]).includes(cb.status)) return refuse('CALLBACK_NOT_OPEN');
    const stale = checkVersion(cb, input.expectedVersion);
    if (stale) return refuse(stale);
    return { ok: true, next: { ...cb, status: 'cancelled', queueAt: null, lease: null, cancelledBy: input.uid, updatedAt: iso(input.now) } };
}

/** True when a worker may claim this record now. */
export function isClaimable(cb: SamparkCallback, now: Date): boolean {
    if (!cb.queueAt || cb.queueAt > iso(now)) return false;
    if (cb.status === 'scheduled') return true;
    // A worker died holding it: its lease expired.
    return cb.status === 'running' && (!cb.lease || cb.lease.until <= iso(now));
}

export type ClaimResult =
    | { kind: 'claimed'; next: SamparkCallback }
    | { kind: 'missed'; next: SamparkCallback }
    | { kind: 'skip' };

/** The worker's atomic claim. Too-late runs become 'missed' instead of being called. */
export function claim(cb: SamparkCallback, input: { holder: string; now: Date; leaseMs?: number }): ClaimResult {
    if (!isClaimable(cb, input.now)) return { kind: 'skip' };
    const now = iso(input.now);
    const scheduled = cb.scheduledAt ? new Date(cb.scheduledAt).getTime() : input.now.getTime();
    // A retry is deliberately late; only the first start is held to the grace period.
    if (cb.attempts === 0 && cb.status === 'scheduled' && input.now.getTime() - scheduled > CALLBACK_MISSED_GRACE_MS) {
        return {
            kind: 'missed',
            next: {
                ...cb,
                status: 'missed',
                queueAt: null,
                lease: null,
                lastError: { code: 'CALLBACK_MISSED', message: 'The callback time passed more than an hour ago without the call being placed. Choose a new time.', at: now },
                updatedAt: now,
            },
        };
    }
    const until = iso(new Date(input.now.getTime() + (input.leaseMs ?? CALLBACK_LEASE_MS)));
    // Re-claiming an expired 'running' record keeps the attempt count: the same start is being finished.
    const attempts = cb.status === 'running' ? cb.attempts : cb.attempts + 1;
    return { kind: 'claimed', next: { ...cb, status: 'running', attempts, lease: { holder: input.holder, until }, queueAt: until, updatedAt: now } };
}

/** Only the lease holder may finish a run. */
function holds(cb: SamparkCallback, holder: string): boolean {
    return cb.status === 'running' && cb.lease?.holder === holder;
}

export function complete(cb: SamparkCallback, input: { holder: string; now: Date; riyaCallId: string }): SamparkCallback | null {
    if (!holds(cb, input.holder)) return null;
    const now = iso(input.now);
    return { ...cb, status: 'completed', riyaCallId: input.riyaCallId, queueAt: null, lease: null, lastError: null, completedAt: now, updatedAt: now };
}

export function fail(cb: SamparkCallback, input: { holder: string; now: Date; code: string; message: string }): SamparkCallback | null {
    if (!holds(cb, input.holder)) return null;
    const now = iso(input.now);
    return { ...cb, status: 'failed', queueAt: null, lease: null, lastError: { code: input.code, message: input.message, at: now }, updatedAt: now };
}

/** A transient failure: back to 'scheduled' later, or 'failed' once attempts run out. */
export function retryOrFail(cb: SamparkCallback, input: { holder: string; now: Date; code: string; message: string }): SamparkCallback | null {
    if (!holds(cb, input.holder)) return null;
    if (cb.attempts >= CALLBACK_MAX_ATTEMPTS) {
        return fail(cb, { ...input, message: `${input.message} (gave up after ${cb.attempts} attempts)` });
    }
    const now = iso(input.now);
    const queueAt = iso(new Date(input.now.getTime() + CALLBACK_RETRY_DELAY_MS * cb.attempts));
    return { ...cb, status: 'scheduled', queueAt, lease: null, lastError: { code: input.code, message: input.message, at: now }, updatedAt: now };
}

/** The idempotency key startRiyaCall gets for this run: stable per (callback, version), uuid-shaped. */
export function runIdempotencyKey(hexDigest: string): string {
    const h = hexDigest.slice(0, 32).padEnd(32, '0');
    // Version-5-style layout (variant bits set) so it passes a strict uuid check.
    const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
