/**
 * Vobiz's hangup callback → the reducer's `hangup` event.
 *
 * The callback is the one authoritative report of how a call ended, and its
 * shape is not stable across Vobiz's own docs: the documented content type is
 * form-encoded but the example body is JSON, the example carries `Status` and
 * `Duration` but no `HangupCause`, and numbers may arrive as strings or as
 * numbers. So this reads every spelling we know and decides in a fixed order:
 *
 *   1. `HangupCause` when present (the telephony cause, as the teacher-path
 *      attendance webhook already maps it);
 *   2. otherwise `Status` / `CallStatus`;
 *   3. a value we do not recognise counts as `completed` ONLY when the call
 *      lasted more than zero seconds, else `failed` — a new provider string can
 *      never quietly inflate the "parent heard it" numbers.
 *
 * Billing: `BillDuration` when the carrier sends it; otherwise an answered call
 * is billed in whole 60-second units (at least one), and an unanswered call is
 * free (Vobiz bills answered calls only, plan §7).
 *
 * The cause table (hardening H7, EDGE_CASES.md §2 gap 7) also says what each
 * cause means for the family's number. A dead, invalid or changed number is
 * never retried and is flagged so no purpose dials it again until the office
 * corrects it; a number the network cannot carry this kind of call to is not
 * retried either. The raw cause is kept on the hangup event (and so on the
 * call), and settling reads the table from there (dispatch/settle.ts).
 *
 * Pure: no clock, no I/O. `at` is supplied by the caller.
 */

import type { CallEvent } from '@/types/sampark';

export type HangupEvent = Extract<CallEvent, { type: 'hangup' }>;
export type HangupCause = HangupEvent['cause'];

export interface HangupCauseRule {
    /** The terminal call state this cause ends the call in. */
    cause: HangupCause;
    /** False: the intent ends ('done', not reached) instead of following the purpose's retry rule. */
    retryable: boolean;
    /** True: the number is dead, invalid or changed; a guardian's number is suppressed for every purpose. */
    invalidNumber: boolean;
}

const rule = (cause: HangupCause, retryable: boolean, invalidNumber = false): HangupCauseRule => ({ cause, retryable, invalidNumber });

/**
 * Telephony hangup causes (Q.850 names, as Vobiz sends them; the same vocabulary as
 * src/app/api/attendance/vobiz/status/route.ts) → what the call and the number become.
 * A cause not listed keeps the pre-H7 behaviour (see hangupCauseFromVobiz).
 */
export const HANGUP_CAUSE_TABLE: Readonly<Record<string, HangupCauseRule>> = {
    NORMAL_CLEARING: rule('completed', true),
    USER_BUSY: rule('busy', true),
    // Rang out, or the phone is switched off / out of coverage (EDGE_CASES telephony D05).
    NO_ANSWER: rule('no_answer', true),
    NO_USER_RESPONSE: rule('no_answer', true),
    TIMEOUT: rule('no_answer', true),
    ALLOTTED_TIMEOUT: rule('no_answer', true),
    SUBSCRIBER_ABSENT: rule('no_answer', true),
    // Rejected, cancelled or lost in the network: worth another attempt later (D06, D10).
    CALL_REJECTED: rule('failed', true),
    ORIGINATOR_CANCEL: rule('failed', true),
    NORMAL_CIRCUIT_CONGESTION: rule('failed', true),
    SWITCH_CONGESTION: rule('failed', true),
    NETWORK_OUT_OF_ORDER: rule('failed', true),
    NORMAL_TEMPORARY_FAILURE: rule('failed', true),
    RECOVERY_ON_TIMER_EXPIRE: rule('failed', true),
    NO_ROUTE_DESTINATION: rule('failed', true),
    // The number is dead, malformed or recycled: never retried, and flagged (D01).
    UNALLOCATED_NUMBER: rule('failed', false, true),
    INVALID_NUMBER_FORMAT: rule('failed', false, true),
    NUMBER_CHANGED: rule('failed', false, true),
    // The network cannot deliver this kind of call to the number: retrying cannot help.
    INCOMPATIBLE_DESTINATION: rule('failed', false),
};

/** The table's rule for a raw cause (any case), or undefined for a cause it does not know. */
export function hangupCauseRule(raw: string | null | undefined): HangupCauseRule | undefined {
    if (!raw) return undefined;
    const key = raw.trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(HANGUP_CAUSE_TABLE, key) ? HANGUP_CAUSE_TABLE[key] : undefined;
}

/** Longest raw cause kept on the call: Q.850 names are short, and the field must stay bounded. */
const MAX_CAUSE_LENGTH = 64;

/** Call statuses (`Status` / `CallStatus`), normalised to lower case with '-' and ' ' as '_'. */
const STATUS_MAP: Readonly<Record<string, HangupCause | 'completed_if_heard'>> = {
    completed: 'completed_if_heard',
    busy: 'busy',
    no_answer: 'no_answer',
    noanswer: 'no_answer',
    timeout: 'no_answer',
    failed: 'failed',
    canceled: 'failed',
    cancelled: 'failed',
    rejected: 'failed',
};

/** First present, non-empty value among `names`, as a trimmed string. Numbers are accepted. */
function pick(form: Readonly<Record<string, unknown>>, names: readonly string[]): string {
    for (const name of names) {
        const value = form[name];
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
        if (typeof value === 'string' && value.trim() !== '') return value.trim();
    }
    return '';
}

/** Whole non-negative seconds, or null when absent or not a number. */
function seconds(raw: string): number | null {
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** The carrier's cause name, upper case and bounded, or '' when it sent none. */
function rawHangupCause(form: Readonly<Record<string, unknown>>): string {
    return pick(form, ['HangupCause', 'hangup_cause', 'HangupCauseName']).toUpperCase().slice(0, MAX_CAUSE_LENGTH);
}

/** The cause the reducer records for this callback. Exported for tests. */
export function hangupCauseFromVobiz(form: Readonly<Record<string, unknown>>): HangupCause {
    const duration = seconds(pick(form, ['Duration', 'duration', 'CallDuration'])) ?? 0;
    const cause = rawHangupCause(form);
    if (cause) return hangupCauseRule(cause)?.cause ?? (duration > 0 ? 'completed' : 'failed');

    const status = pick(form, ['Status', 'CallStatus', 'status', 'call_status']).toLowerCase().replace(/[\s-]+/g, '_');
    const mapped = STATUS_MAP[status];
    if (mapped === 'completed_if_heard') return duration > 0 ? 'completed' : 'no_answer';
    if (mapped) return mapped;
    return duration > 0 ? 'completed' : 'failed';
}

/**
 * The reducer's hangup event for this callback. Typed as the hangup member of CallEvent.
 * Carries `hangupCause` (the raw name, upper case) only when the carrier sent one.
 */
export function hangupEventFromVobiz(form: Readonly<Record<string, unknown>>, at: string): HangupEvent {
    const cause = hangupCauseFromVobiz(form);
    const durationSeconds = seconds(pick(form, ['Duration', 'duration', 'CallDuration'])) ?? 0;
    const answered = cause === 'completed';
    const reportedBill = seconds(pick(form, ['BillDuration', 'bill_duration', 'BillableDuration']));
    const billedSeconds = reportedBill ?? (answered ? Math.max(1, Math.ceil(durationSeconds / 60)) * 60 : 0);
    const hangupCause = rawHangupCause(form);
    return { type: 'hangup', at, cause, durationSeconds, billedSeconds, ...(hangupCause ? { hangupCause } : {}) };
}
