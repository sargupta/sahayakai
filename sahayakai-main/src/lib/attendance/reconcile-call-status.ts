/**
 * Parent-call status: the ONE place that decides how `callStatus` may change
 * and what a consumer should show (CLAUDE.md standing law 1, "reconciled
 * reader").
 *
 * Why: several writers touch `parent_outreach.callStatus` — the call route
 * after dialling, the carrier's answer and status webhooks, the bridge — and
 * they arrive in no guaranteed order. Without a rule, a late `initiated`
 * written after the dial returned could overwrite a `busy` that the carrier had
 * already reported, and a record whose call never connected stayed `initiated`
 * forever (audit F7/F9, docs/calling/PARENT_CALL_AUDIT_2026-10-08.md).
 *
 * The rule: status only moves FORWARD (initiated < ringing < in_progress <
 * terminal), and the FIRST terminal status wins, details included. Extra fields
 * (duration, carrier ids, timestamps) are merged on every other write, so a
 * late progress event still records its timestamp.
 */

import type { CallStatus } from '@/types/attendance';

export const TERMINAL_CALL_STATUSES: readonly CallStatus[] = ['completed', 'failed', 'no_answer', 'busy'];

const RANK: Record<CallStatus, number> = {
    initiated: 1,
    ringing: 2,
    in_progress: 3,
    completed: 4,
    failed: 4,
    no_answer: 4,
    busy: 4,
    // Not a phone call at all (WhatsApp copy): never moved by call events.
    manual: 0,
};

export function isTerminalCallStatus(status: unknown): status is CallStatus {
    return (TERMINAL_CALL_STATUSES as readonly unknown[]).includes(status);
}

/**
 * The status to store when `incoming` arrives while the record holds `current`.
 * Returns `current` unchanged when the transition is not allowed.
 */
export function nextCallStatus(current: CallStatus | null | undefined, incoming: CallStatus): CallStatus {
    if (!current) return incoming;
    if (current === 'manual') return current;
    if (isTerminalCallStatus(current)) return current;
    return RANK[incoming] > RANK[current] ? incoming : current;
}

/** The minimal Firestore surface this needs, so routes and tests share it. */
export interface CallStatusDb {
    runTransaction<T>(fn: (tx: {
        get(ref: unknown): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
        update(ref: unknown, data: Record<string, unknown>): unknown;
    }) => Promise<T>): Promise<T>;
    collection(name: string): { doc(id: string): unknown };
}

export interface CallStatusWrite {
    /** The status actually stored after the write. */
    status: CallStatus | null;
    /** Whether `incoming` was applied (false = ignored as a regression). */
    applied: boolean;
}

/**
 * Transactionally apply `incoming` (if allowed) and merge `fields`.
 * A missing record is reported as `{ status: null, applied: false }`.
 */
export async function writeCallStatus(
    db: CallStatusDb,
    outreachId: string,
    incoming: CallStatus,
    fields: Record<string, unknown> = {},
): Promise<CallStatusWrite> {
    const ref = db.collection('parent_outreach').doc(outreachId);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { status: null, applied: false };
        const current = (snap.data()?.callStatus ?? null) as CallStatus | null;
        const next = nextCallStatus(current, incoming);
        // The FIRST terminal event owns the outcome AND its details. A second
        // terminal event (a carrier retry, a duplicate hangup with another
        // cause) must not rewrite the recorded duration or hangup cause: found
        // in local verification, where a duplicate CALL_REJECTED/Duration=0
        // turned a 61 s completed call into a 0 s one.
        if (isTerminalCallStatus(current) && isTerminalCallStatus(incoming)) {
            return { status: current, applied: current === incoming };
        }
        tx.update(ref, {
            ...fields,
            ...(next !== current ? { callStatus: next } : {}),
            updatedAt: new Date().toISOString(),
        });
        // A duplicate of the stored status counts as applied (idempotent).
        return { status: next, applied: next === incoming };
    });
}

/** A call still "initiated" after this long never connected. */
export const STALE_INITIATED_MS = 15 * 60 * 1000;

/**
 * What a CONSUMER should show for a stored outreach record. Readers must use
 * this rather than `data.callStatus` directly.
 *
 * - `initiated` that is older than STALE_INITIATED_MS → `failed` (the dial or
 *   its webhooks were lost; the record must not say "Calling…" forever).
 * - A call the carrier reports as completed but whose conversation engine
 *   never came up (`engineFailure`) → `failed`: the parent heard only the
 *   opener.
 */
export function reconcileCallStatus(
    data: { callStatus?: unknown; createdAt?: unknown; updatedAt?: unknown; engineFailure?: unknown },
    now: number = Date.now(),
): CallStatus | null {
    const status = (typeof data.callStatus === 'string' ? data.callStatus : null) as CallStatus | null;
    if (!status) return null;
    if (data.engineFailure && status === 'completed') return 'failed';
    if (status === 'initiated') {
        const since = Date.parse(String(data.updatedAt ?? data.createdAt ?? ''));
        if (Number.isFinite(since) && now - since > STALE_INITIATED_MS) return 'failed';
    }
    return status;
}
